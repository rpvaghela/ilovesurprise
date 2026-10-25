const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const categories = [
  { id: 'cat-jewelry-candles', name: 'Jewelry Candles', slug: 'jewelry-candles' },
  { id: 'cat-cash-candles', name: 'Cash Candles', slug: 'cash-candles' },
  { id: 'cat-cash-money-candles', name: 'Cash Money Candles', slug: 'cash-money-candles' },
  { id: 'cat-wax-melts', name: 'Wax Melts', slug: 'wax-melts' },
  { id: 'cat-bath-body', name: 'Bath & Body', slug: 'bath-bombs' },
  { id: 'cat-soaps', name: 'Soaps', slug: 'soap' },
  { id: 'cat-slimes', name: 'Slimes', slug: 'slimes' },
  { id: 'cat-candy', name: 'Cash Candy', slug: 'candy' },
  { id: 'cat-chocolates', name: 'Chocolates', slug: 'chocolates' },
  { id: 'cat-greeting-cards', name: 'Greeting Cards', slug: 'greeting-cards' },
];

async function main() {
  console.log('Matching categories against DB collections:');
  for (const cat of categories) {
    // Try matching by slug or name
    const match = await prisma.collections.findFirst({
      where: {
        OR: [
          { slug: cat.slug },
          { slug: { contains: cat.slug, mode: 'insensitive' } },
          { name: { contains: cat.name, mode: 'insensitive' } },
        ]
      },
      include: {
        _count: {
          select: { product_collections: true }
        }
      }
    });

    // Also find all matching collections
    const allMatches = await prisma.collections.findMany({
      where: {
        OR: [
          { slug: { contains: cat.slug, mode: 'insensitive' } },
          { name: { contains: cat.name, mode: 'insensitive' } },
        ]
      },
      include: {
        _count: {
          select: { product_collections: true }
        }
      }
    });

    console.log(`\nCategory: "${cat.name}" (slug: "${cat.slug}"):`);
    for (const m of allMatches) {
      console.log(`  -> Collection ID: ${m.id}, Name: "${m.name}", Slug: "${m.slug}", Products: ${m._count.product_collections}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
