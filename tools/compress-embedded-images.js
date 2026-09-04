#!/usr/bin/env node
/*
  דחיסת התמונות המוטבעות (data URI base64) בקובצי guides/<תחום>/data/*.js  —  Issue #97.

  למה מוטבע ולא קובץ נפרד: fetch() על קובץ מקומי מהחבילה נכשל ב-WebView של אוצריא
  (ר' CLAUDE.md, "מלכודות ידועות"), ולכן כל תמונה חייבת להיות קבוע JS. הדפוס נשאר —
  מה שמשתנה כאן הוא רק הרזולוציה והפורמט של מה שמוטבע.

  מה הסקריפט עושה לכל data URI:
    1. מפענח את ה-base64.
    2. מקטין לרוחב תצוגה סביר — הכרטיס יושב ב-.panel-box שרוחבו עד 520px
       (shell/router.css). לעולם לא מגדיל (withoutEnlargement).
    3. מקודד מחדש ל-WebP דחוס.
    4. מחליף *רק* את מחרוזת ה-data URI במקומה בקובץ. שום שדה אחר, שום רווח,
       שום סדר — לא נגעים בהם. אין JSON.parse ואין כתיבה מחדש של המבנה.

  שמרנות מכוונת:
    - אם התוצאה יצאה גדולה מהמקור, משאירים את המקור. אף תמונה לא מפסידה.
    - SVG (data:image/svg+xml) מדולג — הוא וקטורי וכבר קטן.
    - התמונה נשמרת בלי מטא-דאטה (sharp מסיר EXIF כברירת מחדל).

  שימוש:
    node tools/compress-embedded-images.js --dry              # מדידה בלבד, בלי לכתוב
    node tools/compress-embedded-images.js                    # על ברירת המחדל (3 הקבצים הכבדים)
    node tools/compress-embedded-images.js guides/people/data/people-data.js
    node tools/compress-embedded-images.js --width 520 --quality 78

  ⚠️ כלל קבוע: כל תמונה חדשה שמוטבעת בקובצי ה-data של המדריכים עוברת את הסקריפט הזה
  לפני ההטבעה (אותו רוחב יעד ואותה איכות), כדי שהמשקל לא יצטבר מחדש.
*/

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');

// ברירת המחדל: שלושת הקבצים שנושאים כמעט את כל המשקל (ר' Issue #97).
const DEFAULT_FILES = [
  'guides/archaeology/data/archaeology-data.js',
  'guides/flora/data/flora-data.js',
  'guides/animal/data/animal-data.js',
];

// ---- פענוח ארגומנטים ----
const argv = process.argv.slice(2);
let width = 520;      // .panel-box { max-width: 520px }
let quality = 78;
let dry = false;
const files = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--dry' || a === '-n') dry = true;
  else if (a === '--width') width = parseInt(argv[++i], 10);
  else if (a === '--quality') quality = parseInt(argv[++i], 10);
  else if (a.startsWith('--')) { console.error(`דגל לא מוכר: ${a}`); process.exit(1); }
  else files.push(a);
}
if (!files.length) files.push(...DEFAULT_FILES);

// jpg/jpeg/png/webp בלבד. svg+xml לא נתפס בכוונה.
const RE = /data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/]+={0,2})/g;

const kb = (n) => (n / 1024).toFixed(0).padStart(5) + 'K';
const mb = (n) => (n / 1048576).toFixed(2) + 'MB';

async function processFile(rel) {
  const abs = path.join(ROOT, rel);
  const src = fs.readFileSync(abs, 'utf8');

  // אוספים את כל ההתאמות מראש, כדי לבנות את הפלט מחתיכות ולא לעשות replace
  // גלובלי (שעלול להתבלבל בין data URI זהים או לפגוע במה שביניהם).
  const matches = [];
  let m;
  while ((m = RE.exec(src)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, fmt: m[1], b64: m[2] });
  }

  let before = 0, after = 0, converted = 0, kept = 0;
  const out = [];
  let cursor = 0;

  for (const im of matches) {
    const origUri = src.slice(im.start, im.end);
    before += origUri.length;

    let replacement = origUri;
    try {
      const buf = Buffer.from(im.b64, 'base64');
      const webp = await sharp(buf)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality, effort: 6 })
        .toBuffer();
      const candidate = 'data:image/webp;base64,' + webp.toString('base64');
      // רק אם באמת הרווחנו. אחרת המקור נשאר בדיוק כמו שהוא.
      if (candidate.length < origUri.length) { replacement = candidate; converted++; }
      else kept++;
    } catch (e) {
      // תמונה פגומה/פורמט ש-sharp לא קרא — משאירים כמות שהיא ומדווחים.
      console.warn(`  ⚠ דילוג על תמונה ב-${rel} (offset ${im.start}): ${e.message}`);
      kept++;
    }

    after += replacement.length;
    out.push(src.slice(cursor, im.start), replacement);
    cursor = im.end;
  }
  out.push(src.slice(cursor));

  const result = out.join('');
  if (!dry && converted > 0) fs.writeFileSync(abs, result, 'utf8');

  return {
    rel, count: matches.length, converted, kept,
    before, after,
    fileBefore: Buffer.byteLength(src, 'utf8'),
    fileAfter: Buffer.byteLength(result, 'utf8'),
  };
}

(async () => {
  console.log(`רוחב יעד: ${width}px | איכות WebP: ${quality} | ${dry ? 'הרצה יבשה (לא נכתב כלום)' : 'כתיבה לקבצים'}`);
  console.log('');

  let totBefore = 0, totAfter = 0, totCount = 0, totConv = 0;
  for (const rel of files) {
    const r = await processFile(rel);
    totBefore += r.fileBefore; totAfter += r.fileAfter;
    totCount += r.count; totConv += r.converted;
    const pct = r.fileBefore ? (100 * (1 - r.fileAfter / r.fileBefore)).toFixed(1) : '0.0';
    console.log(
      `${r.rel}\n` +
      `   תמונות: ${r.count} (הומרו ${r.converted}, נשמרו כמקור ${r.kept})\n` +
      `   קובץ: ${mb(r.fileBefore)} → ${mb(r.fileAfter)}  (חיסכון ${pct}%)`
    );
  }

  const pct = totBefore ? (100 * (1 - totAfter / totBefore)).toFixed(1) : '0.0';
  console.log('');
  console.log(`סה"כ: ${totCount} תמונות, ${totConv} הומרו — ${mb(totBefore)} → ${mb(totAfter)} (חיסכון ${pct}%)`);
  if (dry) console.log('(הרצה יבשה — שום קובץ לא שונה.)');
})().catch((e) => { console.error(e); process.exit(1); });
