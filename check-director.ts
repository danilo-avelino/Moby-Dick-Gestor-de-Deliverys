
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const director = await prisma.user.findFirst({
        where: { role: 'DIRETOR' }
    });

    if (director) {
        console.log(`FOUND: ${director.email}`);
    } else {
        console.log('NOT_FOUND');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
