import { prisma } from 'database';
import { IntegrationInbox, InboxStatus } from 'database';

export class IntegrationInboxService {

    // Log a raw payload to the inbox
    async logIngestion(data: {
        integrationId: string;
        source: string;
        rawPayload: any;
        event?: string;
        externalId?: string;
        correlationId?: string;
    }): Promise<IntegrationInbox> {
        return prisma.integrationInbox.create({
            data: {
                integrationId: data.integrationId,
                source: data.source,
                event: data.event,
                rawPayload: data.rawPayload,
                externalId: data.externalId,
                correlationId: data.correlationId || crypto.randomUUID(),
                status: 'PENDING',
                receivedAt: new Date(),
            }
        });
    }

    // Mark as processed (and optionally save parsed data)
    async markProcessed(id: string, parsedPayload?: any): Promise<void> {
        await prisma.integrationInbox.update({
            where: { id },
            data: {
                status: 'PROCESSED',
                processedAt: new Date(),
                parsedPayload: parsedPayload ?? undefined
            }
        });
    }

    // Mark as failed
    async markFailed(id: string, errorMessage: string): Promise<void> {
        // Increment retries
        await prisma.integrationInbox.update({
            where: { id },
            data: {
                status: 'FAILED',
                errorMessage: errorMessage.substring(0, 500), // Truncate fit
                retriesCount: { increment: 1 }
            }
        });
    }

    // Mark as ignored (e.g. heartbeat or irrelevant event)
    async markIgnored(id: string, reason?: string): Promise<void> {
        await prisma.integrationInbox.update({
            where: { id },
            data: {
                status: 'IGNORED',
                errorMessage: reason,
                processedAt: new Date(),
            }
        });
    }

    // Get pending items for an integration
    async getPendingItems(integrationId: string, limit = 10) {
        return prisma.integrationInbox.findMany({
            where: {
                integrationId,
                status: 'PENDING'
            },
            orderBy: { receivedAt: 'asc' },
            take: limit
        });
    }

    // Get inbox items for inspector
    async listItems(filters: {
        integrationId?: string;
        status?: InboxStatus;
        startDate?: Date;
        endDate?: Date;
        page?: number;
        pageSize?: number;
    }) {
        const { integrationId, status, startDate, endDate, page = 1, pageSize = 50 } = filters;
        const skip = (page - 1) * pageSize;

        const where: any = {};
        if (integrationId) where.integrationId = integrationId;
        if (status) where.status = status;
        if (startDate || endDate) {
            where.receivedAt = {};
            if (startDate) where.receivedAt.gte = startDate;
            if (endDate) where.receivedAt.lte = endDate;
        }

        const [items, total] = await Promise.all([
            prisma.integrationInbox.findMany({
                where,
                include: { integration: { select: { name: true, platform: true } } },
                orderBy: { receivedAt: 'desc' },
                skip,
                take: pageSize
            }),
            prisma.integrationInbox.count({ where })
        ]);

        return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }
}

export const integrationInboxService = new IntegrationInboxService();
