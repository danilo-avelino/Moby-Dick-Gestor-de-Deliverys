
import { prisma } from 'database';

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.log('Please provide an email');
        process.exit(1);
    }

    const user = await prisma.user.findUnique({
        where: { email },
        include: { organization: true, restaurant: true }
    });

    if (user) {
        console.log('User found:', JSON.stringify(user, null, 2));
    } else {
        console.log('User not found');
    }
}

main().catch(console.error);
