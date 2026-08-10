// "מי בפרשה הזו" — אינדקס פסוק→פרשה, ומסך שמראה את כל הערכים (משישת המדריכים)
// שיש להם מקור בתוך טווח הפרשה שנבחרה. נוצר בסבב 2 חלק ב׳ (2.7).
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.

// מיפוי פסוק→פרשה: טבלה קבועה, כתובה ביד. טווחי הפרק:פסוק של 54 הפרשות (מבראשית
// עד וזאת הברכה) אומתו מול שני מקורות עצמאיים בשתי הנקודות הידועות כרגישות
// (יתרו/משפטים בשמות כ, וכי תבוא/נצבים בדברים כט) — לא חושבו/נוחשו מהזיכרון.
// book חייב להיות בדיוק אחד המחרוזות שב-TANAKH_BOOKS (refs.js), כדי ש-verseInParasha
// יתאים למה שמחזיר verseKeysOfRef (co-mentions.js).
const PARASHOT = [
  // בראשית
  { id:'bereshit',   name:'בראשית',        book:'בראשית', from:[1,1],   to:[6,8] },
  { id:'noach',      name:'נח',             book:'בראשית', from:[6,9],   to:[11,32] },
  { id:'lech-lecha', name:'לך לך',          book:'בראשית', from:[12,1],  to:[17,27] },
  { id:'vayera',     name:'וירא',           book:'בראשית', from:[18,1],  to:[22,24] },
  { id:'chayei-sara',name:'חיי שרה',        book:'בראשית', from:[23,1],  to:[25,18] },
  { id:'toldot',     name:'תולדות',         book:'בראשית', from:[25,19], to:[28,9] },
  { id:'vayetze',    name:'ויצא',           book:'בראשית', from:[28,10], to:[32,3] },
  { id:'vayishlach', name:'וישלח',          book:'בראשית', from:[32,4],  to:[36,43] },
  { id:'vayeshev',   name:'וישב',           book:'בראשית', from:[37,1],  to:[40,23] },
  { id:'miketz',     name:'מקץ',            book:'בראשית', from:[41,1],  to:[44,17] },
  { id:'vayigash',   name:'ויגש',           book:'בראשית', from:[44,18], to:[47,27] },
  { id:'vayechi',    name:'ויחי',           book:'בראשית', from:[47,28], to:[50,26] },
  // שמות
  { id:'shemot',     name:'שמות',           book:'שמות', from:[1,1],   to:[6,1] },
  { id:'vaera',      name:'וארא',           book:'שמות', from:[6,2],   to:[9,35] },
  { id:'bo',         name:'בא',             book:'שמות', from:[10,1],  to:[13,16] },
  { id:'beshalach',  name:'בשלח',           book:'שמות', from:[13,17], to:[17,16] },
  { id:'yitro',      name:'יתרו',           book:'שמות', from:[18,1],  to:[20,22] },
  { id:'mishpatim',  name:'משפטים',         book:'שמות', from:[21,1],  to:[24,18] },
  { id:'terumah',    name:'תרומה',          book:'שמות', from:[25,1],  to:[27,19] },
  { id:'tetzaveh',   name:'תצוה',           book:'שמות', from:[27,20], to:[30,10] },
  { id:'ki-tisa',    name:'כי תשא',         book:'שמות', from:[30,11], to:[34,35] },
  { id:'vayakhel',   name:'ויקהל',          book:'שמות', from:[35,1],  to:[38,20] },
  { id:'pekudei',    name:'פקודי',          book:'שמות', from:[38,21], to:[40,38] },
  // ויקרא
  { id:'vayikra',    name:'ויקרא',          book:'ויקרא', from:[1,1],   to:[5,26] },
  { id:'tzav',       name:'צו',             book:'ויקרא', from:[6,1],   to:[8,36] },
  { id:'shmini',     name:'שמיני',          book:'ויקרא', from:[9,1],   to:[11,47] },
  { id:'tazria',     name:'תזריע',          book:'ויקרא', from:[12,1],  to:[13,59] },
  { id:'metzora',    name:'מצורע',          book:'ויקרא', from:[14,1],  to:[15,33] },
  { id:'acharei-mot',name:'אחרי מות',       book:'ויקרא', from:[16,1],  to:[18,30] },
  { id:'kedoshim',   name:'קדושים',         book:'ויקרא', from:[19,1],  to:[20,27] },
  { id:'emor',       name:'אמור',           book:'ויקרא', from:[21,1],  to:[24,23] },
  { id:'behar',      name:'בהר',            book:'ויקרא', from:[25,1],  to:[26,2] },
  { id:'bechukotai', name:'בחקתי',          book:'ויקרא', from:[26,3],  to:[27,34] },
  // במדבר
  { id:'bemidbar',   name:'במדבר',          book:'במדבר', from:[1,1],   to:[4,20] },
  { id:'naso',       name:'נשא',            book:'במדבר', from:[4,21],  to:[7,89] },
  { id:'behaalotcha',name:'בהעלתך',         book:'במדבר', from:[8,1],   to:[12,16] },
  { id:'shlach',     name:'שלח',            book:'במדבר', from:[13,1],  to:[15,41] },
  { id:'korach',     name:'קרח',            book:'במדבר', from:[16,1],  to:[18,32] },
  { id:'chukat',     name:'חקת',            book:'במדבר', from:[19,1],  to:[22,1] },
  { id:'balak',      name:'בלק',            book:'במדבר', from:[22,2],  to:[25,9] },
  { id:'pinchas',    name:'פינחס',          book:'במדבר', from:[25,10], to:[30,1] },
  { id:'matot',      name:'מטות',           book:'במדבר', from:[30,2],  to:[32,42] },
  { id:'masei',      name:'מסעי',           book:'במדבר', from:[33,1],  to:[36,13] },
  // דברים
  { id:'devarim',    name:'דברים',          book:'דברים', from:[1,1],   to:[3,22] },
  { id:'vaetchanan', name:'ואתחנן',         book:'דברים', from:[3,23],  to:[7,11] },
  { id:'eikev',      name:'עקב',            book:'דברים', from:[7,12],  to:[11,25] },
  { id:'reeh',       name:'ראה',            book:'דברים', from:[11,26], to:[16,17] },
  { id:'shoftim',    name:'שופטים',         book:'דברים', from:[16,18], to:[21,9] },
  { id:'ki-teitzei', name:'כי תצא',         book:'דברים', from:[21,10], to:[25,19] },
  { id:'ki-tavo',    name:'כי תבוא',        book:'דברים', from:[26,1],  to:[29,8] },
  { id:'nitzavim',   name:'נצבים',          book:'דברים', from:[29,9],  to:[30,20] },
  { id:'vayelech',   name:'וילך',           book:'דברים', from:[31,1],  to:[31,30] },
  { id:'haazinu',    name:'האזינו',         book:'דברים', from:[32,1],  to:[32,52] },
  { id:'vzot-habracha', name:'וזאת הברכה',  book:'דברים', from:[33,1],  to:[34,12] },
];
// לקבוצות ה-optgroup בבורר, לפי סדר החומשים
const PARASHA_BOOK_ORDER = ['בראשית','שמות','ויקרא','במדבר','דברים'];

function verseInParasha(book, chapter, verse, p){
  if (book !== p.book) return false;
  const [fc, fv] = p.from, [tc, tv] = p.to;
  if (chapter < fc || chapter > tc) return false;
  if (chapter === fc && verse < fv) return false;
  if (chapter === tc && verse > tv) return false;
  return true;
}

function parashaById(id){ return PARASHOT.find(p => p.id === id) || null; }

// כל שישה המדריכים חייבים להיות בזיכרון, כמו coMentionsReady - אחרת התוצאה חלקית.
function parashaDataReady(){ return CATEGORIES.every(c => !!dataCache[c.id]); }

// טוען את מה שחסר, בטור (לא Promise.all - מרעיב את עצמו, כמו בכל מקום אחר כאן).
function ensureAllGuidesLoaded(){
  const missing = CATEGORIES.filter(c => !dataCache[c.id]);
  const chain = (i) => i >= missing.length ? Promise.resolve()
    : loadGuideData(missing[i]).catch(() => null).then(() => chain(i + 1));
  return chain(0);
}

// כל הערכים (מכל מדריך) שיש להם לפחות פסוק אחד בטווח הפרשה. משתמש באותו parseVerseRef
// המשמש את זיהוי הטווחים ב-co-mentions.js (verseKeysOfRef), ולא בונה פרסינג משלו.
function entriesForParasha(parashaId){
  const p = parashaById(parashaId);
  if (!p) return [];
  const out = [];
  CATEGORIES.forEach(cat => {
    (dataCache[cat.id] || []).forEach(entry => {
      const verseList = entry.verses || entry.makorot || [];
      const hit = verseList.some(v => verseKeysOfRef(v && v.ref).some(k => {
        const parts = k.split('|');
        return verseInParasha(parts[0], +parts[1], +parts[2], p);
      }));
      if (hit){
        out.push({ catId: cat.id, catLabel: cat.label, catIcon: cat.icon, name: entry.name, term: entry.name, entry: entry });
      }
    });
  });
  return out;
}

// ---- UI: בורר הפרשה בעמוד השער ----
// הכרטיס "פרשת השבוע" (בשורת "לימוד") פותח פאנל בחירה קטן (panel-overlay משותף
// עם addHtmlOverlay וכו') - בחירה/״הצג״ סוגרים אותו ופותחים את תוצאות הזיהוי.
const parashaCard = document.getElementById('parashaCard');
const parashaPanelOverlay = document.getElementById('parashaPanelOverlay');
const parashaSelect = document.getElementById('parashaSelect');
const parashaGoBtn = document.getElementById('parashaGoBtn');
const parashaPanelClose = document.getElementById('parashaPanelClose');

if (parashaCard) parashaCard.addEventListener('click', () => {
  parashaPanelOverlay.classList.add('open');
});
if (parashaPanelClose) parashaPanelClose.addEventListener('click', () => {
  parashaPanelOverlay.classList.remove('open');
});
function populateParashaSelect(){
  if (!parashaSelect) return;
  let html = '<option value="" selected disabled>מי בפרשה הזו — בחרו פרשה…</option>';
  PARASHA_BOOK_ORDER.forEach(book => {
    html += `<optgroup label="${esc(book)}">`;
    PARASHOT.filter(p => p.book === book).forEach(p => {
      html += `<option value="${esc(p.id)}">${esc(p.name)}</option>`;
    });
    html += '</optgroup>';
  });
  parashaSelect.innerHTML = html;
}
populateParashaSelect();

async function showParasha(parashaId){
  const p = parashaById(parashaId);
  if (!p) return;
  let label = null;
  if (parashaGoBtn){ parashaGoBtn.disabled = true; label = parashaGoBtn.textContent; parashaGoBtn.textContent = '…'; }
  try {
    if (!parashaDataReady()) await ensureAllGuidesLoaded();
    const matches = entriesForParasha(parashaId);
    showResults(matches, 'פרשת ' + p.name);
  } finally {
    if (parashaGoBtn){ parashaGoBtn.disabled = false; parashaGoBtn.textContent = label; }
  }
}

function pickParasha(parashaId){
  if (!parashaId) return;
  parashaPanelOverlay.classList.remove('open');
  showParasha(parashaId);
}
if (parashaGoBtn) parashaGoBtn.addEventListener('click', () => {
  if (parashaSelect) pickParasha(parashaSelect.value);
});
if (parashaSelect) parashaSelect.addEventListener('change', () => pickParasha(parashaSelect.value));
