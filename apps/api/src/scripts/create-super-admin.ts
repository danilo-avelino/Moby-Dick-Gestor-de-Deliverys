
import { PrismaClient } from 'database';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Criando usuário SUPER ADMIN...');

    const email = 'super@moby.com';
    const password = '123456';
    const passwordHash = await bcrypt.hash(password, 10);

    // Ensure default organization exists
    let org = await prisma.organization.findFirst({
        where: { slug: 'moby-dick-default' }
    });

    if (!org) {
        org = await prisma.organization.create({
            data: {
                name: 'Moby Dick Default',
                slug: 'moby-dick-default',
                status: 'ACTIVE'
            }
        });
    }

    // Upsert user
    const user = await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash,
            role: 'SUPER_ADMIN',
            organizationId: org.id,
            scope: 'ORG'
        },
        create: {
            email,
            firstName: 'Super',
            lastName: 'Admin',
            passwordHash,
            role: 'SUPER_ADMIN',
            organizationId: org.id,
            scope: 'ORG'
        }
    });

    console.log('=== CREDENCIAIS SUPER ADMIN ===');
    console.log(`Email: ${email}`);
    console.log(`Senha: ${password}`);
    console.log(`Org ID: ${org.id}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
