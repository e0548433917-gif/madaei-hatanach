#!/usr/bin/env node
// #73 — הטמעת התמונות שנאספו ב-_עבודה/assets/place-photos ב-places.js (img + credit + CARD_IMAGES).
// התמונות כבר מכווצות (WebP 520px). אחרי הריצה: node tools/compress-embedded-images.js guides/places/data/places.js
// ערך שכבר יש לו img מדולג. הרצה חוזרת אינה מזיקה.   --dry  בלי כתיבה.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const FILE = path.join(ROOT, 'guides/places/data/places.js');
const DIR = path.join(ROOT, '_עבודה/assets/place-photos');
const DRY = process.argv.includes('--dry');

let text = fs.readFileSync(FILE, 'utf8');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(text + ';this.D=DATA;this.I=CARD_IMAGES', ctx);
const IMGS = JSON.parse(JSON.stringify(ctx.I));
const credits = JSON.parse(fs.readFileSync(path.join(DIR, 'credits.json'), 'utf8'));

const done = [], skipped = [];
for (const [name, c] of Object.entries(credits)) {
  const e = ctx.D.find((x) => x.name === name && x.cat === c.cat);
  if (!e) { skipped.push(name + ': אין ערך'); continue; }
  if (e.img || IMGS[name]) { skipped.push(name + ': כבר יש תמונה'); continue; }
  const anchor = `{"name":${JSON.stringify(name)},"cat":${JSON.stringify(c.cat)},`;
  if (text.split(anchor).length !== 2) { skipped.push(name + ': עוגן לא ייחודי'); continue; }
  const b64 = fs.readFileSync(path.join(DIR, c.file)).toString('base64');
  IMGS[name] = 'data:image/webp;base64,' + b64;
  text = text.replace(anchor, `{"name":${JSON.stringify(name)},"img":${JSON.stringify(name)},"credit":${JSON.stringify(c.credit)},"cat":${JSON.stringify(c.cat)},`);
  done.push(name);
}
const block = 'const CARD_IMAGES = ' + JSON.stringify(IMGS, null, 0).replace(/","/g, '",\n"') + ';\n';
text = text.replace(/\nconst CARD_IMAGES = [\s\S]*$/, '\n' + block);
if (!DRY) fs.writeFileSync(FILE, text);
console.log(`הוטמעו ${done.length}, דולגו ${skipped.length}${skipped.length ? ':\n  ' + skipped.join('\n  ') : ''}`);
