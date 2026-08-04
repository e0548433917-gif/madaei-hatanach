#!/usr/bin/env node
/*
 * tools/validate.js — ולידציה של מאגר הנתונים של תמונ״ך (משימה ת.0)
 *
 * מריץ שש בדיקות על כל הרשומות שבששת המדריכים, וכותב דוח מסודר ל-
 * tools/validation-report.md. **הסקריפט אינו משנה שום קובץ דאטה** — הוא מדווח בלבד.
 *
 *   שימוש:  node tools/validate.js [--out <path>] [--strict] [--quiet]
 *
 *   --strict  יוצא בקוד 1 אם נמצאה שגיאה חמורה (קטגוריות 1–4). לשימוש ב-CI.
 *   --out     נתיב אחר לקובץ הדוח.
 *
 * הבדיקות:
 *   1. קשרי משפחה המצביעים על רשומה שאינה קיימת (אב/אם/בן זוג/ילד/אח)
 *   2. בני זוג לא הדדיים
 *   3. ילדים בלי הורה מקביל, והורים בלי ילד מקביל (+ אחים לא הדדיים)
 *   4. שדות חובה חסרים לפי הקטגוריה
 *   5. מראי מקום שאינם נפרסים ב-parseAnyRef / parseMidrashRef
 *   6. ערכים בלי תמונה, מפורט לפי קטגוריה  (רשימת העבודה של ת.4)
 *
 * הערה על תלות: הבדיקה 5 טוענת את shell/refs.js *האמיתי* לתוך sandbox, ולא עותק
 * שלו — כך שהדוח תמיד משקף את מה שהתוסף באמת עושה, גם אחרי שינוי במנוע הפענוח.
 *
 * הקובץ הזה הוא נקודת הכניסה בלבד. הלוגיקה מפוצלת ל-tools/lib/:
 *   config.js — רשימת המדריכים וכללי שדות החובה
 *   load.js   — טעינת קבצי הדאטה ושל shell/refs.js לתוך sandbox
 *   util.js   — עזרים משותפים (נרמול שמות, איסוף מראי מקום, בדיקת תמונה)
 *   checks.js — שש הבדיקות עצמן
 *   md.js     — עזרי טבלאות Markdown
 *   report.js — הרכבת הדוח
 */
'use strict';

const fs = require('fs');
const path = require('path');

const { GUIDES } = require('./lib/config');
const { ROOT, loadDataFile, loadRefParsers } = require('./lib/load');
const {
  buildIndex, checkMissingTargets, checkSpouses, checkParentChild, checkOrphans,
  checkFields, buildBookVariantMap, checkRefs, checkImages,
} = require('./lib/checks');
const { renderReport } = require('./lib/report');

function main() {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');
  const quiet = argv.includes('--quiet');
  const outIdx = argv.indexOf('--out');
  const outPath = outIdx >= 0 && argv[outIdx + 1]
    ? path.resolve(argv[outIdx + 1])
    : path.join(__dirname, 'validation-report.md');

  const parsers = loadRefParsers();
  const bookVariants = buildBookVariantMap(parsers);
  const guides = GUIDES.map((g) => {
    const loaded = loadDataFile(g.file);
    return {
      ...g,
      data: loaded.DATA || [],
      cats: loaded.CATS || [],
      images: loaded.CARD_IMAGES || null,
    };
  });

  const people = guides.find((g) => g.id === 'people');
  const peopleIndex = buildIndex(people.data);

  const mt = checkMissingTargets(people.data, peopleIndex);
  const res = {
    missingTargets: mt.rows,
    ambiguousTargets: mt.ambiguous,
    spouses: checkSpouses(people.data, peopleIndex),
    parentChild: checkParentChild(people.data, peopleIndex),
    orphans: checkOrphans(people.data),
    fields: {},
    refs: {},
    images: {},
    dupes: {},
  };
  guides.forEach((g) => {
    res.fields[g.id] = checkFields(g.id, g.data, g.cats);
    res.refs[g.id] = checkRefs(g.data, parsers, bookVariants);
    res.images[g.id] = checkImages(g.data, g.images);
    res.dupes[g.id] = buildIndex(g.data).duplicates;
  });

  const totalEntries = guides.reduce((s, g) => s + g.data.length, 0);
  const md = renderReport({ guides, res, totalEntries, parsers });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md, 'utf8');

  const hardErrors =
    res.missingTargets.filter((r) => r.kind !== 'descriptive').length +
    res.spouses.length +
    res.parentChild.childNoParent.length +
    res.parentChild.parentNoChild.length +
    guides.reduce((s, g) => s + res.fields[g.id].missingRequired.length + res.fields[g.id].unknownCat.length, 0);

  if (!quiet) {
    console.log(`תמונ״ך — ולידציה · ${totalEntries} רשומות ב-${guides.length} מדריכים`);
    console.log(`  1. קשרים שאינם מוצאים רשומה ....... ${res.missingTargets.length}`);
    console.log(`     א. שם + הבהרה בסוגריים ......... ${res.missingTargets.filter((r) => r.kind === 'qualifier').length}`);
    console.log(`     ב. שם ממשי בלי רשומה ........... ${res.missingTargets.filter((r) => r.kind === 'missing').length}`);
    console.log(`     ג. ניסוח תיאורי (תקין) ......... ${res.missingTargets.filter((r) => r.kind === 'descriptive').length}`);
    console.log(`  2. בני זוג לא הדדיים .............. ${res.spouses.length}`);
    console.log(`  3. ילד בלי הורה מקביל ............. ${res.parentChild.childNoParent.length}`);
    console.log(`     הורה בלי ילד מקביל ............. ${res.parentChild.parentNoChild.length}`);
    console.log(`     אחים לא הדדיים ................. ${res.parentChild.siblingOneWay.length}`);
    console.log(`     בלי שום קשר משפחתי ............. ${res.orphans.length}`);
    console.log(`     לא ניתן להכרעה (שם דו-משמעי) ... ${res.parentChild.undecidable.length}`);
    console.log(`     כפילות בתוך שדה קשר ............ ${res.parentChild.dupRelations.length}`);
    console.log(`  4. שדות חובה חסרים ................ ${guides.reduce((s, g) => s + res.fields[g.id].missingRequired.length, 0)}`);
    console.log(`  5. מראי מקום שאינם נפרסים ......... ${guides.reduce((s, g) => s + res.refs[g.id].bad.reduce((a, b) => a + b.count, 0), 0)}`);
    console.log(`  6. ערכים בלי תמונה ................ ${guides.reduce((s, g) => s + res.images[g.id].length, 0)}`);
    console.log(`\nהדוח נכתב אל: ${path.relative(ROOT, outPath).replace(/\\/g, '/')}`);
  }
  if (strict && hardErrors > 0) process.exit(1);
}


main();
