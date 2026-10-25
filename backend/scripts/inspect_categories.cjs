const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cats = await prisma.categories.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { products: true } }
    }
  });
  console.log('Categories count:', cats.length);
  console.log(cats);

  const productsWithCat = await prisma.products.count({
    where: { categoryId: { not: null } }
  });
  const productsWithoutCat = await prisma.products.count({
    where: { categoryId: null }
  });
  console.log('Products with categoryId:', productsWithCat);
  console.log('Products without categoryId (null):', productsWithoutCat);

  const sampleProducts = await prisma.products.findMany({
    take: 10,
    select: {
      id: true,
      name: true,
      categoryId: true,
      categories: true,
      product_collections: {
        include: {
          collections: true
        }
      }
    }
  });
  console.log('Sample 10 products:');
  for (const p of sampleProducts) {
    console.log(`- [${p.id}] ${p.name}: categoryId=${p.categoryId}, catName=${p.categories?.name}, collections=[${p.product_collections.map(pc => pc.collections.name + ' (' + pc.collections.slug + ')').join(', ')}]`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
