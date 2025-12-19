
import { prisma } from 'database';
import { FoodyAdapter } from '../src/services/integrations/adapters/foody';
import { IntegrationConfig } from '../src/services/integrations/types';

async function main() {
    try {
        console.log('Searching for "Terra Querida" cost center...');
        const costCenter = await prisma.costCenter.findFirst({
            where: {
                name: {
                    contains: 'Terra Querida',
                    mode: 'insensitive'
                }
            }
        });

        if (!costCenter) {
            console.error('❌ Cost Center "Terra Querida" not found.');
            process.exit(1);
        }

        console.log(`✅ Found Cost Center: ${costCenter.name} (${costCenter.id})`);

        console.log('Searching for Foody integration...');
        const integration = await prisma.integration.findFirst({
            where: {
                costCenterId: costCenter.id,
                platform: 'FOODY',
                status: { in: ['CONFIGURED', 'CONNECTED', 'INGESTING'] }
            }
        });

        if (!integration) {
            console.error('❌ Active Foody integration not found for this cost center.');
            process.exit(1);
        }

        console.log(`✅ Found Integration: ${integration.id}`);

        const config: IntegrationConfig = {
            integrationId: integration.id,
            platform: 'foody',
            type: 'logistics',
            credentials: integration.credentials as any,
            sandboxMode: false,
            costCenterId: integration.costCenterId,
            organizationId: integration.organizationId || undefined,
        };

        const adapter = new FoodyAdapter(config);

        // Authenticate (optional, but good practice if it does anything)
        if (adapter.authenticate) {
            await adapter.authenticate();
        }

        const date = '2025-12-16';
        const startDate = `${date}T00:00:00-03:00`;
        const endDate = `${date}T23:59:59-03:00`;
        console.log(`Fetching orders from ${startDate} to ${endDate}...`);

        const orders = await adapter.fetchOrdersBatch(startDate, endDate);

        console.log(`✅ Fetched ${orders.length} orders.`);
        console.log(JSON.stringify(orders, null, 2));

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
