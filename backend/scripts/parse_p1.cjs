const fs = require('fs');

const html = fs.readFileSync('C:/Users/cheta/.gemini/antigravity-ide/brain/c8f04229-1fda-4650-afd8-ebb81c75fcd6/.system_generated/steps/972/content.md', 'utf8');

// Find productData JSON
const match = html.match(/productData:\s*({[\s\S]*?})\s*\|\|\s*\[\]/);
if (match) {
  console.log('Found productData in step 972 content:');
  try {
    const pData = JSON.parse(match[1]);
    console.log('Title/Handle:', pData.handle);
    const scents = new Set();
    const surprises = new Set();
    if (pData.variants) {
      for (const v of pData.variants) {
        if (v.options) {
          if (v.options['Choose your scent']) scents.add(v.options['Choose your scent']);
          if (v.options['Choose your jewelry surprise']) surprises.add(v.options['Choose your jewelry surprise']);
        }
      }
    }
    console.log('Choose your scent values (' + scents.size + '):', Array.from(scents));
    console.log('Choose your jewelry surprise values (' + surprises.size + '):', Array.from(surprises));
  } catch (e) {
    console.error('JSON parse error:', e.message);
  }
} else {
  // Try regex on variants
  const scentMatches = Array.from(html.matchAll(/"Choose your scent":\s*"([^"]+)"/g)).map(m => m[1]);
  const uniqueScents = Array.from(new Set(scentMatches));
  console.log('Regex found scents (' + uniqueScents.length + '):', uniqueScents);

  const surpriseMatches = Array.from(html.matchAll(/"Choose your jewelry surprise":\s*"([^"]+)"/g)).map(m => m[1]);
  const uniqueSurprises = Array.from(new Set(surpriseMatches));
  console.log('Regex found surprises (' + uniqueSurprises.length + '):', uniqueSurprises);
}
