// ביקורת סגירה: מוודא ששינויי השיחה קיימים בפועל בעץ העבודה ובגיט,
// ושכל משימה שנרשמה מופיעה בתיעוד. הרצה: node _עבודה/scripts/audit-session.js
const {execSync} = require('child_process');
const fs = require('fs');
const q = c => { try { return execSync(c,{encoding:'utf8'}).trim(); } catch(e){ return String(e.stdout||'').trim() || 'ERR'; } };  // הוולידטור יוצא בקוד שגיאה כשיש ממצאים - הפלט עדיין תקף
const load = (p, strip=true) => { let s=fs.readFileSync(p,'utf8'); if(strip) s=s.replace(/^\/\/.*$/gm,''); return (0,eval)(s+';DATA'); };
const has = (p, needle) => fs.readFileSync(p,'utf8').includes(needle);

let ok=[], bad=[];
const check=(label,cond,detail='')=> (cond?ok:bad).push(label+(detail?'  — '+detail:''));

// ── 1. מצב הגיט ─────────────────────────────────────────────
const behind = q('git log --oneline HEAD..origin/main');
const dirty  = q('git status --short').split('\n').filter(l=>l && !l.startsWith('??'));
check('הכל נדחף (אין קומיטים מקומיים לא-דחופים)', q('git log --oneline origin/main..HEAD')==='');
check('אין פיגור מול origin/main', behind==='');
check('אין שינויים לא-מקומטים שלי', dirty.length===0, dirty.join(' | ') || '');

// ── 2. תוכן שנוסף — קיים בפועל? ─────────────────────────────
const A=load('guides/animal/data/animal-data.js');
const D=load('guides/domem/data/domem-data.js');
const F=load('guides/flora/data/flora-data.js', false);
const P=load('guides/places/data/places.js');
check('בע״ח: 130 ערכים', A.length===130, 'בפועל '+A.length);
check('בע״ח: אין k חסר', A.filter(e=>e.k===null||e.k===undefined).length===0);
check('בע״ח: 5 ערכי K.special עם note', A.filter(e=>e.k==='K.special'&&e.note).length===5);
check('דומם: 392 ערכים', D.length===392, 'בפועל '+D.length);
check('דומם: ששת הערכים החדשים עם makorot',
      ['טלית','סודר','חלוק','עומר','סאה','קב'].every(n=>{const e=D.find(x=>x.name===n); return e&&e.makorot&&e.makorot.length;}));
check('צומח: 124 ערכים', F.length===124, 'בפועל '+F.length);
check('צומח: קנמון עם alias קינמון', (F.find(e=>e.name==='קנמון')?.aliases||[]).includes('קינמון'));
check('מקומות: 322 ערכים', P.length===322, 'בפועל '+P.length);
check('מקומות: 5 ערכי bavel', P.filter(e=>e.cat==='bavel').length===5);
check('מפה: צבע לקטגוריית bavel', has('guides/places/js/map.js','bavel:'));

// ── 3. אין כפילויות ─────────────────────────────────────────
const norm=s=>String(s||'').replace(/[\u0591-\u05C7]/g,'').replace(/["'׳״]/g,'').replace(/\s+/g,' ').trim();
for(const [g,DD] of [['animal',A],['domem',D],['flora',F]]){
  const by={}; DD.forEach(e=>{const k=norm(e.name);(by[k]=by[k]||[]).push(1)});
  const dup=Object.entries(by).filter(([,v])=>v.length>1).map(([k])=>k);
  check(g+': אין כפילות שם', dup.length===0, dup.join(', '));
}

// ── 4. תיקוני הקוד של הדיווחים ──────────────────────────────
check('דיווחים: ה-Web App נשלח תמיד', has('shell/personal.js','if (REPORT_WEBAPP_URL){\n    try { ok.push(await postViaWebApp'));
check('דיווחים: מייל חובה', has('shell/personal.js','isValidReplyEmail'));
check('דיווחים: המרה לטקסט קריא', has('shell/personal.js','markdownToPlain'));
check('עריכות: סימון נשלח', has('shell/data.js','markEntryEditSent'));
check('מפה: גלגל ההגדרות מוסתר במסך מלא', has('guides/places/css/map.css','map-fullscreen-open #settingsBtn'));

// ── 5. תיעוד ─────────────────────────────────────────────────
check('ROADMAP: סדר עדיפויות', has('ROADMAP.md','סדר העדיפויות'));
check('ROADMAP: מפרט העיצוב ע.1א', has('ROADMAP.md','ע.1א'));
check('ROADMAP: ת.11 על כל תת-סעיפיו', ['ת.11א','ת.11ב','ת.11ג','ת.11ד','ת.11ה','ת.11ו'].every(x=>has('ROADMAP.md',x)));
check('ROADMAP: 4.14 סגור', has('ROADMAP.md','#1070'));
check('הוראות למפתח: סדר עדיפויות', has('הוראות-ותכנונים-למפתח-מצורף.md','סדר עדיפויות מחייב'));
check('מפרט עיצוב: נספח ב׳ + ג׳', has('docs/מפרט-עיצוב-אוצריא.md','נספח ב׳') && has('docs/מפרט-עיצוב-אוצריא.md','נספח ג׳'));
check('תוכן ממתין: טבלת הפסילה', has('docs/תוכן-ממתין-25-08-26/README.md','חומרים להרחבה'));
check('תוכן ממתין: כלים/צמחים נסגרו', has('docs/תוכן-ממתין-25-08-26/README.md','מוצה ונסגר'));
check('תוכן ממתין: קבצי רשימת הספרים', fs.existsSync('docs/תוכן-ממתין-25-08-26/all_categories_and_research_books.txt'));
check('סדר-עבודה: בלוק "נסגר ב-31/08"', has('docs/סדר-עבודה-להעברה.md','אל תפתחו מחדש'));
check('תאימות-SDK: ב.1 סגור', has('docs/תאימות-SDK-אוצריא.md','#1070'));

// ── 6. ולידטור ───────────────────────────────────────────────
const v = q('node tools/validate.js --strict');
const m = v.match(/שדות חובה חסרים[\s.]*(\d+)/);
check('ולידטור: שדות חובה חסרים = 0', m && m[1]==='0', m?('בפועל '+m[1]):'לא נמצא');

console.log('✅ עברו ('+ok.length+'):');
ok.forEach(x=>console.log('   '+x));
console.log((bad.length?'\n❌ נכשלו ('+bad.length+'):':'\n❌ נכשלו: אין'));
bad.forEach(x=>console.log('   '+x));
