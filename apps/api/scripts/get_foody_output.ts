
import { prisma } from 'database';
import { FoodyAdapter } from '../src/services/integrations/adapters/foody';
import { IntegrationConfig } from '../src/services/integrations/types';

async function main() {
    try {
        const date = process.argv[2] || '2025-12-22';
        console.log(`--- Fetching Foody Orders for ${date} ---`);

        // Find any active Foody integration
        const integration = await prisma.integration.findFirst({
            where: {
                platform: 'FOODY',
                status: 'CONNECTED'
            }
        });

        if (!integration) {
            console.error('❌ No active Foody integration found in database.');
            process.exit(1);
        }

        console.log(`✅ Using Integration: ${integration.name} (${integration.id})`);

        const config: IntegrationConfig = {
            integrationId: integration.id,
            platform: 'FOODY',
            type: 'sales',
            credentials: integration.credentials as any,
            sandboxMode: false,
            costCenterId: integration.costCenterId,
            organizationId: integration.organizationId || undefined,
        };

        const adapter = new FoodyAdapter(config);

        const startDate = `${date}T00:00:00-03:00`;
        const endDate = `${date}T23:59:59-03:00`;

        console.log(`URL Params: startDate=${startDate}&endDate=${endDate}`);

        const orders = await adapter.fetchOrdersBatch(startDate, endDate);

        console.log(`\n--- RESULTS (${orders.length} orders) ---`);
        console.log(JSON.stringify(orders, null, 2));

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
