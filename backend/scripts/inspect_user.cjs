require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const allUsers = await prisma.user.findMany();
  console.log('ALL USERS:', JSON.stringify(allUsers, null, 2));

  const allAffiliates = await prisma.affiliate_profiles.findMany();
  console.log('ALL AFFILIATES:', JSON.stringify(allAffiliates, null, 2));
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
