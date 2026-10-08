// יישום הצעות העריכה הברורות (#102 #103 #105 #108) ואיחוד כפילויות אסתר (#28 #29).
// עורך שורה-לרשומה בקובצי ה-data (פורמט: רשומת JSON אחת לשורה בתוך const DATA = [...]).
const fs=require('fs');
function edit(file, fn){
  const lines=fs.readFileSync(file,'utf8').split('\n'); let n=0;
  const out=[];
  for(const l of lines){
    const m=l.match(/^(\s*)(\{"name":.*\})(,?)\s*$/);
    if(!m){out.push(l);continue;}
    const e=JSON.parse(m[2]); const r=fn(e);
    if(r===null){n++;continue;}               // מחיקה
    if(r){n++;out.push(m[1]+JSON.stringify(r)+m[3]);} else out.push(l);
  }
  fs.writeFileSync(file,out.join('\n')); console.log(file,'שונו',n);
}
const dedupe=a=>{const s=new Set();return a.filter(x=>{const k=x.ref+'|'+x.text;return s.has(k)?false:(s.add(k),true);});};
const P='guides/people/data/people-data.js';
const all=[];fs.readFileSync(P,'utf8').split('\n').forEach(l=>{const m=l.match(/^\s*(\{"name":.*\}),?\s*$/);if(m)all.push(JSON.parse(m[1]));});
const esther=['אסתר','הדסה','אסתר בת דדו'].map(n=>all.find(e=>e.name===n));
edit(P,e=>{
  if(['אסתר','הדסה','אסתר בת דדו'].includes(e.name)) return null;
  if(e.name==='אסתר בת אביחיל'){
    e.aliases=[...new Set([...(e.aliases||[]),'אסתר','הדסה'])];
    e.verses=dedupe([...e.verses,...esther.flatMap(x=>x.verses||[])]);
    e.midrash=dedupe([...e.midrash,...esther.flatMap(x=>x.midrash||[])]);
    e.note='אסתר המלכה, ושמה גם הדסה (אסתר ב, ז). ״אסתר בת אביחיל דד מרדכי״ (אסתר ב, טו) — ״דד״ הוא דודו של מרדכי, ולא שם אביה.';
    return e;
  }
  if(e.name==='פרשנדתא'){
    const h=all.find(x=>x.name==='המן');
    e.siblings=h.children.filter(c=>c!=='פרשנדתא'); e.deathPlace='שושן'; return e;
  }
  if(e.name==='אברהם'){ e.mother='אמתלאי בת כרנבו (בבא בתרא צא ע״א)'; return e; }
  if(e.name==='המן' && e.father==='המדתא'){ e.roles=[...new Set([...e.roles,'צורר היהודים'])]; e.dwelling='שושן'; e.deathPlace='שושן'; return e; }
});
edit('guides/amoraim/data/amoraim-data.js',e=>{
  if(e.name==='אביי' && !(e.aliases||[]).includes('נחמני')){ e.aliases=[...(e.aliases||[]),'נחמני']; return e; }
});
