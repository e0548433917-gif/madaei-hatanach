#!/usr/bin/env node
/*
 * tools/identify-corpus.js — בדיקת "זיהויי הבעלים" על כל המאגר (#39, שכבה 8).
 *
 * סט הזהב (identify-bench.js) מודד דיוק על 81 מקרים. הבדיקה הזו משלימה אותו:
 * מריצה את המנוע על כל פסוק ייחודי מתוך שדות verses של שמונת המדריכים, וסופרת
 * כמה פעמים הערך שרושם את הפסוק אכן מזוהה בו ("זיהוי בעלים"). זו הבדיקה שה-recall
 * לא נשחק במקום שהסט לא מכסה — היעד: לא לאבד יותר מ-2% מזיהויי הבעלים.
 *
 *   node tools/identify-corpus.js                      — מנוע ברירת המחדל, רק זיהויים גלויים
 *   node tools/identify-corpus.js --all                — גם דרגת "אפשרי" (מוסתרת בתצוגה)
 *   node tools/identify-corpus.js --engine path.js     — גרסה חלופית (למשל עותק של המנוע הישן)
 *   node tools/identify-corpus.js --lost out.json      — שמירת זיהויי הבעלים שאבדו מול --compare
 *   node tools/identify-corpus.js --compare other.js   — השוואת שני מנועים, אותו מאגר
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
const ENGINE = opt('--engine') || 'shell/identify.js';
const COMPARE = opt('--compare');
const LOST_OUT = opt('--lost');
const ALL = args.includes('--all');

const DATASETS = {};
for (const g of GUIDES) DATASETS[g.id] = loadDataFile(g.file).DATA || [];

function loadEngine(enginePath) {
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
  const lexPath = path.join(ROOT, 'guides/_shared/identify-lexicon.js');
  if (fs.existsSync(lexPath)) vm.runInContext(fs.readFileSync(lexPath, 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.resolve(ROOT, enginePath), 'utf8'), ctx);
  return ctx;
}

// פסוק ייחודי (לפי הטקסט) → קבוצת הבעלים "קטגוריה|שם"
const verses = new Map();
for (const g of GUIDES) {
  for (const e of DATASETS[g.id]) {
    for (const v of e.verses || []) {
      if (!v || !v.text) continue;
      if (!verses.has(v.text)) verses.set(v.text, new Set());
      verses.get(v.text).add(g.id + '|' + e.name);
    }
  }
}

async function run(enginePath) {
  const ctx = loadEngine(enginePath);
  let total = 0, owners = 0, ownerHits = 0, ms = 0;
  const hitOwners = new Set();
  for (const [text, own] of verses) {
    const t0 = Date.now();
    let res = await ctx.identify(text);
    ms += Date.now() - t0;
    if (!ALL) res = res.filter((r) => r.confidence !== 'אפשרי');
    const hits = new Set(res.map((r) => r.catId + '|' + r.name));
    total += hits.size;
    owners += own.size;
    for (const o of own) if (hits.has(o)) { ownerHits++; hitOwners.add(text + '\u0000' + o); }
  }
  return { enginePath, verses: verses.size, total, owners, ownerHits, hitOwners, ms };
}

function report(r) {
  const n = r.verses;
  console.log(`\nמנוע: ${r.enginePath}${ALL ? ' (כולל "אפשרי")' : ''} · פסוקים ייחודיים: ${n}`);
  console.log(`זיהויים לפסוק ${(r.total / n).toFixed(2)} · מהם בעלים ${(r.ownerHits / n).toFixed(2)} · לא-בעלים ${((r.total - r.ownerHits) / n).toFixed(2)}`);
  console.log(`זיהויי בעלים ${r.ownerHits} מתוך ${r.owners} רישומים (${(100 * r.ownerHits / r.owners).toFixed(1)}%) · ${(r.ms / n).toFixed(1)}ms לפסוק`);
}

(async () => {
  const a = await run(ENGINE);
  report(a);
  if (COMPARE) {
    const b = await run(COMPARE);
    report(b);
    const lost = [...b.hitOwners].filter((k) => !a.hitOwners.has(k));
    const gained = [...a.hitOwners].filter((k) => !b.hitOwners.has(k));
    const pct = (100 * (b.ownerHits - a.ownerHits) / Math.max(1, b.ownerHits)).toFixed(2);
    console.log(`\n${ENGINE} מול ${COMPARE}: אבדו ${lost.length} זיהויי בעלים, נוספו ${gained.length} · שינוי נטו ${pct}% (יעד: ≤2% אובדן)`);
    if (LOST_OUT) {
      const byOwner = {};
      for (const k of lost) { const o = k.split('\u0000')[1]; byOwner[o] = (byOwner[o] || 0) + 1; }
      const top = Object.entries(byOwner).sort((x, y) => y[1] - x[1]);
      fs.writeFileSync(path.resolve(LOST_OUT), JSON.stringify({ lost: lost.length, gained: gained.length, top, sample: lost.slice(0, 300).map((k) => k.split('\u0000')) }, null, 1), 'utf8');
      console.log('נשמר: ' + LOST_OUT);
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
