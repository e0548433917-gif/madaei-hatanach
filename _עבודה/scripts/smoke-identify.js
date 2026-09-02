// בדיקת עשן למנוע הזיהוי אחרי v2 (01/09/2026) - בלי DOM/Otzaria, טוען את כל
// המדריכים ישירות מהדיסק ומריץ identify() על כמה פסוקים אמיתיים.
const fs = require('fs');
const vm = require('vm');

const CATS = [
  ['people','guides/people/data'],['places','guides/places/data'],
  ['animal','guides/animal/data'],['flora','guides/flora/data'],
  ['domem','guides/domem/data'],['amoraim','guides/amoraim/data'],
  ['beithamikdash','guides/beithamikdash/data'],['mumim','guides/mumim/data'],
  ['chullin','guides/chullin/data'],['sukkah','guides/sukkah/data'],
];
function readData(dir){
  const f = fs.readdirSync(dir).find(x=>/-data\.js$/.test(x) || x==='places.js');
  let s = fs.readFileSync(dir+'/'+f,'utf8');
  const ctx = { window:{} };
  vm.createContext(ctx);
  vm.runInContext(s + ';this.__DATA__=DATA;', ctx);
  return ctx.__DATA__;
}
const DATASETS = {};
for (const [id,dir] of CATS) DATASETS[id] = readData(dir);

const ctx = {
  console,
  CATEGORIES: CATS.map(([id])=>({id,label:id})),
  loadGuideData: async (cat) => DATASETS[cat.id] || [],
  getHtmlPagesIndex: async () => [],
  storageGet: async () => null,
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('shell/core.js','utf8').match(/const HEB_POINT_SRC[\s\S]*?const PREFIXES = \[.*?\];/)[0], ctx);
vm.runInContext(fs.readFileSync('shell/identify.js','utf8'), ctx);

// דגימת פסוקים אמיתיים מתוך verses של הערכים עצמם - טקסט אמיתי, לא מומצא
const samples = [];
for (const arr of Object.values(DATASETS)) {
  for (const e of arr) {
    for (const v of (e.verses||[])) { if (v.text && samples.length < 12) samples.push(v.text); }
  }
  if (samples.length >= 12) break;
}

(async () => {
  let total = 0;
  for (const text of samples) {
    const res = await vm.runInContext(`identify(${JSON.stringify(text)})`, ctx);
    total += res.length;
    console.log('---');
    console.log(text.slice(0,70));
    console.log('  →', res.map(r=>r.name+'['+r.catId+']').join(', ') || '(כלום)');
  }
  console.log('\nסה"כ זיהויים על 12 פסוקים אמיתיים:', total, '  (ממוצע לפסוק:', (total/samples.length).toFixed(1)+')');
})();
