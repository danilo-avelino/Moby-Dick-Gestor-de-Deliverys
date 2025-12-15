import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { requireCostCenter } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import type { ApiResponse } from 'types';

const addPaymentSchema = z.object({
    method: z.enum(['DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'VALE_REFEICAO', 'VALE_ALIMENTACAO', 'CORTESIA']),
    amount: z.number().positive(),
    receivedAmount: z.number().min(0).optional(),
    cardBrand: z.string().optional(),
    cardLastDigits: z.string().optional(),
    authorizationCode: z.string().optional(),
    notes: z.string().optional(),
});

export async function pdvPaymentsRoutes(fastify: FastifyInstance) {
    // Add payment to order
    fastify.post<{ Params: { orderId: string } }>('/orders/:orderId/payments', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV'],
            summary: 'Add payment to order',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const body = addPaymentSchema.parse(request.body);
        const restaurantId = request.user?.costCenterId;

        // Get order
        const where: any = { id: request.params.orderId };
        if (restaurantId) {
            where.restaurantId = restaurantId;
        }

        const order = await prisma.pdvOrder.findFirst({
            where,
            include: { payments: true },
        });

        if (!order) {
            throw errors.notFound('Order not found');
        }

        // Check if order can receive payment
        if (['CANCELADO'].includes(order.status)) {
            throw errors.badRequest('Cannot add payment to cancelled order');
        }

        // Calculate remaining amount
        const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
        const remaining = order.total - totalPaid;

        if (body.amount > remaining + 0.01) { // Small tolerance for floating point
            throw errors.badRequest(`Payment amount exceeds remaining balance (R$ ${remaining.toFixed(2)})`);
        }

        // Calculate change for cash payments
        let changeAmount = 0;
        if (body.method === 'DINHEIRO' && body.receivedAmount) {
            changeAmount = Math.max(0, body.receivedAmount - body.amount);
        }

        // Create payment and update order in transaction
        const [payment] = await prisma.$transaction(async (tx) => {
            const newPayment = await tx.pdvPayment.create({
                data: {
                    orderId: order.id,
                    method: body.method as any,
                    status: 'PAGO',
                    amount: body.amount,
                    receivedAmount: body.receivedAmount,
                    changeAmount,
                    cardBrand: body.cardBrand,
                    cardLastDigits: body.cardLastDigits,
                    authorizationCode: body.authorizationCode,
                    notes: body.notes,
                    processedAt: new Date(),
                },
            });

            // Update order totals
            const newTotalPaid = totalPaid + body.amount;
            await tx.pdvOrder.update({
                where: { id: order.id },
                data: {
                    totalPaid: newTotalPaid,
                    changeAmount: changeAmount,
                },
            });

            // Register cash movement if there's an open cash session
            const cashSession = await tx.cashSession.findFirst({
                where: {
                    restaurantId: restaurantId!,
                    status: 'ABERTO',
                },
            });

            if (cashSession) {
                await tx.cashMovement.create({
                    data: {
                        cashSessionId: cashSession.id,
                        type: 'VENDA',
                        description: `Pedido #${order.code} - ${body.method}`,
                        amount: body.amount,
                        paymentMethod: body.method as any,
                        orderId: order.id,
                        orderCode: order.code,
                        userId: request.user!.id,
                    },
                });

                // Update cash session totals
                const updateData: any = {
                    totalSales: { increment: body.amount },
                };

                if (body.method === 'DINHEIRO') {
                    updateData.totalCashSales = { increment: body.amount };
                    updateData.expectedBalance = { increment: body.amount - changeAmount };
                } else if (body.method === 'PIX') {
                    updateData.totalPixSales = { increment: body.amount };
                } else if (['CARTAO_CREDITO', 'CARTAO_DEBITO'].includes(body.method)) {
                    updateData.totalCardSales = { increment: body.amount };
                } else {
                    updateData.totalOtherSales = { increment: body.amount };
                }

                await tx.cashSession.update({
                    where: { id: cashSession.id },
                    data: updateData,
                });
            }

            return [newPayment];
        });

        const response: ApiResponse = {
            success: true,
            data: {
                ...payment,
                createdAt: payment.createdAt.toISOString(),
            },
        };

        return reply.status(201).send(response);
    });

    // List payments for order
    fastify.get<{ Params: { orderId: string } }>('/orders/:orderId/payments', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV'],
            summary: 'List payments for order',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const where: any = { id: request.params.orderId };
        if (request.user?.costCenterId) {
            where.restaurantId = request.user.costCenterId;
        }

        const order = await prisma.pdvOrder.findFirst({
            where,
            include: {
                payments: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!order) {
            throw errors.notFound('Order not found');
        }

        const response: ApiResponse = {
            success: true,
            data: {
                payments: order.payments.map(p => ({
                    ...p,
                    createdAt: p.createdAt.toISOString(),
                })),
                total: order.total,
                totalPaid: order.totalPaid,
                remaining: order.total - order.totalPaid,
            },
        };

        return reply.send(response);
    });

    // Refund payment
    fastify.post<{ Params: { paymentId: string } }>('/payments/:paymentId/refund', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['PDV'],
            summary: 'Refund a payment',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const payment = await prisma.pdvPayment.findUnique({
            where: { id: request.params.paymentId },
            include: {
                order: true,
            },
        });

        if (!payment) {
            throw errors.notFound('Payment not found');
        }

        if (request.user?.costCenterId && payment.order.restaurantId !== request.user.costCenterId) {
            throw errors.forbidden('Access denied');
        }

        if (payment.status === 'ESTORNADO') {
            throw errors.badRequest('Payment already refunded');
        }

        await prisma.$transaction([
            prisma.pdvPayment.update({
                where: { id: payment.id },
                data: { status: 'ESTORNADO' },
            }),
            prisma.pdvOrder.update({
                where: { id: payment.orderId },
                data: {
                    totalPaid: { decrement: payment.amount },
                },
            }),
        ]);

        const response: ApiResponse = {
            success: true,
            data: { message: 'Payment refunded successfully' },
        };

        return reply.send(response);
    });
}
