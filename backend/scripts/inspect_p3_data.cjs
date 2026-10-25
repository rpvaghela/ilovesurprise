const fs = require('fs');
const html = fs.readFileSync('C:/Users/cheta/.gemini/antigravity-ide/brain/c8f04229-1fda-4650-afd8-ebb81c75fcd6/.system_generated/steps/1094/content.md', 'utf8');

const idx = html.indexOf('productData:');
if (idx !== -1) {
  console.log('productData found!');
  console.log(html.slice(idx, idx + 2000));
} else {
  console.log('productData not found, searching for variants:');
  const vIdx = html.indexOf('variants:');
  if (vIdx !== -1) {
    console.log(html.slice(vIdx, vIdx + 1000));
  } else {
    console.log('Neither found!');
  }
}
