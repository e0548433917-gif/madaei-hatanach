#!/usr/bin/env node
/*
 * tools/harvest-vocal-lexicon.js — סבב 3.3 (#40): קציר הלקסיקון המנוקד.
 *
 * המנוע (shell/identify.js, harvestVocalForms) קוצר בזמן ריצה צורות מנוקדות של
 * שם רק מתוך ה-verses של הערך עצמו. לשמות שהפסוקים שלהם לא נותנים צורה (אין
 * פסוקים, הפסוק לא מנוקד, או שהשם מופיע בו פעמיים בלי רמז-שם) — אין ניקוד
 * להשוואה, והפסילה/האימות של שכבה 3 לא עובדים.
 *
 * הסקריפט משלים מקור מנוקד מתוך *כל* הפסוקים בכל המדריכים, בכללים מחמירים:
 *   (א) טוקן הצמוד לרמז-שם (בן/בת/שמו/אבי/אחי/...) — עדות חזקה שזה השם.
 *   (ב) צורה מנוקדת אחת עקבית: המפתח מופיע ב-≥2 פסוקים שונים, כולם באותו
 *       ניקוד (אחרי השוואה רופפת קמץ≈פתח) — ולא מפתח רב-משמעות.
 * הפלט: guides/_shared/vocal-lexicon.js — קבוע VOCAL_LEXICON {catId: {key: [forms]}},
 * שהמנוע משתמש בו רק למפתחות שאין להם צורה מהקציר העצמי.
 *
 *   node tools/harvest-vocal-lexicon.js            — קציר + כתיבת הקובץ + סיכום
 *   node tools/harvest-vocal-lexicon.js --dry      — סיכום בלבד
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { GUIDES } = require('./lib/config');
const { loadDataFile } = require('./lib/load');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');
const OUT = path.join(ROOT, 'guides/_shared/vocal-lexicon.js');

const DATASETS = {};
for (const g of GUIDES) DATASETS[g.id] = loadDataFile(g.file).DATA || [];

// טוענים את המנוע כמו identify-corpus.js — בלי הלקסיקון הנוכחי, כדי למדוד את
// הכיסוי העצמי בלבד.
const ctx = {
  console,
  CATEGORIES: GUIDES.map((g) => ({ id: g.id, label: g.label })),
  loadGuideData: async (cat) => DATASETS[cat.id] || [],
  getHtmlPagesIndex: async () => [],
  storageGet: async () => null,
};
vm.createContext(ctx);
const coreSrc = fs.readFileSync(path.join(ROOT, 'shell/core.js'), 'utf8');
vm.runInContext(coreSrc.match(/const HEB_POINT_SRC[\s\S]*?const PREFIXES = \[.*?\];/)[0], ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'guides/_shared/identify-lexicon.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'shell/identify.js'), 'utf8'), ctx);
vm.runInContext(`
  this.__api = { normalizeHeb, tokenizeHebPairs, harvestVocalForms, letterSegs, relaxVowels,
                 HAS_VOWEL_RE, HARVEST_CUES, cueForm, isNameGuide,
                 AMBIG: (typeof AMBIG_VOCAL !== 'undefined' ? AMBIG_VOCAL : new Set()) };
`, ctx);
const A = ctx.__api;

// כל מפתח חד-מילתי של כל מדריך (שם, הבהרה, כינויים)
function keysOf(entry) {
  const out = new Set();
  const add = (p) => String(p || '').trim().split(/\s+/).forEach((w) => {
    const n = A.normalizeHeb(w);
    if (n.length >= 2) out.add(n);
  });
  add((entry.name || '').replace(/\s*\(([^)]*)\)\s*$/, ' $1'));
  (entry.aliases || []).forEach(add);
  return out;
}

// כל הפסוקים המנוקדים בכל המדריכים, פעם אחת לכל טקסט
const allVerses = [];
{
  const seen = new Set();
  for (const g of GUIDES) for (const e of DATASETS[g.id]) for (const v of e.verses || []) {
    if (!v || !v.text || seen.has(v.text)) continue;
    seen.add(v.text);
    const toks = A.tokenizeHebPairs(v.text);
    if (toks.some((t) => A.HAS_VOWEL_RE.test(t.v))) allVerses.push(toks);
  }
}

// אינדקס: מפתח -> [{v: ניקוד, cue: bool, verse: מספר}]
const occ = new Map();
allVerses.forEach((toks, vi) => {
  toks.forEach((tok, i) => {
    if (!A.HAS_VOWEL_RE.test(tok.v)) return;
    const cue = [toks[i - 1], toks[i + 1]].some((n) => n && A.HARVEST_CUES.has(A.cueForm(n.c)));
    const push = (c, v) => {
      if (!occ.has(c)) occ.set(c, []);
      occ.get(c).push({ v, cue, verse: vi });
    };
    push(tok.c, tok.v);
    // ו״ו החיבור — כמו בקציר העצמי
    if (tok.c.length > 2 && tok.c[0] === 'ו') push(tok.c.slice(1), A.letterSegs(tok.v).slice(1).join(''));
  });
});

const out = {};
let totalKeys = 0, selfCovered = 0, added = 0;
const byGuide = [];
// אנשים מהתלמוד: השמות אינם מנוקדים במקור, ופסוקי תנ״ך הם מילים אחרות באותו כתיב
const SKIP = new Set(['amoraim']);
for (const g of GUIDES) {
  // מדריכי שמות-עצם (דומם, צומח…): ניקוד תואם רק מחזק את המילה הרגילה (ככר, הים)
  // ומעלה זיהויי שווא — הלקסיקון הסטטי מיועד לשמות פרטיים בלבד.
  if (SKIP.has(g.id) || !A.isNameGuide(g.id)) continue;
  const data = DATASETS[g.id];
  const self = new Map();
  data.forEach((e) => A.harvestVocalForms(e, self));
  const keys = new Set();
  data.forEach((e) => keysOf(e).forEach((k) => keys.add(k)));
  let gSelf = 0, gAdd = 0;
  const lex = {};
  for (const k of keys) {
    if (self.has(k) && self.get(k).size) { gSelf++; continue; }
    if (A.AMBIG.has(k)) continue;
    const list = occ.get(k) || [];
    if (!list.length) continue;
    const forms = new Set();
    // (א) עדות רמז-שם
    list.filter((o) => o.cue).forEach((o) => forms.add(o.v));
    // (ב) ניקוד עקבי בפסוקים שונים
    if (!forms.size) {
      const relaxed = new Set(list.map((o) => A.relaxVowels(A.letterSegs(o.v))));
      const verses = new Set(list.map((o) => o.verse));
      if (relaxed.size === 1 && verses.size >= 2) list.forEach((o) => forms.add(o.v));
    }
    if (forms.size) { lex[k] = Array.from(forms).sort(); gAdd++; }
  }
  totalKeys += keys.size; selfCovered += gSelf; added += gAdd;
  byGuide.push(`  ${g.label.padEnd(14)} מפתחות ${String(keys.size).padStart(5)} · קציר עצמי ${String(gSelf).padStart(5)} · נוסף ${String(gAdd).padStart(5)}`);
  if (Object.keys(lex).length) out[g.id] = lex;
}

console.log('קציר הלקסיקון המנוקד (3.3):');
byGuide.forEach((l) => console.log(l));
const pct = (n) => (100 * n / totalKeys).toFixed(1) + '%';
console.log(`  סה״כ: ${totalKeys} מפתחות · עצמי ${selfCovered} (${pct(selfCovered)}) · נוסף ${added} · כיסוי ${selfCovered + added} (${pct(selfCovered + added)})`);

if (!DRY) {
  const body = '// נוצר אוטומטית ע״י tools/harvest-vocal-lexicon.js (סבב 3.3, #40) — לא לערוך ידנית.\n'
    + '// צורות מנוקדות לשמות שאין להם ניקוד מהפסוקים של הערך עצמו. ר׳ shell/identify.js, buildLookup.\n'
    + 'const VOCAL_LEXICON = ' + JSON.stringify(out) + ';\n';
  fs.writeFileSync(OUT, body);
  console.log(`  נכתב: ${path.relative(ROOT, OUT)} (${(body.length / 1024).toFixed(0)}KB)`);
}
