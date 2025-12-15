
import { prisma } from 'database';

async function main() {
    const email = 'super@moby.com';
    console.log(`Checking for user: ${email}`);

    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            organization: true,
            costCenter: true
        }
    });

    if (user) {
        console.log('User found!');
        console.log('ID:', user.id);
        console.log('Role:', user.role);
        console.log('Active:', user.isActive);
        console.log('Organization:', user.organization?.name);
    } else {
        console.log('User NOT found.');

        // List verified users
        const users = await prisma.user.findMany({ take: 5 });
        console.log('Available users:');
        users.forEach(u => console.log(`- ${u.email} (${u.role})`));
    }
}

main();
