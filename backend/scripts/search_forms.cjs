const fs = require('fs');
const html = fs.readFileSync('C:/Users/cheta/.gemini/antigravity-ide/brain/c8f04229-1fda-4650-afd8-ebb81c75fcd6/.system_generated/steps/972/content.md', 'utf8');

const regexes = [
  /<select[^>]*>[\s\S]*?<\/select>/gi,
  /<label[^>]*>[^<]*scent[^<]*<\/label>/gi,
  /<fieldset[^>]*>[\s\S]*?<\/fieldset>/gi,
  /<legend[^>]*>[^<]*<\/legend>/gi
];

for (const r of regexes) {
  const m = html.match(r);
  if (m) {
    console.log('Found matches for', r, ':', m.slice(0, 5));
  }
}
