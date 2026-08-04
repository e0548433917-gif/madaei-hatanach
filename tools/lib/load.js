// טעינת קבצי הדאטה ופונקציות פענוח מראי המקום — משימה ת.0. ר' tools/validate.js.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// טעינת הדאטה — כל קובץ דאטה הוא סקריפט קלאסי שמכריז const DATA/CATS/CARD_IMAGES.
// const ברמה העליונה אינו נכתב לאובייקט ה-context, לכן מוסיפים ביטוי סיום שמחזיר
// אותם כערך ההשלמה של הסקריפט.
// ---------------------------------------------------------------------------

function loadDataFile(relPath) {
  const abs = path.join(ROOT, relPath);
  const src = fs.readFileSync(abs, 'utf8');
  const tail = `
;({
  DATA:        typeof DATA        !== 'undefined' ? DATA        : null,
  CATS:        typeof CATS        !== 'undefined' ? CATS        : null,
  CARD_IMAGES: typeof CARD_IMAGES !== 'undefined' ? CARD_IMAGES : null
});`;
  return vm.runInNewContext(src + tail, {}, { filename: relPath, timeout: 120000 });
}

// טוען את פונקציות פענוח מראי המקום מתוך shell/refs.js עצמו (לא עותק).
// refs.js נשען על document/window בזמן טעינה — מספקים בובות.
function loadRefParsers() {
  const src = fs.readFileSync(path.join(ROOT, 'shell/refs.js'), 'utf8');
  const sandbox = {
    document: { addEventListener() {} },
    window: {},
    console,
  };
  sandbox.window = sandbox;
  const tail = `
;({ parseAnyRef, parseVerseRef, parseMidrashRef });`;
  return vm.runInNewContext(src + tail, sandbox, { filename: 'shell/refs.js' });
}


module.exports = { ROOT, loadDataFile, loadRefParsers };
