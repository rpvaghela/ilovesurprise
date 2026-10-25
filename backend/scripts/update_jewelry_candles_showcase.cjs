require('dotenv').config();

const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({
    where: {
      email: 'ilovesurprisedotcom@gmail.com',
      role: 'ADMIN',
      isActive: true,
    },
    select: { id: true, email: true, role: true },
  });

  if (!admin) {
    throw new Error('Active Osagie super admin account was not found.');
  }

  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    process.env.JWT_SECRET || 'supersecretkeychangeinproduction',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const response = await fetch('http://localhost:3000/api/admin/storefront/showcase/jewelry-candy', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      displayTitle: 'Jewelry Candles',
      ctaButtonText: 'Shop Jewelry Candles',
      targetCategoryKey: 'Jewelry Candles',
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Showcase update failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  console.log('Updated live showcase card:', {
    cardKey: payload.data?.showcaseCard?.cardKey,
    title: payload.data?.showcaseCard?.displayTitle,
    cta: payload.data?.showcaseCard?.ctaButtonText,
    targetCategoryKey: payload.data?.showcaseCard?.targetCategoryKey,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
