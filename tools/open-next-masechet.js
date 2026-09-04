#!/usr/bin/env node
/* פותח את שתי פניות מדריכי המסכתות הבאות בתור.
 *
 * למה סקריפט ולא GitHub Action: אוטומציה שפותחת פניות מעצמה בזמן שאיש לא
 * מסתכל (למשל הפסקה ארוכה) מציפה את הריפו בלי שאף אחד יעצור אותה. כאן
 * מישהו מריץ במודע, כשיש מי שיעבוד על התוצאה. ר' ההכרעה ב-Issue #81.
 *
 *   node tools/open-next-masechet.js            # יבש - מראה מה ייפתח
 *   node tools/open-next-masechet.js --write    # פותח בפועל
 *   node tools/open-next-masechet.js --write -n 3
 */
const { execFileSync } = require('child_process');
const fs = require('fs');

const WRITE = process.argv.includes('--write');
const N = (() => { const i = process.argv.indexOf('-n'); return i > 0 ? +process.argv[i + 1] : 2; })();
const LABEL = 'מדריך-מסכת';

// סדר התועלת שנקבע ב-#81: כלים ראשונה (הפיילוט), ואז אלה שדורשות הכי הרבה
// המחשה ויזואלית. השאר נגררים אחריהם לפי סדר הש"ס.
const PRIORITY = ['כלים', 'עירובין', 'מנחות', 'זבחים', 'אהלות', 'נגעים', 'פרה', 'מקוואות', 'תמיד', 'מידות'];

// מקור האמת לרשימת המסכתות - אין להמציא רשימה שנייה.
const shas = fs.readFileSync(`${__dirname}/../shell/shas.js`, 'utf8');
const block = shas.match(/const MISHNA_MASECHTOT = \[([\s\S]*?)\n\];/);
if (!block) { console.error('לא נמצא MISHNA_MASECHTOT ב-shell/shas.js'); process.exit(1); }
const ALL = [...block[1].matchAll(/name:\s*'([^']+)'[^}]*?seder:\s*'([^']+)'[^}]*?chapters:\s*(\d+)/g)]
  .map(m => ({ name: m[1], seder: m[2], chapters: +m[3] }));

const order = [...PRIORITY.filter(p => ALL.some(m => m.name === p)),
               ...ALL.map(m => m.name).filter(n => !PRIORITY.includes(n))];

const sh = a => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 1 << 24 }).trim();
const issues = JSON.parse(sh(['issue', 'list', '--state', 'all', '--limit', '300', '--json', 'number,title,state']));
const has = n => issues.find(i => i.title.includes(`מדריך מסכת ${n}`) || i.title.includes(`מסכת ${n} —`));
const openCount = issues.filter(i => i.state === 'OPEN' && /מדריך מסכת /.test(i.title)).length;

const next = order.filter(n => !has(n)).slice(0, N);

console.log(`מסכתות במקור: ${ALL.length} · פניות מדריך פתוחות כרגע: ${openCount}`);
if (openCount >= N && WRITE) {
  console.log(`\nיש כבר ${openCount} פניות מדריך פתוחות. סוגרים אותן לפני שפותחים הבאות — זה כל הרעיון של גל של ${N}.`);
  process.exit(0);
}
if (!next.length) { console.log('\nכל המסכתות כבר קיבלו פנייה. 🎉'); process.exit(0); }

const body = m => `> נפתחה אוטומטית מתוך **#81** (המפרט והתבנית למדריך מסכת), לפי \`tools/open-next-masechet.js\`.

**מסכת ${m.name}** · סדר ${m.seder} · ${m.chapters} פרקים.

## מבנה המדריך — לפי התבנית ב-#81

| ספר | יחידת הניווט | מה יש בכל יחידה |
|---|---|---|
| **משנה** | פרק → משנה | הסבר המשנה, ציור/דיאגרמה היכן שיש מה להראות, וכלים/צמחים/בע״ח שמוזכרים בה |
| **בבלי** | דף → עמוד (א/ב) | הסבר הסוגיה, מושגים, ומה שדורש המחשה |
| **ירושלמי** | פרק → הלכה | אותו דבר; אם אין ירושלמי למסכת — הטאב לא מוצג |

**שלושה טאבים, ניווט עצמאי לכל אחד**, וקישור צולב ביניהם היכן שהם עוסקים באותו עניין.
כל ערך שכבר קיים באחד מששת המדריכים — **מקושר, לא משוכפל.**

## לפני שמתחילים

* **#81** — התבנית והסכימה. אם משהו בה עוד לא הוכרע, מכריעים שם ולא כאן.
* **#95 (מסכת כלים)** — הפיילוט. מה שנבנה שם הוא התקדים; לא להמציא מבנה שני.
* 🔴 **#79 (מ.1 — מפרט ref תלמודי)** — פורמט מסכת/דף/עמוד חייב להיות סגור לפני שבונים עליו ניווט.
* **#82 (ת.11ו)** — מה מותר לשאוב ממדריכי המכונים (גרנשטין, מראה כהן וכו׳). ⚠️ זכויות יוצרים.

---
⚠️ **לפני שמתחילים — [#77](../../issues/77): כלל מקדים לכל משימת תוכן** (סגנון כתיבה + מעבר ביקורת נפרד).`;

for (const name of next) {
  const m = ALL.find(x => x.name === name);
  if (!WRITE) { console.log(`  [יבש] מדריך מסכת ${name} (סדר ${m.seder}, ${m.chapters} פרקים)`); continue; }
  const url = sh(['issue', 'create', '--title', `מדריך מסכת ${name}`,
    '--label', 'תכנון שדרוג', '--label', 'enhancement', '--label', LABEL, '--body', body(m)]);
  console.log(`  ✚ ${url}  מדריך מסכת ${name}`);
}
if (!WRITE) console.log(`\nלהרצה בפועל: node tools/open-next-masechet.js --write`);
