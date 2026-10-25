require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'ilovesurprisedotcom@gmail.com';
const ADMIN_PASSWORD = 'Dreambig1979$!';
const PRIMARY_ADMIN_FIRST_NAME = 'Osagie';
const PRIMARY_ADMIN_LAST_NAME = 'Enahio';

async function seedAdmin() {
  console.log(`Starting admin seed for: ${ADMIN_EMAIL}`);

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS admin_accounts (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) DEFAULT 'Super Administrator',
        role VARCHAR(64) DEFAULT 'SUPER_ADMIN',
        is_active BOOLEAN DEFAULT TRUE,
        notes TEXT,
        last_login_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('admin_accounts table checked/created successfully.');
  } catch (err) {
    console.warn('Note on table creation:', err.message);
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      firstName: PRIMARY_ADMIN_FIRST_NAME,
      lastName: PRIMARY_ADMIN_LAST_NAME,
      updatedAt: new Date(),
    },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      firstName: PRIMARY_ADMIN_FIRST_NAME,
      lastName: PRIMARY_ADMIN_LAST_NAME,
    },
  });

  await prisma.user.updateMany({
    where: {
      role: 'ADMIN',
      email: { not: ADMIN_EMAIL },
    },
    data: {
      role: 'CUSTOMER',
      isActive: false,
    },
  });

  try {
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO admin_accounts (id, email, name, role, is_active, notes, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (email) DO UPDATE
      SET role = EXCLUDED.role,
          name = EXCLUDED.name,
          is_active = EXCLUDED.is_active,
          notes = EXCLUDED.notes,
          updated_at = CURRENT_TIMESTAMP;
    `,
      `admin_${user.id}`,
      ADMIN_EMAIL,
      `${PRIMARY_ADMIN_FIRST_NAME} ${PRIMARY_ADMIN_LAST_NAME}`,
      'SUPER_ADMIN',
      true,
      'Primary super administrator account created via deployment configuration.'
    );

    await prisma.$executeRawUnsafe(
      'UPDATE admin_accounts SET is_active = FALSE, role = $1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) <> $2',
      'DISABLED',
      ADMIN_EMAIL
    );
    console.log('Admin account record synchronized.');
  } catch (err) {
    console.warn('Note on admin_accounts sync:', err.message);
  }

  const isValid = await bcrypt.compare(ADMIN_PASSWORD, user.passwordHash);
  console.log(`Primary password verification: ${isValid ? 'PASSED' : 'FAILED'}`);
  console.log(`Primary Email: ${ADMIN_EMAIL}`);
  console.log('Role: ADMIN');

  await prisma.$disconnect();
}

seedAdmin().catch((err) => {
  console.error('Admin seed error:', err);
  process.exit(1);
});
