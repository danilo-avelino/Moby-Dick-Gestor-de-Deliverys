
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetPassword() {
    const email = 'herbhel@mobydick.net.br';
    const newPassword = 'password123';
    const hash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
        where: { email },
        data: { passwordHash: hash }
    });
    console.log(`Password for ${email} reset to ${newPassword}`);
}

resetPassword()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
