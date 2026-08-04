// האזור האישי — חמש הלשוניות ושליחה למפתח.
// נוצר בפיצול router.js (גרסה 2.11.2). המקור: shell/router.js שורות 2007-2371.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.


// ============================================================
//  האזור האישי
//  אינו מאגר חדש: הוא התצוגה המרוכזת של מה שכבר נשמר במכשיר —
//  סימניות (BOOKMARKS_KEY), עריכות מקומיות (<cat>_edits_v1), טיוטות
//  הצעות (<cat>_nf_drafts_v1), דיווחי זיהוי (identify_error_reports_v1)
//  ודפי ה-HTML השמורים. כך אין סיכון לאבד עריכות קיימות בעדכון גרסה.
// ============================================================
const IDENTIFY_REPORTS_KEY = 'identify_error_reports_v1';
const personalView = document.getElementById('personalView');
const personalBody = document.getElementById('personalBody');
let activePersonalTab = 'bookmarks';

function catLabelOf(catId){
  const c = CATEGORIES.find(x => x.id === catId);
  return c ? (c.icon + ' ' + c.label) : catId;
}

function readJsonLS(key, fallback){
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch(e){ return fallback; }
}

function fmtDate(iso){
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('he-IL', { year:'numeric', month:'2-digit', day:'2-digit' }); }
  catch(e){ return String(iso).slice(0, 10); }
}

async function sendToDev(subject, body){
  if (!hasOtzaria()){
    window.alert('שליחה דורשת פתיחה בתוך אוצריא. אפשר לפנות ישירות ל-' + DEV_EMAIL);
    return false;
  }
  try {
    await Otzaria.call('feedback.sendEmail', { to: DEV_EMAIL, subject: subject, body: body, includeSystemInfo: true });
    await Otzaria.call('notifications.showInApp', { message: 'נשלח, תודה!', type: 'success' }).catch(()=>{});
    return true;
  } catch(e){
    await Otzaria.call('notifications.showInApp', { message: 'שגיאה בשליחה', type: 'error' }).catch(()=>{});
    return false;
  }
}

function openPersonalArea(tab){
  activePersonalTab = tab || activePersonalTab || 'bookmarks';
  document.querySelectorAll('#personalTabs .ptab').forEach(b => {
    b.classList.toggle('active', b.dataset.ptab === activePersonalTab);
  });
  landing.style.display = 'none';
  guideView.classList.remove('open');
  resultsOverlay.classList.remove('open');
  personalView.classList.add('open');
  renderPersonalBody();
}

function closePersonalArea(){
  personalView.classList.remove('open');
  landing.style.display = '';
}

// רענון האזור האישי אחרי פעולה שנעשתה מחוץ לו (מחיקת דף HTML, שמירת עריכה וכו')
function refreshPersonalIfOpen(){
  if (personalView.classList.contains('open')) renderPersonalBody();
}

function personalEmpty(text){
  return '<div class="p-empty">' + esc(text) + '</div>';
}

function personalRow(name, sub, actions){
  const row = document.createElement('div');
  row.className = 'p-row';
  row.innerHTML = '<div class="p-row-main"><div class="p-row-name">' + esc(name) + '</div>'
    + (sub ? '<div class="p-row-sub">' + esc(sub) + '</div>' : '') + '</div>'
    + '<div class="p-actions"></div>';
  const box = row.querySelector('.p-actions');
  (actions || []).forEach(a => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'panel-btn' + (a.secondary ? ' secondary' : '');
    btn.textContent = a.label;
    btn.addEventListener('click', a.onClick);
    box.appendChild(btn);
  });
  return row;
}

function sectionHead(title, countText){
  const d = document.createElement('div');
  d.className = 'p-sec-head';
  d.innerHTML = '<h3>' + esc(title) + '</h3>'
    + (countText ? '<span class="p-count">' + esc(countText) + '</span>' : '');
  return d;
}

// --- איסוף מה שכבר שמור במכשיר ---
function collectEdits(){
  const out = [];
  CATEGORIES.forEach(cat => {
    const edits = readStoredEdits(cat.id);
    Object.keys(edits).forEach(origName => {
      const rec = edits[origName];
      if (rec && rec.entry) out.push({ catId: cat.id, origName: origName, rec: rec });
    });
  });
  return out.sort((a, b) => String(b.rec.savedAt || '').localeCompare(String(a.rec.savedAt || '')));
}

function collectDrafts(){
  const out = [];
  CATEGORIES.forEach(cat => {
    readJsonLS(cat.id + '_nf_drafts_v1', []).forEach((d, i) => {
      out.push({ kind: 'propose', catId: cat.id, idx: i, data: d });
    });
  });
  readJsonLS(IDENTIFY_REPORTS_KEY, []).forEach((r, i) => {
    out.push({ kind: 'report', catId: null, idx: i, data: r });
  });
  return out;
}

function draftBody(d){
  if (d.kind === 'propose'){
    return 'הצעת תוספת למדריך ' + catLabelOf(d.catId)
      + '\nההוספה המוצעת: ' + (d.data.name || '—')
      + '\nהמקור בספרייה: ' + (d.data.source || '—')
      + '\nהערות נוספות: ' + (d.data.notes || '—')
      + '\nנשמר: ' + (d.data.savedAt || '—');
  }
  return 'דיווח טעות בזיהוי'
    + '\nהקטע שנבחר: "' + (d.data.selectedText || '') + '"'
    + '\nמה זוהה:\n' + (d.data.summary || '—')
    + '\nתיאור הטעות: ' + (d.data.note || '—')
    + '\nנשמר: ' + (d.data.savedAt || '—');
}

function deleteDraft(d){
  if (d.kind === 'propose'){
    const key = d.catId + '_nf_drafts_v1';
    const list = readJsonLS(key, []);
    list.splice(d.idx, 1);
    try { localStorage.setItem(key, JSON.stringify(list)); } catch(e){}
  } else {
    const list = readJsonLS(IDENTIFY_REPORTS_KEY, []);
    list.splice(d.idx, 1);
    try { localStorage.setItem(IDENTIFY_REPORTS_KEY, JSON.stringify(list)); } catch(e){}
  }
  renderPersonalBody();
}

async function openEntryByBookmark(catId, key, label){
  const cat = CATEGORIES.find(c => c.id === catId);
  if (!cat) return;
  const data = await loadGuideData(cat);
  const entry = data.find(e => (e.__origName || e.name) === key) || data.find(e => e.name === key);
  if (!entry){
    window.alert('הערך "' + (label || key) + '" לא נמצא במדריך ' + cat.label + '. ייתכן שנמחק או ששמו שונה.');
    return;
  }
  closePersonalArea();
  openGuide(catId, entry.name);
}

// --- רינדור הלשוניות ---
function renderPersonalBody(){
  personalBody.innerHTML = '';
  if (activePersonalTab === 'bookmarks') return renderPersonalBookmarks();
  if (activePersonalTab === 'edits') return renderPersonalEdits();
  if (activePersonalTab === 'drafts') return renderPersonalDrafts();
  if (activePersonalTab === 'pages') return renderPersonalPages();
  if (activePersonalTab === 'feedback') return renderPersonalFeedback();
}

function renderPersonalBookmarks(){
  const list = readBookmarks();
  personalBody.appendChild(sectionHead('⭐ סימניות', list.length ? list.length + ' ערכים' : ''));
  if (!list.length){
    personalBody.insertAdjacentHTML('beforeend',
      personalEmpty('אין עדיין סימניות. בכל כרטיס ערך יש כוכב (☆) בכותרת — לחיצה עליו תוסיף אותו לכאן.'));
    return;
  }
  list.slice().reverse().forEach(b => {
    personalBody.appendChild(personalRow(
      b.label || b.key,
      catLabelOf(b.catId) + (b.addedAt ? ' · נוסף ' + fmtDate(b.addedAt) : ''),
      [
        { label: 'פתיחה', onClick: () => openEntryByBookmark(b.catId, b.key, b.label) },
        { label: 'הסרה', secondary: true, onClick: () => { toggleBookmark(b.catId, b.key, b.label); renderPersonalBody(); } }
      ]
    ));
  });
}

function renderPersonalEdits(){
  const edits = collectEdits();
  personalBody.appendChild(sectionHead('✏️ העריכות שלי', edits.length ? edits.length + ' כרטיסים' : ''));
  if (!edits.length){
    personalBody.insertAdjacentHTML('beforeend',
      personalEmpty('לא ערכתם עדיין אף כרטיס. בכל כרטיס יש כפתור ✏️ לעריכה מקומית — העריכות נשמרות במכשיר ומופיעות כאן.'));
    return;
  }
  const bulk = document.createElement('div');
  bulk.className = 'p-bulk';
  const bulkBtn = document.createElement('button');
  bulkBtn.type = 'button';
  bulkBtn.className = 'panel-btn';
  bulkBtn.textContent = '📧 שליחת כל העריכות למפתח (' + edits.length + ')';
  bulkBtn.addEventListener('click', () => {
    const body = 'עריכות מקומיות מתמונ״ך — ' + edits.length + ' כרטיסים\n\n'
      + edits.map(e => '• ' + e.origName + ' (' + catLabelOf(e.catId) + ') — נשמר ' + fmtDate(e.rec.savedAt)).join('\n')
      + '\n\n--- הנתונים המלאים ---\n'
      + edits.map(e => '### ' + e.origName + ' [' + e.catId + ']\n' + JSON.stringify(e.rec.entry, null, 1)).join('\n\n');
    sendToDev('עריכות מקומיות - תמונ״ך (' + edits.length + ')', body);
  });
  bulk.appendChild(bulkBtn);
  personalBody.appendChild(bulk);

  edits.forEach(e => {
    personalBody.appendChild(personalRow(
      (e.rec.entry && e.rec.entry.name) || e.origName,
      catLabelOf(e.catId) + ' · נשמר ' + fmtDate(e.rec.savedAt)
        + (e.rec.entry && e.rec.entry.name !== e.origName ? ' · במקור: ' + e.origName : ''),
      [
        { label: 'פתיחה', onClick: () => openEntryByBookmark(e.catId, e.origName, e.origName) },
        { label: 'שליחה', secondary: true, onClick: () => sendToDev(
            'עריכת כרטיס - ' + e.origName + ' - תמונ״ך',
            'עריכה מקומית של הכרטיס "' + e.origName + '" במדריך ' + catLabelOf(e.catId)
              + '\nנשמר: ' + (e.rec.savedAt || '—') + '\n\n' + JSON.stringify(e.rec.entry, null, 1)
          ) },
        { label: 'שחזור למקור', secondary: true, onClick: async () => {
            if (!window.confirm('לשחזר את "' + e.origName + '" לגרסת המקור? העריכה שלכם תימחק.')) return;
            const cat = CATEGORIES.find(c => c.id === e.catId);
            const data = cat ? await loadGuideData(cat) : [];
            const entry = data.find(x => (x.__origName || x.name) === e.origName);
            if (entry) restoreEntryToOriginal(e.catId, entry, e.origName);
            else {
              const stored = readStoredEdits(e.catId);
              delete stored[e.origName];
              try { localStorage.setItem(editsKey(e.catId), JSON.stringify(stored)); } catch(err){}
            }
            invalidateLookup(e.catId);
            renderPersonalBody();
          } }
      ]
    ));
  });
}

function renderPersonalDrafts(){
  const drafts = collectDrafts();
  personalBody.appendChild(sectionHead('📝 הצעות ודיווחים שמורים', drafts.length ? drafts.length + ' פריטים' : ''));
  if (!drafts.length){
    personalBody.insertAdjacentHTML('beforeend',
      personalEmpty('אין פריטים שמורים. הצעת ערך חדש ודיווח על טעות בזיהוי נשמרים כאן כשבוחרים ״שמירה במכשיר״.'));
    return;
  }
  const bulk = document.createElement('div');
  bulk.className = 'p-bulk';
  const bulkBtn = document.createElement('button');
  bulkBtn.type = 'button';
  bulkBtn.className = 'panel-btn';
  bulkBtn.textContent = '📧 שליחה מרוכזת של הכל (' + drafts.length + ')';
  bulkBtn.addEventListener('click', async () => {
    const body = 'פריטים שמורים מתמונ״ך — ' + drafts.length + '\n\n'
      + drafts.map((d, i) => (i + 1) + '.\n' + draftBody(d)).join('\n\n');
    const ok = await sendToDev('שליחה מרוכזת - תמונ״ך (' + drafts.length + ' פריטים)', body);
    if (ok && window.confirm('הכל נשלח. למחוק את הפריטים ששמורים במכשיר?')){
      CATEGORIES.forEach(c => { try { localStorage.removeItem(c.id + '_nf_drafts_v1'); } catch(e){} });
      try { localStorage.removeItem(IDENTIFY_REPORTS_KEY); } catch(e){}
      renderPersonalBody();
    }
  });
  bulk.appendChild(bulkBtn);
  personalBody.appendChild(bulk);

  drafts.forEach(d => {
    const title = d.kind === 'propose'
      ? ('➕ ' + (d.data.name || '(ללא שם)'))
      : ('🚩 דיווח זיהוי: "' + (d.data.selectedText || '') + '"');
    const sub = d.kind === 'propose'
      ? (catLabelOf(d.catId) + ' · נשמר ' + fmtDate(d.data.savedAt))
      : ('דיווח טעות · נשמר ' + fmtDate(d.data.savedAt));
    personalBody.appendChild(personalRow(title, sub, [
      { label: 'שליחה', onClick: () => sendToDev(
          d.kind === 'propose' ? ('הצעת תוספת - ' + (d.data.name || '') + ' - תמונ״ך') : 'דיווח טעות בזיהוי - תמונ״ך',
          draftBody(d)
        ) },
      { label: 'מחיקה', secondary: true, onClick: () => {
          if (window.confirm('למחוק את הפריט?')) deleteDraft(d);
        } }
    ]));
  });
}

async function renderPersonalPages(){
  personalBody.appendChild(sectionHead('📄 דפי HTML שמורים', ''));
  const bulk = document.createElement('div');
  bulk.className = 'p-bulk';
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'panel-btn';
  addBtn.textContent = '➕ הוספת דף HTML';
  addBtn.addEventListener('click', openAddHtmlPanel);
  bulk.appendChild(addBtn);
  personalBody.appendChild(bulk);

  const index = await getHtmlPagesIndex();
  if (!index.length){
    personalBody.insertAdjacentHTML('beforeend',
      personalEmpty('אין עדיין דפים שמורים. דף שנוסף כאן נשמר לצמיתות ומקבל ריבוע משלו בעמוד השער.'));
    return;
  }
  index.forEach(name => {
    personalBody.appendChild(personalRow(name, 'דף HTML שמור', [
      { label: 'פתיחה', onClick: () => { closePersonalArea(); openCustomHtmlPage(name); } },
      { label: 'שליחה', secondary: true, onClick: async () => {
          const content = await storageGet('madaei_html_page__' + name);
          sendToDev('דף HTML מצורף מתמונ״ך - ' + name,
            'המשתמש הוסיף דף HTML בשם "' + name + '" (תמונ״ך).\n\nתוכן הדף:\n\n' + (content || ''));
        } },
      { label: 'מחיקה', secondary: true, onClick: async () => {
          if (!window.confirm('למחוק את "' + name + '"?')) return;
          const idx2 = await getHtmlPagesIndex();
          await storageSet(HTML_PAGES_INDEX_KEY, idx2.filter(n => n !== name));
          await storageSet('madaei_html_page__' + name, null);
          renderCustomPageCards();
          renderPersonalBody();
        } }
    ]));
  });
}

function renderPersonalFeedback(){
  personalBody.appendChild(sectionHead('💬 משוב והערות למפתח', ''));
  const wrap = document.createElement('div');
  wrap.innerHTML = '<p class="mini-note" style="margin-top:0">'
    + 'אפשר להעיר על כל דבר — טעות בערך, רעיון לשיפור, או סתם לומר תודה. '
    + 'ההודעה נשלחת במייל דרך אוצריא.</p>';
  const ta = document.createElement('textarea');
  ta.placeholder = 'כתבו כאן את ההערה שלכם...';
  wrap.appendChild(ta);
  const row = document.createElement('div');
  row.className = 'p-bulk';
  row.style.marginTop = '12px';
  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'panel-btn';
  send.textContent = '📧 שליחה למפתח';
  send.addEventListener('click', async () => {
    const body = ta.value.trim();
    if (!body) return;
    const ok = await sendToDev('משוב - תמונ״ך', body);
    if (ok) ta.value = '';
  });
  row.appendChild(send);
  wrap.appendChild(row);
  personalBody.appendChild(wrap);
}

document.getElementById('personalCard').addEventListener('click', () => openPersonalArea('bookmarks'));
document.getElementById('personalBackBtn').addEventListener('click', closePersonalArea);
document.querySelectorAll('#personalTabs .ptab').forEach(btn => {
  btn.addEventListener('click', () => openPersonalArea(btn.dataset.ptab));
});
