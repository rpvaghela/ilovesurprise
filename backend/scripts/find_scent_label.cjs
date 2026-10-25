const fs = require('fs');
const html = fs.readFileSync('C:/Users/cheta/.gemini/antigravity-ide/brain/c8f04229-1fda-4650-afd8-ebb81c75fcd6/.system_generated/steps/972/content.md', 'utf8');

const matches = [];
const lines = html.split('\n');
lines.forEach((line, i) => {
  if (/scent/i.test(line) && (line.includes('label') || line.includes('select') || line.includes('option') || line.includes('dropdown') || line.includes('swatch'))) {
    matches.push(`Line ${i + 1}: ${line.trim().slice(0, 200)}`);
  }
});
console.log('Matches:', matches.slice(0, 20));
