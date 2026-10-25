const fs = require('fs');
const html = fs.readFileSync('C:/Users/cheta/.gemini/antigravity-ide/brain/c8f04229-1fda-4650-afd8-ebb81c75fcd6/.system_generated/steps/1094/content.md', 'utf8');

const scentMatches = Array.from(html.matchAll(/"Choose your scent":\s*"([^"]+)"/g)).map(m => m[1]);
console.log('Product 3 scents count:', new Set(scentMatches).size);
console.log('Product 3 scents:', Array.from(new Set(scentMatches)));

const allOptionNames = Array.from(html.matchAll(/"options":\s*{([^}]+)}/g)).map(m => m[1]);
if (allOptionNames.length > 0) {
  console.log('Option sample:', allOptionNames[0]);
}
