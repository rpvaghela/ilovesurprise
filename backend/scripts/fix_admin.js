require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const updated = await prisma.user.update({
    where: { email: 'ilovesurprisedotcom@gmail.com' },
    data: { role: 'ADMIN', isActive: true }
  });
  console.log('Successfully updated user to ADMIN:', {
    email: updated.email,
    role: updated.role,
    isActive: updated.isActive
  });
  await prisma.$disconnect();
}

run().catch(console.error);
