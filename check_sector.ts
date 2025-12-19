
import { prisma } from './packages/database';

async function main() {
    const email = 'danilocaioavelino@gmail.com';
    const user = await prisma.user.findUnique({
        where: { email },
        include: { organization: true }
    });

    if (!user) {
        console.log('User not found');
        return;
    }

    console.log('User:', user);
    console.log('Organization:', user.organizationId);

    if (user.organizationId) {
        const sectors = await prisma.scheduleSector.findMany({
            where: { organizationId: user.organizationId }
        });
        console.log('Sectors:', sectors);
    } else {
        console.log('User has no organization.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
