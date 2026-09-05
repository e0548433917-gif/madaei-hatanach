#!/usr/bin/env node
/*
 * tools/verify-makorot-prep.js — שלב א׳ של אימות מראי-מקום מול הטקסט (02/09/2026).
 *
 * מייצר queries.json: לכל makorot של הערכים המבוקשים — מראה המקום בצורת Sefaria
 * (למשל "Mishnah Kelim 14:5", "Yoma 75b", "I Samuel 16:1") ומילות-מפתח מהציטוט.
 * את ההורדה עצמה עושה סקריפט PowerShell (Invoke-RestMethod) — node/curl נכשלים ב-TLS
 * מאחורי הפילטר (ר׳ CLAUDE.md / זיכרון הפרויקט), PowerShell משתמש במאגר האישורים של Windows.
 *
 *   node tools/verify-makorot-prep.js <guide> <out.json> [--generic-only]
 *     guide: domem | flora | animal | places | beithamikdash
 *     --generic-only: רק ערכים שה-identification שלהם הוא הנוסחה הגנרית (דומם)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadDataFile } = require('./lib/load');
const { GUIDES } = require('./lib/config');

const [guideId, outPath] = process.argv.slice(2);
const GENERIC_ONLY = process.argv.includes('--generic-only');
if (!guideId || !outPath) { console.error('usage: node tools/verify-makorot-prep.js <guide> <out.json> [--generic-only]'); process.exit(2); }
const g = GUIDES.find((x) => x.id === guideId);
if (!g) { console.error('unknown guide ' + guideId); process.exit(2); }

const TANAKH = {
  'בראשית': 'Genesis', 'שמות': 'Exodus', 'ויקרא': 'Leviticus', 'במדבר': 'Numbers', 'דברים': 'Deuteronomy',
  'יהושע': 'Joshua', 'שופטים': 'Judges', 'שמואל א': 'I Samuel', 'שמואל ב': 'II Samuel', 'מלכים א': 'I Kings', 'מלכים ב': 'II Kings',
  'ישעיהו': 'Isaiah', 'ישעיה': 'Isaiah', 'ירמיהו': 'Jeremiah', 'ירמיה': 'Jeremiah', 'יחזקאל': 'Ezekiel', 'הושע': 'Hosea', 'יואל': 'Joel', 'עמוס': 'Amos',
  'עובדיה': 'Obadiah', 'יונה': 'Jonah', 'מיכה': 'Micah', 'נחום': 'Nahum', 'חבקוק': 'Habakkuk', 'צפניה': 'Zephaniah', 'חגי': 'Haggai',
  'זכריה': 'Zechariah', 'מלאכי': 'Malachi', 'תהילים': 'Psalms', 'תהלים': 'Psalms', 'משלי': 'Proverbs', 'איוב': 'Job',
  'שיר השירים': 'Song of Songs', 'רות': 'Ruth', 'איכה': 'Lamentations', 'קהלת': 'Ecclesiastes', 'אסתר': 'Esther', 'דניאל': 'Daniel',
  'עזרא': 'Ezra', 'נחמיה': 'Nehemiah', 'דברי הימים א': 'I Chronicles', 'דברי הימים ב': 'II Chronicles',
};
const MASECHET = {
  'ברכות': 'Berakhot', 'פאה': 'Peah', 'דמאי': 'Demai', 'כלאים': 'Kilayim', 'שביעית': 'Sheviit', 'תרומות': 'Terumot', 'מעשרות': 'Maasrot',
  'מעשר שני': 'Maaser Sheni', 'חלה': 'Challah', 'ערלה': 'Orlah', 'ביכורים': 'Bikkurim', 'שבת': 'Shabbat', 'עירובין': 'Eruvin', 'פסחים': 'Pesachim',
  'שקלים': 'Shekalim', 'יומא': 'Yoma', 'סוכה': 'Sukkah', 'ביצה': 'Beitzah', 'ראש השנה': 'Rosh Hashanah', 'תענית': 'Taanit', 'מגילה': 'Megillah',
  'מועד קטן': 'Moed Katan', 'חגיגה': 'Chagigah', 'יבמות': 'Yevamot', 'כתובות': 'Ketubot', 'נדרים': 'Nedarim', 'נזיר': 'Nazir', 'סוטה': 'Sotah',
  'גיטין': 'Gittin', 'קידושין': 'Kiddushin', 'בבא קמא': 'Bava Kamma', 'בבא מציעא': 'Bava Metzia', 'בבא בתרא': 'Bava Batra', 'סנהדרין': 'Sanhedrin',
  'מכות': 'Makkot', 'שבועות': 'Shevuot', 'עדיות': 'Eduyot', 'עדויות': 'Eduyot', 'עבודה זרה': 'Avodah Zarah', 'אבות': 'Avot', 'הוריות': 'Horayot',
  'זבחים': 'Zevachim', 'מנחות': 'Menachot', 'חולין': 'Chullin', 'בכורות': 'Bekhorot', 'ערכין': 'Arakhin', 'תמורה': 'Temurah', 'כריתות': 'Keritot',
  'מעילה': 'Meilah', 'תמיד': 'Tamid', 'מידות': 'Middot', 'קינים': 'Kinnim', 'כלים': 'Kelim', 'אהלות': 'Oholot', 'נגעים': 'Negaim', 'פרה': 'Parah',
  'טהרות': 'Tahorot', 'מקואות': 'Mikvaot', 'מקוואות': 'Mikvaot', 'נדה': 'Niddah', 'נידה': 'Niddah', 'מכשירין': 'Makhshirin', 'זבים': 'Zavim',
  'טבול יום': 'Tevul Yom', 'ידים': 'Yadayim', 'עוקצין': 'Oktzin',
};
const NIQQUD = /[֑-ׇ]/g;
const GEM = { 'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80, 'צ': 90, 'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400, 'ך': 20, 'ם': 40, 'ן': 50, 'ף': 80, 'ץ': 90 };
function heb2num(s) {
  s = String(s || '').replace(/[״"'׳]/g, '').trim();
  if (!s || !/^[א-ת]+$/.test(s)) return null;
  let n = 0; for (const c of s) n += GEM[c] || 0; return n || null;
}
function cleanRef(r) { return String(r || '').replace(NIQQUD, '').replace(/\s+/g, ' ').replace(/[״"]/g, '"').trim(); }

// מחזיר {sref, kind} או null
function toSefaria(ref) {
  let s = cleanRef(ref);
  let m;
  // בבלי: "בבלי, יומא עה:" | "בבלי, יומא עה." | "בבלי, יומא עה ע"ב" | "בבלי, מנחות דף מד."
  if ((m = s.match(/^בבלי,?\s+(.+?)\s+(?:דף\s+)?([א-ת]{1,3})\s*(?:(ע"א|ע"ב|\.|:)|,\s*([אב]))?\s*$/))) {
    const t = MASECHET[m[1].trim()]; const d = heb2num(m[2]); if (!t || !d) return null;
    const side = (m[3] === 'ע"ב' || m[3] === ':' || m[4] === 'ב') ? 'b' : 'a';
    return { sref: `${t} ${d}${side}`, kind: 'bavli' };
  }
  // משנה: "משנה, כלים יד, ה" | "משנה, נידה י, ז" | "משנה כלים יד ה"
  if ((m = s.match(/^משנה,?\s+(.+?)\s+([א-ת]{1,2}),?\s+([א-ת]{1,2})\s*$/))) {
    const t = MASECHET[m[1].trim()]; const c = heb2num(m[2]); const v = heb2num(m[3]); if (!t || !c || !v) return null;
    return { sref: `Mishnah ${t} ${c}:${v}`, kind: 'mishnah' };
  }
  // ירושלמי: "ירושלמי, שקלים ג, ב"
  if ((m = s.match(/^ירושלמי,?\s+(.+?)\s+([א-ת]{1,2}),?\s+([א-ת]{1,2})\s*$/))) {
    const t = MASECHET[m[1].trim()]; const c = heb2num(m[2]); const v = heb2num(m[3]); if (!t || !c || !v) return null;
    return { sref: `Jerusalem Talmud ${t} ${c}:${v}`, kind: 'yerushalmi' };
  }
  // תנ"ך: "שמואל א, טז א" | "שמות, כז ג" | "תהילים סח יד" | "בראשית א, ל"
  if ((m = s.match(/^(.+?),?\s+([א-ת]{1,3}),?\s+([א-ת]{1,3})\s*$/))) {
    const b = TANAKH[m[1].replace(/,$/, '').trim()]; const c = heb2num(m[2]); const v = heb2num(m[3]);
    if (b && c && v) return { sref: `${b} ${c}:${v}`, kind: 'tanakh' };
  }
  return null;
}

// מילות מפתח: 2 הרצפים הראשונים של 2 מילים (בלי ניקוד/פיסוק), לא כולל "..."
function keywords(text) {
  const words = String(text || '').replace(NIQQUD, '').replace(/[״"'׳.,;:!?()\[\]…]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter((w) => w.length > 1);
  const out = [];
  for (let i = 0; i + 1 < words.length && out.length < 3; i += 2) out.push(words[i] + ' ' + words[i + 1]);
  if (!out.length && words.length) out.push(words[0]);
  return out;
}

const data = loadDataFile(g.file).DATA || [];
const GENERIC = /הזיהוי עולה מהקשר המקורות|זיהוי הגוון עולה/;
const rows = [];
data.forEach((d, idx) => {
  if (GENERIC_ONLY && !GENERIC.test(d.identification || '')) return;
  const mak = d.makorot || d.verses || [];
  mak.forEach((m, mi) => {
    const conv = toSefaria(m.ref);
    rows.push({ i: idx, mi, name: d.name, cat: d.cat, ref: m.ref, sref: conv ? conv.sref : null, kind: conv ? conv.kind : 'unparsed', kw: keywords(m.text), text: String(m.text || '').slice(0, 120) });
  });
});
fs.writeFileSync(path.resolve(outPath), JSON.stringify(rows, null, 1), 'utf8');
const unparsed = rows.filter((r) => !r.sref);
console.log(`ערכים: ${GENERIC_ONLY ? 'גנריים בלבד' : 'כולם'} · מראי מקום: ${rows.length} · ניתנים להמרה: ${rows.length - unparsed.length} · לא הומרו: ${unparsed.length}`);
unparsed.slice(0, 40).forEach((r) => console.log('  ✗ ' + r.name + ' | ' + r.ref));
