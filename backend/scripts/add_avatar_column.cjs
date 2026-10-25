require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;');
  console.log('Successfully added avatar column to users table.');

  const cols = await prisma.$queryRawUnsafe("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'public';");
  console.log('public.users columns:', cols);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
