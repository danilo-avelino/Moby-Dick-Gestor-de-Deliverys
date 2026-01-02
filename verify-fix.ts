
import { prisma } from './packages/database/src/index';
async function test() {
    console.log('Checking prisma.revenue...');
    if (prisma.revenue) {
        console.log('Success: prisma.revenue is defined');
        const count = await prisma.revenue.count();
        console.log('Current revenue count:', count);
    } else {
        console.log('Failure: prisma.revenue is NOT defined');
        console.log('Available models:', Object.keys(prisma).filter(k => !k.startsWith('$')));
    }
    process.exit(0);
}
test().catch(err => {
    console.error('Test Error:', err);
    process.exit(1);
});
