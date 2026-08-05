// ״מוזכר יחד עם״ — קישורים אוטומטיים בין דצח״מ שמופיעים באותו פסוק (2.12.0).
// אין כאן דאטה חדש: הכל נגזר משדות verses/makorot שכבר קיימים בכל שישה המדריכים.
// אין כאן DOM — רק אינדקס. הרינדור עצמו ב-entry-detail.js.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.

// גימטריה: הפרקים והפסוקים במאגרים כתובים באותיות (״כה, יג-טו״), וכדי לפרוש טווח
// צריך מספרים. אין כאן צורך בגימטריה ״חכמה״ (ט״ו/ט״ז) — פשוט סכום האותיות.
const GEMATRIA_VALUES = {
  'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,
  'י':10,'כ':20,'ך':20,'ל':30,'מ':40,'ם':40,'נ':50,'ן':50,'ס':60,'ע':70,'פ':80,'ף':80,'צ':90,'ץ':90,
  'ק':100,'ר':200,'ש':300,'ת':400
};
function gematriaValue(s){
  const letters = String(s || '').replace(/[^א-ת]/g, '');
  if (!letters) return 0;
  let n = 0;
  for (const ch of letters){
    if (GEMATRIA_VALUES[ch] == null) return 0;
    n += GEMATRIA_VALUES[ch];
  }
  return n;
}

// כתיבים חלופיים של שמות ספרים שאינם ברשימה של refs.js
const BOOK_ALIASES = { 'תהילים': 'תהלים', 'קוהלת': 'קהלת', 'עמוס': 'עמוס' };

// מראה מקום אחד -> רשימת מפתחות ״ספר|פרק|פסוק״. מכסה את שלוש הצורות שבמאגרים:
//   ״בראשית י, ב״ · ״בראשית כה, יג-טו״ (טווח נפרש) · ״במדבר, לא נ״ (הצורה של דומם)
// וגם כמה קטעים בשורה אחת (״בראשית יד, א-ב, ט״) ומראי מקום מופרדים ב-;.
// מה שאינו ספר תנ״ך (תוספתא, ירושלמי, רש״י) פשוט אינו מחזיר מפתחות — 155 מתוך
// 6,368 מראי המקום, וכולם באמת אינם פסוק.
function verseKeysOfRef(ref){
  const out = [];
  String(ref == null ? '' : ref).split(';').forEach(part => {
    const clean = part.replace(/\([^)]*\)/g, ' ').replace(/["״׳']/g, '').trim();
    if (!clean) return;
    let book = null, rest = '';
    for (const b of TANAKH_BOOKS){
      if (clean.indexOf(b + ' ') === 0){ book = b; rest = clean.slice(b.length + 1); break; }
      if (clean.indexOf(b + ', ') === 0){ book = b; rest = clean.slice(b.length + 2); break; }
    }
    if (!book){
      for (const alias of Object.keys(BOOK_ALIASES)){
        if (clean.indexOf(alias + ' ') === 0 || clean.indexOf(alias + ', ') === 0){
          book = BOOK_ALIASES[alias];
          rest = clean.slice(clean.indexOf(',') === alias.length ? alias.length + 2 : alias.length + 1);
          break;
        }
      }
    }
    if (!book) return;
    rest = rest.trim();
    let chapterPart, versePart;
    const comma = rest.indexOf(',');
    if (comma !== -1){ chapterPart = rest.slice(0, comma).trim(); versePart = rest.slice(comma + 1); }
    else {
      const m = rest.match(/^(\S+)\s+(.+)$/);
      if (!m) return;
      chapterPart = m[1]; versePart = m[2];
    }
    const chapter = gematriaValue(chapterPart);
    if (!chapter) return;
    versePart.split(/[,·]/).forEach(seg => {
      const s = seg.trim();
      if (!s) return;
      const range = s.split(/[-–]/);
      if (range.length === 2){
        const from = gematriaValue(range[0]), to = gematriaValue(range[1]);
        // טווח ארוך מ-80 פסוקים הוא כמעט תמיד פענוח שגוי ולא ציטוט אמיתי
        if (from && to && to >= from && to - from < 80){
          for (let v = from; v <= to; v++) out.push(book + '|' + chapter + '|' + v);
          return;
        }
      }
      const v = gematriaValue(s);
      if (v) out.push(book + '|' + chapter + '|' + v);
    });
  });
  return out;
}

// מזהה ריצה לכל ערך — רק כדי לחבר קישור ב-HTML לאובייקט הנכון. **לא** מזהה יציב
// לדאטה (זו בדיוק החסימה של 2.6): הוא נולד ומת עם המופע, ואינו נשמר לשום מקום.
let coMentionSeq = 0;
const coMentionRegistry = new Map(); // id -> entry
function coMentionIdOf(entry){
  if (!entry.__cmId){
    entry.__cmId = 'cm' + (++coMentionSeq);
    coMentionRegistry.set(entry.__cmId, entry);
  } else if (!coMentionRegistry.has(entry.__cmId)){
    coMentionRegistry.set(entry.__cmId, entry);
  }
  return entry.__cmId;
}
function coMentionEntryById(id){ return coMentionRegistry.get(id) || null; }

let coMentionIndex = null;      // verseKey -> [{catId, entry}]
let coMentionKeysOf = null;     // Map(entry -> [verseKey])
function invalidateCoMentions(){ coMentionIndex = null; coMentionKeysOf = null; }

// האינדקס נבנה רק כששישה המדריכים בזיכרון — אחרת ״מוזכר יחד עם״ היה מציג רשימה
// חלקית שמשתנה לפי מה שהספיק להיטען, וזה גרוע יותר מלא להציג כלום.
function coMentionsReady(){ return CATEGORIES.every(c => !!dataCache[c.id]); }

function buildCoMentionIndex(){
  const index = new Map(), keys = new Map();
  CATEGORIES.forEach(cat => {
    (dataCache[cat.id] || []).forEach(entry => {
      const list = entry.verses || entry.makorot || [];
      if (!list.length) return;
      const set = new Set();
      list.forEach(v => verseKeysOfRef(v && v.ref).forEach(k => set.add(k)));
      if (!set.size) return;
      keys.set(entry, Array.from(set));
      set.forEach(k => {
        if (!index.has(k)) index.set(k, []);
        index.get(k).push({ catId: cat.id, entry: entry });
      });
    });
  });
  coMentionIndex = index;
  coMentionKeysOf = keys;
}

// חזרה למספר עברי לתצוגה (הכיוון ההפוך לגימטריה) — כולל ט״ו/ט״ז, שלא נכתבים
// י״ה/י״ו מטעמי קדושה. משמש רק לחלונית ההסבר שעל הקישור.
const HEB_NUM_PARTS = [[400,'ת'],[300,'ש'],[200,'ר'],[100,'ק'],[90,'צ'],[80,'פ'],[70,'ע'],[60,'ס'],[50,'נ'],[40,'מ'],[30,'ל'],[20,'כ'],[10,'י'],[9,'ט'],[8,'ח'],[7,'ז'],[6,'ו'],[5,'ה'],[4,'ד'],[3,'ג'],[2,'ב'],[1,'א']];
function numToHeb(n){
  let v = parseInt(n, 10) || 0, out = '';
  while (v > 0){
    if (v === 15){ out += 'טו'; break; }
    if (v === 16){ out += 'טז'; break; }
    const p = HEB_NUM_PARTS.find(x => x[0] <= v);
    if (!p) break;
    out += p[1];
    v -= p[0];
  }
  return out;
}

function coMentionKeyLabel(key){
  const parts = String(key).split('|');
  return parts[0] + ' ' + numToHeb(parts[1]) + ', ' + numToHeb(parts[2]);
}

// כל הערכים שחולקים לפחות פסוק אחד עם הערך הזה, ממוינים לפי מספר הפסוקים
// המשותפים ואז לפי אותו מדריך תחילה. מחזיר [] כשאין, ו-null כשהאינדקס לא מוכן.
function coMentionsFor(entry, catId){
  if (!coMentionsReady()) return null;
  if (!coMentionIndex) buildCoMentionIndex();
  const keys = coMentionKeysOf.get(entry);
  if (!keys) return [];
  const hits = new Map(); // entry -> {catId, entry, shared:[key]}
  keys.forEach(k => {
    (coMentionIndex.get(k) || []).forEach(rec => {
      if (rec.entry === entry) return;
      if (!hits.has(rec.entry)) hits.set(rec.entry, { catId: rec.catId, entry: rec.entry, shared: [] });
      hits.get(rec.entry).shared.push(k);
    });
  });
  const list = Array.from(hits.values());
  list.sort((a, b) => (b.shared.length - a.shared.length) ||
    ((a.catId === catId ? 0 : 1) - (b.catId === catId ? 0 : 1)) ||
    String(a.entry.name).localeCompare(String(b.entry.name), 'he'));
  return list;
}
