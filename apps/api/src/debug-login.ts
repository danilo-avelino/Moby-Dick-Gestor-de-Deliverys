
import { prisma } from 'database';
import bcrypt from 'bcryptjs';

async function main() {
    console.log('Starting debug login...');
    const email = 'admin@burgerhouse.com.br';
    const password = 'password123';

    try {
        console.log(`1. Finding user with email: ${email}`);
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                costCenter: true,
                organization: true
            },
        });

        if (!user) {
            console.error('ERROR: User not found in DB');
            return;
        }
        console.log('User found:', user.email, 'Role:', user.role);

        if (!user.isActive) {
            console.error('ERROR: User is inactive');
            return;
        }

        console.log('2. Verifying password...');
        console.log('Stored Hash:', user.passwordHash);
        const validPassword = await bcrypt.compare(password, user.passwordHash);

        if (!validPassword) {
            console.error('ERROR: Password check failed');
            return;
        }
        console.log('Password check PASSED');

        console.log('3. Inspecting relations...');
        console.log('Organization:', user.organization ? user.organization.name : 'NULL');
        console.log('CostCenter:', user.costCenter ? user.costCenter.name : 'NULL');

        console.log('LOGIN DEBUG SUCCESSFUL');

    } catch (err) {
        console.error('EXCEPTION during debug:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
