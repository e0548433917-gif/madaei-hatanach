// הרכבת דוח ה-Markdown — משימה ת.0. ר' tools/validate.js.
'use strict';

const { normName } = require('./util');
const { REL_FIELDS, stripQualifier } = require('./checks');
const { groupBy, mdTable, catLabelMap } = require('./md');

function renderReport({ guides, res, totalEntries, parsers }) {
  const L = [];
  const p = (s) => L.push(s == null ? '' : s);
  const people = guides.find((g) => g.id === 'people');
  const peopleCats = catLabelMap(people.cats);

  const sumRefs = (id) => res.refs[id].bad.reduce((a, b) => a + b.count, 0);
  const totalBadRefs = guides.reduce((s, g) => s + sumRefs(g.id), 0);
  const totalRefs = guides.reduce((s, g) => s + res.refs[g.id].total, 0);
  const totalNoImg = guides.reduce((s, g) => s + res.images[g.id].length, 0);
  const totalReqMissing = guides.reduce((s, g) => s + res.fields[g.id].missingRequired.length, 0);

  p('# דוח ולידציה — תמונ״ך');
  p('');
  p(`נוצר על ידי \`tools/validate.js\`. **הסקריפט לא שינה שום קובץ** — זהו דוח בלבד.`);
  p('');
  p(`**היקף:** ${totalEntries} רשומות בשישה מדריכים.`);
  p('');
  p(mdTable(['מדריך', 'רשומות', 'תת-קטגוריות', 'בנק תמונות (CARD_IMAGES)'],
    guides.map((g) => [g.label, g.data.length, g.cats.length, g.images ? `${Object.keys(g.images).length} מפתחות` : 'אין בכלל'])));
  p('');
  p('## תקציר הממצאים');
  p('');
  const mtReal = res.missingTargets.filter((r) => r.kind !== 'descriptive').length;
  p(mdTable(['#', 'בדיקה', 'ממצאים'], [
    ['1', 'קשרי משפחה שאינם מוצאים רשומה', `${mtReal} דורשים טיפול (+${res.missingTargets.length - mtReal} תיאוריים תקינים)`],
    ['2', 'בני זוג לא הדדיים', res.spouses.length],
    ['3א-1', '**סתירה** — לילד רשום הורה אחר (סביר: הקישור נצמד לאדם הלא נכון)', res.parentChild.childNoParent.filter((r) => r.kind === 'conflict').length],
    ['3א-2', 'חוסר הדדיות בלבד — שדות ההורה של הילד ריקים', res.parentChild.childNoParent.filter((r) => r.kind !== 'conflict').length],
    ['3ב', 'הורה שרשום כהורה של X, אבל אינו רושם את X כילד', res.parentChild.parentNoChild.length],
    ['3ג', 'אחים לא הדדיים', res.parentChild.siblingOneWay.length],
    ['3ד', '**קשרים שאי אפשר להכריע** — מפנים לשם שנישא בידי כמה אישים', res.parentChild.undecidable.length],
    ['3ה', 'כפילות בתוך שדה קשר (שתי מחרוזות → אותה רשומה)', res.parentChild.dupRelations.length],
    ['3ו', 'רשומות בלי שום קשר משפחתי (חֶסֶר תוכן, לא סתירה — כאן יושבים ״בני המן״)', res.orphans.length],
    ['4', 'שדות חובה חסרים', totalReqMissing],
    ['5', `מראי מקום שאינם נפרסים (מתוך ${totalRefs})`, totalBadRefs],
    ['6', 'ערכים בלי תמונה', totalNoImg],
  ]));
  p('');
  p('---');
  p('');

  // ---- 1 ----
  p('## 1. קשרי משפחה שאינם מוצאים רשומה');
  p('');
  p('נבדקו השדות `father` · `mother` · `spouses` · `children` · `siblings` במדריך אישים');
  p('(היחיד שיש בו קשרי משפחה). ערך נחשב "קיים" אם הוא מתאים ל-`name` או לאחד מ-`aliases`');
  p('של רשומה כלשהי, אחרי נרמול ניקוד/גרשיים/מקפים.');
  p('');
  const qual = res.missingTargets.filter((r) => r.kind === 'qualifier');
  const real = res.missingTargets.filter((r) => r.kind === 'missing');
  const descr = res.missingTargets.filter((r) => r.kind === 'descriptive');
  p(`**${res.missingTargets.length} הפניות שאינן מוצאות רשומה**, בשלוש קבוצות שונות לחלוטין מבחינת מה שצריך לעשות איתן:`);
  p('');
  p(mdTable(['הקבוצה', 'כמה', 'מה זה', 'הטיפול ב-ת.1'], [
    ['**א. שם + הבהרה בסוגריים**', qual.length,
      'הרשומה קיימת! המחרוזת פשוט נושאת סוגריים — ״אמנון (בכורו, בן אחינעם היזרעאלית)״',
      'להסיר את ההבהרה מהמחרוזת, **או** ללמד את הקוד להתעלם ממנה'],
    ['**ב. שם ממשי בלי רשומה**', real.length,
      'שם אמיתי שאין לו ערך במדריך',
      'ליצור רשומה, או לתקן שגיאת כתיב'],
    ['**ג. ניסוח תיאורי**', descr.length,
      '״בנים ובנות נוספים (לא נקראו בשם)״ — לא שם של אדם',
      '**לא לגעת.** תקין כפי שהוא'],
  ]));
  p('');
  p('### פילוח לפי שדה');
  p('');
  p(mdTable(['שדה', 'א. סוגריים', 'ב. חסר', 'ג. תיאורי', 'סה״כ'],
    REL_FIELDS.map((f) => {
      const all = res.missingTargets.filter((r) => r.field === f.key);
      return [`\`${f.key}\` (${f.label})`,
        all.filter((r) => r.kind === 'qualifier').length,
        all.filter((r) => r.kind === 'missing').length,
        all.filter((r) => r.kind === 'descriptive').length,
        all.length];
    })));
  p('');
  p('### א. שם + הבהרה בסוגריים — הרשומה קיימת, הקישור לא נוצר');
  p('');
  p('**זו הקבוצה החשובה ביותר בבדיקה הזו.** כל שורה כאן היא קישור משפחתי שקיים בדאטה');
  p('אבל **לא יעבוד** בעץ המשפחה של משימה 2.6, כי המחרוזת אינה זהה לשם הרשומה.');
  p('התיקון זול: או ניקוי הסוגריים, או `stripQualifier` בצד הקוד — והוא פותר את כולן במכה אחת.');
  p('');
  p(mdTable(['הרשומה', 'שדה', 'המחרוזת שנכתבה', '→ הרשומה שהיא באמת מתכוונת אליה'],
    qual.map((r) => [r.from, `\`${r.field}\``, r.target, r.resolvedTo])));
  p('');
  p('### ב. שמות ממשיים שאין להם רשומה');
  p('');
  p('״מוזכר ב״ = כמה רשומות מפנות אליו. שם שמוזכר פעמים רבות הוא כמעט תמיד רשומה שצריך');
  p('ליצור; שם יחיד — לרוב שגיאת כתיב.');
  p('');
  {
    const byTarget = groupBy(real, (r) => normName(r.target));
    const rows = [...byTarget.entries()]
      .map(([, arr]) => ({
        target: arr[0].target,
        n: arr.length,
        fields: [...new Set(arr.map((r) => r.field))].join(', '),
        from: arr.slice(0, 4).map((r) => r.from).join(' · ') + (arr.length > 4 ? ` … (+${arr.length - 4})` : ''),
      }))
      .sort((a, b) => b.n - a.n || a.target.localeCompare(b.target, 'he'));
    p(mdTable(['היעד החסר', 'מוזכר ב', 'בשדות', 'מי מפנה אליו'],
      rows.map((r) => [r.target, r.n, r.fields, r.from])));
  }
  p('');
  p('### ג. ניסוחים תיאוריים — תקינים, לא לגעת');
  p('');
  p('<details><summary>הרשימה המלאה (לעיון בלבד)</summary>');
  p('');
  p(mdTable(['רשומה', 'שדה', 'הטקסט'], descr.map((r) => [r.from, r.field, r.target])));
  p('');
  p('</details>');
  p('');
  p('---');
  p('');

  // ---- 2 ----
  p('## 2. בני זוג לא הדדיים');
  p('');
  p('א׳ רשום כבן/בת זוג אצל ב׳, אבל ב׳ אינו רושם את א׳ בחזרה. שתי הרשומות קיימות —');
  p('אחרת הממצא היה מופיע בבדיקה 1.');
  p('');
  p(`**${res.spouses.length} ממצאים.**`);
  p('');
  p(mdTable(['הרשומה שרושמת', '← בן/בת הזוג שלא רושם בחזרה', 'מה כן רשום אצלו ב-spouses'],
    res.spouses.map((r) => [r.from, r.to, r.otherSpouses.length ? r.otherSpouses.join(' · ') : '(ריק)'])));
  p('');
  p('---');
  p('');

  // ---- 3 ----
  p('## 3. ילדים בלי הורה מקביל, והורים בלי ילד מקביל');
  p('');
  p('### 3א. X רושם את Y כילד — אבל Y אינו רושם את X כאב או כאם');
  p('');
  {
    const conflict = res.parentChild.childNoParent.filter((r) => r.kind === 'conflict');
    const missing = res.parentChild.childNoParent.filter((r) => r.kind !== 'conflict');
    p(`**${res.parentChild.childNoParent.length} ממצאים**, בשתי רמות חומרה שונות מאוד:`);
    p('');
    p(`#### 3א-1. סתירה חזיתית — לילד כבר רשום הורה **אחר** (${conflict.length})`);
    p('');
    p('**זו הקבוצה שדורשת החלטה אנושית, לא תיקון מכני.** שתי אפשרויות לכל שורה:');
    p('');
    p('1. אחד משני השדות פשוט שגוי; **או**');
    p('2. — והסביר יותר — **הקישור מצביע על האדם הלא נכון בעל אותו שם.** למשל ״רמון״ רושם');
    p('   ילד בשם ״חם״, והרשומה היחידה בשם ״חם״ היא בנו של נח. אלה שני אנשים שונים, אבל');
    p('   בדאטה יש רק שם — ולכן הקישור נצמד לרשומה הלא נכונה בלי שום סימן אזהרה.');
    p('');
    p('שימו לב: **המקרה השני אינו נספר ב-3ה** (״שם דו-משמעי״), כי לאדם השני אין רשומה כלל,');
    p('ולכן השם נראה חד-משמעי. זו נקודת העיוורון הגדולה של קישור-לפי-שם.');
    p('');
    p(mdTable(['ההורה (רשם את הילד)', 'הילד', '`father` של הילד', '`mother` של הילד'],
      conflict.map((r) => [r.parent, r.child, r.childFather, r.childMother])));
    p('');
    p(`#### 3א-2. חוסר הדדיות בלבד — שדות ההורה של הילד ריקים (${missing.length})`);
    p('');
    p('אין כאן סתירה, רק חֶסֶר. תיקון מכני: להשלים `father`/`mother` אצל הילד.');
    p('');
    p('<details><summary>הרשימה המלאה</summary>');
    p('');
    p(mdTable(['ההורה', 'הילד'], missing.map((r) => [r.parent, r.child])));
    p('');
    p('</details>');
    p('');
  }
  p('### 3ב. Y רושם את X כהורה — אבל X אינו רושם את Y ב-`children`');
  p('');
  p(`**${res.parentChild.parentNoChild.length} ממצאים.**`);
  p('');
  p(mdTable(['הילד (רשם את ההורה)', 'התפקיד', 'ההורה', 'כמה ילדים רשומים אצל ההורה'],
    res.parentChild.parentNoChild.map((r) => [r.child, r.role, r.parent, r.childrenCount])));
  p('');
  p('### 3ג. אחים לא הדדיים');
  p('');
  p('לא נדרש מפורשות ב-ת.0, אך נמצא באותה סריקה. א׳ רושם את ב׳ כאח — ב׳ לא רושם בחזרה.');
  p('');
  p(`**${res.parentChild.siblingOneWay.length} ממצאים.**`);
  p('');
  p('<details><summary>הרשימה המלאה</summary>');
  p('');
  p(mdTable(['רושם', '← אינו רושם בחזרה'], res.parentChild.siblingOneWay.map((r) => [r.from, r.to])));
  p('');
  p('</details>');
  p('');
  p('### 3ד. קשרים שאי אפשר להכריע — שמות שנישאים בידי כמה אישים');
  p('');
  p('**זו המגבלה החשובה ביותר של הדוח הזה, וחשוב להבין אותה לפני שמתקנים משהו.**');
  p('שמות מקראיים רבים נישאים בידי יותר מאדם אחד — יש כמה ״ראש״, כמה ״אמנון״, כמה ״שמעא״ —');
  p('ובשדות הקשר נכתב **רק השם**, בלי שום דרך לדעת לאיזה מהם הכוונה.');
  p('');
  p('גרסה קודמת של הסקריפט בחרה שרירותית את הרשומה הראשונה בעלת אותו שם, וייצרה ממצאי');
  p('שווא כמו ״רמון רשם את חם כילד, אבל אביו של חם הוא נח״ — שני ״חם״ שונים לגמרי.');
  p('**עכשיו כל קשר כזה מסומן כבלתי-ניתן-להכרעה ומדווח כאן, ולא נספר כשגיאה.**');
  p('');
  p(`**${res.parentChild.undecidable.length} קשרים** אינם ניתנים להכרעה.`);
  p('');
  {
    const byTarget = groupBy(res.parentChild.undecidable, (r) => normName(stripQualifier(r.target)));
    p(mdTable(['השם הדו-משמעי', 'כמה רשומות נושאות אותו', 'כמה קשרים תלויים בו', 'הסיבה'],
      [...byTarget.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 60)
        .map(([, arr]) => [arr[0].target, arr[0].n, arr.length, [...new Set(arr.map((r) => r.why))].join(' · ')])));
    if (byTarget.size > 60) p(`_(מוצגים 60 מתוך ${byTarget.size} שמות)_\n`);
  }
  p('');
  p('**המסקנה למשימה 2.6 (עץ משפחה):** עץ משפחה שמקשר לפי שם בלבד יחבר אנשים לא נכונים.');
  p('לפני 2.6 צריך מזהה ייחודי לכל רשומה (`id`), ושדות הקשר צריכים להצביע עליו ולא על השם.');
  p('');
  p('### 3ה. כפילות בתוך שדה קשר');
  p('');
  p('שתי מחרוזות שונות באותו שדה מצביעות על אותה רשומה — למשל `children` שמכיל גם ״לבן״');
  p('וגם ״לבן (הארמי)״. בעץ המשפחה זה יופיע כשני ילדים.');
  p('');
  p(mdTable(['הרשומה', 'השדה', 'שתי המחרוזות', '→ אותה רשומה'],
    res.parentChild.dupRelations.map((r) => [r.from, `\`${r.field}\``, r.strings.join(' + '), r.target])));
  p('');
  p('### 3ו. רשומות בלי שום קשר משפחתי — ולמה ״בני המן״ לא מופיע בדוח הזה');
  p('');
  p('**נבדק במפורש: המקרה של ״בני המן״ אינו ניתן לגילוי אוטומטי.** ל-`פרשנדתא` אין `father`,');
  p('ול-`המן` אין `children`, ואין ב-`note`/`roles` שלהם שום טקסט שרומז על הקשר. אין סתירה');
  p('בין שתי הרשומות — פשוט אין ביניהן שום קשר רשום. אותו דבר ב-`זרש` ו-`המן`: שניהם עם');
  p('`spouses` ריק. **חֶסֶר תוכן אינו סתירה, ולכן שום בדיקת עקביות לא תתפוס אותו.**');
  p('');
  p(`להלן **${res.orphans.length} הרשומות שכל חמשת שדות הקשר שלהן ריקים** — הבריכה שממנה`);
  p('ת.1 צריך לשלות ידנית. פילוח לפי ספר, כדי לעבוד בצורה ממוקדת:');
  p('');
  {
    const byCat = groupBy(res.orphans, (r) => r.cat);
    p(mdTable(['ספר / תת-קטגוריה', 'כמה'],
      [...byCat.entries()].sort((a, b) => b[1].length - a[1].length)
        .map(([cat, arr]) => [`${peopleCats.get(cat) || cat} \`${cat}\``, arr.length])));
    p('');
    p('<details><summary>הרשימה המלאה, לפי ספר</summary>');
    p('');
    [...byCat.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([cat, arr]) => {
      p(`**${peopleCats.get(cat) || cat}** (${arr.length}): ` + arr.map((r) => r.name).join(' · '));
      p('');
    });
    p('</details>');
  }
  p('');
  p('---');
  p('');

  // ---- 4 ----
  p('## 4. שדות חובה חסרים לפי הקטגוריה');
  p('');
  p('**כללי החובה נגזרו מהדאטה עצמו**, לא הומצאו: שדה מוגדר חובה אם הוא מלא ב-100%');
  p('מהרשומות של אותה קטגוריה בגרסה 2.11.3 — כלומר כל חריגה היא שבירה אמיתית של הדפוס.');
  p('שדה שכבר היום חסר בחלק מהרשומות נרשם כ**מומלץ**, ומדווח בנפרד כמשימת השלמה.');
  p('הכללים יושבים ב-`FIELD_RULES` בראש הסקריפט וניתן לשנותם.');
  p('');
  p(mdTable(['מדריך', 'שדות חובה', 'שדות מומלצים', 'חובה חסר', 'מומלץ חסר', '`cat` לא מוכר', 'שמות כפולים'],
    guides.map((g) => {
      const f = res.fields[g.id];
      return [g.label, f.rules.required.map((x) => `\`${x}\``).join(' '), f.rules.recommended.map((x) => `\`${x}\``).join(' ') || '—',
        f.missingRequired.length, f.missingRecommended.length, f.unknownCat.length, res.dupes[g.id].length];
    })));
  p('');
  guides.forEach((g) => {
    const f = res.fields[g.id];
    const dup = res.dupes[g.id];
    if (!f.missingRequired.length && !f.missingRecommended.length && !f.unknownCat.length && !dup.length) return;
    p(`### ${g.label}`);
    p('');
    if (f.missingRequired.length) {
      p('**שדות חובה חסרים:**');
      p('');
      p(mdTable(['ערך', 'תת-קטגוריה', 'השדה החסר'], f.missingRequired.map((r) => [r.name, r.cat, `\`${r.field}\``])));
      p('');
    }
    if (f.unknownCat.length) {
      p('**`cat` שאינו קיים ברשימת ה-CATS של המדריך:**');
      p('');
      p(mdTable(['ערך', '`cat`'], f.unknownCat.map((r) => [r.name, r.cat])));
      p('');
    }
    if (dup.length) {
      p('**שמות כפולים:**');
      p('');
      p(mdTable(['שם', 'אינדקס'], dup.map((r) => [r.name, r.index])));
      p('');
    }
    if (f.missingRecommended.length) {
      const byField = groupBy(f.missingRecommended, (r) => r.field);
      p('**שדות מומלצים חסרים** (השלמת תוכן, לא שבירה):');
      p('');
      p(mdTable(['השדה', 'כמה ערכים', 'הערכים'],
        [...byField.entries()].map(([field, arr]) => [
          `\`${field}\``, arr.length,
          arr.slice(0, 25).map((r) => r.name).join(' · ') + (arr.length > 25 ? ` … (+${arr.length - 25})` : ''),
        ])));
      p('');
    }
  });
  p('---');
  p('');

  // ---- 5 ----
  p('## 5. מראי מקום שאינם נפרסים');
  p('');
  p('מראה מקום שאינו נפרס = הכיתוב מוצג בכרטיס, אבל **אין ״↗ פתח בספרייה״** ולחיצה עליו');
  p('לא עושה כלום. שני נתיבים שונים, בדיוק כמו ב-`entry-detail.js`:');
  p('');
  p('* `verses` / `makorot` → **`parseAnyRef`** (פסוק, ואם לא — מקור חז״ל)');
  p('* `midrash` → **`parseMidrashRef` בלבד** (שורה 234 ב-`entry-detail.js`) — ולכן מראה מקום');
  p('  תנ״כי רגיל בשדה `midrash` נכשל גם אם `parseAnyRef` היה פורס אותו. הטור ״נפרס ב-parseAnyRef?״ מסמן בדיוק את המקרים האלה.');
  p('');
  p(`נבדקו **${totalRefs}** מראי מקום; **${totalBadRefs}** אינם נפרסים (${(totalBadRefs / Math.max(totalRefs, 1) * 100).toFixed(1)}%).`);
  p('');
  p(mdTable(['מדריך', 'סה״כ מראי מקום', 'לא נפרסים', 'תבניות ייחודיות'],
    guides.map((g) => [g.label, res.refs[g.id].total, sumRefs(g.id), res.refs[g.id].bad.length])));
  p('');
  p('### סיבות השורש — כאן נמצא הרווח האמיתי');
  p('');
  p('**כל סיווג כאן אומת בפועל:** הסקריפט תיקן את מראה המקום בדרך אחת, הריץ שוב את *אותו*');
  p('פרסר, וסיווג רק אם הפעם הוא באמת נפרס. אין ניחוש. לכל סיבה יש תיקון אחד שפותר את כל');
  p('השורות שלה בבת אחת.');
  p('');
  p('> ⚠️ **מה ״נפרס״ מוכיח, ומה לא.** הוא מוכיח שהמחרוזת עוברת את `parseAnyRef`/`parseMidrashRef`');
  p('> ומייצרת `bookId`. הוא **אינו** מוכיח שה-`bookId` הזה הוא ספר שקיים בספריית אוצריא.');
  p('> לדוגמה, ״אוצר מדרשים, חופת אליהו רבה, ריג״ נפרס אחרי התיקון ל-`bookId` בשם');
  p('> ״אוצר מדרשים על חופת אליהו״ — שם שכנראה אינו קיים. לכן הטבלאות המפורטות מציגות את');
  p('> ה-`bookId` שנוצר, ו-ת.1 חייב לעבור עליו בעין.');
  p('');
  {
    const all = guides.flatMap((g) => res.refs[g.id].bad.map((r) => ({ ...r, guide: g.label })));
    const byCause = groupBy(all, (r) => r.cause);
    p(mdTable(['סיבת השורש', 'תבניות', 'מופעים', 'איפה', 'דוגמה'],
      [...byCause.entries()]
        .sort((a, b) => b[1].reduce((s, r) => s + r.count, 0) - a[1].reduce((s, r) => s + r.count, 0))
        .map(([cause, arr]) => [
          cause, arr.length, arr.reduce((s, r) => s + r.count, 0),
          [...new Set(arr.map((r) => r.guide))].join(' · '),
          `\`${arr[0].ref}\`` + (arr[0].fixed ? ` → \`${arr[0].fixed}\`` : ''),
        ])));
    p('');
    const spelling = all.filter((r) => r.cause === 'כתיב שונה של שם הספר');
    if (spelling.length) {
      const variants = groupBy(spelling, (r) => r.detail);
      p('**התיקון הזול ביותר בכל הדוח — כתיב שם הספר:**');
      p('');
      p(mdTable(['הכתיב בדאטה ← הכתיב שב-`TANAKH_BOOKS`', 'מופעים', 'מדריכים'],
        [...variants.entries()]
          .sort((a, b) => b[1].reduce((s, r) => s + r.count, 0) - a[1].reduce((s, r) => s + r.count, 0))
          .map(([d, arr]) => [d, arr.reduce((s, r) => s + r.count, 0), [...new Set(arr.map((r) => r.guide))].join(' · ')])));
      p('');
      p('אפשר לתקן משני הכיוונים: החלפה בדאטה, **או** הוספת הכתיב החלופי ל-`TANAKH_BOOKS`');
      p('ב-`shell/refs.js:5` — הכיוון השני זול יותר ועמיד לדאטה עתידי.');
      p('');
    }
  }
  guides.forEach((g) => {
    const bad = res.refs[g.id].bad;
    if (!bad.length) return;
    p(`### ${g.label} — ${sumRefs(g.id)} מראי מקום ב-${bad.length} תבניות`);
    p('');
    p('<details><summary>הרשימה המלאה, לפי שכיחות</summary>');
    p('');
    p(mdTable(['מראה המקום', 'מופעים', 'השדה', 'סיבת השורש', 'אחרי תיקון', '→ bookId שייפתח בספרייה', 'נפרס ב-parseAnyRef?', 'דוגמאות'],
      bad.map((r) => [r.ref, r.count, `\`${r.field}\``, r.cause, r.fixed ? `\`${r.fixed}\`` : '—',
        r.bookId ? `\`${r.bookId}\` · ${r.fixedRef}` : '—',
        r.rescuedByAnyRef ? '**כן — יינצל בשינוי שורה אחת**' : 'לא', r.samples.join(' · ')])));
    p('');
    p('</details>');
    p('');
  });
  p('---');
  p('');

  // ---- 6 ----
  p('## 6. ערכים בלי תמונה — רשימת העבודה של ת.4');
  p('');
  p('הקריטריון זהה ל-`lookupEntryImage` ב-`shell/guides.js`: לערך יש תמונה אם `img` שלו');
  p('קיים כמפתח ב-`CARD_IMAGES`, **או** אם `methods[0].wiki` קיים שם. אין תמונה = הכרטיס');
  p('נפתח בלי דימוי כלל.');
  p('');
  p('> ⚠️ **שני המדריכים אישים ומקומות אינם כוללים `CARD_IMAGES` בכלל** — אין להם מנגנון תמונה');
  p('> מוטבע, ולכן כל הרשומות שלהם נספרות כאן כ״בלי תמונה״. עבור **מקומות** זו החלטת עיצוב');
  p('> (יש מפת Leaflet במקום), ועבור **אישים** אין ממילא ״תמונה של אדם״ מהתנ״ך. **רשימת העבודה');
  p('> המעשית של ת.4 היא ארבעת המדריכים האחרים בלבד**, והם מפורטים ראשונים.');
  p('');
  const imgOrder = ['domem', 'beithamikdash', 'animal', 'flora', 'places', 'people'];
  p(mdTable(['מדריך', 'סה״כ', 'עם תמונה', 'בלי תמונה', 'אחוז חסר'],
    imgOrder.map((id) => {
      const g = guides.find((x) => x.id === id);
      const missing = res.images[id].length;
      return [g.label, g.data.length, g.data.length - missing, missing, `${(missing / Math.max(g.data.length, 1) * 100).toFixed(0)}%`];
    })));
  p('');
  ['domem', 'beithamikdash', 'animal', 'flora'].forEach((id) => {
    const g = guides.find((x) => x.id === id);
    const missing = res.images[id];
    const labels = catLabelMap(g.cats);
    p(`### ${g.label} — ${missing.length} ערכים בלי תמונה`);
    p('');
    if (!missing.length) { p('_כל הערכים מצוידים בתמונה._'); p(''); return; }
    const byCat = groupBy(missing, (r) => r.cat);
    p(mdTable(['תת-קטגוריה', 'כמה', 'הערכים'],
      [...byCat.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([cat, arr]) => [`${labels.get(cat) || cat} \`${cat}\``, arr.length, arr.map((r) => r.name).join(' · ')])));
    p('');
  });
  ['places', 'people'].forEach((id) => {
    const g = guides.find((x) => x.id === id);
    p(`### ${g.label} — ${res.images[id].length} ערכים (אין למדריך בנק תמונות)`);
    p('');
    p('אין `CARD_IMAGES` במדריך זה, ולכן אין תמונה לאף ערך. **לא רשימת עבודה — החלטת ארכיטקטורה.**');
    p('');
  });
  p('---');
  p('');
  p('## הרצה חוזרת');
  p('');
  p('```bash');
  p('node tools/validate.js');
  p('```');
  p('');
  p('`--strict` יוצא בקוד 1 כשיש שגיאה חמורה (בדיקות 1–4) — מיועד ל-GitHub Action של משימה 5.3.');
  p('`--out <path>` כותב את הדוח למקום אחר. `--quiet` משתיק את הפלט למסך.');
  p('');
  return L.join('\n');
}


module.exports = { renderReport };
