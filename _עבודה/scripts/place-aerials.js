#!/usr/bin/env node
// #72 (ת.5.1) — תצלומי אוויר לאתרים היסטוריים/ארכיאולוגיים במדריך המקומות.
// מקורות: ויקישיתוף בלבד (כולל צילומי USGS שהועלו לשם), ברישיון חופשי, עם קרדיט.
// לא Google Earth / Google Maps / Bing / Apple — נפסל לפי התיאור והקרדיט.
// לפני הוספה: הערך קיים פעם אחת בדיוק (שם או כינוי), ואין לו img/gallery.
// שימוש: node _עבודה/scripts/place-aerials.js [--dry]   ואז tools/compress-embedded-images.js
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const FILE = path.resolve(__dirname, '../../guides/places/data/places.js');
const DRY = process.argv.includes('--dry');

// שם בערך ← מונחי חיפוש באנגלית (לפי סדר עדיפות). רק אתרים שיש בהם מה לראות.
const SITES = {
  'שילה': ['Tel Shiloh', 'Shiloh archaeological'], 'לכיש': ['Tel Lachish', 'Lachish'],
  'מגידו': ['Tel Megiddo', 'Megiddo'], 'חצור': ['Tel Hazor', 'Hazor'], 'דן': ['Tel Dan'],
  'גזר': ['Tel Gezer', 'Gezer'], 'עזקה': ['Tel Azekah', 'Azekah'], 'מראשה': ['Maresha', 'Beit Guvrin'],
  'יזרעאל': ['Tel Jezreel'], 'תענך': ['Tel Taanach', 'Taanach'], 'ציפורי': ['Tzippori', 'Sepphoris', 'Zippori'],
  'שומרון': ['Sebastia', 'Samaria Sebaste'], 'עקרון': ['Tel Miqne', 'Ekron'], 'גת': ['Tell es-Safi', 'Tel Zafit'],
  'באר שבע': ['Tel Beer Sheva', 'Tel Sheva'], 'יריחו': ['Tell es-Sultan', 'Tel Jericho'],
  'בית שאן': ["Tel Beit She'an", "Beit She'an National Park", 'Scythopolis'], 'בית שמש': ['Tel Beit Shemesh'],
  'אשקלון': ['Tel Ashkelon', 'Ashkelon National Park'], 'תמנה': ['Tel Batash'],
  'בית שערים': ["Beit She'arim", 'Beit Shearim'], 'עופל': ['Ophel'], 'קדש נפתלי': ['Tel Kedesh'],
  'ממרא': ['Mamre', 'Ramat al-Khalil'], 'גבעון': ['Gibeon', 'al-Jib'], 'דותן': ['Tel Dothan'],
  'תרצה': ["Tell el-Far'ah", 'Tirzah'],
};
// צילום של אתר אחר / מקום בשם זהה בחו״ל — נפסל (נמצא בהרצה יבשה)
const REJECT = { 'יזרעאל': /megiddo/i, 'עקרון': /kiryat/i };
const FOREIGN = /kentucky|ohio|texas|indiana|united states|usa\b/i;
const AIR = /aerial|drone|from above|from the air|bird'?s.eye|air view|airview|usgs/i;
const BANNED = /google|bing|apple maps|satellite image from|earth\.google/i;
const OKLIC = /^(cc[- ]by(-sa)?|cc0|public domain|pd)/i;

const src = fs.readFileSync(FILE, 'utf8');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(src + ';this.D=DATA;this.I=(typeof CARD_IMAGES!=="undefined"?CARD_IMAGES:{})', ctx);
const DATA = ctx.D, IMGS = ctx.I;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const api = async (q, tries = 4) => {
  await sleep(1500);
  const u = 'https://commons.wikimedia.org/w/api.php?format=json&origin=*&' + new URLSearchParams(q);
  const r = await fetch(u, { headers: { 'User-Agent': 'madaei-hatanach/1.0 (Otzaria plugin)' } });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch(e){ if (tries > 1){ await sleep(8000); return api(q, tries - 1); } throw e; }
};
const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function findImage(terms, name){
  for (const t0 of terms) for (const q of [`"${t0}" aerial`, `${t0} aerial`, `${t0} drone`]){
    const t = t0;
    const j = await api({ action: 'query', generator: 'search', gsrsearch: q + ' filetype:bitmap',
      gsrnamespace: 6, gsrlimit: 12, prop: 'imageinfo', iiprop: 'url|extmetadata|mime|size', iiurlwidth: 1040 });
    const pages = Object.values((j.query && j.query.pages) || {}).sort((a, b) => a.index - b.index);
    for (const p of pages){
      const ii = p.imageinfo && p.imageinfo[0]; if (!ii || !/jpeg|png|webp/.test(ii.mime)) continue;
      const m = ii.extmetadata || {};
      const desc = strip(m.ImageDescription && m.ImageDescription.value);
      const credit = strip(m.Credit && m.Credit.value), artist = strip(m.Artist && m.Artist.value);
      const lic = strip(m.LicenseShortName && m.LicenseShortName.value);
      const hay = p.title + ' ' + desc;
      const norm = s => s.toLowerCase().replace(/['’\-_]/g, '');
      const toks = t.split(/\s+/).filter(w => w.length >= 4 && !/^(tell?|national|park|archaeological)$/i.test(w));
      if (!AIR.test(hay) || !toks.some(w => norm(hay).includes(norm(w)))) continue;
      if (FOREIGN.test(hay) || (REJECT[name] && REJECT[name].test(hay))) continue;
      if (BANNED.test(hay + ' ' + credit + ' ' + artist)) continue;
      if (!OKLIC.test(lic) || /nc|nd/i.test(lic.replace(/^cc[- ]by(-sa)?/i, ''))) continue;
      if (ii.width < 600) continue;
      return { title: p.title, url: ii.thumburl || ii.url, lic, artist: (artist || credit || 'לא צוין').slice(0, 80) };
    }
  }
  return null;
}

(async () => {
  let text = src; const added = [], skipped = [];
  const usedFiles = new Set();
  for (const [name, terms] of Object.entries(SITES)){
    let hits = DATA.filter(e => e.name === name || (e.aliases || []).includes(name));
    // שם זהה בשתי קטגוריות (עיר / ארץ) — העיר או היישוב, כי שם יש מה לצלם
    if (hits.length > 1){ const c = hits.filter(e => e.name === name && /^(cities|villages)$/.test(e.cat)); if (c.length === 1) hits = c; }
    if (hits.length !== 1){ skipped.push(`${name}: ${hits.length} ערכים`); continue; }
    const e = hits[0];
    if (e.img || (e.gallery && e.gallery.length) || IMGS[e.name]){ skipped.push(`${name}: כבר יש תמונה`); continue; }
    const anchor = `{"name":${JSON.stringify(e.name)},`;
    if (text.split(anchor).length !== 2){ skipped.push(`${name}: עוגן לא ייחודי`); continue; }
    let img; try { img = await findImage(terms, name); } catch(err){ skipped.push(`${name}: ${err.message}`); continue; }
    if (!img){ skipped.push(`${name}: לא נמצא צילום אוויר חופשי`); continue; }
    if (usedFiles.has(img.title)){ skipped.push(`${name}: אותה תמונה כמו ערך אחר`); continue; }
    usedFiles.add(img.title);
    const r = await fetch(img.url, { headers: { 'User-Agent': 'madaei-hatanach/1.0' } });
    if (!r.ok){ skipped.push(`${name}: הורדה ${r.status}`); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    const mime = r.headers.get('content-type') || 'image/jpeg';
    const credit = `${img.artist}, ויקישיתוף (${img.title.replace(/^File:/, '')}) · ${img.lic}`;
    text = text.replace(anchor, anchor + `"img":${JSON.stringify(e.name)},"credit":${JSON.stringify(credit)},`);
    IMGS[e.name] = `data:${mime};base64,${buf.toString('base64')}`;
    added.push(`${name} ← ${img.title} (${img.lic}, ${(buf.length / 1024) | 0}KB)`);
  }
  // CARD_IMAGES בסוף הקובץ (נוצר אם אינו קיים)
  const block = 'const CARD_IMAGES = ' + JSON.stringify(IMGS, null, 0).replace(/","/g, '",\n"') + ';\n';
  if (/\nconst CARD_IMAGES = [\s\S]*$/.test(text)) text = text.replace(/\nconst CARD_IMAGES = [\s\S]*$/, '\n' + block);
  else text = text.replace(/\s*$/, '\n\n// #72 — תצלומי אוויר (ויקישיתוף, רישיון חופשי; קרדיט בשדה credit)\n' + block);
  if (!DRY && added.length) fs.writeFileSync(FILE, text);
  console.log(`נוספו ${added.length}, דולגו ${skipped.length}${DRY ? ' (dry)' : ''}`);
  added.forEach(s => console.log('  + ' + s)); skipped.forEach(s => console.log('  - ' + s));
})();
