import { prisma } from './packages/database/src/index';

async function main() {
    console.log('Prisma keys:', Object.keys(prisma).filter(k => !k.startsWith('_')));
}

main().catch(console.error);
