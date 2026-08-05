// כרטיס הערך המלא: סכימת השדות, קישורי משפחה, מפה ורינדור.
// נוצר בפיצול router.js (גרסה 2.11.2). המקור: shell/router.js שורות 731-1141.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.

// מאגרי המדריכים לא אחידים בשמות השדות של מקורות חז״ל: מקומות משתמש ב-{source,note,link}
// ואישים/בע״ח/צומח/דומם ב-{ref,text}. עד כה השַׁלֶּה קרא רק source/note ולכן בכל כרטיס
// אישים הוצגה תיבה ריקה תחת "מקורות חז״ל". שני העוזרים האלה מקבלים את שתי הצורות.
function midrashSource(m){ return (m && (m.source || m.ref)) || ''; }
function midrashNote(m){ return (m && (m.note || m.text)) || ''; }

function fieldBlock(label, value){
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return '';
  const text = Array.isArray(value) ? value.join(', ') : value;
  return `<div class="field-label">${esc(label)}</div><p>${esc(text)}</p>`;
}

// זיהוי מודרני בקצרה - לשורת הפופאפ ולרשימת התוצאות, לפי איזה שדה קיים בערך:
// identification (דומם), methods[0].modern (מקומות), methods[0].latin (חי/צומח).
function shortModernId(entry){
  if (!entry) return '';
  const m0 = entry.methods && entry.methods[0];
  let s = entry.identification || (m0 && (m0.modern || m0.latin)) || '';
  s = String(s).replace(/\s+/g, ' ').trim();
  if (s.length > 70) s = s.slice(0, 67) + '...';
  return s;
}

// ---- קישורים בין אישים (אב/אם/בני זוג/ילדים/אחים לחיצים, כמו במדריך המקורי) ----
const PERSON_LINK_FIELDS = new Set(['father','mother','spouses','children','siblings']);
function isPersonEntry(entry){ return (dataCache['people'] || []).indexOf(entry) !== -1; }
function findPersonEntry(raw){
  const data = dataCache['people'] || [];
  const core = s => normalizeHeb(String(s||'').replace(/\s*\([^)]*\)\s*$/, ''));
  const norm = core(raw);
  if (!norm) return null;
  return data.find(e => core(e.name) === norm ||
    (e.aliases || []).some(a => core(a) === norm)) || null;
}
function personLinkedValue(value, selfEntry){
  const list = Array.isArray(value) ? value : [value];
  return list.filter(v => v != null && v !== '').map(name => {
    const target = findPersonEntry(name);
    if (target && target !== selfEntry) return `<span class="person-link" data-person="${esc(name)}">${esc(name)}</span>`;
    return esc(name);
  }).join(' · ');
}

// ---- קישור ממקום בכרטיס אישים אל כרטיס המקומות (עם המפה) ----
// שדות המקום של אישים אינם שם נקי אלא טקסט חופשי: ״מערת המכפלה בחברון״, ״ואז ארץ
// כנען ומצרים לתקופה״, ״עפרה (קברו)״. לכן לא מחפשים התאמה מלאה של השדה אלא סורקים
// אותו מילה-מילה, בדיוק כמו מנוע הזיהוי — ומעדיפים צירוף ארוך (״אור כשדים״, ״פדן
// ארם״) על פני מילה בודדת, כדי לא לקשר את ״אור״ לבדו.
const PLACE_LINK_FIELDS = new Set(['birthPlace','dwelling','deathPlace','burialPlace']);
const HEB_WORD_RE = new RegExp('(?:[א-ת]' + HEB_POINT_SRC + '*)+', 'g');
// מילות יחס שהן גם שם של מקום אמיתי במדריך — ״תחת״ היא תחנת מסע (במדבר לג), ולכן
// ״תחת תומר דבורה״ נקשר אליה. כמילה בודדת לא מקשרים אותן; בתוך צירוף (״תחת״ כשם
// עצמאי בשדה) עדיין ייתפסו דרך התאמת הצירוף.
const PLACE_LINK_SKIP_WORDS = new Set(['תחת','בין','אצל','ליד','עם','אל','על','מן','עד','שם','מול','סביב','לפני','אחרי','כאן','אז','ואז']);

// אינדקס של **שמות שלמים** בלבד (שם, שם בלי הסוגריים, תוכן הסוגריים, כינויים) —
// ובמכוון לא buildLookup של מנוע הזיהוי, שרושם גם כל מילה בתוך שם רב-מילים. שם
// חלקי מתאים לזיהוי בפסוק, אבל כאן הוא מקשר לכרטיס הלא נכון: ״אלון בצענים״ נקשר
// ל״אלון בכות״ ו״בית לחם יהודה״ ל״מדבר יהודה״. נמדד: 99 שדות מקושרים עם מילים
// חלקיות מול 89 בלעדיהן — עשרה קישורים פחות, וכולם היו שגויים או מטעים.
// מוחזר null כל עוד מדריך המקומות לא נטען; ר' refreshPlaceLinksWhenReady.
let placeNameIndex = null;
function placesNameIndex(){
  if (placeNameIndex) return placeNameIndex;
  const data = dataCache['places'];
  if (!data || !data.length) return null;
  const idx = new Map();
  const put = (s, e) => { const n = normalizeHeb(s); if (n && n.length >= 2 && !idx.has(n)) idx.set(n, e); };
  data.forEach(e => {
    let core = e.name || '', paren = '';
    const pm = core.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    if (pm){ core = pm[1]; paren = pm[2]; }
    put(core, e);
    if (paren) put(paren, e);
    (e.aliases || []).forEach(a => put(a, e));
  });
  placeNameIndex = idx;
  return idx;
}
function invalidatePlaceNameIndex(){ placeNameIndex = null; }

// התאמה מדויקת בלבד (כולל תחיליות/סיומות דרך candidateForms) — בלי כתיב חסר,
// שמייצר בטקסט חופשי קצר יותר רעש מתועלת.
function lookupPlaceByPhrase(phrase, allowForms){
  const idx = placesNameIndex();
  if (!idx) return null;
  const norm = normalizeHeb(phrase);
  if (norm.length < 2) return null;
  if (!allowForms) return idx.has(norm) ? idx.get(norm) : null;
  if (GENERIC_DESCRIPTORS.has(norm) || STOPWORDS.has(norm) || PLACE_LINK_SKIP_WORDS.has(norm)) return null;
  if (idx.has(norm)) return idx.get(norm);
  for (const f of candidateForms(phrase)){
    if (f === norm) continue;
    if (GENERIC_DESCRIPTORS.has(f) || STOPWORDS.has(f)) continue;
    if (idx.has(f)) return idx.get(f);
  }
  return null;
}

function findPlaceEntryByName(name){
  const idx = placesNameIndex();
  return (idx && idx.get(normalizeHeb(name))) || null;
}

function placeLinkedText(value){
  const text = Array.isArray(value) ? value.join(', ') : String(value == null ? '' : value);
  if (!placesNameIndex()) return esc(text);
  const toks = [];
  let m;
  HEB_WORD_RE.lastIndex = 0;
  while ((m = HEB_WORD_RE.exec(text)) !== null) toks.push({ s: m.index, e: m.index + m[0].length });
  let out = '', cursor = 0, i = 0;
  while (i < toks.length){
    let hit = null, span = 1;
    for (let len = Math.min(3, toks.length - i); len >= 1; len--){
      const phrase = text.slice(toks[i].s, toks[i + len - 1].e);
      const found = lookupPlaceByPhrase(phrase, len === 1);
      if (found){ hit = found; span = len; break; }
    }
    if (!hit){ i++; continue; }
    const s = toks[i].s, e = toks[i + span - 1].e;
    out += esc(text.slice(cursor, s));
    out += `<span class="place-link" data-place="${esc(hit.name)}">${esc(text.slice(s, e))}</span>`;
    cursor = e;
    i += span;
  }
  out += esc(text.slice(cursor));
  return out;
}

// ---- סכימת שדות לכל מדריך ----
// מגדירה אילו שדות "אמורים" להיות בערך של כל מדריך. משמשת לשני דברים:
// 1. בתצוגה - להראות גם שדות **חסרים** (באפור, "—"), כדי שיידעו איזה מידע עוד חסר.
// 2. בעריכה - לפתוח את *כל* השדות לעריכה, לא רק את אלה שכבר מלאים.
const FIELD_LABELS = {
  tribe:'שבט/משפחה', father:'אב', mother:'אם', spouses:'בני/בנות זוג',
  children:'ילדים', siblings:'אחים/אחיות', roles:'תפקיד',
  birthPlace:'מקום לידה', dwelling:'מקום מגורים', deathPlace:'מקום פטירה',
  burialPlace:'מקום קבורה', age:'שנות חיים', note:'הערה',
  explanation:'הסבר', identification:'זיהוי מודרני', region:'נחלה',
  gender:'מין', era:'תקופה', modern:'זיהוי מודרני', latin:'שם מדעי (לטיני)',
  wiki:'ערך ויקיפדיה', confidence:'מידת ודאות', mapQuery:'חיפוש במפה'
};
const ARRAY_FIELDS = new Set(['aliases','spouses','children','siblings','roles']);
const LONG_FIELDS = new Set(['explanation','identification','note','modern']);

const GUIDE_FIELDS = {
  people: ['gender','father','mother','spouses','children','siblings','roles','tribe','birthPlace','dwelling','deathPlace','burialPlace','age','note'],
  places: ['region','explanation','modern','mapQuery','note'],
  animal: ['explanation','latin','wiki','confidence','note'],
  flora:  ['explanation','latin','wiki','confidence','note'],
  domem:  ['tribe','explanation','identification','note'],
  beithamikdash: ['explanation','identification','note']
};
// שדות שיושבים בתוך methods[0] ולא ישירות על הערך (חי/צומח/מקומות/מקדש)
const METHOD_FIELDS = new Set(['explanation','latin','wiki','confidence','modern','mapQuery']);

function guideFieldsFor(catId, entry){
  const base = GUIDE_FIELDS[catId] || ['explanation','identification','note'];
  // שדות מותאמים אישית שהמשתמש הוסיף לערך הזה (customFields) מוצגים גם הם
  const custom = entry && entry.customFields ? Object.keys(entry.customFields) : [];
  return { base, custom };
}

// קורא ערך שדה בין אם הוא ישיר על הערך ובין אם הוא בתוך methods[0]
function readField(entry, key){
  if (METHOD_FIELDS.has(key)){
    const m0 = entry.methods && entry.methods[0];
    if (m0 && m0[key] != null && m0[key] !== '') return m0[key];
  }
  return entry[key];
}
function writeField(entry, key, value){
  if (METHOD_FIELDS.has(key)){
    if (!entry.methods) entry.methods = [{}];
    if (!entry.methods[0]) entry.methods[0] = {};
    entry.methods[0][key] = value;
    return;
  }
  entry[key] = value;
}
function isEmptyVal(v){
  return v == null || v === '' || (Array.isArray(v) && !v.length);
}

// ---- ערכי הבחנה ----
// רשומה שתפקידה "שם משותף" אינה אדם אלא טבלת מפתח לכמה אישים שנושאים את
// אותו שם. עד כה היא נראתה כמו כרטיס שבור: שמות הווריאנטים היו טקסט מת בתוך
// ההערה (note לא נכלל ב-PERSON_LINK_FIELDS), ומתחת התיבה "פרטים שאינם במדריך"
// מנתה כמעט הכול כחסר - למרות שלטבלת מפתח אין ולא צריך להיות אב, שבט או גיל.
function isDisambigEntry(entry){
  return !!entry && Array.isArray(entry.roles) && entry.roles.indexOf('שם משותף') !== -1;
}
// מחלץ את רשימת הווריאנטים מתוך ההערה ("... האישים עצמם: א · ב · ג.")
function disambigVariants(entry){
  const m = String((entry && entry.note) || '').match(/האישים עצמם:\s*(.+)$/);
  if (!m) return [];
  return m[1].replace(/[.\s]+$/, '').split('·').map(s => s.trim()).filter(Boolean);
}
// אותה הערה בלי רשימת הווריאנטים (הרשימה מוצגת בנפרד, כקישורים)
function disambigIntro(entry){
  return String((entry && entry.note) || '')
    .replace(/\s*—?\s*האישים עצמם:\s*.+$/, '')
    .replace(/\s*הערך הזה הוא ערך הבחנה בלבד\s*/, ' ')
    .trim();
}

// לאיזה מדריך שייך הערך, כשאין הקשר של מדריך פתוח (למשל פתיחה מהאזור האישי או
// משורת החיפוש). מזהה לפי זהות האובייקט בתוך dataCache, ולכן מדויק גם לשמות כפולים.
function catIdOfEntry(entry){
  for (const cat of CATEGORIES){
    const d = dataCache[cat.id];
    if (d && d.indexOf(entry) !== -1) return cat.id;
  }
  return null;
}

function renderEntryDetailHTML(entry, catIdOverride){
  const catId = catIdOverride || (currentGuideCat ? currentGuideCat.id : null) || catIdOfEntry(entry);
  const leadImg = catId ? lookupEntryImage(entry, catId) : null;
  const gallery = catId ? lookupEntryGallery(entry, catId) : [];
  const wikiTitle = !leadImg && entry.methods && entry.methods[0] && entry.methods[0].wiki;
  let html = '';
  if (leadImg) html += `<img src="${leadImg}" alt="${esc(entry.name)}" style="max-width:100%;border-radius:10px;margin-bottom:12px;display:block;">`;
  else if (entry.customImage) html += `<img src="${esc(entry.customImage)}" alt="${esc(entry.name)}" style="max-width:100%;border-radius:10px;margin-bottom:12px;display:block;">`;
  else if (wikiTitle) html += `<div data-wiki-lazy="${esc(wikiTitle)}" style="margin-bottom:12px;"></div>`;
  const bmKey = bookmarkKeyOf(entry);
  const bmOn = !!catId && isBookmarked(catId, bmKey);
  html += `<h2>${esc(entry.name)}`
    + ` <button id="entryBookmarkBtn" class="entry-tool-btn${bmOn ? ' bm-on' : ''}"`
    + ` title="${bmOn ? 'הסרה מהסימניות' : 'הוספה לסימניות (האזור האישי)'}"`
    + ` data-bm-cat="${esc(catId || '')}" data-bm-key="${esc(bmKey)}" data-bm-label="${esc(entry.name)}">${bmOn ? '★' : '☆'}</button>`
    + ` <button id="entryPrintBtn" title="הדפסה" class="entry-tool-btn">🖨️</button>`
    + ` <button id="entryEditBtn" title="עריכת הכרטיס / הוספת מידע" class="entry-tool-btn">✏️</button></h2>`;
  html += `<div class="entry-sub">כינויים: ${entry.aliases && entry.aliases.length ? esc(entry.aliases.join(', ')) : '<span class="missing-val">— חסר</span>'}</div>`;
  if (entry.__edited) html += `<div class="edited-note">✏️ כרטיס זה נערך על ידכם ונשמר במכשיר זה. לשחזור לגרסת המקור — פתחו את העריכה (✏️) ולחצו "שחזור לגרסת המקור".</div>`;

  const personEntry = isPersonEntry(entry);
  const disambig = isDisambigEntry(entry);
  const { base, custom } = guideFieldsFor(catId, entry);
  const missing = [];

  // ערך הבחנה: תג במקום "תפקיד: שם משותף", ורשימת האישים כקישורים לחיצים
  if (disambig){
    const variants = disambigVariants(entry);
    const intro = disambigIntro(entry);
    html += `<div class="conf-tag">ערך הבחנה</div>`;
    if (intro) html += `<p>${esc(intro)}</p>`;
    if (variants.length){
      html += `<div class="field-label">האישים בשם זה</div><p>` +
        variants.map(n => {
          const target = findPersonEntry(n);
          return target && target !== entry
            ? `<span class="person-link" data-person="${esc(n)}">${esc(n)}</span>`
            : `${esc(n)} <span class="missing-val">(אין כרטיס)</span>`;
        }).join(' · ') + `</p>`;
    }
  }

  base.forEach(k => {
    // אצל ערך הבחנה השניים האלה מוצגים למעלה בצורה טובה יותר
    if (disambig && (k === 'note' || k === 'roles')) return;
    const label = FIELD_LABELS[k] || k;
    const v = readField(entry, k);
    if (isEmptyVal(v)){ if (!disambig) missing.push(label); return; }
    if (personEntry && PERSON_LINK_FIELDS.has(k)){
      const linked = personLinkedValue(v, entry);
      if (linked){ html += `<div class="field-label">${esc(label)}</div><p>${linked}</p>`; return; }
    }
    if (personEntry && PLACE_LINK_FIELDS.has(k)){
      html += `<div class="field-label">${esc(label)}</div><p>${placeLinkedText(v)}</p>`;
      return;
    }
    html += fieldBlock(label, v);
  });

  // שדות מותאמים שהמשתמש הוסיף (קטגוריות חדשות: קישורים, מידע מחז"ל וכו')
  custom.forEach(k => {
    const v = entry.customFields[k];
    if (isEmptyVal(v)) return;
    html += `<div class="field-label">${esc(k)}</div><p>${esc(v)}</p>`;
  });

  if (entry.methods && entry.methods.length){
    html += `<div class="field-label">${entry.methods.length>1?'שיטות זיהוי / דעות':'הסבר'}</div>`;
    entry.methods.forEach(m => {
      html += `<div class="method-block">`;
      if (m.confidence) html += `<span class="conf-tag">${esc(m.confidence)}</span>`;
      if (m.latin) html += `<p class="latin">${esc(m.latin)}</p>`;
      if (m.explanation) html += `<p>${esc(m.explanation)}</p>`;
      if (m.modern) html += `<p><strong>זיהוי מודרני:</strong> ${esc(m.modern)}</p>`;
      if (m.geo && m.geo.length >= 2){
        html += `<div class="offline-map" data-geo="${m.geo[0]},${m.geo[1]},${m.geo[2]||7}" data-cat="${esc(entry.cat||'')}" ></div>`;
        const mapsUrl = `https://www.google.com/maps?q=${m.geo[0]},${m.geo[1]}`;
        html += `<p style="display:flex;gap:12px;flex-wrap:wrap;">
          <a href="#" class="focus-main-map" data-geo="${m.geo[0]},${m.geo[1]},${m.geo[2]||7}" data-name="${esc(entry.name)}">🗺️ הצג במפה הראשית</a>
          <a href="${mapsUrl}" data-external-link="${mapsUrl}">📍 פתח במפות גוגל ↗</a>
        </p>`;
      }
      html += `</div>`;
    });
  }

  const verseList = entry.verses || entry.makorot || [];
  if (verseList.length){
    html += `<div class="field-label">מקורות בתנ״ך</div>`;
    verseList.forEach((v,i) => {
      const parsed = parseAnyRef(v.ref);
      html += `<div class="verse-card${parsed?' clickable':''}" data-vref="${i}">
        <div class="verse-ref">${esc(v.ref)}${parsed?' <span class="open-hint">↗ פתח בספרייה</span>':''}</div>
        ${v.text ? `<div class="verse-text">${v.text}</div>` : ''}
      </div>`;
    });
  }

  if (entry.midrash && entry.midrash.length){
    html += `<div class="field-label">מקורות חז״ל</div>`;
    entry.midrash.forEach((m,i) => {
      const src = midrashSource(m), note = midrashNote(m);
      if (!src && !note) return;   // בלי זה נוצרה תיבה ריקה לגמרי
      const parsed = src ? parseMidrashRef(src) : null;
      html += `<div class="src-item${parsed?' clickable':''}" data-mref="${i}">${src?`<div class="src-source">${esc(src)}${parsed?' <span class="open-hint">↗ פתח בספרייה</span>':''}</div>`:''}${note?`<div class="src-note">${esc(note)}</div>`:''}${m.link?`<a href="${esc(m.link)}" data-external-link="${esc(m.link)}">קישור ↗</a>`:''}</div>`;
    });
  }
  if (entry.academic && entry.academic.length){
    html += `<div class="field-label">מקורות נוספים</div>`;
    entry.academic.forEach(a => {
      const txt = (typeof a === 'string') ? a : (a.citation || a.note || a.text || a.ref || '');
      if (!txt) return;
      html += `<div class="src-item">${esc(txt)}${a.link?` <a href="${esc(a.link)}" data-external-link="${esc(a.link)}">קישור ↗</a>`:''}</div>`;
    });
  }
  if (gallery.length){
    html += `<div class="field-label">תמונות</div><div style="display:flex;flex-wrap:wrap;gap:8px;">`;
    gallery.forEach(src => { html += `<img src="${src}" style="width:110px;height:110px;object-fit:cover;border-radius:8px;">`; });
    html += `</div>`;
  }
  if (!disambig){
    if (!verseList.length) missing.push('מקורות בתנ״ך');
    if (!(entry.midrash && entry.midrash.length)) missing.push('מקורות חז״ל');
    if (!(entry.academic && entry.academic.length)) missing.push('מקורות נוספים');
  }

  // מה חסר בכרטיס - כדי שיידעו איזה מידע עוד אפשר להשלים (ולהציע אותו דרך ✏️).
  // בערך הבחנה אין מה להשלים: אין לו אב, שבט או גיל מעצם טבעו.
  if (missing.length && !disambig){
    html += `<div class="missing-box">
      <div class="field-label" style="margin-top:0;">פרטים שאינם במדריך</div>
      <p style="margin:0;">${missing.map(m => `<span class="missing-chip">${esc(m)}</span>`).join(' ')}</p>
      <p class="mini-note" style="margin:8px 0 0;">יש לך את המידע החסר? לחצו על ✏️ למעלה כדי להשלים אותו — ניתן לשמור במכשיר או לשלוח למפתח.</p>
    </div>`;
  }
  return maskDivineName(html);
}

// מפה אופלין (Leaflet + Natural Earth, בלי אינטרנט) - נטענת פעם אחת ב-index.html
// (guides/places/js/map.js + data/geo-basemap.js), בדיוק הבסיס הווקטורי שמקומות
// השתמש בו במקור. בלי לוויין (בהתאם לגרסה הרזה).
function renderOfflineMiniMap(container, lat, lng, zoom, cat){
  if (typeof window.L === 'undefined' || typeof addBaseLayers !== 'function') {
    container.textContent = 'מפה לא זמינה כרגע.';
    return;
  }
  try {
    const map = L.map(container, { minZoom: 2, maxZoom: MAP_MAX_ZOOM, scrollWheelZoom: false, zoomControl: true });
    map.attributionControl.setPrefix('');
    map.attributionControl.addAttribution('Natural Earth');
    map.setView([lat, lng], Math.min(zoom || 7, MAP_MAX_ZOOM));
    addBaseLayers(map);
    addLabels(map, 0.9);
    L.marker([lat, lng], { icon: pinIcon(cat, false) }).addTo(map);
    setTimeout(() => { map.invalidateSize(); map.setView([lat, lng], Math.min(zoom || 7, MAP_MAX_ZOOM)); }, 120);
  } catch(e){
    console.warn('madaei-hatanach: map render failed', e);
    container.textContent = 'מפה לא זמינה כרגע.';
  }
}

// מחבר התנהגות (קליק על פסוק, הדפסה, עריכה) לתוכן שכבר סופק ע"י renderEntryDetailHTML,
// בכל קונטיינר שהוא (המודל הראשי, או שורת תוצאה שמתרחבת) - כדי לא לשכפל לוגיקה.
function wireEntryDetail(container, entry, onEdit){
  const verseList = entry.verses || entry.makorot || [];
  container.querySelectorAll('.verse-card.clickable').forEach(el => {
    const i = parseInt(el.dataset.vref);
    const v = verseList[i];
    const parsed = v && parseAnyRef(v.ref);
    if (parsed) el.addEventListener('click', () => openInReader(parsed.bookId, parsed.ref));
  });
  // מקורות חז"ל לחיצים — נפתחים בספרייה (הקישור החיצוני שבפנים מטופל בנפרד)
  container.querySelectorAll('.src-item.clickable').forEach(el => {
    const i = parseInt(el.dataset.mref);
    const m = (entry.midrash || [])[i];
    const parsed = m && parseMidrashRef(midrashSource(m));
    if (parsed) el.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-external-link]')) return;
      openInReader(parsed.bookId, parsed.ref);
    });
  });
  const bmb = container.querySelector('#entryBookmarkBtn');
  if (bmb) bmb.addEventListener('click', (e) => {
    e.stopPropagation();
    const catId = bmb.dataset.bmCat;
    if (!catId) return;
    const on = toggleBookmark(catId, bmb.dataset.bmKey, bmb.dataset.bmLabel);
    bmb.textContent = on ? '★' : '☆';
    bmb.classList.toggle('bm-on', on);
    bmb.title = on ? 'הסרה מהסימניות' : 'הוספה לסימניות (האזור האישי)';
  });
  const pb = container.querySelector('#entryPrintBtn');
  if (pb) pb.addEventListener('click', (e) => { e.stopPropagation(); window.print(); });
  const eb = container.querySelector('#entryEditBtn');
  if (eb) eb.addEventListener('click', (e) => { e.stopPropagation(); onEdit ? onEdit() : openGenericEditForm(entry); });
  const wikiEl = container.querySelector('[data-wiki-lazy]');
  if (wikiEl){
    fetchWikiThumbnail(wikiEl.dataset.wikiLazy).then(src => {
      wikiEl.innerHTML = src ? `<img src="${src}" alt="" style="max-width:100%;border-radius:10px;display:block;">` : '';
    });
  }
  container.querySelectorAll('.offline-map').forEach(el => {
    const [lat, lng, zoom] = el.dataset.geo.split(',').map(Number);
    renderOfflineMiniMap(el, lat, lng, zoom, el.dataset.cat);
  });
  container.querySelectorAll('.person-link').forEach(el => {
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const target = findPersonEntry(el.dataset.person);
      if (target) openEntryDetail(target);
    });
  });
  // מקום בכרטיס אישים -> כרטיס המקומות עצמו, שכולל את המפה של אותו מקום
  container.querySelectorAll('.place-link').forEach(el => {
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const target = findPlaceEntryByName(el.dataset.place);
      if (target) openEntryDetail(target);
    });
  });
  refreshPlaceLinksWhenReady(container, entry, onEdit);
  // "הצג במפה הראשית" - סוגר את הכרטיס, גולל למפה שבסוף רשימת המקומות וממקד שם.
  container.querySelectorAll('.focus-main-map').forEach(el => {
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      const [lat, lng, zoom] = el.dataset.geo.split(',').map(Number);
      focusMainMap(lat, lng, zoom, el.dataset.name);
    });
  });
}

// כרטיס אישים עלול להיפתח לפני שמדריך המקומות סיים להיטען ברקע (preloadAllGuides
// טוען בטור) — ואז אין ממה לבנות את הקישורים. במקום לעכב את הפתיחה, טוענים ברקע
// ומרנדרים את אותו כרטיס פעם אחת כשהנתונים מוכנים. אחרי הטעינה placesLookupSync
// מחזיר אינדקס, ולכן אין כאן לולאה.
function refreshPlaceLinksWhenReady(container, entry, onEdit){
  if (!isPersonEntry(entry) || placesNameIndex()) return;
  const cat = CATEGORIES.find(c => c.id === 'places');
  if (!cat) return;
  loadGuideData(cat).then(() => {
    if (!placesNameIndex() || !container.isConnected) return;
    container.innerHTML = renderEntryDetailHTML(entry);
    wireEntryDetail(container, entry, onEdit);
  }, () => {});
}

// ממקד את מפת העולם שבסוף רשימת המקומות על נקודה מסוימת (כמו focusOnMainMap במקור).
async function focusMainMap(lat, lng, zoom, name){
  entryOverlay.classList.remove('open');
  resultsOverlay.classList.remove('open');
  if (!currentGuideCat || currentGuideCat.id !== 'places'){
    await openGuide('places', null);
  } else if (activeGuideChip !== 'all' || guideSearchBox.value){
    activeGuideChip = 'all';
    guideSearchBox.value = '';
    renderGuideGrid('');
  }
  setTimeout(() => {
    const el = document.getElementById('worldMap');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof worldMap === 'undefined' || !worldMap) return;
    const z = Math.min(zoom || 8, (typeof MAP_MAX_ZOOM !== 'undefined' ? MAP_MAX_ZOOM : 12));

    const rec = (typeof allMarkers !== 'undefined' && Array.isArray(allMarkers))
      ? allMarkers.find(r => {
          const p = r.marker.getLatLng();
          return Math.abs(p.lat - lat) < 1e-6 && Math.abs(p.lng - lng) < 1e-6;
        })
      : null;

    let popped = false;
    const showPopup = () => {
      if (popped || !rec) return;
      popped = true;
      if (markerLayer && typeof markerLayer.zoomToShowLayer === 'function' && markerLayer.hasLayer(rec.marker)){
        markerLayer.zoomToShowLayer(rec.marker, () => rec.marker.openPopup());
      } else rec.marker.openPopup();
    };

    worldMap.once('moveend', showPopup);
    worldMap.flyTo([lat, lng], z, { duration: 1.2 });

    // flyTo מונפש דרך requestAnimationFrame - אם מסיבה כלשהי ההנפשה לא רצה
    // (חלון לא מצויר, מנוע webview חוסך משאבים) המפה לא תגיע ליעד. לכן מוודאים
    // הגעה בפועל, וקופצים ישירות אם צריך.
    setTimeout(() => {
      const c = worldMap.getCenter();
      if (Math.abs(c.lat - lat) > 0.01 || Math.abs(c.lng - lng) > 0.01){
        worldMap.setView([lat, lng], z);
      }
      showPopup();
    }, 1400);
  }, 400);
}

function openEntryDetail(entry){
  entryModalInner.innerHTML = renderEntryDetailHTML(entry);
  wireEntryDetail(entryModalInner, entry);
  entryOverlay.classList.add('open');
}
entryCloseBtn.addEventListener('click', () => entryOverlay.classList.remove('open'));
// לחיצה על הרקע (מחוץ לכרטיס) סוגרת - וגם Esc.
entryOverlay.addEventListener('click', (ev) => { if (ev.target === entryOverlay) entryOverlay.classList.remove('open'); });
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  if (entryOverlay.classList.contains('open')) entryOverlay.classList.remove('open');
  else if (resultsOverlay.classList.contains('open')) resultsOverlay.classList.remove('open');
  else document.querySelectorAll('.panel-overlay.open').forEach(p => p.classList.remove('open'));
});
