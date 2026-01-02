import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
    console.log('--- Verificando usuário: hollywoodsteakburger@gmail.com ---');
    try {
        const user = await prisma.user.findUnique({
            where: { email: 'hollywoodsteakburger@gmail.com' },
            include: {
                organization: { select: { name: true, status: true } },
                costCenter: { select: { name: true, isActive: true } }
            }
        });

        if (user) {
            console.log('Usuário encontrado:');
            console.log(JSON.stringify({
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                isActive: user.isActive,
                organization: user.organization?.name,
                orgStatus: user.organization?.status,
                costCenter: user.costCenter?.name,
                ccActive: user.costCenter?.isActive
            }, null, 2));
        } else {
            console.log('Usuário NÃO encontrado no banco de dados.');

            // Buscar usuários similares
            const similar = await prisma.user.findMany({
                where: { email: { contains: 'hollywood', mode: 'insensitive' } },
                select: { email: true }
            });
            if (similar.length > 0) {
                console.log('Usuários similares encontrados:', similar.map(u => u.email));
            }
        }

        // Verificar logs de acesso ou auditoria se existirem campos relevantes
        const stats = await prisma.user.count();
        console.log(`\nTotal de usuários no banco: ${stats}`);

    } catch (error) {
        console.error('Erro ao consultar o banco:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkUser();
