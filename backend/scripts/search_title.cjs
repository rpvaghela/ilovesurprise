const fs = require('fs');
const html = fs.readFileSync('C:/Users/cheta/.gemini/antigravity-ide/brain/c8f04229-1fda-4650-afd8-ebb81c75fcd6/.system_generated/steps/972/content.md', 'utf8');

let pos = 0;
while (true) {
  const idx = html.indexOf('I Got It From My Mama', pos);
  if (idx === -1) break;
  console.log(`\n--- Match at index ${idx} ---`);
  console.log(html.slice(Math.max(0, idx - 100), Math.min(html.length, idx + 400)));
  pos = idx + 20;
}
