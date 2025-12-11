
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixUser() {
    const email = 'herbhel@mobydick.net.br';
    const targetRestaurantId = 'cmj075by50000f5nfaf0iwgey'; // Burger House

    console.log(`Updating ${email} to Restaurant ID: ${targetRestaurantId}...`);

    const user = await prisma.user.update({
        where: { email },
        data: { restaurantId: targetRestaurantId }
    });

    console.log('Update success!');
    console.log(`User: ${user.email}`);
    console.log(`New Restaurant ID: ${user.restaurantId}`);
}

fixUser()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
