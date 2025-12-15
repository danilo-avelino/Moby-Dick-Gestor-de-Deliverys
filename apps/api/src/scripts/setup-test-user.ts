
import { PrismaClient } from 'database';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Procurando usuário DIRETOR...');

    const director = await prisma.user.findFirst({
        where: { role: 'DIRETOR' }
    });

    const passwordHash = await bcrypt.hash('123456', 10);

    let user;

    if (director) {
        console.log(`Usuário encontrado: ${director.email}. Resetando senha...`);
        user = await prisma.user.update({
            where: { id: director.id },
            data: { passwordHash: passwordHash }
        });
    } else {
        console.log('Nenhum DIRETOR encontrado. Criando admin_test@moby.com...');
        user = await prisma.user.create({
            data: {
                email: 'admin_test@moby.com',
                firstName: 'Admin',
                lastName: 'Test',
                passwordHash: passwordHash,
                role: 'DIRETOR',
            }
        });
    }

    console.log('=== CREDENCIAIS PARA TESTE ===');
    console.log(`Email: ${user.email}`);
    console.log('Senha: 123456');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
