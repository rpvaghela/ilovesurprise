const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const totalProducts = await prisma.products.count();
  console.log('Total products in DB:', totalProducts);

  const allCollections = await prisma.collections.findMany({
    include: {
      _count: {
        select: { product_collections: true }
      }
    }
  });
  console.log('Collections in DB:');
  for (const c of allCollections) {
    console.log(`- ${c.name} (slug: ${c.slug}, id: ${c.id}): ${c._count.product_collections} product_collections`);
  }

  const allCategories = await prisma.categories.findMany({
    include: {
      _count: {
        select: { products: true }
      }
    }
  });
  console.log('\nCategories in DB:');
  for (const cat of allCategories) {
    console.log(`- ${cat.name} (slug: ${cat.slug}, id: ${cat.id}): ${cat._count.products} products`);
  }

  const sampleProducts = await prisma.products.findMany({
    take: 5,
    include: {
      categories: true,
      product_collections: {
        include: { collections: true }
      }
    }
  });
  console.log('\nSample products:', JSON.stringify(sampleProducts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
