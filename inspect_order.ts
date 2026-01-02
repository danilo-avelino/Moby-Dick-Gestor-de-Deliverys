
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkOrder() {
    const order = await prisma.order.findFirst({
        where: { externalId: '8551' },
        select: {
            metadata: true,
            orderDatetime: true,
            readyDatetime: true,
            outForDeliveryDatetime: true,
            deliveredDatetime: true,
            prepTime: true,
            pickupTime: true,
            deliveryTime: true,
            totalTime: true
        }
    });

    console.log(JSON.stringify(order, null, 2));
}

checkOrder();
