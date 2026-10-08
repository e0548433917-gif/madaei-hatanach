/**
 * שומר נגד היתקעות הוולידטור של אוצריא (#91).
 *
 *   שימוש:  node tools/check-comment-quotes.js
 *
 * Otzaria/otzaria-plugin-validator (src/extendedValidator.js, stripCommentsForScan)
 * "מחביא" מחרוזות לפני שהוא מסיר הערות — אבל מחפש אותן גם בתוך הערות `//`.
 * גרש ASCII בודד בהערה (״ר' docs/…״ במקום ״ר׳ docs/…״) נחשב לו תחילת מחרוזת,
 * הופך את זוגיות הגרשיים בהמשך הקובץ, ואז ה-regex של ליטרלי-regex רץ בזמן
 * ריבועי על שורה ארוכה. הוולידציה נתקעת, ה-Action נחתך ב-timeout והפרסום לחנות
 * לא קורה. כך היה עד 4.17.0 בגלל guides/animal/data/animal-data.js שורה 4.
 *
 * רוב הגרשים הבודדים בהערות לא מזיקים (הם נבלעים במחרוזת קצרה), ולכן הבדיקה
 * לא סופרת גרשים אלא מריצה בדיוק את שני ה-regex של הוולידטור על כל קובץ שנארז,
 * עם תקרת זמן. קובץ שחורג — נכשל, עם מספר השורה שבה מתחילה ה"מחרוזת" השגויה.
 * התיקון: ׳ (גרש עברי) או ״ (גרשיים) במקום ' או " בהערה שקודמת לשורה הזו.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// מועתק כלשונו מ-src/extendedValidator.js של הוולידטור.
const STR_RE = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g;
const REGEX_LIT_RE = /(^|[=(,;:!?~&|+\-*/%<>{}[\]]|=>|\breturn\b|\bthrow\b|\bin\b|\bof\b|\btypeof\b|\bdelete\b|\bvoid\b|\binstanceof\b|\bnew\b)(\s*)(\/(?:\\.|\[(?:\\.|[^\]\\\n\r])*\]|[^/\\\n\r])+?\/[gimsuyd]*)/g;

if (!isMainThread) {
  const text = fs.readFileSync(workerData, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  text.replace(STR_RE, ' STR ').replace(REGEX_LIT_RE, 'x');
  parentPort.postMessage('ok');
  return;
}

const LIMIT_MS = 3000;
const root = path.resolve(__dirname, '..');
const files = [];
(function walk(abs) {
  if (fs.statSync(abs).isDirectory()) {
    for (const n of fs.readdirSync(abs)) walk(path.join(abs, n));
  } else if (/\.(m?js|html|css)$/.test(abs)) files.push(abs);
})(root + path.sep + 'shell');
for (const s of ['index.html', 'background.html', 'guides']) {
  const p = path.join(root, s);
  if (!fs.existsSync(p)) continue;
  if (fs.statSync(p).isDirectory()) {
    (function walk(abs) {
      if (fs.statSync(abs).isDirectory()) {
        for (const n of fs.readdirSync(abs)) walk(path.join(abs, n));
      } else if (/\.(m?js|html|css)$/.test(abs)) files.push(abs);
    })(p);
  } else files.push(p);
}

// השורה הראשונה שבה ה"מחרוזת" של הוולידטור מתחילה בתוך הערת // — לדיווח.
function suspectLine(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const re = new RegExp(STR_RE.source, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const lineStart = text.lastIndexOf('\n', m.index) + 1;
    const before = text.slice(lineStart, m.index);
    if (/^\s*\/\//.test(before) && m[0].includes('\n')) {
      return text.slice(0, m.index).split('\n').length;
    }
  }
  return null;
}

function check(file) {
  return new Promise((resolve) => {
    const w = new Worker(__filename, { workerData: file });
    const t = setTimeout(() => { w.terminate(); resolve(false); }, LIMIT_MS);
    w.on('message', () => { clearTimeout(t); w.terminate(); resolve(true); });
    w.on('error', () => { clearTimeout(t); resolve(true); });
  });
}

(async () => {
  const bad = [];
  for (const f of files) if (!(await check(f))) bad.push(f);
  if (bad.length) {
    console.error(`${bad.length} קבצים תוקעים את ולידטור אוצריא (#91):`);
    for (const f of bad) {
      const ln = suspectLine(f);
      console.error(`  ${path.relative(root, f)}` + (ln ? ` — כנראה גרש/מירכאה ASCII בודדים בהערה בשורה ${ln}` : ''));
    }
    console.error("תיקון: ׳ (גרש עברי) או ״ (גרשיים) במקום ' או \" בהערה.");
    process.exit(1);
  }
  console.log(`בדיקת היתקעות הוולידטור עברה (${files.length} קבצים).`);
})();
