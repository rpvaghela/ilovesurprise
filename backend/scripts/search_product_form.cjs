const fs = require('fs');
const html = fs.readFileSync('C:/Users/cheta/.gemini/antigravity-ide/brain/c8f04229-1fda-4650-afd8-ebb81c75fcd6/.system_generated/steps/972/content.md', 'utf8');

const matches = html.match(/<form[^>]*class="[^"]*product-form[^"]*"[\s\S]*?<\/form>/gi) ||
                html.match(/<product-form[\s\S]*?<\/product-form>/gi) ||
                html.match(/<variant-picker[\s\S]*?<\/variant-picker>/gi) ||
                html.match(/class="[^"]*variant[^"]*"[^>]*>/gi);

console.log('Matches found:', matches ? matches.length : 0);
if (matches) {
  console.log(matches.slice(0, 3));
}
