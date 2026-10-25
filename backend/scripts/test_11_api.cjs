const http = require('http');

const userSlugs = [
  'i-got-it-from-my-mama-jewelry-greeting-candle',
  'greetings-from-nevada-greetings-from-candles',
  'gojou-satoru-anime-candle',
  'nailed-it-funny-candles',
  'best-mom-in-the-world-jewelry-greeting-candle',
  'sunday-brunch-jewelry-candle',
  'anna-name-jewelry-candles',
  'pray-for-eastern-shore-candle',
  'i-love-nj-jewelry-state-candles',
  'greensboro-candle',
  'meridian-city-jewelry-candle'
];

function fetchProduct(slug) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000/api/products/${encodeURIComponent(slug)}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: body });
        }
      });
    }).on('error', (err) => resolve({ error: err.message }));
  });
}

async function run() {
  console.log('Testing live API response for user 11 products:');
  for (const slug of userSlugs) {
    const data = await fetchProduct(slug);
    const prod = data.data?.product || data.product;
    if (!prod) {
      console.log(`\n[${slug}]: ERROR/NOT FOUND:`, data.message || data.error);
      continue;
    }
    const scentOpt = prod.options?.find(o => /scent/i.test(o.name));
    console.log(`\n[${slug}] "${prod.name}":`);
    console.log('  options in API response:', prod.options?.map(o => `${o.name} (${o.values?.length} vals)`));
    console.log('  scentNotes count:', prod.scentNotes?.length);
    console.log('  Scent Variety Active:', scentOpt ? `YES (${scentOpt.values?.length} scents)` : 'NO');
    if (scentOpt) {
      console.log('  Sample Scents:', scentOpt.values?.slice(0, 4));
    }
  }
}

run().catch(console.error);
