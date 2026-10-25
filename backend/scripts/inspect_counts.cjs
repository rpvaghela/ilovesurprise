const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pcCount = await prisma.product_collections.count();
  console.log('Total product_collections links:', pcCount);
  const colCount = await prisma.collections.count();
  console.log('Total collections in DB:', colCount);

  // Group product_collections by collectionId
  const colGroups = await prisma.product_collections.groupBy({
    by: ['collectionId'],
    _count: { productId: true },
    orderBy: { _count: { productId: 'desc' } }
  });
  console.log(`Collections with products assigned: ${colGroups.length}`);

  const colIds = colGroups.map(g => g.collectionId);
  const collections = await prisma.collections.findMany({
    where: { id: { in: colIds } },
    select: { id: true, name: true, slug: true }
  });
  const colMap = new Map(collections.map(c => [c.id, c]));

  console.log('Top collections by products:');
  for (const g of colGroups.slice(0, 30)) {
    const c = colMap.get(g.collectionId);
    console.log(`- ${c?.name} (slug: ${c?.slug}, id: ${g.collectionId}): ${g._count.productId} products`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
