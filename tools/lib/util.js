// עזרים משותפים לכל הבדיקות — משימה ת.0. ר' tools/validate.js.
'use strict';

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

const isEmpty = (v) =>
  v === null || v === undefined || v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'string' && v.trim() === '');

// נרמול שם לצורך השוואה: מסירים גרשיים/גרשים בכל וריאציה, ורווחים כפולים.
// בלי זה "רבקה " ו-"רבקה" נחשבים שני אנשים שונים, ו"בת־שבע" לא נמצא מול "בת שבע".
function normName(s) {
  return String(s == null ? '' : s)
    .replace(/[֑-ׇ]/g, '')   // ניקוד וטעמים
    .replace(/[״"]/g, '"')
    .replace(/[׳']/g, "'")
    .replace(/[‐-―־־]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// מחזיר את כל מראי המקום ברשומה, עם ציון השדה והפרסר הרלוונטי.
// verses/makorot נפרסים ב-parseAnyRef, midrash ב-parseMidrashRef — בדיוק כמו
// ב-entry-detail.js (שורות 221 ו-234). ההפרדה חשובה: מקור חז״ל בשדה midrash
// אינו עובר דרך parseVerseRef כלל.
function collectRefs(entry) {
  const out = [];
  (entry.verses || entry.makorot || []).forEach((v) => {
    const ref = v && v.ref;
    if (!isEmpty(ref)) out.push({ ref: String(ref), field: entry.verses ? 'verses' : 'makorot', parser: 'parseAnyRef' });
  });
  (entry.midrash || []).forEach((m) => {
    const ref = m && (m.source || m.ref);
    if (!isEmpty(ref)) out.push({ ref: String(ref), field: 'midrash', parser: 'parseMidrashRef' });
  });
  return out;
}

// אותה לוגיקה בדיוק כמו lookupEntryImage ב-shell/guides.js (שורות 40-46).
function hasImage(entry, cardImages) {
  if (!cardImages) return false;
  if (entry.img && Object.prototype.hasOwnProperty.call(cardImages, entry.img)) return true;
  const wiki = entry.methods && entry.methods[0] && entry.methods[0].wiki;
  if (wiki && Object.prototype.hasOwnProperty.call(cardImages, wiki)) return true;
  return false;
}


module.exports = { isEmpty, normName, collectRefs, hasImage };
