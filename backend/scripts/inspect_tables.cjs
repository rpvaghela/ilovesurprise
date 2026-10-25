require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const memberships = await prisma.user_memberships.findMany();
  console.log('user_memberships:', memberships);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
