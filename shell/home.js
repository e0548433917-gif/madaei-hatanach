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
let homeSearchActiveIdx = -1;
let homeSearchRows = [];

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

function closeHomeDrop(){
  homeSearchDrop.classList.remove('open');
  homeSearchActiveIdx = -1;
  homeSearchRows = [];
}

function renderHomeDrop(){
  const q = homeSearch.value.trim();
  const hits = searchEntriesByName(q, 12);
  if (!hits.length){ closeHomeDrop(); return; }
  homeSearchRows = hits;
  homeSearchActiveIdx = -1;
  homeSearchDrop.innerHTML = hits.map((h, i) => {
    const viaNote = (normalizeHeb(h.via) !== normalizeHeb(h.name)) ? ' <span class="hs-cat">(' + esc(h.via) + ')</span>' : '';
    return `<div class="hs-row" data-i="${i}">
      <span>${h.catIcon}</span>
      <span class="hs-name">${esc(h.name)}</span>${viaNote}
      <span class="hs-cat">${esc(h.catLabel)}</span>
    </div>`;
  }).join('') + '<div class="hs-note">Enter — זיהוי מלא של כל הטקסט שבשורה (גם פסוק שלם)</div>';
  homeSearchDrop.querySelectorAll('.hs-row').forEach(row => {
    row.addEventListener('click', () => {
      const h = homeSearchRows[parseInt(row.dataset.i, 10)];
      if (h) pickHomeSuggestion(h);
    });
  });
  homeSearchDrop.classList.add('open');
}

function pickHomeSuggestion(h){
  closeHomeDrop();
  homeSearch.value = '';
  openGuide(h.catId, h.name);
}

async function runHomeIdentify(){
  const text = homeSearch.value.trim();
  if (!text) return;
  closeHomeDrop();
  homeSearchBtn.disabled = true;
  const label = homeSearchBtn.textContent;
  homeSearchBtn.textContent = '…';
  try {
    const matches = await identify(text);
    showResults(matches, text);
  } finally {
    homeSearchBtn.disabled = false;
    homeSearchBtn.textContent = label;
  }
}

if (homeSearch){
  let homeSearchTimer = null;
  homeSearch.addEventListener('input', () => {
    clearTimeout(homeSearchTimer);
    homeSearchTimer = setTimeout(renderHomeDrop, 140);
  });
  homeSearch.addEventListener('keydown', (ev) => {
    const rows = homeSearchDrop.querySelectorAll('.hs-row');
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp'){
      if (!rows.length) return;
      ev.preventDefault();
      homeSearchActiveIdx += (ev.key === 'ArrowDown' ? 1 : -1);
      if (homeSearchActiveIdx < 0) homeSearchActiveIdx = rows.length - 1;
      if (homeSearchActiveIdx >= rows.length) homeSearchActiveIdx = 0;
      rows.forEach((r, i) => r.classList.toggle('active', i === homeSearchActiveIdx));
      rows[homeSearchActiveIdx].scrollIntoView({ block: 'nearest' });
      return;
    }
    if (ev.key === 'Enter'){
      ev.preventDefault();
      if (homeSearchActiveIdx >= 0 && homeSearchRows[homeSearchActiveIdx]){
        pickHomeSuggestion(homeSearchRows[homeSearchActiveIdx]);
      } else {
        runHomeIdentify();
      }
      return;
    }
    if (ev.key === 'Escape') closeHomeDrop();
  });
  homeSearchBtn.addEventListener('click', runHomeIdentify);
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('#homeSearchWrap')) closeHomeDrop();
  });
}
