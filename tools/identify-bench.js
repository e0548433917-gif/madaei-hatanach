#!/usr/bin/env node
/*
 * tools/identify-bench.js — מדידת מנוע הזיהוי מול סט הבדיקות הזהב (#38, סבב 3).
 *
 *   node tools/identify-bench.js                 — סיכום: דיוק / כיסוי / F1, ופירוט לפי תגית
 *   node tools/identify-bench.js --verbose       — גם שורה לכל מקרה: מה חסר (FN) ומה מיותר (FP)
 *   node tools/identify-bench.js --tag תלמוד     — רק מקרים עם התגית הזו
 *   node tools/identify-bench.js --engine path   — קובץ identify.js חלופי (להשוואת גרסאות ב-3.2)
 *   node tools/identify-bench.js --json out.json — שמירת התוצאות המלאות (להשוואת לפני/אחרי)
 *
 * הסט: tools/identify-testset.json. לכל מקרה:
 *   expect — חייב להימצא (חסר = FN)
 *   allow  — מותר ולא נספר לשום צד (קריאות "לגיטימיות" שאינן חובה: ערך-עם על אזכור של עם, כפילות בדאטה)
 *   כל זיהוי אחר = זיהוי שווא (FP)
 *
 * רץ ב-Node בלי DOM/אוצריא, בדיוק כמו tools/validate.js: shell/core.js (הקבועים בלבד) +
 * shell/identify.js נטענים ל-vm עם CATEGORIES/loadGuideData מדומים. הקטגוריות = GUIDES
 * מ-tools/lib/config.js (שמונת המדריכים עם קובץ דאטה), לא CATEGORIES של האפליקציה.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { GUIDES } = require('./lib/config');
const { loadDataFile } = require('./lib/load');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const VERBOSE = args.includes('--verbose');
const TAG = opt('--tag');
const ENGINE = opt('--engine') || 'shell/identify.js';
const JSON_OUT = opt('--json');

const DATASETS = {};
for (const g of GUIDES) DATASETS[g.id] = loadDataFile(g.file).DATA || [];

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
vm.runInContext(fs.readFileSync(path.resolve(ROOT, ENGINE), 'utf8'), ctx);

const testset = JSON.parse(fs.readFileSync(path.join(__dirname, 'identify-testset.json'), 'utf8'));
const cases = testset.cases.filter((c) => !TAG || c.tag === TAG);

(async () => {
  const perTag = {};
  const rows = [];
  let TP = 0, FP = 0, FN = 0, perfect = 0;
  for (const c of cases) {
    const res = await ctx.identify(c.text);
    const hits = new Set(res.map((r) => r.catId + '|' + r.name));
    const expect = new Set(c.expect), allow = new Set(c.allow);
    const tp = [...hits].filter((h) => expect.has(h));
    const fp = [...hits].filter((h) => !expect.has(h) && !allow.has(h));
    const fn = [...expect].filter((e) => !hits.has(e));
    TP += tp.length; FP += fp.length; FN += fn.length;
    if (!fp.length && !fn.length) perfect++;
    const t = perTag[c.tag] || (perTag[c.tag] = { n: 0, tp: 0, fp: 0, fn: 0, perfect: 0 });
    t.n++; t.tp += tp.length; t.fp += fp.length; t.fn += fn.length; if (!fp.length && !fn.length) t.perfect++;
    rows.push({ id: c.id, tag: c.tag, ref: c.ref, hits: [...hits], fp, fn });
    if (VERBOSE && (fp.length || fn.length)) {
      console.log(`${c.id} [${c.ref}]` + (fn.length ? '  חסר: ' + fn.join(', ') : '') + (fp.length ? '  מיותר: ' + fp.join(', ') : ''));
    }
  }
  const P = TP / Math.max(1, TP + FP), R = TP / Math.max(1, TP + FN), F1 = (2 * P * R) / Math.max(1e-9, P + R);
  const pct = (x) => (100 * x).toFixed(1) + '%';
  console.log(`\nמנוע: ${ENGINE} · מקרים: ${cases.length}${TAG ? ' (תגית ' + TAG + ')' : ''}`);
  console.log(`נכונים ${TP} · שווא ${FP} · חסרים ${FN} · מקרים נקיים ${perfect}/${cases.length}`);
  console.log(`דיוק ${pct(P)} · כיסוי ${pct(R)} · F1 ${pct(F1)} · שווא לפסוק ${(FP / cases.length).toFixed(2)}`);
  console.log('\nלפי תגית:');
  for (const [tag, t] of Object.entries(perTag)) {
    const p = t.tp / Math.max(1, t.tp + t.fp), r = t.tp / Math.max(1, t.tp + t.fn);
    console.log(`  ${tag.padEnd(12)} n=${String(t.n).padStart(2)}  דיוק ${pct(p).padStart(6)}  כיסוי ${pct(r).padStart(6)}  נקיים ${t.perfect}/${t.n}  שווא/פסוק ${(t.fp / t.n).toFixed(2)}`);
  }
  if (JSON_OUT) {
    fs.writeFileSync(path.resolve(JSON_OUT), JSON.stringify({ engine: ENGINE, cases: cases.length, TP, FP, FN, perfect, P, R, F1, perTag, rows }, null, 1), 'utf8');
    console.log('\nנשמר: ' + JSON_OUT);
  }
})().catch((e) => { console.error(e); process.exit(1); });
