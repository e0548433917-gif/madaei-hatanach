/**
 * אריזת .otzplugin בפורמט זהה לאורז הרשמי של אוצריא.
 *
 *   שימוש:  node tools/pack-otzplugin.js <תיקייה-מוכנה> <קובץ-פלט.otzplugin>
 *
 * למה זה קיים: כשה-Action של אוצריא (Otzaria/otzaria-plugin-validator) נתקע,
 * ה-CI ארז "חבילה חלופית" עם `zip -qr` של לינוקס. החבילה הזו נפתחה תקין
 * באוצריא, אבל דף ההעלאה ב-otzaria.org דחה אותה ("לא ניתן לקרוא את
 * manifest.json מקובץ התוסף", 4.16.1). מאז 4.17.0 כל חבילה — רגילה ופלוס —
 * נארזת כאן, בדיוק כמו buildOtzplugin שב-src/zipWriter.js של ה-Action:
 * manifest.json ראשון, בלי רשומות תיקייה, בלי extra fields, בלי data
 * descriptors, נתיבים עם '/', deflate או stored.
 *
 * הסקריפט אורז את *כל* מה שבתיקייה שקיבל — את הסינון (.otzignore / רשימה
 * לבנה) עושים לפני כן, בהכנת התיקייה.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const [, , srcArg, outArg] = process.argv;
if (!srcArg || !outArg) {
  console.error('שימוש: node tools/pack-otzplugin.js <תיקייה> <פלט.otzplugin>');
  process.exit(2);
}
const root = path.resolve(srcArg);
const outAbs = path.resolve(outArg);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// כל הקבצים, ממוינים, עם manifest.json בראש.
const names = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (abs === outAbs) continue;
    if (e.isDirectory()) walk(abs);
    else if (e.isFile()) names.push(path.relative(root, abs).split(path.sep).join('/'));
  }
})(root);
names.sort();
const mi = names.indexOf('manifest.json');
if (mi < 0) {
  console.error('manifest.json לא נמצא בשורש ' + root);
  process.exit(1);
}
names.splice(mi, 1);
names.unshift('manifest.json');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
for (const ep of [manifest.entrypoint, manifest.contributes?.background?.entrypoint]) {
  if (ep && !names.includes(ep)) {
    console.error(`קובץ הכניסה ${ep} חסר בחבילה`);
    process.exit(1);
  }
}

const locals = [];
const centrals = [];
let offset = 0;
for (const name of names) {
  const data = fs.readFileSync(path.join(root, name));
  const nameBuf = Buffer.from(name, 'utf8');
  const crc = crc32(data);
  const deflated = zlib.deflateRawSync(data, { level: 9 });
  const store = deflated.length >= data.length;
  const method = store ? 0 : 8;
  const payload = store ? data : deflated;
  const flags = /^[\x00-\x7f]*$/.test(name) ? 0 : 0x0800; // UTF-8 לשמות לא-ASCII

  const lfh = Buffer.alloc(30);
  lfh.writeUInt32LE(0x04034b50, 0);
  lfh.writeUInt16LE(20, 4);
  lfh.writeUInt16LE(flags, 6);
  lfh.writeUInt16LE(method, 8);
  lfh.writeUInt32LE(crc, 14);
  lfh.writeUInt32LE(payload.length, 18);
  lfh.writeUInt32LE(data.length, 22);
  lfh.writeUInt16LE(nameBuf.length, 26);
  locals.push(lfh, nameBuf, payload);

  const cdh = Buffer.alloc(46);
  cdh.writeUInt32LE(0x02014b50, 0);
  cdh.writeUInt16LE(20, 4);
  cdh.writeUInt16LE(20, 6);
  cdh.writeUInt16LE(flags, 8);
  cdh.writeUInt16LE(method, 10);
  cdh.writeUInt32LE(crc, 16);
  cdh.writeUInt32LE(payload.length, 20);
  cdh.writeUInt32LE(data.length, 24);
  cdh.writeUInt16LE(nameBuf.length, 28);
  cdh.writeUInt32LE(offset, 42);
  centrals.push(cdh, nameBuf);

  offset += 30 + nameBuf.length + payload.length;
}
if (names.length > 0xffff || offset > 0xfffffff0) {
  console.error('החבילה גדולה מדי לפורמט ZIP רגיל (ZIP64 אינו נתמך באוצריא)');
  process.exit(1);
}

const localPart = Buffer.concat(locals);
const centralPart = Buffer.concat(centrals);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(names.length, 8);
eocd.writeUInt16LE(names.length, 10);
eocd.writeUInt32LE(centralPart.length, 12);
eocd.writeUInt32LE(localPart.length, 16);

const archive = Buffer.concat([localPart, centralPart, eocd]);
fs.mkdirSync(path.dirname(outAbs), { recursive: true });
fs.writeFileSync(outAbs, archive);
const sha = crypto.createHash('sha256').update(archive).digest('hex');
console.log(`${path.basename(outAbs)}: ${names.length} קבצים, ${(archive.length / 1048576).toFixed(1)}MB, sha256 ${sha}`);
