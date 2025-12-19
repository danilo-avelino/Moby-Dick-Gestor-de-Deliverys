
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking admin user...');
    const email = 'admin@burgerhouse.com.br';
    const user = await prisma.user.findUnique({
        where: { email },
        include: { organization: true }
    });

    console.log('User found:', user?.email);
    console.log('OrganizationId:', user?.organizationId);

    if (!user) {
        console.error('User not found!');
        return;
    }

    if (!user.organizationId) {
        console.log('User has NO organization. Fetching available orgs...');
        const orgs = await prisma.organization.findMany();
        console.log('Available Orgs:', orgs.map(o => ({ id: o.id, name: o.name })));

        if (orgs.length > 0) {
            console.log(`Assigning user to first org: ${orgs[0].name} (${orgs[0].id})`);
            await prisma.user.update({
                where: { id: user.id },
                data: { organizationId: orgs[0].id }
            });
            console.log('User updated successfully.');
        } else {
            console.log('No organizations found! Creating one...');
            const newOrg = await prisma.organization.create({
                data: {
                    name: 'Burger House HQ',
                    slug: 'burger-house-hq',
                    status: 'ACTIVE'
                }
            });
            console.log('Created Org:', newOrg);
            await prisma.user.update({
                where: { id: user.id },
                data: { organizationId: newOrg.id }
            });
            console.log('User assigned to new org.');
        }
    } else {
        console.log('User already has an organization.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
