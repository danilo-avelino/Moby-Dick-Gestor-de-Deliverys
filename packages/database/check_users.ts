import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
    const emails = ['admin@burgerhouse.com.br', 'herbhel@mobydick.net.br'];

    const users = await prisma.user.findMany({
        where: { email: { in: emails } },
        include: { restaurant: true }
    });

    console.log('--- User Check ---');
    users.forEach(u => {
        console.log(`User: ${u.email}`);
        console.log(`Role: ${u.role}`);
        console.log(`Restaurant ID: ${u.restaurantId}`);
        console.log(`Restaurant Name: ${u.restaurant?.name || 'N/A'}`);
        console.log('------------------');
    });
}

checkUsers()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
