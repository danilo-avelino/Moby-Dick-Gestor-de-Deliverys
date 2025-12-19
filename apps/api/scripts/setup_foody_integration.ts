
import { prisma } from 'database';

async function main() {
    const apiToken = process.argv[2];

    if (!apiToken) {
        console.error('❌ Please provide the Foody API Token as an argument.');
        console.log('Usage: npx tsx scripts/setup_foody_integration.ts YOUR_TOKEN_HERE');
        process.exit(1);
    }

    const costCenterId = 'cmj9amvgt0001r50i8dml5dth'; // Terra Querida core id
    const organizationId = 'cmj6e2k3600017121j44dpdoi';

    try {
        console.log(`Setting up Foody integration for Cost Center ${costCenterId}...`);

        const integration = await prisma.integration.upsert({
            where: {
                costCenterId_platform_externalId: {
                    costCenterId,
                    platform: 'FOODY',
                    externalId: 'terra-querida-foody' // Unique identifier for this integration instance
                }
            },
            update: {
                credentials: { apiToken },
                status: 'CONNECTED',
                organizationId
            },
            create: {
                costCenterId,
                organizationId,
                platform: 'FOODY',
                name: 'Foody Logistics - Terra Querida',
                status: 'CONNECTED',
                credentials: { apiToken },
                externalId: 'terra-querida-foody'
            }
        });

        console.log('✅ Integration record created/updated successfully!');
        console.log('Integration ID:', integration.id);
        console.log('Status:', integration.status);

    } catch (error) {
        console.error('❌ Error setting up integration:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
