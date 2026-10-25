require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `);

  console.log('Searching all tables for "chetan"...');
  for (const t of tables) {
    const tableName = t.table_name;
    try {
      const res = await prisma.$queryRawUnsafe(`SELECT * FROM "${tableName}" WHERE CAST("${tableName}".* AS text) ILIKE '%chetan%';`);
      if (res && res.length > 0) {
        console.log(`FOUND IN ${tableName}:`, JSON.stringify(res, null, 2));
      }
    } catch (err) {
      // ignore table if cannot cast
    }
  }
  console.log('Search completed.');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
