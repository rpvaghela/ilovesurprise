const { listProducts } = require('../dist/services/product.service');

async function main() {
  const categoriesToTest = ['jewelry-candles', 'wax-melts', 'bath-bombs', 'slimes', 'soap', 'candy'];
  for (const cat of categoriesToTest) {
    const res = await listProducts({ category: cat, limit: 3 });
    console.log(`Category "${cat}": total=${res.total}, returned=${res.products.length}`);
    if (res.products.length > 0) {
      console.log(`  Sample: "${res.products[0].name}" (categoryName: "${res.products[0].categoryName}")`);
    }
  }
}

main().catch(console.error);
