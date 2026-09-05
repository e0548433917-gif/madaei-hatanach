#!/usr/bin/env node
// ייבוא קורא ה-PDF מהתוסף "צופה PDF+OCR" (com.chadbedera.pdfviewer) אל תוך
// עינים למקרא — Issue #65.
//
// ⚠️ למה סקריפט ולא העתקה ידנית: תוסף המקור מתעדכן. העתקה ידנית של תיקייה
// שלמה מביאה איתה 10MB של מנוע OCR שאיננו צריכים, דורסת הכרעות, ולא ניתן
// לדעת אחר כך מה שונה ולמה. הסקריפט מעתיק רשימת קבצים מפורשת ומחיל רשימת
// טלאים מוצהרת; טלאי חובה שלא נמצא ⇒ הריצה נכשלת ולא נכתב כלום, כך שנדע
// מיד שהמקור השתנה במקום לגלות זאת דרך באג.
//
//   node tools/import-pdf-viewer.js [נתיב-לתוסף-המקור]
//
// ברירת מחדל למקור: ../pdf-viewer (הקלון שלצד הריפו הזה).
// היעד: guides/pdf/ — נטען כדף שלם ב-iframe, לא ממוזג ל-DOM של התוסף.
// ר' ההסבר המלא בתגובה ב-Issue #65 (8 התנגשויות ids/CSS/IndexedDB).

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const SRC  = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'pdf-viewer'));
const DEST = path.join(__dirname, '..', 'guides', 'pdf');

// ---- הקבצים שמועתקים. כל השאר (tesseract, jszip, UTIF, ו-ocr-worker-loader
// שמשקלו 10MB) נשאר מאחור בכוונה. ----
const COPY = [
  { from: 'vendor/pdf.min.js',        to: 'vendor/pdf.min.js' },
  { from: 'vendor/pdf.worker.min.js', to: 'vendor/pdf.worker.min.js' },
];
const PAGE = { from: 'index.html', to: 'viewer.html' };

// ---- הטלאים על viewer.html. required:true ⇒ ריצה נכשלת אם הדפוס לא נמצא. ----
const PATCHES = [
  {
    id: 'drop-ocr-vendor-scripts',
    required: true,
    find: '<script src="./vendor/tesseract.min.js"></script>\n<script src="./vendor/jszip.min.js"></script>\n<script src="./vendor/UTIF.js"></script>\n',
    replace: "<!-- עינים למקרא: tesseract/jszip/UTIF לא יובאו (OCR, אופיס, TIFF) — ר' tools/import-pdf-viewer.js -->\n",
  },
  {
    id: 'title',
    required: true,
    find: '<title>צופה PDF עם OCR</title>',
    replace: '<title>קורא PDF — עינים למקרא</title>',
  },
  {
    id: 'h1',
    required: true,
    find: '<h1>צופה PDF+OCR</h1>',
    replace: '<h1>קורא PDF</h1>',
  },
  {
    id: 'hide-ocr-controls',
    required: true,
    find: '</style>\n</head>',
    replace: [
      '  /* עינים למקרא: פקדים שאינם רלוונטיים בגרסה המוטמעת (OCR, צילום מסך,',
      '     ואודות של התוסף המקורי). הלוגיקה נשארת במקומה — רק מוסתרת. */',
      '  #btn-capture-select, #btn-paste-extract, #btn-ocr, #btn-save-embedded,',
      '  #capture-armed-banner, #capture-overlay, #about-toggle, #about-panel { display:none !important; }',
      '</style>',
      '</head>',
    ].join('\n'),
  },
  {
    id: 'indexeddb-name',
    required: true,
    find: "indexedDB.open('pdfviewer-recents', 1)",
    replace: "indexedDB.open('madaei-pdf-recents', 1)",
  },
  {
    id: 'storage-key-scale-get',
    required: true,
    find: "await storageGet('scale')",
    replace: "await storageGet('madaei_pdf_scale')",
  },
  {
    id: 'storage-key-scale-set',
    required: true,
    all: true,
    find: "storageSet('scale', scale)",
    replace: "storageSet('madaei_pdf_scale', scale)",
  },
  {
    id: 'feedback-subject',
    required: true,
    find: "subject: 'משוב על תוסף צופה PDF עם OCR',",
    replace: "subject: 'משוב על קורא ה-PDF בעינים למקרא',",
  },
  {
    id: 'ocr-unavailable',
    required: true,
    find: [
      "    if (window.__OTZ_WORKER_BUNDLE_B64__) { resolve(); return; }",
      "    const s = document.createElement('script');",
      "    s.src = './vendor/ocr-worker-loader.js';",
      '    s.onload = () => resolve();',
      "    s.onerror = () => reject(new Error('טעינת קובץ מנוע ה-OCR נכשלה (vendor/ocr-worker-loader.js)'));",
      '    document.head.appendChild(s);',
    ].join('\n'),
    replace: [
      '    // עינים למקרא: מנוע ה-OCR (vendor/ocr-worker-loader.js, 10MB) לא יובא.',
      '    // חילוץ טקסט *מוטבע* (📝) עובד רגיל — הוא pdf.js טהור.',
      "    reject(new Error('חילוץ טקסט מסריקה (OCR) אינו כלול בקורא שבתוך עינים למקרא. לטקסט מוטבע יש את הכפתור 📝; ל-OCR מלא יש את התוסף הנפרד \"צופה PDF+OCR\".'));",
    ].join('\n'),
  },
  {
    id: 'parent-bridge',
    required: true,
    find: '// ===== Boot =====',
    replace: [
      '// ===== עינים למקרא: גשר הורה ← iframe (Issue #65) =====',
      '// הדף נטען כ-iframe same-origin מ-shell/home.js, ומקבל את בייטי ה-PDF',
      '// ב-postMessage במקום דרך בורר קבצים. הקובץ עצמו יושב ב-IndexedDB של',
      "// התוסף (madaei-hatanach-files) ולא ב-storage של אוצריא — ר' shell/data.js.",
      "window.addEventListener('message', async (ev) => {",
      '  const d = ev && ev.data;',
      "  if (!d || d.type !== 'madaei-pdf-open') return;",
      '  try {',
      '    let buf = d.bytes;',
      "    if (buf && typeof buf.arrayBuffer === 'function') buf = await buf.arrayBuffer();",
      "    if (!(buf instanceof ArrayBuffer)) throw new Error('לא התקבלו נתוני קובץ');",
      "    await loadPdf(buf, d.name || 'מדריך.pdf');",
      '  } catch(e){',
      "    showStatus('שגיאה בטעינת הקובץ: ' + ((e && e.message) || String(e)));",
      '  }',
      '});',
      "try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'madaei-pdf-ready' }, '*'); } catch(e){}",
      '',
      '// ===== Boot =====',
    ].join('\n'),
  },
];

// ---------------------------------------------------------------------------
function sha256(buf){ return crypto.createHash('sha256').update(buf).digest('hex'); }
function fail(msg){ console.error('✗ ' + msg); process.exit(1); }

if (!fs.existsSync(SRC)) fail('תיקיית המקור לא נמצאה: ' + SRC);

// 1. קוראים את הדף ומחילים את הטלאים *לפני* שכותבים משהו לדיסק.
const pageSrc = path.join(SRC, PAGE.from);
if (!fs.existsSync(pageSrc)) fail('לא נמצא ' + pageSrc);
let page = fs.readFileSync(pageSrc, 'utf8');

const applied = [];
const missing = [];
for (const p of PATCHES){
  if (!page.includes(p.find)){
    if (p.required) missing.push(p.id);
    else console.warn('  ~ טלאי לא-חובה דולג: ' + p.id);
    continue;
  }
  page = p.all ? page.split(p.find).join(p.replace) : page.replace(p.find, p.replace);
  applied.push(p.id);
}
if (missing.length){
  fail('טלאי חובה לא נמצא במקור — כנראה תוסף המקור התעדכן.\n  ' +
       missing.join('\n  ') + '\nלא נכתב דבר. יש לעדכן את PATCHES ב-tools/import-pdf-viewer.js.');
}

// 2. עכשיו כותבים.
fs.mkdirSync(path.join(DEST, 'vendor'), { recursive: true });
const hashes = [];
for (const f of COPY){
  const src = path.join(SRC, f.from);
  if (!fs.existsSync(src)) fail('לא נמצא ' + src);
  const buf = fs.readFileSync(src);
  fs.writeFileSync(path.join(DEST, f.to), buf);
  hashes.push({ file: f.to, bytes: buf.length, sha256: sha256(buf) });
}
fs.writeFileSync(path.join(DEST, PAGE.to), page, 'utf8');
hashes.push({ file: PAGE.to, bytes: Buffer.byteLength(page), sha256: sha256(page) });

// 3. פרובננס — כדי שייבוא חוזר יהיה בר-בדיקה.
let srcVersion = '?', srcCommit = '?';
try { srcVersion = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8')).version; } catch(e){}
try { srcCommit = execSync('git -C "' + SRC + '" rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch(e){}

const md = [
  '# guides/pdf — קוד מיובא, אין לערוך ידנית',
  '',
  'הקבצים כאן מיוצרים על ידי `tools/import-pdf-viewer.js`. **כל עריכה ידנית תידרס',
  'בייבוא הבא.** שינוי נדרש ⇒ להוסיף טלאי ל-`PATCHES` בסקריפט ולהריץ מחדש.',
  '',
  '| | |',
  '|---|---|',
  '| מקור | `com.chadbedera.pdfviewer` — https://github.com/e0548433917-gif/pdf-viewer |',
  '| גרסת מקור | ' + srcVersion + ' |',
  '| commit | ' + srcCommit + ' |',
  '| יובא בתאריך | ' + new Date().toISOString().slice(0, 10) + ' |',
  '| פנייה | #65 |',
  '',
  '## מה לא יובא ולמה',
  '',
  '`vendor/ocr-worker-loader.js` (10MB, מנוע OCR עברי), `tesseract.min.js`,',
  '`jszip.min.js` (docx/pptx/epub) ו-`UTIF.js` (TIFF) — יחד 10.2MB שהיו כמעט',
  'מכפילים את משקל החבילה. הקורא כאן הוא PDF בלבד; חילוץ טקסט **מוטבע** (📝)',
  'עובד רגיל, כי הוא pdf.js טהור.',
  '',
  '## קבצים',
  '',
].concat(hashes.map(h =>
  '* `' + h.file + '` — ' + h.bytes.toLocaleString('en-US') + ' bytes · sha256 `' + h.sha256.slice(0, 16) + '…`'
)).concat([
  '',
  'pdf.js הוא של Mozilla תחת Apache-2.0 (הרישיון מוטבע בראש `vendor/pdf.min.js`).',
  '',
]).join('\n');
fs.writeFileSync(path.join(DEST, 'IMPORTED-FROM.md'), md, 'utf8');

const total = hashes.reduce((a, h) => a + h.bytes, 0);
console.log('✓ יובא אל guides/pdf/ — ' + applied.length + ' טלאים הוחלו, 0 נכשלו');
hashes.forEach(h => console.log('    ' + h.file.padEnd(26) + (h.bytes / 1024).toFixed(0).padStart(6) + ' KB'));
console.log('  סה"כ ' + (total / 1024 / 1024).toFixed(2) + ' MB');
