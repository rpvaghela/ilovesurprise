const { collectionService } = require('../dist/services/collection.service');

async function main() {
  const collections = await collectionService.listAdminCollections();
  console.log(`Found ${collections.length} admin collections:`);
  for (const c of collections) {
    console.log(`- ${c.name} (slug: /${c.slug}): ${c.productCount} Products`);
  }

  const sampleProducts = await collectionService.getCollectionProducts('jewelry-candles', 3);
  console.log(`\nSample jewelry-candles products (${sampleProducts.length}):`);
  for (const p of sampleProducts) {
    console.log(`- [${p.id}] ${p.name} ($${p.price})`);
  }
}

main().catch(console.error);
