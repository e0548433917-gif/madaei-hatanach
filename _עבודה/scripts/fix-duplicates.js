// תיקון כפילויות שנוצרו בהוספות 01/09/2026.
// השורש: בדיקת הכפילות שלי השוותה מחרוזת מדויקת, והערכים הקיימים כתובים
// בכתיב חסר (קפוד, קנמון, בת היענה) בעוד קובץ המקור נתן כתיב מלא.
// הפתרון: מוחקים את הערך שהוספתי, ומעבירים את השם שלו ל-aliases של הערך
// הקיים — כך החיפוש ימשיך למצוא גם את הכתיב המלא.
const fs = require('fs');

const MERGE = [
  // [קובץ, השם שנמחק (שלי), השם שנשאר (הקיים), כינויים להוסיף לקיים]
  ['guides/animal/data/animal-data.js', 'קיפוד',     'קפוד',      ['קיפוד','קפודיא']],
  ['guides/animal/data/animal-data.js', 'בת יענה',   'בת היענה',  ['בת יענה','יען']],
  ['guides/flora/data/flora-data.js',   'קינמון',    'קנמון',     ['קינמון']],
];

let report = [];
for (const [p, dropName, keepName, addAliases] of MERGE) {
  let s = fs.readFileSync(p, 'utf8');
  const quoted = p.includes('flora') ? false : true;   // flora משתמש במפתחות בלי מרכאות

  // --- 1. מציאת גבולות האובייקט של הערך שנמחק, וחיתוכו ---
  const needle = quoted ? '{"name":"' + dropName + '"' : '{name:"' + dropName + '"';
  const start = s.indexOf(needle);
  if (start < 0) { report.push('דילוג (לא נמצא): ' + dropName); continue; }
  let depth = 0, end = -1;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) { report.push('שגיאה: לא נמצא סוף האובייקט ' + dropName); continue; }
  let cut = s.slice(start, end);
  // בולעים גם את הפסיק שאחריו (או שלפניו, אם זה האיבר האחרון)
  let after = end;
  while (after < s.length && /[\s,]/.test(s[after])) { if (s[after] === ',') { after++; break; } after++; }
  s = s.slice(0, start) + s.slice(after);

  // --- 2. הוספת הכינויים לערך שנשאר ---
  const keepNeedle = quoted ? '"name":"' + keepName + '"' : 'name:"' + keepName + '"';
  const ki = s.indexOf(keepNeedle);
  if (ki < 0) { report.push('⚠️ ' + dropName + ' נמחק אבל ' + keepName + ' לא נמצא!'); }
  else {
    const aliasRe = quoted ? /"aliases":\[([^\]]*)\]/ : /aliases:\[([^\]]*)\]/;
    const seg = s.slice(ki, ki + 600);
    const m = seg.match(aliasRe);
    if (m) {
      const cur = m[1].trim();
      const existing = cur ? cur.split(',').map(x => x.trim().replace(/^"|"$/g, '')) : [];
      const merged = [...new Set([...existing, ...addAliases])];
      const rebuilt = (quoted ? '"aliases":[' : 'aliases:[') + merged.map(x => JSON.stringify(x)).join(',') + ']';
      s = s.slice(0, ki) + seg.replace(aliasRe, rebuilt) + s.slice(ki + 600);
    } else {
      // אין שדה aliases כלל — מוסיפים אחד מיד אחרי name
      const ins = ki + keepNeedle.length;
      s = s.slice(0, ins) + (quoted ? ',"aliases":' : ', aliases:') + JSON.stringify(addAliases) + s.slice(ins);
    }
  }
  fs.writeFileSync(p, s);
  report.push('מוזג: ' + dropName + ' → ' + keepName + '  (+כינויים: ' + addAliases.join(', ') + ')');
}
console.log(report.join('\n'));
