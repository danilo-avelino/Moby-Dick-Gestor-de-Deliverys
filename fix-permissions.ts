import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = process.argv[2];

    if (!email) {
        console.error('Por favor, forneça o email do usuário como argumento.');
        console.error('Exemplo: npx tsx fix-permissions.ts admin@example.com');
        process.exit(1);
    }

    console.log(`Buscando usuário com email: ${email}...`);

    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        console.error('Usuário não encontrado!');
        process.exit(1);
    }

    console.log(`Usuário encontrado: ${user.firstName} ${user.lastName} (${user.role})`);

    if (user.role === 'DIRETOR') {
        console.log('Este usuário já é um DIRETOR.');
        return;
    }

    console.log('Atualizando permissões para DIRETOR...');

    await prisma.user.update({
        where: { id: user.id },
        data: { role: 'DIRETOR' }
    });

    console.log('Sucesso! O usuário agora tem acesso total (DIRETOR).');
}

main()
    .catch((e) => {
        console.error('Erro ao atualizar usuário:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
