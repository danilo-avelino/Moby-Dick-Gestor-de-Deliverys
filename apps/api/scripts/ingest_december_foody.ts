
import { prisma } from 'database';
import { integrationManager } from '../src/services/integrations/integration-manager';
import { FoodyAdapter } from '../src/services/integrations/adapters/foody';

async function main() {
    try {
        console.log('--- Starting December 2025 Ingestion (Resilient) ---');

        const integration = await prisma.integration.findFirst({
            where: { platform: 'FOODY', status: 'CONNECTED' }
        });

        if (!integration) {
            console.error('❌ No active Foody integration found.');
            process.exit(1);
        }

        let adapter = integrationManager.getIntegration(integration.id)?.adapter as FoodyAdapter;
        if (!adapter) {
            await integrationManager.addIntegration({
                id: integration.id,
                platform: integration.platform,
                type: 'sales',
                credentials: integration.credentials as any,
                syncInterval: integration.syncFrequencyMinutes,
                organizationId: integration.organizationId || undefined,
                costCenterId: integration.costCenterId,
            });
            adapter = integrationManager.getIntegration(integration.id)?.adapter as FoodyAdapter;
        }

        for (let day = 1; day <= 31; day++) {
            const dateStr = `2025-12-${day.toString().padStart(2, '0')}`;
            const startStr = `${dateStr}T00:00:00-03:00`;
            const endStr = `${dateStr}T23:59:59-03:00`;

            console.log(`\n[${dateStr}] Fetching...`);

            try {
                const orders = await adapter.fetchOrdersBatch(startStr, endStr);
                console.log(`✅ Received ${orders.length} orders.`);

                let processedCount = 0;
                for (const order of orders) {
                    const orderId = order.id || order.orderId || order.uid;
                    if (!orderId) {
                        console.warn('Skipping order without ID:', JSON.stringify(order).substring(0, 100));
                        continue;
                    }

                    // Log to inbox
                    const inbox = await prisma.integrationInbox.create({
                        data: {
                            integrationId: integration.id,
                            source: 'foody',
                            event: 'order.backfill',
                            externalId: orderId.toString(),
                            rawPayload: order as any,
                            status: 'PENDING'
                        }
                    });

                    // Process immediately
                    await adapter.processPayload(inbox);
                    processedCount++;
                }
                console.log(`✅ Processed ${processedCount} orders.`);
            } catch (err) {
                console.error(`❌ Error on ${dateStr}:`, err);
            }
        }

        console.log('\n--- Done ---');

    } catch (error) {
        console.error('❌ Global error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
