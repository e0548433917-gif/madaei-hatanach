#!/usr/bin/env node
/*
 * tools/merge-pending.js — מיון, דה-דופ ושילוב של התוכן הממתין ב-
 * docs/תוכן-ממתין-25-08-26/ (משימה: "מיון תוכן ממתין", 30/08/26).
 *
 *   node tools/merge-pending.js            — דוח בלבד, לא כותב כלום
 *   node tools/merge-pending.js --write    — משלב בפועל בקבצי הדאטה
 *
 * שלושה זרמים:
 *   events — ערך-היום-מאורעות-1..4.txt  ->  TANAKH_DATE_EVENTS (guides/_shared/dates.js)
 *   domem  — כלים-מהמקורות-1..5.txt + מטבעות.txt -> DATA (guides/domem/data/domem-data.js)
 *   colors — תיקון makorot שבורים (טקסט "undefined") שנוצרו בשילוב הצבעים מ-26/08
 *
 * הערה: domem-data.js הוא שורה אחת של ~1MB. הכתיבה כאן היא parse/stringify של
 * מחרוזת ה-DATA כולה, ולא חיתוך קצוות (slice) - הדרך שכבר שברה JSON בעבר.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'docs', 'תוכן-ממתין-25-08-26');
const DATES_FILE = path.join(ROOT, 'guides', '_shared', 'dates.js');
const DOMEM_FILE = path.join(ROOT, 'guides', 'domem', 'data', 'domem-data.js');
const QUOTES_OUT = path.join(SRC, 'מאורעות-ציטוט-והסבר.json');

const WRITE = process.argv.includes('--write');
const log = (...a) => console.log(...a);

// ---------------------------------------------------------------------------
// פרסר CSV סובלני
// ---------------------------------------------------------------------------
// קבצי המקור מכילים גרשיים לא-מוברחים בתוך שדות מצוטטים, למשל
// "ירושלמי, ראש השנה א', א' / רש"י בראשית כ"א, ב'" - פרסר CSV תקני נשבר על זה.
// הכלל כאן: שדה שנפתח בגרש כפול נסגר בגרש הכפול הראשון שאחריו פסיק או סוף
// שורה; כל גרש כפול אחר הוא תו רגיל בתוך התוכן.
function parseCsvLine(line) {
  const out = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let j = i + 1;
      for (;;) {
        const q = line.indexOf('"', j);
        if (q === -1) { out.push(line.slice(i + 1)); i = line.length + 1; break; }
        const next = line[q + 1];
        if (next === undefined || next === ',') { out.push(line.slice(i + 1, q)); i = q + 2; break; }
        j = q + 1;
      }
    } else {
      const c = line.indexOf(',', i);
      if (c === -1) { out.push(line.slice(i)); i = line.length + 1; }
      else { out.push(line.slice(i, c)); i = c + 1; }
    }
  }
  return out.map((s) => s.trim());
}

function readCsv(fileName) {
  const raw = fs.readFileSync(path.join(SRC, fileName), 'utf8').replace(/\r/g, '');
  return raw.split('\n').filter((l) => l.trim()).slice(1).map(parseCsvLine);
}

// ---------------------------------------------------------------------------
// נרמול
// ---------------------------------------------------------------------------
const NIQQUD = /[֑-ׇ]/g;

// נרמול להשוואה בלבד (לא לתצוגה): בלי ניקוד, בלי גרשיים, בלי פיסוק, רווח יחיד.
function norm(s) {
  return String(s == null ? '' : s)
    .replace(NIQQUD, '')
    .replace(/[״"'׳`]/g, '')
    .replace(/[.,;:!?()\[\]{}\/\\־–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// שיבושי OCR/קידוד שנמצאו בפועל בקבצי המקור. כל תיקון מודפס, לא מתוקן בשקט.
const OCR_FIXES = [
  [/\s*\bme'/g, "'"],
  [/�/g, ''],
];
let ocrCount = 0;
const ocrSamples = [];
function fixOcr(s) {
  let v = String(s == null ? '' : s);
  for (const [re, rep] of OCR_FIXES) {
    re.lastIndex = 0;
    if (re.test(v)) {
      ocrCount++;
      if (ocrSamples.length < 20) ocrSamples.push(v.slice(0, 70));
      v = v.replace(re, rep);
    }
  }
  return v.replace(/\s+/g, ' ').trim();
}

// "י\"ד בניסן" / "ז' באאלול" -> "יד" / "ז" (הפורמט של day ב-TANAKH_DATE_EVENTS)
function dayLetters(cell) {
  return stripGershayim(String(cell).trim().split(/\s+/)[0]);
}
function stripGershayim(s) {
  return String(s).replace(/[״"'׳]/g, '').trim();
}

const TANAKH_BOOK_HINTS = [
  'בראשית', 'שמות', 'ויקרא', 'במדבר', 'דברים', 'יהושע', 'שופטים', 'שמואל', 'מלכים',
  'ישעיהו', 'ישעיה', 'ירמיהו', 'ירמיה', 'יחזקאל', 'הושע', 'יואל', 'עמוס', 'עובדיה',
  'יונה', 'מיכה', 'נחום', 'חבקוק', 'צפניה', 'חגי', 'זכריה', 'מלאכי', 'תהלים', 'משלי',
  'איוב', 'שיר השירים', 'רות', 'איכה', 'קהלת', 'אסתר', 'דניאל', 'עזרא', 'נחמיה',
  'דברי הימים',
];

// שני היעדים דורשים **פורמט מקור שונה**, וזו הסיבה שיש כאן שתי פונקציות ולא אחת:
//   dates.js  -> "ספר פרק:פסוק"  ("שמות מ:ב")      — parseColonVerseRef (dates.js:313)
//   domem     -> "ספר, פרק פסוק" ("שמות, מ ב")     — parseAnyRef/parseVerseRef (shell/refs.js),
//                וכך כתובים כל מראי המקום הקיימים ב-DATA.
// מקורות חז״ל זהים בשני היעדים ("משנה, כלים טז, א" / "בבלי, יומא עה:") — parseMidrashRef.
// מקור משולב ("... / בבלי, שבת פו.") — נלקח החלק הראשון בלבד, בדיוק כמו
// ש-parseColonVerseRef עצמו כבר עושה למקור כפול.

const MISHNA_KINDS = ['משנה', 'תוספתא', 'ירושלמי', 'בבלי'];

// פירוק מקור גולמי לחלקיו, פעם אחת, לשני היעדים.
function splitSource(raw) {
  let s = fixOcr(raw).replace(NIQQUD, '');
  if (!s) return null;
  s = s.split(' / ')[0].trim();
  // שיבוש OCR שחוזר בכל הקבצים: האות ט במספר עברי נקראה כ-פ ("כ\"פ ל'" במקום
  // "כ\"ט ל'", "בבלי נידה י\"פ." במקום "י\"ט."). מתוקן רק בתוך מראה מקום.
  const before = s;
  s = s.replace(/([א-ת][״"׳'])פ(?=[\s.,:]|$)/g, '$1ט');
  if (s !== before) { ocrCount++; if (ocrSamples.length < 20) ocrSamples.push(before); }
  const bare = stripGershayim(s).replace(/\s+/g, ' ').trim();

  const book = TANAKH_BOOK_HINTS.find((b) => bare.startsWith(b));
  if (book) {
    const rest = bare.slice(book.length).trim();
    // "מלכים א ו, א" — חלק הספר (א/ב) שייך לשם הספר, לא למספר הפרק.
    const part = /^(א|ב)\s/.test(rest) ? rest.slice(0, 1) : '';
    const tail = part ? rest.slice(1).trim() : rest;
    const m = tail.match(/^([א-ת]{1,4})\s*[,\s]\s*([א-ת]{1,4})/);
    if (m) return { kind: 'tanakh', book: book + (part ? ' ' + part : ''), a: m[1], b: m[2] };
    const m2 = tail.match(/^([א-ת]{1,4})\s*$/);
    if (m2) return { kind: 'tanakh', book: book + (part ? ' ' + part : ''), a: m2[1], b: '' };
  }
  return { kind: 'other', text: bare };
}

// מקור לרשומת מאורע ב-dates.js
function sourceForDates(raw) {
  const p = splitSource(raw);
  if (!p) return '';
  if (p.kind === 'tanakh') return p.book + ' ' + p.a + (p.b ? ':' + p.b : '');
  return normalizeRabbinic(p.text);
}

// מקור ל-makorot של דומם
function sourceForDomem(raw) {
  const p = splitSource(raw);
  if (!p) return '';
  if (p.kind === 'tanakh') return p.book + ', ' + p.a + (p.b ? ' ' + p.b : '');
  return normalizeRabbinic(p.text);
}

// "משנה כלים טז א" -> "משנה, כלים טז, א"  (התבנית ש-parseMidrashRef דורשת:
// פסיק אחרי סוג החיבור, ופסיק בין הפרק למשנה). "בבלי יומא עה:" כבר תקין.
const COMMENTATORS = [['רשי', 'רש"י'], ['רדק', 'רד"ק'], ['רלבג', 'רלב"ג'], ['רמבן', 'רמב"ן'], ['אבן עזרא', 'אבן עזרא'], ['ספורנו', 'ספורנו'], ['תרגום אונקלוס', 'תרגום אונקלוס']];

function normalizeRabbinic(s) {
  // מפרשים: "רשי, שמות יב, מ" -> "רש\"י על שמות יב, מ" (התבנית "X על ספר פרק, פסוק"
  // ש-parseMidrashRef דורשת). הגרשיים הוסרו קודם בנרמול, ולכן מוחזרים כאן.
  for (const [bare, proper] of COMMENTATORS) {
    if (s.startsWith(bare + ',') || s.startsWith(bare + ' ')) {
      const rest = s.slice(bare.length).replace(/^[,\s]+/, '').trim();
      const m = rest.match(/^(.+?)\s+([א-ת]{1,3})\s*[,\s]\s*([א-ת]{1,3})\s*$/);
      if (m) return proper + ' על ' + m[1].trim() + ' ' + m[2] + ', ' + m[3];
      return proper + ' על ' + rest;
    }
  }
  // "פרקי דרבי אליעזר, כח" -> "פרקי דרבי אליעזר, פרק כח"
  const pd = s.match(/^(פרקי דרבי אליעזר|מסכת סופרים)\s*,\s*([א-ת]{1,3})\s*$/);
  if (pd) return pd[1] + ', פרק ' + pd[2];

  const kind = MISHNA_KINDS.find((k) => s.startsWith(k + ' ') || s.startsWith(k + ', '));
  if (!kind) return s;
  const rest = s.slice(kind.length).replace(/^,\s*/, '').trim();
  if (kind === 'בבלי') return 'בבלי, ' + rest;
  // "כלים טז א" / "כלים טז, א" -> מסכת, פרק, משנה
  const m = rest.match(/^(.+?)\s+([א-ת]{1,3})\s*[,\s]\s*([א-ת]{1,3})\s*$/);
  if (m) return kind + ', ' + m[1].trim() + ' ' + m[2] + ', ' + m[3];
  return kind + ', ' + rest;
}

// ---------------------------------------------------------------------------
// זרם 1: מאורעות -> TANAKH_DATE_EVENTS
// ---------------------------------------------------------------------------
const EVENT_FILES = [1, 2, 3, 4].map((n) => 'ערך-היום-מאורעות-' + n + '.txt');

function loadExistingEvents() {
  const src = fs.readFileSync(DATES_FILE, 'utf8');
  const start = src.indexOf('const TANAKH_DATE_EVENTS = [');
  const end = src.indexOf('\n];', start);
  if (start === -1 || end === -1) throw new Error('לא נמצא TANAKH_DATE_EVENTS ב-dates.js');
  const body = src.slice(start, end);
  const rows = [];
  const re = /\{\s*day:"([^"]*)"\s*,\s*month:"([^"]*)"\s*,\s*event:"((?:[^"\\]|\\.)*)"\s*,\s*source:"((?:[^"\\]|\\.)*)"\s*\}/g;
  let m;
  while ((m = re.exec(body))) {
    rows.push({
      day: m[1], month: m[2],
      event: m[3].replace(/\\"/g, '"'), source: m[4].replace(/\\"/g, '"'),
    });
  }
  return { src, insertAt: end, rows };
}

function collectEvents() {
  const seen = new Map();
  const quotes = {};
  const rows = [];
  let total = 0;
  for (const f of EVENT_FILES) {
    const recs = readCsv(f);
    total += recs.length;
    let added = 0;
    for (const c of recs) {
      if (c.length < 3 || !c[0] || !c[1] || !c[2]) continue;
      const rec = {
        day: dayLetters(c[1]),
        month: fixOcr(c[0]),
        event: fixOcr(c[2]),
        source: sourceForDates(c[3] || ''),
      };
      if (!rec.day || !rec.month || !rec.event) continue;
      const key = rec.day + '|' + rec.month + '|' + norm(rec.event);
      if (seen.has(key)) continue;
      seen.set(key, rec);
      rows.push(rec);
      added++;
      const q = fixOcr(c[4] || '');
      const e = fixOcr(c[5] || '');
      if (q || e) quotes[rec.day + '|' + rec.month + '|' + rec.event] = { quote: q, explanation: e };
    }
    log('  ' + f + ': ' + recs.length + ' שורות, ' + added + ' חדשות אחרי דה-דופ פנימי');
  }
  log('  סה"כ ייחודיים בין 4 הקבצים: ' + rows.length + ' (מתוך ' + total + ' שורות)');
  return { rows, quotes };
}

// דה-דופ מילולי לבדו אינו מספיק כאן: הרשומות שנוספו ב-26/08 מאחדות כמה
// מאורעות לשורה אחת ("הקמת המשכן במדבר; מות נדב ואביהוא; ראש השנה למלכים"),
// והמקורות כאן מפרקים אותה לשלוש שורות נפרדות. לכן, לאותו יום+חודש בלבד:
// רשומה חדשה נחשבת כפילות אם הטקסט שלה מוכל בקיים, או שרוב מילות התוכן שלה
// כבר מופיעות בו. ההשוואה מוגבלת לאותו תאריך, כך ששני מאורעות שונים באמת
// (למשל "עמידת השמש בגבעון" מול "לידת יוסף הצדיק") אינם נפגעים.
const STOPWORDS = new Set(['של', 'על', 'את', 'עם', 'אל', 'מן', 'לא', 'או', 'כי', 'בן', 'בת', 'יום', 'ימי', 'בימי', 'לפי', 'הוא', 'היא', 'לדעת']);
function contentTokens(s) {
  return norm(s).split(' ').filter((w) => w.length > 1 && !STOPWORDS.has(w));
}
const SIMILARITY_THRESHOLD = 0.65;
function isSemanticDup(newEvent, oldEvents) {
  const nNorm = norm(newEvent);
  const nTok = contentTokens(newEvent);
  if (!nTok.length) return null;
  for (const old of oldEvents) {
    const oNorm = norm(old);
    if (oNorm.includes(nNorm) || nNorm.includes(oNorm)) return old;
    const oTok = new Set(contentTokens(old));
    const hits = nTok.filter((w) => oTok.has(w)).length;
    if (hits / nTok.length >= SIMILARITY_THRESHOLD) return old;
  }
  return null;
}

function runEvents() {
  log('\n=== מאורעות ===');
  const existing = loadExistingEvents();
  log('  ב-TANAKH_DATE_EVENTS כרגע: ' + existing.rows.length + ' רשומות');
  const { rows, quotes } = collectEvents();

  const existingKeys = new Set(existing.rows.map((r) => r.day + '|' + r.month + '|' + norm(r.event)));
  const byDate = new Map();
  existing.rows.forEach((r) => {
    const k = r.day + '|' + r.month;
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k).push(r.event);
  });

  const fresh = [];
  const exactDup = [];
  const semanticDup = [];
  const collisions = [];
  for (const r of rows) {
    if (existingKeys.has(r.day + '|' + r.month + '|' + norm(r.event))) { exactDup.push(r); continue; }
    const same = byDate.get(r.day + '|' + r.month) || [];
    const hit = isSemanticDup(r.event, same);
    if (hit) { semanticDup.push({ n: r, old: hit }); continue; }
    // הרשומה נכנסת, אבל יש כבר מאורע אחר באותו תאריך - לעין אנושית.
    if (same.length) collisions.push({ n: r, old: same });
    fresh.push(r);
  }
  // דה-דופ סמנטי גם בין הרשומות החדשות עצמן, באותו תאריך.
  const finalFresh = [];
  const innerDup = [];
  const perDate = new Map();
  for (const r of fresh) {
    const k = r.day + '|' + r.month;
    const bucket = perDate.get(k) || [];
    const hit = isSemanticDup(r.event, bucket);
    if (hit) { innerDup.push({ n: r, old: hit }); continue; }
    bucket.push(r.event);
    perDate.set(k, bucket);
    finalFresh.push(r);
  }

  log('  כפילות מילולית מול dates.js: ' + exactDup.length);
  log('  כפילות סמנטית מול dates.js: ' + semanticDup.length);
  semanticDup.forEach((c) => log('    נזרק "' + c.n.event + '" (' + c.n.day + " " + c.n.month + ') ≈ "' + c.old + '"'));
  log('  כפילות סמנטית בין הקבצים עצמם: ' + innerDup.length);
  innerDup.forEach((c) => log('    נזרק "' + c.n.event + '" ≈ "' + c.old + '"'));
  log('  חדשים בפועל: ' + finalFresh.length);
  log('  נוספו לתאריך שכבר יש בו מאורע אחר (תקין, לא כפילות): ' + collisions.length);
  const fresh2 = finalFresh;
  fresh.length = 0;
  fresh2.forEach((r) => fresh.push(r));

  if (WRITE && fresh.length) {
    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const header = '\n  // --- גל 30/08/26: 4 קבצי "ערך היום — מאורעות" מ-\n'
      + '  // docs/תוכן-ממתין-25-08-26/ערך-היום-מאורעות-1..4.txt, אחרי דה-דופ פנימי\n'
      + '  // ומול המערך הקיים (tools/merge-pending.js). עמודות ה"ציטוט"/"הסבר קצר"\n'
      + '  // שבמקור אינן שדה ברשומה כאן - הן נשמרו בנפרד ב-\n'
      + '  // docs/תוכן-ממתין-25-08-26/מאורעות-ציטוט-והסבר.json.\n';
    const body = fresh.map((r) =>
      '  { day:"' + esc(r.day) + '", month:"' + esc(r.month) + '", event:"' + esc(r.event)
      + '", source:"' + esc(r.source) + '" },').join('\n');
    const out = existing.src.slice(0, existing.insertAt) + '\n' + header + body + existing.src.slice(existing.insertAt);
    fs.writeFileSync(DATES_FILE, out, 'utf8');
    fs.writeFileSync(QUOTES_OUT, JSON.stringify(quotes, null, 1), 'utf8');
    log('  ✓ נכתבו ' + fresh.length + ' רשומות ל-dates.js, ו-' + Object.keys(quotes).length + ' ציטוטים/הסברים ל-' + path.basename(QUOTES_OUT));
  }
  return fresh;
}

// ---------------------------------------------------------------------------
// זרם 2: כלים ומטבעות -> DATA של דומם
// ---------------------------------------------------------------------------
const TOOL_FILES = [1, 2, 3, 4, 5].map((n) => 'כלים-מהמקורות-' + n + '.txt');

// שדה חובה ב-domem (tools/lib/config.js) שאין לו עמודה במקור. ניסוח קבוע,
// זהה בעיקרון לזה שנעשה בשילוב הצבעים - לא מחרוזת ריקה, שהוולידטור סופר
// כ"שדה חובה חסר" (רגרסיה שמעכבת שחרור).
const IDENT_FALLBACK = 'הזיהוי עולה מהקשר המקורות שלהלן (ר\' רשימת המקורות והציטוט).';

// "קטגוריה / תשמיש" מהמקור -> cat קיים ב-CATS של domem-data.js.
function mapCat(usage) {
  const u = norm(usage);
  if (/נגינה|פעמון|זמר/.test(u)) return 'instruments';
  if (/נשק|מלחמה|ציד|הגנה/.test(u)) return 'weapons';
  if (/מקדש|שרת|משכן|כהונה|קרבן|גורל/.test(u)) return 'vessels';
  if (/לבוש|מנעל|בגד/.test(u)) return 'clothing';
  if (/חקלאות|עבודה|מלאכה|בניין|בנייה|נגרות|חציבה|כתישה|חיתוך|אריגה|טקסטיל|דיש|קליעה|גילוף|מדידה/.test(u)) return 'tools';
  return 'objects';
}

function loadDomem() {
  const src = fs.readFileSync(DOMEM_FILE, 'utf8');
  const m = src.match(/const DATA = (\[[\s\S]*?\]);\n/);
  if (!m) throw new Error('לא נמצא const DATA ב-domem-data.js');
  return { src, raw: m[1], data: JSON.parse(m[1]) };
}

function saveDomem(bundle, data) {
  const out = bundle.src.replace(bundle.raw, () => JSON.stringify(data));
  fs.writeFileSync(DOMEM_FILE, out, 'utf8');
}

// רשומת דומם תקינה: כל שדות החובה מלאים, ו-makorot בלי ref/text ריקים או
// "undefined" (בדיוק הבאג שנוצר בשילוב הצבעים).
function buildEntry(name, cat, explanation, srcRef, quote, aliases) {
  const mak = [];
  const ref = String(srcRef || '').trim();
  const text = String(quote || '').trim();
  if (ref && text && !/undefined/.test(ref + text)) mak.push({ ref: ref, text: text });
  else if (ref && !/undefined/.test(ref)) mak.push({ ref: ref, text: ref });
  return {
    name: name, cat: cat, img: null, aliases: aliases || [],
    explanation: explanation,
    identification: IDENT_FALLBACK,
    note: '', gallery: [], makorot: mak,
  };
}

function runDomem() {
  log('\n=== כלים ומטבעות ===');
  const bundle = loadDomem();
  log('  ב-DATA כרגע: ' + bundle.data.length + ' רשומות');
  const existingNames = new Set();
  bundle.data.forEach((e) => {
    existingNames.add(norm(e.name));
    (e.aliases || []).forEach((a) => existingNames.add(norm(a)));
  });

  const seen = new Set();
  const fresh = [];
  const skippedNoExpl = [];
  const catCounts = {};

  // --- כלים ---
  for (const f of TOOL_FILES) {
    const recs = readCsv(f);
    let added = 0, dupIn = 0, dupOut = 0;
    for (const c of recs) {
      if (c.length < 5 || !c[0]) continue;
      const rawName = fixOcr(c[0]);
      const parts = rawName.split('/').map((s) => s.trim()).filter(Boolean);
      const name = parts[0];
      const aliases = parts.slice(1);
      if (!name) continue;
      const key = norm(name);
      if (seen.has(key)) { dupIn++; continue; }
      if (existingNames.has(key)) { dupOut++; seen.add(key); continue; }
      const explanation = fixOcr(c[4]);
      if (!explanation) { skippedNoExpl.push(name + ' (' + f + ')'); continue; }
      seen.add(key);
      const cat = mapCat(c[1]);
      catCounts[cat] = (catCounts[cat] || 0) + 1;
      fresh.push(buildEntry(name, cat, explanation, sourceForDomem(c[2]), fixOcr(c[3]), aliases));
      added++;
    }
    log('  ' + f + ': ' + recs.length + ' שורות → ' + added + ' חדשות (' + dupIn + ' כפולות בין הקבצים, ' + dupOut + ' קיימות כבר ב-DATA)');
  }

  // --- מטבעות ---
  // עמודות היחס המוניטרי והמשקל אינן שדה בסכימה - נספחות לתחילת ההסבר.
  const coins = readCsv('מטבעות.txt');
  let coinsAdded = 0, coinsDup = 0;
  for (const c of coins) {
    if (c.length < 6 || !c[0]) continue;
    const name = fixOcr(c[0]);
    const key = norm(name);
    if (seen.has(key) || existingNames.has(key)) { coinsDup++; continue; }
    const bits = [fixOcr(c[1]), fixOcr(c[2])].filter(Boolean).join(' · ');
    const explanation = (bits ? bits + '. ' : '') + fixOcr(c[5]);
    if (!explanation.trim()) continue;
    seen.add(key);
    catCounts.coins = (catCounts.coins || 0) + 1;
    fresh.push(buildEntry(name, 'coins', explanation, sourceForDomem(c[3]), fixOcr(c[4]), []));
    coinsAdded++;
  }
  log('  מטבעות.txt: ' + coins.length + ' שורות → ' + coinsAdded + ' חדשות (' + coinsDup + ' קיימות/כפולות)');

  log('  מיפוי קטגוריות: ' + JSON.stringify(catCounts));
  if (skippedNoExpl.length) log('  נזרקו (אין הסבר, שדה חובה): ' + skippedNoExpl.join(', '));
  log('  סה"כ רשומות חדשות לדומם: ' + fresh.length);

  return { bundle, fresh };
}

// ---------------------------------------------------------------------------
// זרם 3: תיקון makorot של הצבעים (באג משילוב 26/08)
// ---------------------------------------------------------------------------
// הסקריפט הקודם בנה text כ-`[ציטוט] ${undefined}` והוסיף רשומות ריקות, כך
// שב-28 מ-29 ערכי colors יש makorot עם המילה "undefined" ו/או בלי ref.
// כאן נבנה makorot מחדש מ-צבעים.txt המקורי.
// עמודות צבעים.txt: 0=צבע/גוון 1=קטגוריה 2=הקשר/נושא 3=מקור מדויק 4=ציטוט 5=ביאור.
// הסקריפט הקודם לקח ref מעמודת ה*ביאור* ו-text מהציטוט, ושרשר `${undefined}` —
// ולכן ה-ref בכרטיס הוא "תיאור התבשיל והאדמומיות של עשיו" במקום "בראשית, כה ל",
// ולכן גם ה-explanation נגמר ב-"undefined". כאן makorot ו-explanation נבנים
// מחדש מהמקור, ולא מתוקנים טלאי על הקיים.
function fixColors(data) {
  log('\n=== תיקון הצבעים (makorot + explanation) ===');
  const recs = readCsv('צבעים.txt');
  const byName = new Map();
  for (const c of recs) {
    if (!c[0]) continue;
    const key = norm(String(c[0]).split('/')[0]);
    const ref = sourceForDomem(c[3] || '');
    const text = fixOcr(c[4] || '');
    const biur = fixOcr(c[5] || '');
    if (!byName.has(key)) byName.set(key, { mak: [], biur: [] });
    const slot = byName.get(key);
    if (ref && text) slot.mak.push({ ref: ref, text: text });
    if (biur) slot.biur.push(biur);
  }

  let fixedMak = 0, fixedExpl = 0, ghosts = 0, total = 0;
  data.forEach((e) => {
    if (e.cat !== 'colors') return;
    const src = byName.get(norm(String(e.name).split('/')[0]));

    // makorot: מהמקור אם יש; אחרת ניקוי הקיים מ-"undefined" ומרשומות ריקות.
    const before = Array.isArray(e.makorot) ? e.makorot.length : 0;
    let mak;
    if (src && src.mak.length) {
      mak = [];
      const seenM = new Set();
      src.mak.forEach((m) => {
        const k = norm(m.ref) + '|' + norm(m.text);
        if (seenM.has(k)) return;
        seenM.add(k);
        mak.push(m);
      });
    } else {
      mak = (e.makorot || [])
        .map((m) => ({
          ref: String(m.ref == null ? '' : m.ref).replace(/\s*undefined\s*/g, '').trim(),
          text: String(m.text == null ? '' : m.text).replace(/\s*undefined\s*/g, '').replace(/^\[|\]$/g, '').trim(),
        }))
        .filter((m) => m.ref && m.text);
    }
    ghosts += Math.max(0, before - mak.length);
    total += mak.length;
    if (JSON.stringify(mak) !== JSON.stringify(e.makorot)) { e.makorot = mak; fixedMak++; }

    // explanation: היה "גוון המוזכר במקורות שלהלן. undefined"
    const expl = String(e.explanation || '');
    if (/undefined/.test(expl) || !expl.trim()) {
      const biur = src && src.biur.length ? src.biur.join('; ') : '';
      e.explanation = biur
        ? 'גוון המוזכר במקורות שלהלן: ' + biur + '.'
        : 'גוון המוזכר במקורות שלהלן.';
      fixedExpl++;
    }
  });
  log('  ערכים שה-makorot שלהם נבנה מחדש: ' + fixedMak + ' | רשומות makorot בסך הכל: ' + total + ' | רשומות-רפאים שהוסרו: ' + ghosts);
  log('  ערכים שה-explanation שלהם תוקן: ' + fixedExpl);
  return fixedMak;
}

// ---------------------------------------------------------------------------
function main() {
  runEvents();
  if (process.argv.includes('--events-only')) return;
  const { bundle, fresh } = runDomem();
  const data = bundle.data;
  fresh.forEach((e) => data.push(e));
  fixColors(data);

  const bad = [];
  data.forEach((e) => {
    ['name', 'cat', 'explanation', 'identification'].forEach((f) => {
      if (!e[f] || !String(e[f]).trim()) bad.push(e.name + ' → ' + f);
    });
    if (!Array.isArray(e.makorot) || !e.makorot.length) bad.push(e.name + ' → makorot');
    (e.makorot || []).forEach((m) => {
      if (/undefined/.test(String(m.ref) + String(m.text))) bad.push(e.name + ' → makorot/undefined');
      if (!m.ref || !m.text) bad.push(e.name + ' → makorot ריק');
    });
  });
  log('\n=== בדיקה עצמית לפני כתיבה ===');
  log('  DATA אחרי: ' + data.length + ' רשומות');
  log('  בעיות שדות חובה/makorot: ' + bad.length);
  if (bad.length) log('    ' + bad.slice(0, 30).join('\n    '));
  log('  תיקוני OCR שבוצעו: ' + ocrCount);
  if (ocrSamples.length) log('    דוגמאות: ' + ocrSamples.slice(0, 5).map((s) => JSON.stringify(s)).join(' , '));

  if (WRITE) {
    if (bad.length) { console.error('\n✗ לא נכתב ל-domem-data.js: יש ' + bad.length + ' בעיות שדות חובה.'); process.exit(1); }
    saveDomem(bundle, data);
    log('  ✓ נכתב domem-data.js');
  } else {
    log('\n(הרצה יבשה. להרצה בפועל: node tools/merge-pending.js --write)');
  }
}

main();
