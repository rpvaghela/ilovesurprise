require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true }
  });
  console.log('Admins in DB:', admins);

  const targetUser = await prisma.user.findUnique({
    where: { email: 'ilovesurprisedotcom@gmail.com' },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true }
  });
  console.log('Target User in DB:', targetUser);

  await prisma.$disconnect();
}

run().catch(console.error);
