const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const queryCategory = 'wax-melts';
  const prods = await prisma.products.findMany({
    where: {
      OR: [
        { categoryId: queryCategory },
        { categories: { slug: { equals: queryCategory, mode: 'insensitive' } } },
        { categories: { name: { contains: queryCategory, mode: 'insensitive' } } },
        { badge: { contains: queryCategory, mode: 'insensitive' } },
        {
          product_collections: {
            some: {
              collections: {
                OR: [
                  { slug: { equals: queryCategory, mode: 'insensitive' } },
                  { name: { contains: queryCategory, mode: 'insensitive' } },
                  { id: queryCategory },
                ],
              },
            },
          },
        },
      ],
    },
    take: 5,
    select: { id: true, name: true, price: true }
  });
  console.log(`wax-melts found ${prods.length} products:`, prods);

  const queryCategory2 = 'jewelry-candles';
  const prods2 = await prisma.products.findMany({
    where: {
      OR: [
        { categoryId: queryCategory2 },
        { categories: { slug: { equals: queryCategory2, mode: 'insensitive' } } },
        { categories: { name: { contains: queryCategory2, mode: 'insensitive' } } },
        { badge: { contains: queryCategory2, mode: 'insensitive' } },
        {
          product_collections: {
            some: {
              collections: {
                OR: [
                  { slug: { equals: queryCategory2, mode: 'insensitive' } },
                  { name: { contains: queryCategory2, mode: 'insensitive' } },
                  { id: queryCategory2 },
                ],
              },
            },
          },
        },
      ],
    },
    take: 5,
    select: { id: true, name: true, price: true }
  });
  console.log(`jewelry-candles found ${prods2.length} products:`, prods2);
}

test().catch(console.error).finally(() => prisma.$disconnect());
