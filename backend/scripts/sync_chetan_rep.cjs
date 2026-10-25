require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function run() {
  const email = 'chetansonawane1260@gmail.com';
  const username = 'chetansonawane1260';
  const avatarUrl = '/uploads/chetan-sonawane.jpg';

  let user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });

  if (!user) {
    const passwordHash = await bcrypt.hash('Chetan@12345', 10);
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Chetan',
        lastName: 'Sonawane',
        role: 'AFFILIATE',
        isActive: true,
        avatar: avatarUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log('Created user Chetan Sonawane:', user.id);
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        role: 'AFFILIATE',
        isActive: true,
        avatar: avatarUrl,
        firstName: 'Chetan',
        lastName: 'Sonawane',
        updatedAt: new Date(),
      },
    });
    console.log('Updated user Chetan Sonawane with avatar:', user.id);
  }

  // Affiliate profile
  let aff = await prisma.affiliate_profiles.findFirst({
    where: {
      OR: [
        { userId: user.id },
        { username: username },
        { referralCode: username }
      ]
    }
  });

  if (!aff) {
    aff = await prisma.affiliate_profiles.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        referralCode: username,
        username: username,
        slug: username,
        status: 'ACTIVE',
        isActive: true,
        payoutStatus: 'active',
        commissionRate: 0.20,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });
    console.log('Created affiliate profile:', aff.id);
  } else {
    aff = await prisma.affiliate_profiles.update({
      where: { id: aff.id },
      data: {
        userId: user.id,
        username: username,
        referralCode: username,
        slug: username,
        status: 'ACTIVE',
        isActive: true,
        payoutStatus: 'active',
        updatedAt: new Date(),
      }
    });
    console.log('Updated affiliate profile:', aff.id);
  }

  // Ensure default plans exist
  let plan = await prisma.membership_plans.findFirst({
    where: { slug: 'monthly-active' }
  });
  if (!plan) {
    plan = await prisma.membership_plans.create({
      data: {
        id: 'plan-monthly-active',
        name: 'VIP Representative ($19.99/mo)',
        slug: 'monthly-active',
        description: 'Standard VIP representative membership',
        price: 19.99,
        interval: 'MONTHLY',
        discountPercent: 0,
        freeShipping: true,
        perks: ['VIP Back Office', 'Retail Discounts'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });
  }

  // Ensure user membership exists
  let mem = await prisma.user_memberships.findFirst({
    where: { userId: user.id }
  });
  if (!mem) {
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    mem = await prisma.user_memberships.create({
      data: {
        id: `mem-${user.id}`,
        userId: user.id,
        planId: plan.id,
        status: 'active',
        startDate: now,
        endDate: nextMonth,
        autoRenew: true,
        createdAt: now,
        updatedAt: now,
      }
    });
    console.log('Created user membership:', mem.id);
  }

  console.log('Chetan Sonawane representative setup completed successfully!');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
