
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
console.log('Prisma models:', Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')));
if (prisma.revenue) {
    console.log('Success: Revenue model found');
} else {
    console.log('Failure: Revenue model NOT found');
}
process.exit(0);
