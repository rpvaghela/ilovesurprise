const fs = require('fs');
const html = fs.readFileSync('C:/Users/cheta/.gemini/antigravity-ide/brain/c8f04229-1fda-4650-afd8-ebb81c75fcd6/.system_generated/steps/1070/content.md', 'utf8');

const idx = html.indexOf('productData:');
if (idx !== -1) {
  const jsonPart = html.slice(idx, idx + 4000);
  const scentMatches = Array.from(jsonPart.matchAll(/"Choose (?:[yY]our )?[sS]cent":\s*"([^"]+)"/g)).map(m => m[1]);
  console.log('Nevada scents on website (' + new Set(scentMatches).size + '):', Array.from(new Set(scentMatches)));
}
