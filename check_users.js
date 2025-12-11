
const { PrismaClient } = require('./packages/database/dist/index.js'); // Adjust path if needed, or just use prisma from where it is generated.
// Actually, usually we can require form @prisma/client if installed in root node_modules or verify path.
// Let's try to import from @prisma/client assuming it's hoisted.

const { PrismaClient: PC } = require('@prisma/client');
const prisma = new PC();

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
        console.log(`Restaurant Name: ${u.restaurant ? u.restaurant.name : 'N/A'}`);
        console.log('------------------');
    });
}

checkUsers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
