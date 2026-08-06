// תצוגת המדריך: רפרנסי DOM, תמונות, צ׳יפים, רשת הכרטיסים ופתיחה/סגירה.
// נוצר בפיצול router.js (גרסה 2.11.2). המקור: shell/router.js שורות 369-399, 460-620, 1408-1452.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.

// ---- UI ----

const landing = document.getElementById('landing');
const frameWrap = document.getElementById('frameWrap');
const guideFrame = document.getElementById('guideFrame');
const frameTitle = document.getElementById('frameTitle');
const backBtn = document.getElementById('backBtn');
const resultsOverlay = document.getElementById('resultsOverlay');
const resultsList = document.getElementById('resultsList');
const resultsQuote = document.getElementById('resultsQuote');
const closeResults = document.getElementById('closeResults');
const noResults = document.getElementById('noResults');

// ==== רינדור מדריך ילידי, בלי iframe ====
// ניסינו קודם iframe (עם ניווט ל-view.html) וגם ניווט מלא של החלון - שניהם נכשלו
// בפועל בתוך אוצריא (עמוד לבן / שגיאת טעינה). לכן כל תצוגת מדריך נבנית ישירות
// כאן, בתוך index.html עצמו, מהנתונים שכבר נטענים דרך ה-iframe הנסתר (loadGuideData) -
// כך שקריאות ל-Otzaria (פתיחת ספר, שליחת מייל וכו') תמיד רצות מהעמוד הראשי עצמו.
const guideView = document.getElementById('guideView');
const guideViewTitle = document.getElementById('guideViewTitle');
const guideSearchBox = document.getElementById('guideSearchBox');
const guideGrid = document.getElementById('guideGrid');
const guideBackBtn = document.getElementById('guideBackBtn');
const guideAddNewBtn = document.getElementById('guideAddNewBtn');
const entryOverlay = document.getElementById('entryOverlay');
const entryModalInner = document.getElementById('entryModalInner');
const entryCloseBtn = document.getElementById('entryCloseBtn');

let currentGuideData = [];
let currentGuideCat = null;


// תמונות מוטבעות (CARD_IMAGES) - נטענות יחד עם ה-DATA דרך אותו iframe נסתר, ונשמרות
// ב-imagesCache. לא כל מדריך משתמש בזה (מקומות למשל - יש לו מפה בפני עצמה; צומח - היה
// מביא תמונות חי מוויקיפדיה, לא הוטמע כאן).
function lookupEntryImage(entry, catId){
  const images = imagesCache[catId] || {};
  if (entry.img && images[entry.img]) return images[entry.img];
  const wiki = entry.methods && entry.methods[0] && entry.methods[0].wiki;
  if (wiki && images[wiki]) return images[wiki];
  return null;
}
function lookupEntryGallery(entry, catId){
  const images = imagesCache[catId] || {};
  return (entry.gallery || []).map(k => images[k]).filter(Boolean);
}

// לחלק מהמדריכים (בעיקר צומח, כפי שהיה במקור) אין תמונות מוטבעות בכלל - הן נטענות
// באופן חי מוויקיפדיה לפי שם הערך המדעי (methods[0].wiki), בדיוק כמו שהמדריך המקורי
// עשה. זה דורש רשת (לא קובץ מקומי), אז זו הרחבה בלבד - אם זה נכשל, פשוט לא מוצגת תמונה.
const wikiThumbCache = {};
function fetchWikiThumbnail(title){
  if (!title) return Promise.resolve(null);
  if (wikiThumbCache[title] !== undefined) return Promise.resolve(wikiThumbCache[title]);
  return fetch('https://he.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title))
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      const src = data && data.thumbnail && data.thumbnail.source;
      wikiThumbCache[title] = src || null;
      return wikiThumbCache[title];
    })
    .catch(() => { wikiThumbCache[title] = null; return null; });
}

function entryCardHTML(entry, idx){
  const sub = entry.tribe || entry.region || (entry.methods && entry.methods[0] && entry.methods[0].confidence) || '';
  const desc = entry.explanation || (entry.methods && entry.methods[0] && entry.methods[0].explanation) || entry.note || '';
  const img = currentGuideCat ? lookupEntryImage(entry, currentGuideCat.id) : null;
  const wikiTitle = !img && entry.methods && entry.methods[0] && entry.methods[0].wiki;
  const imgSrc = img || entry.customImage;
  return maskDivineName(`<div class="entry-card" data-idx="${idx}">
    ${imgSrc ? `<div class="entry-card-img"><img src="${imgSrc}" alt="${esc(entry.name)}" loading="lazy"></div>`
       : (wikiTitle ? `<div class="entry-card-img" data-wiki-lazy="${esc(wikiTitle)}"></div>` : '')}
    <div class="entry-card-name">${esc(entry.name)}${entry.__edited ? ' <span class="edited-badge" title="נערך על ידכם במכשיר זה">✏️</span>' : ''}</div>
    ${sub ? `<div class="entry-card-sub">${esc(sub)}</div>` : ''}
    ${desc ? `<div class="entry-card-desc">${esc(desc)}</div>` : ''}
  </div>`);
}

function lazyLoadWikiThumbnails(container){
  const targets = container.querySelectorAll('[data-wiki-lazy]');
  if (!targets.length) return;
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      obs.unobserve(entry.target);
      const el = entry.target;
      fetchWikiThumbnail(el.dataset.wikiLazy).then(src => {
        if (src) el.innerHTML = `<img src="${src}" alt="" loading="lazy">`;
        else el.remove();
      });
    });
  }, { rootMargin: '200px' });
  targets.forEach(el => io.observe(el));
}

let activeGuideChip = 'all';
const guideChips = document.getElementById('guideChips');

// ---- אפשרויות הסינון, כפי שהן בתוסף ״אישים בתנ״ך״ (2.12.0) ----
// שלוש שורות: קטגוריה (הצ׳יפים שהיו כאן מאז ומתמיד) · תקופה · א-ב. ״תקופה״ נשענת
// על השדה era שב-CATS, שקיים רק במדריך אישים — ולכן השורה מוסתרת בשאר המדריכים,
// בדיוק כמו שהיא לא קיימת שם. ב״ביוגרפיות״ אין סינון בכלל ולא הועתק ממנו דבר.
const guideFilters = document.getElementById('guideFilters');
const guideFiltersToggle = document.getElementById('guideFiltersToggle');
const guideFiltersSummary = document.getElementById('guideFiltersSummary');
const guideEraRow = document.getElementById('guideEraRow');
const guideEraChips = document.getElementById('guideEraChips');
const guideAlphaBar = document.getElementById('guideAlphaBar');
const ALEPH_BET = ['א','ב','ג','ד','ה','ו','ז','ח','ט','י','כ','ל','מ','נ','ס','ע','פ','צ','ק','ר','ש','ת'];
let activeGuideEra = 'all';
let activeGuideLetter = 'all';

function guideCatOf(catId){
  const cats = (currentGuideCat && catsCache[currentGuideCat.id]) || [];
  return cats.find(c => c.id === catId) || null;
}
function guideEraOf(entry){
  const c = guideCatOf(entry.cat);
  return (c && c.era) || '';
}
// האות הראשונה של השם, אחרי הסרת ניקוד — כמו firstLetter בתוסף אישים
function guideFirstLetter(name){
  const n = normalizeHeb(name || '');
  return n ? n[0] : '';
}
// הסינון שאינו הצ׳יפים: תקופה ואות פותחת. משמש גם ברשימה וגם בספירות שבצ׳יפים.
function matchesGuideFilters(entry){
  if (activeGuideEra !== 'all' && guideEraOf(entry) !== activeGuideEra) return false;
  if (activeGuideLetter !== 'all' && guideFirstLetter(entry.name) !== activeGuideLetter) return false;
  return true;
}

function renderGuideEraChips(){
  const cats = (currentGuideCat && catsCache[currentGuideCat.id]) || [];
  const eras = [];
  cats.forEach(c => {
    if (c.era && !eras.includes(c.era) && currentGuideData.some(e => e.cat === c.id)) eras.push(c.era);
  });
  if (!eras.length){
    guideEraRow.classList.add('hidden');
    guideEraChips.innerHTML = '';
    activeGuideEra = 'all';
    return;
  }
  guideEraRow.classList.remove('hidden');
  guideEraChips.innerHTML = `<button class="chip${activeGuideEra==='all'?' active':''}" data-era="all">הכל</button>` +
    eras.map(e => `<button class="chip${activeGuideEra===e?' active':''}" data-era="${esc(e)}">${esc(e)}</button>`).join('');
  guideEraChips.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      activeGuideEra = btn.dataset.era;
      renderGuideGrid(guideSearchBox.value);
    });
  });
}

function renderGuideAlphaBar(){
  // רק אותיות שיש להן ערכים *בהינתן* הסינון האחר, כדי שלא יוצגו אותיות מתות
  const letters = new Set();
  currentGuideData.forEach(e => {
    if (activeGuideChip !== 'all' && e.cat !== activeGuideChip) return;
    if (activeGuideEra !== 'all' && guideEraOf(e) !== activeGuideEra) return;
    const l = guideFirstLetter(e.name);
    if (l) letters.add(l);
  });
  if (activeGuideLetter !== 'all' && !letters.has(activeGuideLetter)) activeGuideLetter = 'all';
  guideAlphaBar.innerHTML = `<button class="alpha-btn${activeGuideLetter==='all'?' active':''}" data-letter="all" title="הכל">*</button>` +
    ALEPH_BET.filter(l => letters.has(l))
      .map(l => `<button class="alpha-btn${activeGuideLetter===l?' active':''}" data-letter="${l}">${l}</button>`).join('');
  guideAlphaBar.querySelectorAll('.alpha-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeGuideLetter = btn.dataset.letter;
      renderGuideGrid(guideSearchBox.value);
    });
  });
}

function updateGuideFiltersSummary(){
  const parts = [];
  if (activeGuideChip !== 'all'){
    const c = guideCatOf(activeGuideChip);
    parts.push('קטגוריה: ' + (c ? c.label : activeGuideChip));
  }
  if (activeGuideEra !== 'all') parts.push('תקופה: ' + activeGuideEra);
  if (activeGuideLetter !== 'all') parts.push('אות: ' + activeGuideLetter);
  const open = !guideFilters.classList.contains('collapsed');
  guideFiltersSummary.textContent = (parts.length && !open) ? ('סינון פעיל — ' + parts.join(' · ')) : '';
  guideFiltersToggle.classList.toggle('on', parts.length > 0);
}

guideFiltersToggle.addEventListener('click', () => {
  const nowOpen = guideFilters.classList.toggle('collapsed') === false;
  guideFiltersToggle.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
  guideFiltersToggle.textContent = nowOpen ? '✕ סגירת הסינון' : '☰ סינון';
  updateGuideFiltersSummary();
});

function renderGuideChips(){
  renderGuideEraChips();
  renderGuideAlphaBar();
  updateGuideFiltersSummary();
  const cats = (currentGuideCat && catsCache[currentGuideCat.id]) || [];
  if (!cats.length){ guideChips.innerHTML = ''; guideChips.style.display = 'none'; return; }
  guideChips.style.display = 'flex';
  // הספירות מכבדות את שאר הסינון, אחרת צ׳יפ יבטיח 40 ערכים ויציג שניים
  const counted = currentGuideData.filter(matchesGuideFilters);
  const totalCount = counted.length;
  guideChips.innerHTML = `<button class="chip${activeGuideChip==='all'?' active':''}" data-chip="all">הכל (${totalCount})</button>` +
    cats.map(c => {
      const n = counted.filter(e => e.cat === c.id).length;
      return `<button class="chip${activeGuideChip===c.id?' active':''}" data-chip="${esc(c.id)}">${esc(c.label)} (${n})</button>`;
    }).join('');
  // במקומות: כפתור קפיצה ישירה למפה שבסוף הרשימה
  if (currentGuideCat && currentGuideCat.id === 'places'){
    guideChips.insertAdjacentHTML('beforeend', '<button class="chip chip-map" id="jumpToMapChip">🗺️ למפה</button>');
  }
  guideChips.querySelectorAll('.chip').forEach(btn => {
    if (btn.id === 'jumpToMapChip') return;
    btn.addEventListener('click', () => {
      activeGuideChip = btn.dataset.chip;
      guideSearchBox.value = '';
      renderGuideGrid('');
    });
  });
  const jumpBtn = document.getElementById('jumpToMapChip');
  if (jumpBtn) jumpBtn.addEventListener('click', () => {
    if (activeGuideChip !== 'all' || guideSearchBox.value || activeGuideEra !== 'all' || activeGuideLetter !== 'all'){
      activeGuideChip = 'all';
      activeGuideEra = 'all';
      activeGuideLetter = 'all';
      guideSearchBox.value = '';
      renderGuideGrid('');
    }
    setTimeout(() => {
      const el = document.getElementById('worldMap');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  });
}

// ---- ציר זמן לפי דורות (2.9) — תצוגה חלופית במדריך אישים, לצד הרשת (מתג, לא החלפה) ----
// era קיים רק על קטגוריות מדריך אישים (ר' ההערה למעלה על guideEraOf) - ולכן הכפתור
// מוצג רק שם, ומצב הציר מתאפס בכל פתיחת מדריך כדי לא "לדלוף" למדריך אחר.
let guideViewMode = 'grid';
const guideTimelineToggle = document.getElementById('guideTimelineToggle');
// סדר הדורות = סדר ה-CATS (כרונולוגי, כמו ברשימת הצ'יפים) - לא ממציאים סדר חדש.
function guideErasInOrder(){
  const cats = (currentGuideCat && catsCache[currentGuideCat.id]) || [];
  const eras = [];
  cats.forEach(c => { if (c.era && !eras.includes(c.era)) eras.push(c.era); });
  return eras;
}
// מכבד את אותו סינון (activeGuideChip/matchesGuideFilters/חיפוש) שכבר חושב ב-renderGuideGrid -
// ציר שלא מכבד את הצ'יפים היה סותר את מה שכתוב בהם.
function renderGuideTimeline(list){
  const eras = guideErasInOrder();
  if (!eras.length){
    guideGrid.innerHTML = '<div class="grid-empty">אין נתוני תקופה למדריך זה.</div>';
    return;
  }
  const flatIdx = [];
  let html = '<div class="timeline">';
  eras.forEach(era => {
    const items = list.filter(e => guideEraOf(e) === era);
    if (!items.length) return;
    html += `<div class="timeline-era">
      <div class="timeline-era-head"><span class="timeline-dot"></span><h3>${esc(era)}</h3><span class="timeline-count">${items.length}</span></div>
      <div class="timeline-items">`;
    items.forEach(entry => { html += entryCardHTML(entry, flatIdx.length); flatIdx.push(entry); });
    html += `</div></div>`;
  });
  html += '</div>';
  guideGrid.innerHTML = html;
  guideGrid.querySelectorAll('.entry-card').forEach(card => {
    const entry = flatIdx[parseInt(card.dataset.idx, 10)];
    card.addEventListener('click', () => openEntryDetail(entry));
  });
  lazyLoadWikiThumbnails(guideGrid);
}
if (guideTimelineToggle) guideTimelineToggle.addEventListener('click', () => {
  guideViewMode = guideViewMode === 'timeline' ? 'grid' : 'timeline';
  guideTimelineToggle.classList.toggle('on', guideViewMode === 'timeline');
  guideTimelineToggle.textContent = guideViewMode === 'timeline' ? '☰ תצוגת רשת' : '🕰️ ציר זמן';
  renderGuideGrid(guideSearchBox.value);
});

// כשאין חיפוש והצ'יפ הפעיל הוא "הכל" - מקבצים לפי הקטגוריות המקוריות של המדריך (בדיוק
// כמו שהיה בכל מדריך בנפרד: כותרת קטגוריה + מספר סידורי + הסבר). אחרת - רשימה שטוחה.
function renderGuideGrid(filterText){
  renderGuideChips();
  const q = normalizeHeb(filterText || '').trim();
  let list = currentGuideData;
  if (activeGuideChip !== 'all') list = list.filter(e => e.cat === activeGuideChip);
  list = list.filter(matchesGuideFilters);
  if (q) list = list.filter(e => normalizeHeb(e.name + ' ' + (e.aliases || []).join(' ')).includes(q));

  if (!list.length){
    guideGrid.innerHTML = '<div class="grid-empty">לא נמצאו תוצאות התואמות את הסינון.</div>';
    return;
  }

  if (guideViewMode === 'timeline' && currentGuideCat && currentGuideCat.id === 'people'){
    renderGuideTimeline(list);
    return;
  }

  const cats = (currentGuideCat && catsCache[currentGuideCat.id]) || [];
  const noExtraFilter = activeGuideEra === 'all' && activeGuideLetter === 'all';
  const groupByCat = activeGuideChip === 'all' && !q && noExtraFilter && cats.length;
  const flatIdx = []; // רשימת (entry) לפי סדר הופעה בפועל ב-DOM, לחיבור הקליקים
  let html = '';
  if (groupByCat){
    cats.forEach(c => {
      const items = list.filter(e => e.cat === c.id);
      if (!items.length) return;
      html += `<div class="entry-section-head"><span class="entry-section-num">${esc(c.num||'')}</span><h3>${esc(c.label)}</h3></div>`;
      items.forEach(entry => { html += entryCardHTML(entry); flatIdx.push(entry); });
    });
    const uncategorized = list.filter(e => !cats.some(c => c.id === e.cat));
    uncategorized.forEach(entry => { html += entryCardHTML(entry); flatIdx.push(entry); });
  } else {
    list.forEach(entry => { html += entryCardHTML(entry); flatIdx.push(entry); });
  }

  // במקומות בלבד: מפת עולם מלאה עם כל ציוני הדרך, בסוף הרשימה (בדיוק כמו במקור,
  // רק שם היא הייתה בהתחלה - כאן מבקשים בסוף). אופלין לגמרי (Natural Earth + Leaflet).
  const isPlaces = currentGuideCat && currentGuideCat.id === 'places' && !q && activeGuideChip === 'all' && noExtraFilter;
  if (isPlaces){
    html += `<div class="entry-section-head" style="grid-column:1/-1;"><span class="entry-section-num">🗺️</span><h3>מפת כל המקומות</h3></div>
      <div id="worldMap" style="grid-column:1/-1;height:420px;border-radius:10px;overflow:hidden;"></div>`;
  }

  guideGrid.innerHTML = html;
  let cardI = 0;
  Array.from(guideGrid.children).forEach(card => {
    if (!card.classList.contains('entry-card')) return;
    const entry = flatIdx[cardI++];
    card.addEventListener('click', () => openEntryDetail(entry));
  });
  lazyLoadWikiThumbnails(guideGrid);

  if (isPlaces && typeof resetWorldMap === 'function'){
    window.DATA = currentGuideData;
    window.CATS = catsCache['places'] || [];
    window.openModal = openEntryDetail;
    resetWorldMap();
    setTimeout(() => { try { initWorldMap(); } catch(e){ console.warn('madaei-hatanach: world map failed', e); } }, 50);
  }
}

guideAddNewBtn.addEventListener('click', () => openGenericProposeForm(''));

// מציג מדריך ישירות בעמוד השער (בלי iframe) - הנתונים כבר נטענים דרך loadGuideData.
async function openGuide(catId, term){
  const cat = CATEGORIES.find(c => c.id === catId);
  if (!cat) return;
  landing.style.display = 'none';
  frameWrap.classList.remove('open');
  resultsOverlay.classList.remove('open');
  guideView.classList.add('open');
  guideViewTitle.textContent = cat.icon + ' ' + cat.label;
  guideSearchBox.value = '';
  activeGuideChip = 'all';
  activeGuideEra = 'all';
  activeGuideLetter = 'all';
  guideViewMode = 'grid';
  if (guideTimelineToggle){
    guideTimelineToggle.style.display = cat.id === 'people' ? '' : 'none';
    guideTimelineToggle.classList.remove('on');
    guideTimelineToggle.textContent = '🕰️ ציר זמן';
  }
  currentGuideCat = cat;
  currentGuideData = await loadGuideData(cat);
  renderGuideGrid('');
  if (term){
    const norm = normalizeHeb(term);
    const match = currentGuideData.find(e => normalizeHeb(e.name) === norm) ||
                  currentGuideData.find(e => (e.aliases||[]).some(a => normalizeHeb(a) === norm));
    if (match) openEntryDetail(match);
  }
}
function closeGuideView(){
  guideView.classList.remove('open');
  landing.style.display = '';
}
guideBackBtn.addEventListener('click', closeGuideView);
guideSearchBox.addEventListener('input', () => renderGuideGrid(guideSearchBox.value));

function closeFrame(){
  frameWrap.classList.remove('open');
  guideFrame.src = 'about:blank';
}
backBtn.addEventListener('click', closeFrame);

// כפתור "חזרה" בתוך כל מדריך רץ בתוך ה-iframe, ולכן משדר הודעה להורה במקום לנווט
// את עצמו (ניווט של ה-iframe עצמו לא בעייתי, אבל עדיף לסגור את המסגרת ולחזור לעמוד הכניסה).
window.addEventListener('message', (ev) => {
  if (ev.data && ev.data.__madaeiHatanachBack) closeFrame();
});

document.querySelectorAll('.card[data-cat]').forEach(card => {
  card.addEventListener('click', () => openGuide(card.dataset.cat, null));
});
