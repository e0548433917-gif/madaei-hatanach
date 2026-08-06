// עמוד השער: דפי HTML שמורים, ריבועיהם, ושורת החיפוש העליונה.
// נוצר בפיצול router.js (גרסה 2.11.2). המקור: shell/router.js שורות 1455-1466, 1479-1583, 1882-2006.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.


// ---- משוב והערות ----
// חלונית המשוב הנפרדת בוטלה: לשונית ״משוב״ באזור האישי (renderPersonalFeedback)
// היא הכניסה היחידה, והשליחה עצמה עוברת דרך sendToDev.

// ---- הוספת דף HTML (נשמר לצמיתות דרך storage.get/set, כמו בתוסף "צופה HTML") ----
const addHtmlOverlay = document.getElementById('addHtmlOverlay');
const addHtmlName = document.getElementById('addHtmlName');
const addHtmlFile = document.getElementById('addHtmlFile');
const savedHtmlList = document.getElementById('savedHtmlList');
let pendingHtmlContent = null;


async function renderSavedHtmlList(){
  const index = await getHtmlPagesIndex();
  savedHtmlList.innerHTML = '';
  if (!index.length){
    savedHtmlList.innerHTML = '<div class="mini-note">אין עדיין דפים שמורים.</div>';
    return;
  }
  for (const name of index){
    const row = document.createElement('div');
    row.className = 'saved-html-row';
    row.innerHTML = `<span>${name}</span>
      <span>
        <button class="panel-btn" data-open>פתיחה</button>
        <button class="panel-btn secondary" data-send>שליחה למפתח</button>
        <button class="panel-btn secondary" data-del>מחיקה</button>
      </span>`;
    row.querySelector('[data-open]').addEventListener('click', () => openCustomHtmlPage(name));
    row.querySelector('[data-send]').addEventListener('click', async () => {
      const content = await storageGet('madaei_html_page__' + name);
      if (!hasOtzaria()) { window.alert('שליחה דורשת פתיחה בתוך אוצריא.'); return; }
      try {
        await Otzaria.call('feedback.sendEmail', {
          to: DEV_EMAIL, subject: 'דף HTML מצורף מתמונ״ך - ' + name,
          body: 'המשתמש הוסיף דף HTML בשם "' + name + '" (תמונ״ך).\n\nתוכן הדף מצורף למטה:\n\n' + (content || ''),
          includeSystemInfo: true
        });
        await Otzaria.call('notifications.showInApp', { message: 'נשלח למפתח, תודה!', type: 'success' }).catch(()=>{});
      } catch(e){
        await Otzaria.call('notifications.showInApp', { message: 'שגיאה בשליחה', type: 'error' }).catch(()=>{});
      }
    });
    row.querySelector('[data-del]').addEventListener('click', async () => {
      if (!window.confirm('למחוק את "' + name + '"?')) return;
      const idx2 = await getHtmlPagesIndex();
      await storageSet(HTML_PAGES_INDEX_KEY, idx2.filter(n => n !== name));
      await storageSet('madaei_html_page__' + name, null);
      renderSavedHtmlList();
      renderCustomPageCards();
      refreshPersonalIfOpen();
    });
    savedHtmlList.appendChild(row);
  }
}

async function openCustomHtmlPage(name){
  const content = await storageGet('madaei_html_page__' + name);
  if (content == null){ window.alert('לא נמצא תוכן שמור עבור "' + name + '"'); return; }
  guideFrame.removeAttribute('src');
  guideFrame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms allow-modals');
  guideFrame.srcdoc = content;
  frameTitle.textContent = '📄 ' + name;
  frameWrap.classList.add('open');
  addHtmlOverlay.classList.remove('open');
  resultsOverlay.classList.remove('open');
}

function openAddHtmlPanel(){
  addHtmlOverlay.classList.add('open');
  renderSavedHtmlList();
}
document.getElementById('addHtmlClose').addEventListener('click', () => {
  addHtmlOverlay.classList.remove('open');
});
addHtmlFile.addEventListener('change', () => {
  const file = addHtmlFile.files && addHtmlFile.files[0];
  if (!file) return;
  if (!addHtmlName.value.trim()) addHtmlName.value = file.name.replace(/\.html?$/i, '');
  const reader = new FileReader();
  reader.onload = () => { pendingHtmlContent = reader.result; };
  reader.readAsText(file);
});
document.getElementById('addHtmlSave').addEventListener('click', async () => {
  const name = addHtmlName.value.trim();
  if (!name){ window.alert('יש לתת שם לדף'); return; }
  if (!pendingHtmlContent){ window.alert('יש לבחור קובץ HTML'); return; }
  if (!hasOtzaria()){ window.alert('שמירה קבועה דורשת פתיחה בתוך אוצריא.'); return; }
  const index = await getHtmlPagesIndex();
  if (!index.includes(name)) index.push(name);
  await storageSet(HTML_PAGES_INDEX_KEY, index);
  await storageSet('madaei_html_page__' + name, pendingHtmlContent);
  addHtmlName.value = '';
  addHtmlFile.value = '';
  pendingHtmlContent = null;
  await Otzaria.call('notifications.showInApp', { message: 'הדף נשמר לצמיתות', type: 'success' }).catch(()=>{});
  renderSavedHtmlList();
  renderCustomPageCards();
  refreshPersonalIfOpen();
});

// ---- ריבועים בעמוד השער עבור דפי HTML שנשמרו ----
// מאז 2.12.0 הכרטיסים האלה יושבים בשורה השנייה (#extraGrid) יחד עם האזור האישי,
// כדי ששורת ששת המדריכים תישאר 3+3 מלאה ולא תיקטע בכל פעם שנוסף דף.
const extraGrid = document.getElementById('extraGrid');
async function renderCustomPageCards(){
  extraGrid.querySelectorAll('.card[data-custom-page]').forEach(el => el.remove());
  const index = await getHtmlPagesIndex();
  const anchor = document.getElementById('personalCard');   // הכרטיסים נכנסים לפני "האזור האישי"
  index.forEach(name => {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-custom-page', name);
    card.innerHTML = `<span class="icon">📄</span><span class="label">${esc(name)}</span>`;
    card.addEventListener('click', () => openCustomHtmlPage(name));
    extraGrid.insertBefore(card, anchor);
  });
}

// ============================================================
//  שורת החיפוש בעמוד השער
//  אותו מנוע בדיוק של תפריט ההקשר בספרייה: הקלדה קצרה = השלמה חיה משמות
//  הערכים והכינויים שכבר נטענו לזיכרון; Enter/״זיהוי״ = identify() מלא, כך
//  שאפשר להדביק פסוק שלם ולקבל את כל הדצח״מ שבו.
// ============================================================
const homeSearch = document.getElementById('homeSearch');
const homeSearchBtn = document.getElementById('homeSearchBtn');
const homeSearchDrop = document.getElementById('homeSearchDrop');

// חיפוש בשמות ובכינויים בכל המדריכים שכבר נטענו (preloadAllGuides טוען אותם ברקע).
// התאמת תחילית מדורגת לפני התאמת תת-מחרוזת.
function searchEntriesByName(q, limit){
  const norm = normalizeHeb(q);
  if (norm.length < 2) return [];
  const starts = [], contains = [];
  for (const cat of CATEGORIES){
    const data = dataCache[cat.id];
    if (!data) continue;
    for (const e of data){
      const names = [e.name].concat(e.aliases || []);
      let via = null, isStart = false;
      for (const n of names){
        const nn = normalizeHeb(n);
        if (!nn) continue;
        if (nn.indexOf(norm) === 0){ via = n; isStart = true; break; }
        if (!via && nn.indexOf(norm) !== -1) via = n;
      }
      if (!via) continue;
      (isStart ? starts : contains).push({
        catId: cat.id, catLabel: cat.label, catIcon: cat.icon, name: e.name, via: via
      });
    }
  }
  return starts.concat(contains).slice(0, limit || 12);
}

// ההתנהגות הזו זהה בשער ובתוך כל מדריך, ולכן היא פונקציה אחת ולא שני עותקים (2.12.0):
//   input · drop · btn (אופציונלי) · wrapSel (לסגירה בלחיצה בחוץ) · preferCat
//   onBeforePick — נקרא לפני מעבר למדריך, כדי שכל שורה תנקה את מה ששייך לה.
// המדריך הפעיל (preferCat) עולה לראש ההשלמות, כי מי שמחפש בתוך ״אישים״ מתכוון
// כמעט תמיד לאישים — אבל ההשלמות מכל המדריכים נשארות, בדיוק כמו בשער.
function attachLiveSearch(opts){
  const input = opts.input, drop = opts.drop, btn = opts.btn || null;
  if (!input || !drop) return null;
  let rows = [], activeIdx = -1, timer = null;

  function close(){
    drop.classList.remove('open');
    drop.innerHTML = '';
    rows = []; activeIdx = -1;
  }

  function render(){
    let hits = searchEntriesByName(input.value.trim(), 12);
    const prefer = opts.preferCat && opts.preferCat();
    if (prefer && hits.length){
      hits = hits.filter(h => h.catId === prefer).concat(hits.filter(h => h.catId !== prefer));
    }
    if (!hits.length){ close(); return; }
    rows = hits; activeIdx = -1;
    drop.innerHTML = hits.map((h, i) => {
      const viaNote = (normalizeHeb(h.via) !== normalizeHeb(h.name)) ? ' <span class="hs-cat">(' + esc(h.via) + ')</span>' : '';
      return `<div class="hs-row" data-i="${i}">
        <span>${h.catIcon}</span>
        <span class="hs-name">${esc(h.name)}</span>${viaNote}
        <span class="hs-cat">${esc(h.catLabel)}</span>
      </div>`;
    }).join('') + '<div class="hs-note">Enter — זיהוי מלא של כל הטקסט שבשורה (גם פסוק שלם)</div>';
    drop.querySelectorAll('.hs-row').forEach(row => {
      row.addEventListener('click', () => {
        const h = rows[parseInt(row.dataset.i, 10)];
        if (h) pick(h);
      });
    });
    drop.classList.add('open');
  }

  function pick(h){
    close();
    input.value = '';
    if (opts.onBeforePick) opts.onBeforePick();
    openGuide(h.catId, h.name);
  }

  async function runIdentify(){
    const text = input.value.trim();
    if (!text) return;
    close();
    let label = null;
    if (btn){ btn.disabled = true; label = btn.textContent; btn.textContent = '…'; }
    try {
      const matches = await identify(text);
      showResults(matches, text);
    } finally {
      if (btn){ btn.disabled = false; btn.textContent = label; }
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(render, 140);
  });
  input.addEventListener('keydown', (ev) => {
    const els = drop.querySelectorAll('.hs-row');
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp'){
      if (!els.length) return;
      ev.preventDefault();
      activeIdx += (ev.key === 'ArrowDown' ? 1 : -1);
      if (activeIdx < 0) activeIdx = els.length - 1;
      if (activeIdx >= els.length) activeIdx = 0;
      els.forEach((r, i) => r.classList.toggle('active', i === activeIdx));
      els[activeIdx].scrollIntoView({ block: 'nearest' });
      return;
    }
    if (ev.key === 'Enter'){
      ev.preventDefault();
      if (activeIdx >= 0 && rows[activeIdx]) pick(rows[activeIdx]);
      else runIdentify();
      return;
    }
    if (ev.key === 'Escape') close();
  });
  if (btn) btn.addEventListener('click', runIdentify);
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest(opts.wrapSel)) close();
  });
  return { close: close, identify: runIdentify };
}

attachLiveSearch({
  input: homeSearch, drop: homeSearchDrop, btn: homeSearchBtn, wrapSel: '#homeSearchWrap'
});

// אותה שורה בדיוק בתוך כל מדריך. הסינון החי של הרשת (guides.js) נשאר כפי שהיה —
// כאן רק נוספו ההשלמה החיה וה-Enter שמריץ זיהוי מלא על הטקסט שבשורה.
attachLiveSearch({
  input: guideSearchBox,
  drop: document.getElementById('guideSearchDrop'),
  btn: document.getElementById('guideIdentifyBtn'),
  wrapSel: '#guideSearchWrap, #guideIdentifyBtn',
  preferCat: () => currentGuideCat && currentGuideCat.id
});

// ============================================================
//  "ערך היום" (2.10א): מאורעות התנ״ך לפי התאריך העברי של היום, מתוך
//  TANAKH_DATE_EVENTS (guides/_shared/dates.js). דאטה קבועה, בלי רשת.
// ============================================================
const dailyEventCard = document.getElementById('dailyEventCard');
const dailyEventLabel = document.getElementById('dailyEventLabel');
const dailyEventOverlay = document.getElementById('dailyEventOverlay');
const dailyEventBody = document.getElementById('dailyEventBody');

function dateEventRow(ev, monthLabel){
  return `<div class="src-item"><div class="src-source">${esc(ev.day)}' ${esc(monthLabel)} — ${esc(ev.event)}</div>`
    + (ev.source ? `<div class="src-note">${esc(ev.source)}</div>` : '') + `</div>`;
}
function renderDailyEventBody(){
  const t = todayHebrew();
  const today = eventsForToday();
  let html = `<p class="panel-hint">היום ${esc(t.dayLetters)}' ${esc(t.monthName)}</p>`;
  if (today.length){
    html += '<div class="field-label">מאורעות התנ״ך היום</div>' + today.map(ev => dateEventRow(ev, t.monthName)).join('');
  } else {
    html += '<p class="mini-note">אין מאורע תנ״ך רשום לתאריך זה ברשימה (חלקית - ר׳ הרשימה המלאה למטה).</p>';
  }
  html += '<div class="field-label" style="margin-top:16px;">כל מאורעות התנ״ך לפי חודש</div>';
  HEBREW_MONTHS_ORDER.forEach(month => {
    const items = TANAKH_DATE_EVENTS.filter(e => e.month === month);
    if (!items.length) return;
    html += `<details class="month-details"><summary>${esc(month)} (${items.length})</summary>`
      + items.map(ev => dateEventRow(ev, month)).join('') + '</details>';
  });
  dailyEventBody.innerHTML = html;
}
if (dailyEventLabel){
  const t = todayHebrew();
  dailyEventLabel.textContent = 'ערך היום — ' + t.dayLetters + "' " + t.monthName;
}
if (dailyEventCard) dailyEventCard.addEventListener('click', () => {
  renderDailyEventBody();
  dailyEventOverlay.classList.add('open');
});
document.getElementById('dailyEventClose').addEventListener('click', () => {
  dailyEventOverlay.classList.remove('open');
});
