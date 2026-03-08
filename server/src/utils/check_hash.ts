import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst({
        orderBy: { createdAt: 'desc' }
    });
    console.log(user);
    const bcrypt = require('bcrypt');
    if (user) {
        // try to compare 'password' since the user said 'exact same password'
        // let's assume the user was testing with 'password'
        console.log("Is equal to 'password'?", await bcrypt.compare('password', user.passwordHash));
        console.log("Is equal to '123456'?", await bcrypt.compare('123456', user.passwordHash));
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
