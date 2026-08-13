// לוגיקת האפליקציה: רינדור כרטיסים, חיפוש/סינון, מודאל, אינטגרציית אוצריא
"use strict";
;
;

let activeCat = 'all';
let query = '';

function cardHTML(item, idx){
  const firstVerse = item.verses[0] ? item.verses[0].ref : '';
  const searchBlob = (item.name+' '+firstVerse+' '+(item.aliases||[]).join(' ')+' '+(item.region||'')+' '+(item.border ? 'נקודת גבול גבולות הארץ' : '')+' '+(item.refuge ? 'עיר מקלט' : '')+' '+(item.levite ? 'עיר לוים מקלט' : '')+' '+item.methods.map(m=>m.label+' '+m.explanation).join(' ')).toLowerCase();
  return `
  <div class="card" data-cat="${item.cat}" data-idx="${idx}" data-search="${searchBlob}">
    <div class="card-media">
      ${item.region ? `<div class="region-tag">${item.region}</div>` : ''}
      ${item.border ? `<div class="border-tag">גבול</div>` : ''}
      ${item.refuge ? `<div class="refuge-tag${item.border ? ' stacked' : ''}">עיר מקלט</div>` : ''}
      ${item.levite ? `<div class="levite-tag">עיר לוים</div>` : ''}
      <div class="placeholder-icon">${ICONS[item.cat]}</div>
    </div>
    <div class="card-body">
      <h3 class="card-name">${item.name}</h3>
      <span class="card-verse">${firstVerse}${item.verses.length>1 ? ' ועוד' : ''}</span>
      <p class="card-desc">${item.methods[0].explanation}</p>
    </div>
  </div>`;
}

function render(){
  document.getElementById('heroSub').textContent = DATA.length + ' מקומות — ערים, הרים, נהרות, מדבריות וארצות — עם פסוקים ומקורות חז״ל. לחצו על כל כרטיס להרחבה.';
  document.getElementById('badgeNote').textContent = '✓ ' + DATA.length + ' ערכים, מבוססים על חיפוש בפועל בטקסט הספרייה המקומית.';
  const main = document.getElementById('main');
  main.innerHTML = CATS.map(cat=>{
    const items = DATA.map((d,i)=>({...d, idx:i})).filter(d=>d.cat===cat.id);
    return `
    <section class="category-section" id="${cat.id}">
      <div class="cat-head">
        <span class="cat-num">${cat.num}</span>
        <h2>${cat.label}</h2>
        <span class="count-tag">(${items.length})</span>
      </div>
      <p style="color:var(--ink-soft);font-size:13.5px;max-width:760px;margin:8px 0 20px;">${cat.blurb}</p>
      <div class="grid">${items.map(it=>cardHTML(it, it.idx)).join('')}</div>
    </section>`;
  }).join('') + `<p class="empty-msg hidden" id="emptyMsg">לא נמצאו תוצאות התואמות את החיפוש.</p>` + extraTownsHTML();

  const chipsWrap = document.getElementById('chips');
  chipsWrap.innerHTML = `<button class="map-goto-chip" id="mapGotoChip">🗺️ למפה</button>` +
    `<button class="chip active" data-cat="all">הכל <span class="count-tag">(${DATA.length})</span></button>` +
    CATS.map(c=>`<button class="chip" data-cat="${c.id}">${c.label}</button>`).join('');

  const legend = document.getElementById('mapLegend');
  if(legend) legend.innerHTML = CATS.map(c=>
    `<span class="legend-item"><span class="legend-dot" style="background:${CAT_COLORS[c.id]||'#555'}"></span>${c.label}</span>`).join('');

  attachEvents();
}

function extraTownsHTML(){
  if (!EXTRA_TOWNS.length) return '';
  const byTribe = {};
  EXTRA_TOWNS.forEach((t,i)=>{ (byTribe[t.tribe] = byTribe[t.tribe] || []).push({...t, idx:i}); });
  const groupsHTML = Object.keys(byTribe).map(tribe => `
    <div class="field-label" style="margin-top:18px;">נחלת ${tribe} (${byTribe[tribe].length})</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill, minmax(150px,1fr)); gap:8px;">
      ${byTribe[tribe].map(t=>`
        <div class="extra-card" data-exidx="${t.idx}">
          <div class="extra-name">${stripNiqqudDisplay(t.text).replace(/^\(.+?\)\s*/,'').slice(0,40)}${stripNiqqudDisplay(t.text).length>40?'…':''}</div>
          <div class="extra-meta">${t.ref}</div>
        </div>`).join('')}
    </div>`).join('');
  return `
    <section class="category-section" id="extra-towns">
      <div class="cat-head">
        <span class="cat-num">✧</span>
        <h2>עוד ערים ברשימות הנחלות</h2>
        <span class="count-tag">(${EXTRA_TOWNS.length} פסוקים)</span>
      </div>
      <p style="color:var(--ink-soft);font-size:13.5px;max-width:760px;margin:8px 0 20px;">
        עשרות ערים נוספות המוזכרות ברשימות נחלות השבטים (יהושע טו, יח, יט) שאין להן כרטיס מלא — מיקומן המדויק לרוב אינו ידוע, ואין להן משמעות נרטיבית נוספת בתנ״ך. לחצו על פסוק להצגת הטקסט המלא.
      </p>
      ${groupsHTML}
    </section>`;
}

function attachEvents(){
  document.querySelectorAll('.chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      const cat = chip.dataset.cat;
      document.querySelectorAll('.category-section').forEach(sec=>{
        sec.classList.toggle('hidden', cat!=='all' && sec.id!==cat);
      });
      document.querySelectorAll('.card').forEach(c=>c.classList.remove('hidden'));
      document.getElementById('search').value='';
      document.getElementById('emptyMsg').classList.add('hidden');
      updateMapFilter();
    });
  });
  const mapChip = document.getElementById('mapGotoChip');
  if(mapChip) mapChip.addEventListener('click', ()=>{
    document.getElementById('mapSection').scrollIntoView({behavior:'smooth'});
  });
  document.getElementById('search').addEventListener('input', e=>filterSearch(e.target.value.trim().toLowerCase()));
  document.querySelectorAll('.card').forEach(card=>{
    card.addEventListener('click', ()=> openModal(DATA[card.dataset.idx]));
  });
  document.querySelectorAll('.extra-card').forEach(card=>{
    card.addEventListener('click', ()=> openExtraTownModal(EXTRA_TOWNS[card.dataset.exidx]));
  });
}

function extraDetailHTML(item){
  const parsed = parseVerseRef(item.ref);
  const openAttr = parsed ? ` data-open-ref='${JSON.stringify(parsed).replace(/'/g,'&#39;')}'` : '';
  return `
    <div class="modal-head">
      <div>
        <h2>נחלת ${item.tribe}</h2>
        <div class="cat-line">${item.ref} · מרשימת ערי הנחלה</div>
      </div>
    </div>
    <div class="modal-body">
      <div class="basic-note">קבוצת ערים ברשימת נחלת ${item.tribe} (יהושע) — לרוב ללא זיהוי מודרני ודאי או משמעות נרטיבית נוספת בתנ״ך.</div>
      <div class="field-label">הפסוק</div>
      <div class="verse-card${parsed ? ' clickable' : ''}"${openAttr}>
        <div class="verse-ref">${item.ref}${parsed ? ' <span class="open-hint">↗ פתח בספרייה</span>' : ''}</div>
        <div class="verse-text">${item.text}</div>
      </div>
    </div>
  `;
}

function openExtraTownModal(item){
  modalInner.innerHTML = extraDetailHTML(item);
  overlay.classList.add('open');
}

function filterSearch(q){
  let anyVisible = false;
  document.querySelectorAll('.category-section').forEach(sec=>sec.classList.remove('hidden'));
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
  document.querySelector('.chip[data-cat="all"]').classList.add('active');
  document.querySelectorAll('.category-section').forEach(sec=>{
    let has = false;
    sec.querySelectorAll('.card').forEach(card=>{
      const match = !q || card.dataset.search.includes(q);
      card.classList.toggle('hidden', !match);
      if(match) has = true;
    });
    sec.classList.toggle('hidden', !has);
    if(has) anyVisible = true;
  });
  document.getElementById('emptyMsg').classList.toggle('hidden', anyVisible || !q);
  updateMapFilter();
}

// ---------- modal ----------
const overlay = document.getElementById('overlay');
const modalInner = document.getElementById('modalInner');

function itemDetailHTML(item){
  const catLabel = CATS.find(c=>c.id===item.cat)?.label || item.cat;

  const versesHTML = item.verses.map(v=>{
    const parsed = parseVerseRef(v.ref);
    const openAttr = parsed ? ` data-open-ref='${JSON.stringify(parsed).replace(/'/g,'&#39;')}'` : '';
    return `
    <div class="verse-card${parsed ? ' clickable' : ''}"${openAttr}>
      <div class="verse-ref">${v.ref}${parsed ? ' <span class="open-hint">↗ פתח בספרייה</span>' : ''}</div>
      <div class="verse-text ${v.text ? '' : 'empty'}">${v.text || 'טקסט הפסוק המלא ייווסף בהרחבה הבאה — ניתן לעיין במקור לפי המראה מקום.'}</div>
    </div>`;}).join('');

  const midrashHTML = (item.midrash && item.midrash.length) ? item.midrash.map(s=>{
    const parsed = parseMidrashRef(s.source);
    const openAttr = parsed ? ` data-open-ref='${JSON.stringify(parsed).replace(/'/g,'&#39;')}'` : '';
    return `
    <div class="src-item${parsed ? ' clickable' : ''}"${openAttr}>
      <div class="src-source">${s.source}${parsed ? ' <span class="open-hint">↗ פתח בספרייה</span>' : ''}</div>
      <div class="src-note">${s.note}</div>
      ${s.link ? `<a class="src-link" href="${s.link}" data-external-link="${s.link}">קישור למקור ↗</a>` : ''}
    </div>`;}).join('') : `<p class="no-src">מקורות חז״ל מפורטים לערך זה טרם נאספו — בהרחבות הבאות.</p>`;

  const academicHTML = (item.academic && item.academic.length) ? item.academic.map(a=>`
    <div class="src-item">
      <div class="src-note">${a.citation}</div>
      ${a.link ? `<a class="src-link" href="${a.link}" data-external-link="${a.link}">קישור ↗</a>` : ''}
    </div>`).join('') : `<p class="no-src">מקורות מחקריים נוספים טרם נאספו עבור ערך זה.</p>`;

  const tabsHTML = item.methods.length > 1 ? item.methods.map((mm,i)=>`<button class="method-tab ${i===0?'active':''}" data-mi="${i}">${mm.label}</button>`).join('') : '';

  return `
    <div class="modal-head">
      <div>
        <h2>${item.name} <button id="editBtn" title="הצעת עריכה" style="border:none;background:none;cursor:pointer;font-size:16px;">✏️</button></h2>
        <div class="cat-line">${catLabel}${item.region ? ' · נחלת ' + item.region : ''}${item.border ? ' · נקודת ציון בגבולות הארץ' : ''}${item.refuge ? ' · עיר מקלט' : ''}${item.levite ? ' · עיר לוים' : ''}</div>
        ${item.aliases && item.aliases.length ? `<div class="cat-line">כינויים/צורות נוספות: ${item.aliases.join(', ')}</div>` : ''}
      </div>
    </div>
    <div class="modal-body">
      <div class="field-label">${item.methods.length > 1 ? 'שיטות זיהוי / דעות' : 'על המקום'}</div>
      <div class="method-tabs">${tabsHTML}</div>
      <div id="methodPanel"></div>

      <div class="field-label">מקורות בתנ״ך</div>
      ${versesHTML}

      <div class="field-label">מקורות חז״ל (תלמוד ומדרש)</div>
      ${midrashHTML}

      <div class="field-label">מקורות מחקריים נוספים</div>
      ${academicHTML}
    </div>
  `;
}

function wireItemDetail(item){
  renderMethodPanel(item, 0);
  modalInner.querySelectorAll('.method-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      modalInner.querySelectorAll('.method-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      renderMethodPanel(item, parseInt(tab.dataset.mi));
    });
  });
  const eb = modalInner.querySelector('#editBtn');
  if (eb) eb.addEventListener('click', (e)=>{ e.stopPropagation(); openEditForm(item); });
}

function placesEditField(id, label, val, long){
  const v = Array.isArray(val) ? val.join(', ') : String(val==null?'':val);
  const safe = v.replace(/"/g,'&quot;');
  return `<div class="edit-field"><div class="field-label">${label}</div>` +
    (long ? `<textarea id="${id}" style="width:100%;min-height:80px;">${v}</textarea>` : `<input type="text" id="${id}" value="${safe}" style="width:100%;">`) +
    `</div>`;
}
function openEditForm(item){
  const m0 = item.methods[0];
  modalInner.innerHTML = `
    <div class="modal-head"><div><h2>עריכת כרטיס: ${item.name}</h2>
    <div class="cat-line">השינויים נשמרים במכשיר זה בלבד, אלא אם תישלח הצעה למפתח</div></div></div>
    <div class="modal-body">
      ${placesEditField('pef_aliases','כינויים/צורות נוספות (מופרד בפסיקים)', item.aliases||[])}
      ${placesEditField('pef_explanation','הסבר (שיטת הזיהוי הראשית)', m0.explanation, true)}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <button class="nf-btn" id="pefSave">💾 שמירה במכשיר</button>
        <button class="nf-btn" id="pefSend">📧 שליחה למפתח</button>
        <button class="nf-btn secondary" id="pefCancel">ביטול</button>
      </div>
    </div>`;
  overlay.classList.add('open');
  function collect(){
    return {
      aliases: document.getElementById('pef_aliases').value.split(',').map(s=>s.trim()).filter(Boolean),
      explanation: document.getElementById('pef_explanation').value.trim()
    };
  }
  function diffText(fields){
    const lines = [];
    const beforeAliases = (item.aliases||[]).join(', ');
    const afterAliases = fields.aliases.join(', ');
    if (beforeAliases !== afterAliases) lines.push('כינויים:\n  לפני: ' + (beforeAliases||'—') + '\n  אחרי: ' + (afterAliases||'—'));
    if ((m0.explanation||'') !== fields.explanation) lines.push('הסבר:\n  לפני: ' + (m0.explanation||'—') + '\n  אחרי: ' + (fields.explanation||'—'));
    return lines.join('\n\n');
  }
  document.getElementById('pefSave').addEventListener('click', ()=>{
    const f = collect();
    item.aliases = f.aliases;
    m0.explanation = f.explanation;
    render();
    openModal(item);
  });
  document.getElementById('pefSend').addEventListener('click', async ()=>{
    const f = collect();
    const diff = diffText(f) || '(לא זוהה שינוי בשדות)';
    item.aliases = f.aliases;
    m0.explanation = f.explanation;
    render();
    if (window.Otzaria && Otzaria.call){
      try {
        await Otzaria.call('feedback.sendEmail', { to: REPORT_EMAIL, subject: 'הצעת עריכה - ' + item.name + ' - מקומות', body: 'הצעת עריכה לערך: ' + item.name + '\n\n' + diff, includeSystemInfo: true });
        await Otzaria.call('notifications.showInApp', { message: 'ההצעה נשלחה, תודה!', type: 'success' }).catch(()=>{});
      } catch(e){
        await Otzaria.call('notifications.showInApp', { message: 'שגיאה בשליחת ההצעה', type: 'error' }).catch(()=>{});
      }
    }
    openModal(item);
  });
  document.getElementById('pefCancel').addEventListener('click', ()=> openModal(item));
}

function openModal(item){
  modalInner.innerHTML = itemDetailHTML(item);
  wireItemDetail(item);
  overlay.classList.add('open');
}

function hasModernInfo(v){ return !!(v && v.replace(/[\s—–\-]/g,'').length); }

function renderMethodPanel(item, mi){
  const m = item.methods[mi];
  const panel = document.getElementById('methodPanel');
  const wikiUrl = `https://he.wikipedia.org/w/index.php?search=${encodeURIComponent(item.name)}`;
  const confColor = m.confidence==='ודאי' ? 'var(--forest)' : m.confidence==='שנוי' ? 'var(--rust)' : 'var(--gold)';
  const confText = m.confidence==='שנוי' ? '#FBEDE6' : m.confidence==='סביר' ? '#2B2318' : '#EAF2E9';
  const mapUrl = m.mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.mapQuery)}` : '';
  panel.innerHTML = `
    <div class="method-panel">
      <span class="conf-tag" style="background:${confColor};color:${confText}">${m.confidence}</span>
      <p class="method-text">${m.explanation}</p>
      ${hasModernInfo(m.modern) ? `
      <div class="modern-box">
        <div class="modern-label">מיקום בעולם המודרני</div>
        <div>${m.modern}</div>
        ${m.geo ? `<div class="mini-map" id="miniMap"></div>` : ''}
        ${mapUrl ? `<a class="map-link" href="${mapUrl}" data-external-link="${mapUrl}">📍 פתח במפות גוגל ↗</a>` : ''}
        ${m.geo ? `<button class="mini-map-btn" id="miniMapGoto">🗺️ הצג במפה הראשית</button>` : ''}
      </div>` : ''}
      <a class="wiki-link" href="${wikiUrl}" data-external-link="${wikiUrl}">קריאה נוספת במכלול ↗</a>
    </div>`;
  renderMiniMap(item, mi);
  const gotoBtn = document.getElementById('miniMapGoto');
  if(gotoBtn) gotoBtn.addEventListener('click', ()=>focusOnMainMap(item, mi));
}

function closeModal(){ overlay.classList.remove('open'); destroyMiniMap(); }
document.getElementById('closeBtn').addEventListener('click', closeModal);
overlay.addEventListener('click', e=>{ if(e.target===overlay) closeModal(); });
document.getElementById('printBtn').addEventListener('click', ()=> window.print());

document.addEventListener('keydown', e=>{
  if(e.key==='Escape'){ closeModal(); }
});



// קישורים חיצוניים — לא לתת ל-WebView לנווט ישירות; שואלים אישור ופותחים בדפדפן המערכת.
async function confirmOpenExternal(url){
  let hostname = url;
  try { hostname = new URL(url).hostname || url; } catch(_) { /* ignore */ }
  const res = await Otzaria.call('ui.showConfirm', {
    title: 'קישור לאתר חיצוני',
    content: `הקישור הזה מוביל אל האתר "${hostname}" — מחוץ לתוסף. האם לפתוח אותו בדפדפן המערכת שלכם?\n\n💚 אין לך אינטרנט? אתה שמור, אשריך! אתה מקיים את העולם — המשך כך, שכרך ישולם לך לעולם הבא, אבל תזכה לאכול מפירותיה גם בעולם הזה!`
  }).catch(() => null);
  if (!res || !res.success || !res.data || res.data.confirmed !== true) return;
  const r = await Otzaria.call('app.openUrl', { url }).catch(() => null);
  if (!r || !r.success){
    await Otzaria.call('ui.showError', { message: 'פתיחת הקישור נכשלה.' }).catch(()=>{});
  }
}

document.addEventListener('click', e=>{
  const link = e.target.closest('[data-external-link]');
  if(link){
    e.preventDefault();
    const url = link.getAttribute('data-external-link');
    if (url) confirmOpenExternal(url);
    else Otzaria.call('ui.showError', { message: 'קישור זה אינו נגיש מתוך התוסף.' }).catch(()=>{});
  }
}, true);

// ---------- פתיחת מקורות (פסוקים/חז״ל) ישירות בספריית אוצריא ----------
const TANAKH_BOOK_NAMES = ["דברי הימים א","דברי הימים ב","שמואל א","שמואל ב","מלכים א","מלכים ב",
  "בראשית","שמות","ויקרא","במדבר","דברים","יהושע","שופטים","ישעיה","ישעיהו","ירמיה","ירמיהו","יחזקאל",
  "הושע","יואל","עמוס","עובדיה","יונה","מיכה","נחום","חבקוק","צפניה","חגי","זכריה","מלאכי",
  "תהילים","תהלים","משלי","איוב","שיר השירים","רות","איכה","קהלת","אסתר","דניאל","עזרא","נחמיה"];

function parseVerseRef(ref){
  if (!ref) return null;
  for (const book of TANAKH_BOOK_NAMES){
    if (ref.startsWith(book + ' ')){
      const rest = ref.slice(book.length + 1).trim();
      const chapter = rest.split(',')[0].trim();
      if (chapter) return { bookId: book, ref: 'פרק ' + chapter };
    }
  }
  return null;
}

function parseMidrashRef(source){
  if (!source) return null;
  const s = source.replace(/\s*\([^)]*\)\s*$/, '').trim();
  let m = s.match(/^(?:בבלי\s+)?([א-ת" ]+?)\s+([א-ת]+),\s*([אב])\s*$/);
  if (m) return { bookId: m[1].trim(), ref: 'דף ' + m[2] };
  m = s.match(/^ירושלמי\s+([א-ת" ]+?)\s+([א-ת]+),\s*([א-ת]+)\s*$/);
  if (m) return { bookId: 'תלמוד ירושלמי ' + m[1].trim(), ref: 'פרק ' + m[2] };
  m = s.match(/^משנה\s+([א-ת" ]+?)\s+([א-ת]+),\s*([א-ת]+)\s*$/);
  if (m) return { bookId: 'משנה ' + m[1].trim(), ref: 'פרק ' + m[2] };
  m = s.match(/^תוספתא\s+([א-ת" ]+?)\s+([א-ת]+),\s*([א-ת]+)\s*$/);
  if (m) return { bookId: 'תוספתא ' + m[1].trim(), ref: 'פרק ' + m[2] };
  return null;
}

async function openInLibrary(bookId, ref){
  if (!hasOtzaria()) return;
  try {
    const r = await Otzaria.call('reader.openBookAtRef', { bookId, ref, index: 0 });
    if (!r || !r.success) await Otzaria.call('notifications.showInApp', { message: 'לא ניתן היה לפתוח את המקור בספרייה', type: 'info' }).catch(()=>{});
  } catch(e){
    await Otzaria.call('notifications.showInApp', { message: 'פתיחת המקור בספרייה נכשלה', type: 'error' }).catch(()=>{});
  }
}

document.addEventListener('click', e=>{
  if (e.target.closest('[data-external-link]')) return;
  const el = e.target.closest('[data-open-ref]');
  if (el){
    try {
      const parsed = JSON.parse(el.getAttribute('data-open-ref').replace(/&#39;/g, "'"));
      if (parsed && parsed.bookId) openInLibrary(parsed.bookId, parsed.ref);
    } catch(_){}
  }
}, true);

// ---------- Otzaria plugin integration ----------
const MENU_ITEM_ID = 'chadbedera-place-lookup';

function hasOtzaria(){ return !!(window.Otzaria && typeof Otzaria.call === 'function'); }

function normalizeHeb(s){
  return (s || '')
    .replace(/[֑-ׇ]/g, '')      // ניקוד וטעמים
    .replace(/[^א-ת]/g, '');    // רק עיצורים עבריים
}

function stripNiqqudDisplay(s){
  return (s || '').replace(/[֑-ׇ]/g, '');
}

const PREFIXES = ['ה','ו','ב','כ','ל','מ','ש'];
const SUFFIXES = ['ים','ות'];
const NIQQUD_RE = /[֑-ׇ]/g;

function tokenizeHeb(text){
  return (text || '').replace(NIQQUD_RE, '').match(/[א-ת]+/g) || [];
}
function looseForm(w){ return (w || '').replace(/[וי]/g, ''); }

const PLACE_LOOKUP = new Map();
const LOOSE_LOOKUP = new Map();

function registerKey(phrase, idx){
  const norm = normalizeHeb(phrase);
  if (!norm || norm.length < 2) return;
  if (!PLACE_LOOKUP.has(norm)) PLACE_LOOKUP.set(norm, idx);
  const loose = looseForm(norm);
  if (loose.length >= 2 && !LOOSE_LOOKUP.has(loose)) LOOSE_LOOKUP.set(loose, idx);
}
function registerPhrase(phrase, idx){
  if (!phrase) return;
  registerKey(phrase, idx);
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) words.forEach(w => { if (normalizeHeb(w).length >= 3) registerKey(w, idx); });
}

DATA.forEach((item, idx) => {
  registerPhrase(item.name, idx);
  (item.aliases || []).forEach(a => registerPhrase(a, idx));
});

// כל הצירופים האפשריים: הסרת עד שתי קידומות (אותיות השימוש) X הסרת סיומת ריבוי
function candidateForms(word){
  const w = normalizeHeb(word);
  if (!w) return [];
  const prefixVariants = [w];
  let cur = w;
  for (let i = 0; i < 2 && cur.length > 2; i++){
    if (!PREFIXES.includes(cur[0])) break;
    cur = cur.slice(1);
    prefixVariants.push(cur);
  }
  const all = new Set();
  prefixVariants.forEach(p => {
    all.add(p);
    SUFFIXES.forEach(suf => {
      if (p.endsWith(suf) && p.length > suf.length + 1) all.add(p.slice(0, -suf.length));
    });
  });
  return Array.from(all).filter(c => c.length >= 2);
}

function findPlaceIdx(word){
  const cands = candidateForms(word);
  for (const c of cands){ if (PLACE_LOOKUP.has(c)) return PLACE_LOOKUP.get(c); }
  for (const c of cands){
    const lc = looseForm(c);
    if (lc.length >= 2 && LOOSE_LOOKUP.has(lc)) return LOOSE_LOOKUP.get(lc);
  }
  return null;
}

function findPlaceInSelection(text){
  const words = tokenizeHeb(text);
  for (const w of words){
    const idx = findPlaceIdx(w);
    if (idx !== null) return idx;
  }
  return null;
}

function findAllPlaceIdxsInSelection(text){
  const words = tokenizeHeb(text);
  const seen = new Set();
  const result = [];
  for (const w of words){
    const idx = findPlaceIdx(w);
    if (idx !== null && !seen.has(idx)){ seen.add(idx); result.push(idx); }
  }
  return result;
}

// ---------- זיהוי גם עבור ערי הנחלות (EXTRA_TOWNS) שאין להן כרטיס מלא ----------
const EXTRA_LOOKUP = new Map();
const EXTRA_STOPWORDS = new Set(['ויהיו','ותהי','ותהיינה','הערים','ערי','עיר','מקצה','קצה','למטה','מטה',
  'בני','בנות','בנותיה','ובנותיה','אל','גבול','גבולם','גבולה','ובגבולה','בנגבה','נגבה','נגב','עוד',
  'זאת','נחלת','נחלתם','זה','אלה','האלה','ישוב','חצריהן','וחצריהן','חצריה','וחצריה','פרזים','הפרזי',
  'אשר','העמקים','בעמק','בהר','במדבר','ובמגרשיה','מגרשיה','ומגרשיה','ערים','עשרים','שתים','ותשע',
  'יהודה','שמעון','בנימין','דן','אפרים','מנשה','זבולון','יששכר','נפתלי','גד','ראובן','לוי','אשר',
  'שבט','שבטי','למשפחתם','למשפחתם','זאת','תהיה']);

function registerExtraKey(word, idx){
  const norm = normalizeHeb(word);
  if (!norm || norm.length < 2 || EXTRA_STOPWORDS.has(norm)) return;
  if (!EXTRA_LOOKUP.has(norm)) EXTRA_LOOKUP.set(norm, idx);
}

EXTRA_TOWNS.forEach((t, idx) => {
  tokenizeHeb(t.text).forEach(w => registerExtraKey(w, idx));
});

function findExtraIdx(word){
  const cands = candidateForms(word);
  for (const c of cands){ if (EXTRA_LOOKUP.has(c)) return EXTRA_LOOKUP.get(c); }
  return null;
}

function findAllMatchesInSelection(text){
  const words = tokenizeHeb(text);
  const seenData = new Set(), seenExtra = new Set();
  const result = [];
  for (const w of words){
    const idx = findPlaceIdx(w);
    if (idx !== null && !seenData.has(idx)){ seenData.add(idx); result.push({ kind: 'full', idx }); }
  }
  for (const w of words){
    const idx = findExtraIdx(w);
    if (idx !== null && !seenExtra.has(idx)){ seenExtra.add(idx); result.push({ kind: 'extra', idx }); }
  }
  return result;
}

const REPORT_EMAIL = 'E0548433917@outlook.com';

function openMultiModal(matches){
  const rowsHTML = matches.map(m=>{
    if (m.kind === 'full'){
      const it = DATA[m.idx];
      return `
        <div class="multi-item" data-kind="full" data-idx="${m.idx}">
          <div class="placeholder-icon">${ICONS[it.cat]}</div>
          <div>
            <div class="multi-item-name">${it.name}</div>
            <div class="multi-item-desc">${it.methods[0].explanation}</div>
          </div>
        </div>`;
    }
    const t = EXTRA_TOWNS[m.idx];
    const displayName = stripNiqqudDisplay(t.text).replace(/^\(.+?\)\s*/,'').slice(0,40);
    return `
        <div class="multi-item" data-kind="extra" data-idx="${m.idx}">
          <div class="placeholder-icon" style="display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--gold);">✧</div>
          <div>
            <div class="multi-item-name">${displayName}</div>
            <div class="multi-item-desc">נחלת ${t.tribe} · ${t.ref}</div>
          </div>
        </div>`;
  }).join('');

  modalInner.innerHTML = `
    <div class="modal-head">
      <div>
        <h2>נמצאו ${matches.length} מקומות בקטע שנבחר</h2>
        <div class="cat-line">לחצו על מקום לצפייה בפרטים — הרשימה נשארת למעלה כדי לעבור בין הכרטיסים</div>
      </div>
    </div>
    <div class="modal-body">
      <div class="multi-list" id="multiList">${rowsHTML}</div>
      <div id="multiDetail"></div>
    </div>`;
  const selectMultiItem = (kind, idx) => {
    modalInner.querySelectorAll('.multi-item').forEach(x=>x.classList.toggle('active', x.dataset.kind===kind && x.dataset.idx == idx));
    const box = document.getElementById('multiDetail');
    if (kind === 'full'){
      const item = DATA[idx];
      box.innerHTML = itemDetailHTML(item);
      wireItemDetail(item);
    } else {
      box.innerHTML = extraDetailHTML(EXTRA_TOWNS[idx]);
    }
  };
  modalInner.querySelectorAll('.multi-item').forEach(el=>{
    el.addEventListener('click', ()=> selectMultiItem(el.dataset.kind, el.dataset.idx));
  });
  selectMultiItem(matches[0].kind, matches[0].idx);
  overlay.classList.add('open');
}

function openNotFoundModal(searchedText){
  const safeText = (searchedText||'').replace(/"/g,'&quot;');
  modalInner.innerHTML = `
    <div class="modal-head">
      <div>
        <h2>המקום "${searchedText}" אינו קיים עדיין במדריך</h2>
        <div class="cat-line">אפשר להציע להוסיף אותו בגרסה הבאה</div>
      </div>
    </div>
    <div class="modal-body nf-form">
      <p class="no-src">מלאו את הפרטים הבאים ושלחו אותם למפתח (${REPORT_EMAIL}), או הורידו קובץ טקסט לשליחה ממחשב אחר המחובר לרשת אם אין לכם כרגע חיבור לאינטרנט.</p>
      <div class="field-label">מה ההוספה (שם המקום)</div>
      <input type="text" id="nfName" value="${safeText}">
      <div class="field-label">מה המקור בספרייה (פסוק / מסכת / מדרש)</div>
      <textarea id="nfSource" placeholder="לדוגמה: בראשית י, י — או מסכת ונושא בגמרא"></textarea>
      <div class="field-label">הערות נוספות</div>
      <textarea id="nfNotes" placeholder="פרטים נוספים, קישורים, זיהוי מוצע וכו׳"></textarea>
      <div class="nf-actions">
        <button class="nf-btn" id="nfSave">💾 שמירה במכשיר</button>
        <button class="nf-btn" id="nfSend">📧 שליחה במייל</button>
        <button class="nf-btn secondary" id="nfDownload">💾 הורדה כקובץ טקסט</button>
      </div>
    </div>`;
  overlay.classList.add('open');

  function buildReport(){
    const name = document.getElementById('nfName').value.trim();
    const source = document.getElementById('nfSource').value.trim();
    const notes = document.getElementById('nfNotes').value.trim();
    return `הצעת תוספת למדריך מקומות\nלשליחה אל: ${REPORT_EMAIL}\n\nההוספה המוצעת: ${name}\nהמקור בספרייה: ${source || '—'}\nהערות נוספות: ${notes || '—'}\n`;
  }

  document.getElementById('nfSave').addEventListener('click', ()=>{
    const name = document.getElementById('nfName').value.trim();
    if (!name){ window.alert('יש למלא שם'); return; }
    try {
      const key = 'places_nf_drafts_v1';
      const drafts = JSON.parse(localStorage.getItem(key) || '[]');
      drafts.push({
        name, source: document.getElementById('nfSource').value.trim(),
        notes: document.getElementById('nfNotes').value.trim(), savedAt: new Date().toISOString()
      });
      localStorage.setItem(key, JSON.stringify(drafts));
      window.alert('הטיוטה נשמרה במכשיר זה. ניתן לשלוח אותה למפתח בכל שלב.');
    } catch(e){ window.alert('שמירת הטיוטה נכשלה.'); }
  });
  document.getElementById('nfSend').addEventListener('click', async ()=>{
    if (!hasOtzaria()) return;
    try {
      await Otzaria.call('feedback.sendEmail', {
        to: REPORT_EMAIL,
        subject: 'הצעת תוספת - מדריך מקומות',
        body: buildReport(),
        includeSystemInfo: true
      });
      await Otzaria.call('notifications.showInApp', { message: 'ההצעה נשלחה, תודה!', type: 'success' }).catch(()=>{});
    } catch(e){
      await Otzaria.call('notifications.showInApp', { message: 'שגיאה בשליחת ההצעה', type: 'error' }).catch(()=>{});
    }
  });

  document.getElementById('nfDownload').addEventListener('click', ()=>{
    const blob = new Blob([buildReport()], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'הצעת-תוספת-מקומות-בתנך.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  });
}

function showLookupStatus(msg, ok){
  const el = document.getElementById('lookupStatus');
  el.textContent = msg;
  el.className = 'lookup-status ' + (ok ? 'ok' : 'err');
  el.style.display = 'inline-block';
}

async function registerContextMenuItem(){
  try {
    await Otzaria.call('reader.addContextMenuItem', {
      id: MENU_ITEM_ID,
      label: 'זהה מקום במדריך',
      icon: 'location_24_regular'
    });
    showLookupStatus('✅ זיהוי מקומות בלחיצה ימנית פעיל (יש להפעיל "הרצה ברקע" בהגדרות התוסף כדי שיישאר זמין תמיד)', true);
  } catch(e){
    showLookupStatus('⚠️ רישום פריט הזיהוי נכשל: ' + ((e && e.message) || String(e)), false);
  }
}

async function goToPluginOnConfirm(title, content, fallbackMessage){
  try {
    const res = await Otzaria.call('ui.showConfirm', { title, content });
    if (res && res.data && res.data.confirmed){
      const openSelfMethod = ['plugin', 'openSelf'].join('.');
      const nav = await Otzaria.call(openSelfMethod, {}).catch(() => ({ success: false }));
      if (!nav || !nav.success){
        await Otzaria.call('notifications.showInApp', {
          message: 'מעבר אוטומטי ללשונית נתמך רק מגרסת אוצריא 0.9.96 ואילך. אפשר לעבור ידנית ללשונית "כלים" > "מקומות" — הכרטיס כבר פתוח שם.',
          type: 'info'
        }).catch(()=>{});
      }
    }
  } catch(e) {
    await Otzaria.call('notifications.showInApp', { message: fallbackMessage, type: 'success' }).catch(()=>{});
  }
}

async function handleContextMenuClick(data){
  if (!data || data.itemId !== MENU_ITEM_ID) return;
  const text = (data.selectedText || '').trim();
  if (!text){
    if (hasOtzaria()) await Otzaria.call('notifications.showInApp', { message: 'יש לסמן תחילה את שם המקום בטקסט', type: 'info' }).catch(()=>{});
    return;
  }
  const matches = findAllMatchesInSelection(text);
  if (matches.length > 1){
    openMultiModal(matches);
    if (hasOtzaria()){
      const lines = matches.map(m=>{
        if (m.kind === 'full'){
          const it = DATA[m.idx];
          const modern = it.methods[0].modern;
          return '• ' + it.name + (hasModernInfo(modern) ? ' — כיום: ' + modern : '');
        }
        const t = EXTRA_TOWNS[m.idx];
        const displayName = stripNiqqudDisplay(t.text).replace(/^\(.+?\)\s*/,'').slice(0,40);
        return '• ' + displayName + ' (נחלת ' + t.tribe + ')';
      }).join('\n');
      await goToPluginOnConfirm(
        '📍 נמצאו ' + matches.length + ' מקומות',
        'נמצאו במדריך כמה מקומות בקטע שסימנתם:\n\n' + lines + '\n\nהרשימה המלאה כבר פתוחה ברקע. לחיצה על אישור תעביר אותך ללשונית "מקומות".',
        '📍 נמצאו ' + matches.length + ' מקומות — פתוח בלשונית "מקומות".'
      );
    }
    return;
  }
  if (matches.length === 1 && matches[0].kind === 'full'){
    const item = DATA[matches[0].idx];
    openModal(item);
    if (hasOtzaria()){
      const firstVerse = item.verses[0] ? item.verses[0].ref : '';
      const modern = item.methods[0].modern;
      let explanation = item.methods[0].explanation || '';
      if (explanation.length > 220) explanation = explanation.slice(0, 217) + '...';
      const content = explanation
        + (firstVerse ? '\n\nלפי: ' + firstVerse : '')
        + (hasModernInfo(modern) ? '\n\n📍 המקום כיום: ' + modern : '')
        + '\n\nלחיצה על אישור תעביר אותך ללשונית "מקומות" לכרטיס המלא (עם פסוקים ומקורות).';
      await goToPluginOnConfirm('📍 ' + item.name, content, '📍 זוהה: ' + item.name);
    }
  } else if (matches.length === 1 && matches[0].kind === 'extra'){
    const t = EXTRA_TOWNS[matches[0].idx];
    openExtraTownModal(t);
    if (hasOtzaria()){
      const displayName = stripNiqqudDisplay(t.text).replace(/^\(.+?\)\s*/,'').slice(0,40);
      const content = 'עיר ברשימת נחלת ' + t.tribe + ' (יהושע), ללא כרטיס מלא — לרוב אין לה זיהוי מודרני ודאי.'
        + '\n\nלפי: ' + t.ref
        + '\n\nהפרטים כבר פתוחים ברקע. לחיצה על אישור תעביר אותך ללשונית "מקומות".';
      await goToPluginOnConfirm('📍 ' + displayName, content, '📍 זוהה: ' + displayName + ' (נחלת ' + t.tribe + ')');
    }
  } else {
    openNotFoundModal(text);
    if (hasOtzaria()){
      await goToPluginOnConfirm(
        '❓ לא נמצא: ' + text,
        'לא נמצא מקום במדריך עבור "' + text + '".\n\nטופס להצעת תוספת כבר פתוח ברקע. לחיצה על אישור תעביר אותך ללשונית "מקומות".',
        '❓ לא זוהה מקום עבור "' + text + '" — טופס הצעת תוספת פתוח בלשונית "מקומות".'
      );
    }
  }
}

document.getElementById('lightbulb-btn').addEventListener('click', async () => {
  if (!hasOtzaria()) return;
  const msg = window.prompt('מה תרצה לשתף לגבי התוסף? (הודעה תישלח למפתח)');
  if (!msg || !msg.trim()) return;
  try {
    await Otzaria.call('feedback.sendEmail', {
      to: REPORT_EMAIL,
      subject: 'משוב על תוסף מדריך מקומות',
      body: msg.trim(),
      includeSystemInfo: true
    });
    await Otzaria.call('notifications.showInApp', { message: 'המשוב נשלח, תודה!', type: 'success' }).catch(()=>{});
  } catch(e){
    await Otzaria.call('notifications.showInApp', { message: 'שגיאה בשליחת המשוב', type: 'error' }).catch(()=>{});
  }
});

function waitForOtzaria(elapsed){
  if (window.Otzaria && typeof Otzaria.on === 'function'){
    // פריט התפריט האחיד נרשם ע"י מעטפת "מדעי התנ״ך" (index.html), לא כאן.
    Otzaria.on('reader.context_menu_item_clicked', handleContextMenuClick);
    return;
  }
  if (elapsed > 4000 && !waitForOtzaria._warned){
    waitForOtzaria._warned = true;
  }
  setTimeout(() => waitForOtzaria(elapsed + 200), 200);
}
waitForOtzaria(0);

document.getElementById('addNewBtn').addEventListener('click', ()=> openNotFoundModal(''));

render();
initWorldMap();

(function(){
  try {
    const focus = new URLSearchParams(location.search).get('focus');
    if (focus) handleContextMenuClick({ itemId: MENU_ITEM_ID, selectedText: focus });
  } catch(e){}
})();

