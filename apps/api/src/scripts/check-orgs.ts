
import { prisma } from 'database';

async function main() {
    const orgs = await prisma.organization.findMany({
        include: { restaurants: true, users: true }
    });
    console.log('Organizations found:', JSON.stringify(orgs, null, 2));
}

main().catch(console.error);
