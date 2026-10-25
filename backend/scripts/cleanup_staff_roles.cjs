const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const protectedAdminEmails = new Set([
  'ilovesurprisedotcom@gmail.com',
]);

async function main() {
  const staffUsers = await prisma.user.findMany({
    where: {
      OR: [{ role: 'STAFF' }, { role: 'ADMIN' }],
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

  const removable = staffUsers.filter((user) => !protectedAdminEmails.has(user.email.toLowerCase()));

  if (removable.length > 0) {
    await prisma.user.updateMany({
      where: {
        id: { in: removable.map((user) => user.id) },
      },
      data: {
        role: 'CUSTOMER',
        isActive: false,
      },
    });
  }

  const remaining = await prisma.user.findMany({
    where: {
      OR: [{ role: 'STAFF' }, { role: 'ADMIN' }],
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
    },
    orderBy: { email: 'asc' },
  });

  console.log(`Removed ${removable.length} non-protected staff role account(s).`);
  console.table(
    remaining.map((user) => ({
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
      role: user.role,
      active: user.isActive,
    }))
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
