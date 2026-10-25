require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'ilovesurprisedotcom@gmail.com';
const ADMIN_NAME = 'Osagie Enahio';

async function main() {
  const user = await prisma.user.update({
    where: { email: ADMIN_EMAIL },
    data: {
      firstName: 'Osagie',
      lastName: 'Enahio',
      role: 'ADMIN',
      isActive: true,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
    },
  });

  try {
    await prisma.$executeRawUnsafe(
      'UPDATE admin_accounts SET name = $1, role = $2, is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE email = $3',
      ADMIN_NAME,
      'SUPER_ADMIN',
      ADMIN_EMAIL
    );
  } catch (err) {
    console.warn('admin_accounts sync skipped:', err.message);
  }

  console.log('Super admin updated:', user);
}

main()
  .catch((err) => {
    console.error('Failed to update super admin:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
