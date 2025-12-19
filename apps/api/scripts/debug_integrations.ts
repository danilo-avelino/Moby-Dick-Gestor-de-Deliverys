
import { prisma } from 'database';

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

        console.log('Listing all integrations for this cost center...');
        const integrations = await prisma.integration.findMany({
            where: {
                costCenterId: costCenter.id,
            }
        });

        if (integrations.length === 0) {
            console.log('No integrations found for this cost center.');
            console.log('Cost Center details:', {
                id: costCenter.id,
                name: costCenter.name,
                organizationId: costCenter.organizationId
            });
        } else {
            console.table(integrations.map(i => ({
                id: i.id,
                platform: i.platform,
                status: i.status,
                organizationId: i.organizationId
            })));
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
