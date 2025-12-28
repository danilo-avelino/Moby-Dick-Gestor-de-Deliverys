
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';

const PublicRevenueSchema = z.object({
    date: z.string().or(z.date()).transform(d => new Date(d)),
    amount: z.number().min(0),
    notes: z.string().optional(),
});

export async function publicRevenueRoutes(fastify: FastifyInstance) {
    // Get Restaurant Info (for confirmation on frontend)
    fastify.get<{ Params: { costCenterId: string } }>('/:costCenterId/info', {
        schema: {
            tags: ['Public', 'Financial'],
            summary: 'Get public info for revenue submission',
            params: {
                type: 'object',
                properties: {
                    costCenterId: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { costCenterId } = request.params;

        const costCenter = await prisma.costCenter.findUnique({
            where: { id: costCenterId },
            select: {
                id: true,
                name: true,
                tradeName: true,
                logoUrl: true,
                currency: true
            }
        });

        if (!costCenter) {
            return reply.status(404).send({ success: false, error: 'Restaurant not found' });
        }

        return reply.send({ success: true, data: costCenter });
    });

    // Create Public Revenue
    fastify.post<{
        Params: { costCenterId: string },
        Body: z.infer<typeof PublicRevenueSchema>
    }>('/:costCenterId', {
        schema: {
            tags: ['Public', 'Financial'],
            summary: 'Submit revenue publicly',
            params: {
                type: 'object',
                properties: {
                    costCenterId: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { costCenterId } = request.params;

        try {
            const payload = PublicRevenueSchema.parse(request.body);

            // Verify existence
            const costCenter = await prisma.costCenter.findUnique({
                where: { id: costCenterId }
            });

            if (!costCenter) {
                return reply.status(404).send({ success: false, error: 'Restaurant not found' });
            }

            // Create Revenue
            // Note: startDate and endDate are the same for daily submission
            const revenue = await prisma.revenue.create({
                data: {
                    costCenterId,
                    startDate: payload.date,
                    endDate: payload.date,
                    totalAmount: payload.amount,
                    notes: payload.notes ? `${payload.notes} (Via Link Público)` : '(Via Link Público)',
                    createdByUserId: null // Explicitly null
                }
            });

            return reply.send({ success: true, data: revenue });

        } catch (error) {
            console.error('Error creating public revenue:', error);
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ success: false, error: 'Validation Error', details: error.errors });
            }
            return reply.status(500).send({ success: false, error: 'Internal Server Error' });
        }
    });

    // Get Stats (KPIs)
    fastify.get<{ Params: { costCenterId: string } }>('/:costCenterId/stats', {
        schema: {
            tags: ['Public', 'Financial'],
            summary: 'Get public revenue stats (KPIs)',
            params: {
                type: 'object',
                properties: { costCenterId: { type: 'string' } }
            }
        }
    }, async (request, reply) => {
        const { costCenterId } = request.params;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Previous Month
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // Fetch Current Month Revenue
        const currentMonthRevenue = await prisma.revenue.aggregate({
            where: {
                costCenterId,
                startDate: { gte: startOfMonth, lte: endOfMonth }
            },
            _sum: { totalAmount: true }
        });

        // Fetch Last Month Revenue
        const lastMonthRevenue = await prisma.revenue.aggregate({
            where: {
                costCenterId,
                startDate: { gte: startOfLastMonth, lte: endOfLastMonth }
            },
            _sum: { totalAmount: true }
        });

        const currentTotal = currentMonthRevenue._sum.totalAmount || 0;
        const lastTotal = lastMonthRevenue._sum.totalAmount || 0;

        // Forecast
        const daysInMonth = endOfMonth.getDate();
        const daysPassed = now.getDate(); // Including today partial? Let's assume inclusive or exclusive depending on simple projection.
        // Simple projection: (Current / DaysPassed) * DaysInMonth
        // Or better: Avg Daily * DaysInMonth
        // Ensure at least 1 day passed to avoid Infinity
        let forecast = 0;
        if (daysPassed > 0) {
            const avgDaily = currentTotal / daysPassed;
            forecast = avgDaily * daysInMonth;
        }

        return reply.send({
            success: true,
            data: {
                currentMonth: currentTotal,
                lastMonth: lastTotal,
                forecast: forecast,
                monthName: startOfMonth.toLocaleString('pt-BR', { month: 'long' }),
                lastMonthName: startOfLastMonth.toLocaleString('pt-BR', { month: 'long' })
            }
        });
    });

    // Get Calendar List
    fastify.get<{ Params: { costCenterId: string }, Querystring: { month?: string } }>('/:costCenterId/list', {
        schema: {
            tags: ['Public', 'Financial'],
            summary: 'List revenues for calendar',
            params: {
                type: 'object',
                properties: { costCenterId: { type: 'string' } }
            },
            querystring: {
                type: 'object',
                properties: { month: { type: 'string' } }
            }
        }
    }, async (request, reply) => {
        const { costCenterId } = request.params;
        const { month } = request.query; // YYYY-MM

        let start = new Date();
        start.setDate(1); // Default to current month start
        if (month) {
            const [y, m] = month.split('-');
            start = new Date(parseInt(y), parseInt(m) - 1, 1);
        } else {
            start = new Date(start.getFullYear(), start.getMonth(), 1);
        }

        const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

        const revenues = await prisma.revenue.findMany({
            where: {
                costCenterId,
                startDate: { gte: start, lte: end }
            },
            orderBy: { startDate: 'asc' }
        });

        return reply.send({ success: true, data: revenues });
    });
}
