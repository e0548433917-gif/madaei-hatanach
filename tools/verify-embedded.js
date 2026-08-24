/**
 * בדיקת סנכרון לפני פרסום לחנות.
 *
 *   שימוש:  node tools/verify-embedded.js
 *
 * שלושה קבצים ב-guides/_shared/ אינם נערכים ביד: build/pack.ps1 מטביע לתוכם את
 * CHANGELOG.md, ROADMAP.md ומספר הגרסה שבמניפסט (שלבים 1ג/1ד/1ה), כי fetch() של
 * קובץ מקומי מהחבילה נכשל בפועל בתוך ה-WebView של אוצריא. המשמעות: אם מישהו ערך
 * את CHANGELOG.md / ROADMAP.md / manifest.json ודחף בלי לארוז מחדש, החבילה
 * שמתפרסמת לחנות תציג למשתמשים תוכן ישן — בלי שום שגיאה בזמן ריצה.
 *
 * הסקריפט הזה נופל בקוד 1 בדיוק במצב הזה, ולכן רץ ב-CI לפני שלב הפרסום.
 * התיקון תמיד אחד: להריץ build/pack.ps1 (או לפחות שלבים 1ג–1ה שבו) ולחייב מחדש.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const errors = [];

// הקבצים המוטבעים הם `const X = "<json>";` — שולפים את הליטרל ומפענחים אותו,
// במקום להריץ את הקובץ (הוא נכתב לדפדפן ולא ל-node).
function embeddedValue(rel, constName) {
  const src = read(rel);
  const m = src.match(new RegExp('const\\s+' + constName + '\\s*=\\s*([\\s\\S]*?);\\s*$'));
  if (!m) {
    errors.push(`${rel}: לא נמצאה ההשמה ל-${constName} — הקובץ נערך ביד או שהפורמט ב-build/pack.ps1 השתנה.`);
    return null;
  }
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    errors.push(`${rel}: הליטרל של ${constName} אינו JSON תקין (${e.message}).`);
    return null;
  }
}

const manifest = JSON.parse(read('manifest.json'));

// ---- 1. גרסה תקינה, ותיאור שאוצריא לא תדחה ----
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  errors.push(`manifest.json: גרסה '${manifest.version}' אינה בפורמט X.Y.Z.`);
}
// 2.19.4 חסמה התקנה בפועל בגלל זה, ולוולידציה/פקג' אין בדיקה כזו.
if (manifest.description.length > 150) {
  errors.push(`manifest.json: התיאור (${manifest.description.length} תווים) חורג מ-150 — אוצריא דוחה התקנה.`);
}

// ---- 2. שלושת הקבצים המוטבעים מול המקור ----
const version = embeddedValue('guides/_shared/version-embedded.js', 'EMBEDDED_PLUGIN_VERSION');
if (version !== null && version !== manifest.version) {
  errors.push(`version-embedded.js מוטבע על ${version} אבל manifest.json על ${manifest.version} — "הגרסה המותקנת אצלך" בלשונית "מה חדש" תציג מספר שגוי.`);
}

const changelog = embeddedValue('guides/_shared/changelog-embedded.js', 'EMBEDDED_CHANGELOG_MD');
if (changelog !== null && changelog !== read('CHANGELOG.md')) {
  errors.push('changelog-embedded.js אינו זהה ל-CHANGELOG.md — לשונית "מה חדש" תציג גרסה ישנה של הקובץ.');
}

const roadmap = embeddedValue('guides/_shared/roadmap-embedded.js', 'EMBEDDED_ROADMAP_MD');
if (roadmap !== null && roadmap !== read('ROADMAP.md')) {
  errors.push('roadmap-embedded.js אינו זהה ל-ROADMAP.md — "מה מתוכנן בהמשך" תציג רשימה ישנה.');
}

// ---- 3. יש ערך CHANGELOG לגרסה שמתפרסמת ----
const clRe = new RegExp('^##\\s+' + manifest.version.replace(/\./g, '\\.') + '\\s', 'm');
if (!clRe.test(read('CHANGELOG.md'))) {
  errors.push(`CHANGELOG.md: אין ערך '## ${manifest.version}' — הגרסה שמתפרסמת אינה מתועדת.`);
}

if (errors.length) {
  console.error(`בדיקת הסנכרון נכשלה (${errors.length}):\n`);
  errors.forEach((e) => console.error(`  ✗ ${e}`));
  console.error('\nהתיקון: להריץ build/pack.ps1 ולחייב את guides/_shared/*-embedded.js מחדש.');
  process.exit(1);
}

console.log(`בדיקת הסנכרון עברה: גרסה ${manifest.version}, המוטבעים תואמים ל-CHANGELOG.md / ROADMAP.md / manifest.json.`);
