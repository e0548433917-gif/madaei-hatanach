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

// ============================================================
//  4.1 — ממסר הדיווחים (2.13.2)
//  שלושה תנאים מחייבים: לא מייל · לא קישור חיצוני · לא ליפול כשאין רשת.
//
//  המסלול (ר' docs/הקמת-ממסר-דיווחים.md):
//    התוסף ──POST──> docs.google.com/.../formResponse   (פתוח בנטפרי)
//                          └─> גיליון ─> טריגר Apps Script ─> GitHub Issue
//  הטריגר רץ על שרתי גוגל, ולכן api.github.com לא נוגע ברשת של המשתמש כלל,
//  ואין טוקן ואין סוד משותף בתוך החבילה.
//
//  ה-POST הוא "בקשה פשוטה" (x-www-form-urlencoded) ולכן אין CORS preflight.
//  גוגל לא מחזירה תשובה שניתן לקרוא (mode:'no-cors'), ולכן "הצלחה" מוגדרת
//  כ**הבקשה לא זרקה חריגה** — ומכאן שה-outbox חובה: הפריט נמחק מהתור רק
//  אחרי שליחה שלא זרקה, ואם זרקה הוא נשאר לניסיון הבא בפתיחה הבאה.
// ============================================================
const REPORT_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd7NiGDUahnwpaestosEcDxPJoAkYXzVRUa2yB5EiXkLPSWvQ/formResponse';
const REPORT_FIELD_KIND    = 'entry.1407711891';   // סוג
const REPORT_FIELD_TITLE   = 'entry.261441606';    // כותרת
const REPORT_FIELD_DETAILS = 'entry.1548335987';   // פרטים
const REPORT_FIELD_ENV     = 'entry.932826683';    // סביבה
const REPORT_OUTBOX_KEY = 'madaei_report_outbox_v1';
const REPORT_OUTBOX_MAX = 20;             // מעבר לזה — הישן ביותר נמחק
const REPORT_SEND_TIMEOUT_MS = 8000;      // שלא תישאר בקשה תלויה
const REPORT_TITLE_MAX = 120;             // הטריגר חותך ל-120 בכותרת ה-Issue
const REPORT_DETAILS_MAX = 6000;
const REPORT_FLUSH_DELAY_MS = 4000;       // אחרי שהתוסף כבר שימושי
const REPORT_KINDS = [
  { id: 'באג בקוד',   label: '🐞 באג בקוד — משהו בתוסף לא עובד' },
  { id: 'טעות בתוכן', label: '📖 טעות בתוכן — פרט לא נכון בערך' },
  { id: 'הצעה',       label: '💡 הצעה — רעיון לשיפור' }
];
// כתובת הדיווחים הידנית — למי שמעדיף לפתוח Issue בעצמו, או שהשליחה אצלו חסומה.
// לא נפתחת בניווט ישיר אלא דרך data-external-link ⇒ confirmOpenExternal (refs.js).
const REPORT_ISSUES_URL = 'https://github.com/e0548433917-gif/madaei-hatanach/issues';

// התור נשמר ב-plugin.storage כשיש אוצריא (שורד עדכון גרסה), ובדפדפן חשוף
// נופל ל-localStorage כדי שגם בדיקה מחוץ לאוצריא תתנהג אותו דבר.
function reportOutboxRead(){
  if (hasOtzaria()) return storageGetJson(REPORT_OUTBOX_KEY).then(v => Array.isArray(v) ? v : []);
  const v = readJsonLS(REPORT_OUTBOX_KEY, []);
  return Promise.resolve(Array.isArray(v) ? v : []);
}
function reportOutboxWrite(list){
  if (hasOtzaria()) return storageSetJson(REPORT_OUTBOX_KEY, list);
  try { localStorage.setItem(REPORT_OUTBOX_KEY, JSON.stringify(list)); } catch(e){}
  return Promise.resolve(true);
}

// "סביבה" — גרסת התוסף מהמניפסט שנארז (לא קבוע בקוד שיתיישן) + גרסת אוצריא.
let reportEnvCache = null;
async function reportEnv(){
  if (reportEnvCache) return reportEnvCache;
  let plug = '—', otz = '—';
  try {
    const res = await fetch('manifest.json', { cache: 'no-store' });
    if (res && res.ok){ const m = JSON.parse(await res.text()); if (m && m.version) plug = String(m.version); }
  } catch(e){}
  if (hasOtzaria()){
    try {
      const res = await Otzaria.call('app.getInfo');
      const v = res && res.data && res.data.version;
      if (v) otz = String(v);
    } catch(e){}
  }
  reportEnvCache = 'תמונ״ך ' + plug + ' · אוצריא ' + otz;
  return reportEnvCache;
}

function reportNotify(message, type){
  if (hasOtzaria()){
    Otzaria.call('notifications.showInApp', { message: message, type: type || 'success' })
      .catch(() => { try { window.alert(message); } catch(e){} });
    return;
  }
  try { window.alert(message); } catch(e){}
}

// זורק חריגה אם השליחה נכשלה — וזו ההגדרה היחידה שיש לנו ל"נכשל".
// גוף URLSearchParams מייצר לבדו Content-Type: application/x-www-form-urlencoded
// — בדיוק מה שנדרש, ובלי להוסיף כותרת ידנית שתפסול את הבקשה הפשוטה.
function postReportToRelay(item, env){
  const body = new URLSearchParams();
  body.set(REPORT_FIELD_KIND, item.kind || 'דיווח');
  body.set(REPORT_FIELD_TITLE, item.title || 'דיווח מהתוסף');
  body.set(REPORT_FIELD_DETAILS, item.details || '');
  body.set(REPORT_FIELD_ENV, env || item.env || '');
  const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  const timer = setTimeout(() => { try { ctrl && ctrl.abort(); } catch(e){} }, REPORT_SEND_TIMEOUT_MS);
  return fetch(REPORT_FORM_URL, {
    method: 'POST',
    mode: 'no-cors',
    body: body,
    signal: ctrl ? ctrl.signal : undefined
  }).then(
    () => { clearTimeout(timer); return true; },
    err => { clearTimeout(timer); throw err; }
  );
}

function newReportItem(kind, title, details, env){
  return {
    id: 'r' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    kind: kind || 'דיווח',
    title: String(title == null ? '' : title).trim().slice(0, REPORT_TITLE_MAX) || 'דיווח מהתוסף',
    details: String(details == null ? '' : details).slice(0, REPORT_DETAILS_MAX),
    env: env || '',
    savedAt: new Date().toISOString()
  };
}

async function queueReport(item){
  const list = await reportOutboxRead();
  list.push(item);
  while (list.length > REPORT_OUTBOX_MAX) list.shift();   // הישן ביותר נופל
  await reportOutboxWrite(list);
}

async function removeFromOutbox(id){
  const list = (await reportOutboxRead()).filter(x => x && x.id !== id);
  await reportOutboxWrite(list);
  return list;
}

// שליחה יזומה של המשתמש: קודם לתור, ורק אחר כך ניסיון רשת.
// מחזירה true רק אם הבקשה לא זרקה — "נכנס לתור" אינו "נשלח".
async function sendReport(kind, title, details){
  const env = await reportEnv();
  const item = newReportItem(kind, title, details, env);
  await queueReport(item);
  try {
    await postReportToRelay(item, env);
  } catch(e){
    // כמו בתוסף "ביוגרפיות" — המשתמש שלחץ "שליחה" מקבל תשובה, לא שקט.
    // ההבדל: כאן הדיווח לא אבד, ולכן ההודעה מרגיעה ולא מבקשת לנסות שוב.
    reportNotify('אין כרגע חיבור לרשת — הדיווח נשמר במכשיר ויישלח אוטומטית בפתיחה הבאה של התוסף.', 'error');
    refreshPersonalIfOpen();
    return false;
  }
  await removeFromOutbox(item.id);
  reportNotify('נשלח, תודה!', 'success');
  refreshPersonalIfOpen();
  return true;
}

// ריקון התור. ברקע (בפתיחת התוסף) — שקט מוחלט, בלי שום הודעה.
// הכישלון הראשון עוצר: אם אין רשת, אין טעם לנסות את השאר.
let reportFlushBusy = false;
async function flushReportOutbox(opts){
  const announce = !!(opts && opts.announce);
  if (reportFlushBusy) return { sent: 0, left: -1 };
  reportFlushBusy = true;
  let sent = 0, failed = false;
  try {
    let list = await reportOutboxRead();
    if (!list.length) return { sent: 0, left: 0 };
    const env = await reportEnv();
    for (const item of list.slice()){
      if (!item || !item.id) continue;
      try { await postReportToRelay(item, item.env || env); }
      catch(e){ failed = true; break; }
      sent++;
      list = await removeFromOutbox(item.id);
    }
    if (announce){
      if (sent) reportNotify(sent === 1 ? 'הדיווח הממתין נשלח, תודה!' : (sent + ' הדיווחים הממתינים נשלחו, תודה!'), 'success');
      else if (failed) reportNotify('אין כרגע חיבור לרשת — הדיווחים נשארו שמורים וייבדקו שוב מאוחר יותר.', 'error');
    }
    return { sent: sent, left: list.length };
  } catch(e){
    return { sent: sent, left: -1 };          // שקט מוחלט
  } finally {
    reportFlushBusy = false;
    if (sent) refreshPersonalIfOpen();
  }
}

// ---- הורדה לקובץ ושליחה ידנית אחר כך ----
// לא כל סביבה מרשה הורדה מתוך WebView, ולכן יש נפילה מדורגת:
// הורדה אמיתית → העתקה ללוח → חלון עם הטקסט לבחירה ידנית. בכל מקרה
// המשתמש נשאר עם הטקסט ביד, ועם הכתובת שאליה אפשר להדביק אותו.
function reportItemToText(item){
  return [
    'דיווח מתוסף תמונ״ך',
    'סוג: ' + (item.kind || '—'),
    'כותרת: ' + (item.title || '—'),
    'סביבה: ' + (item.env || '—'),
    'נשמר: ' + (item.savedAt || '—'),
    '',
    item.details || '',
    '',
    '— אפשר להדביק את הטקסט הזה כדיווח חדש ב-' + REPORT_ISSUES_URL
  ].join('\n');
}

function copyReportText(text){
  if (navigator.clipboard && navigator.clipboard.writeText){
    return navigator.clipboard.writeText(text).then(() => true, () => false);
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-1000px;';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return Promise.resolve(!!ok);
  } catch(e){ return Promise.resolve(false); }
}

function saveReportsToFile(items, baseName){
  const text = (items || []).map(reportItemToText).join('\n\n==============================\n\n');
  const name = (baseName || 'דיווח-תמונך') + '-' + new Date().toISOString().slice(0, 10) + '.txt';
  try {
    const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch(e){} }, 4000);
    reportNotify('הקובץ ירד: ' + name + '. אפשר לשלוח אותו מתי שנוח.', 'success');
    return Promise.resolve(true);
  } catch(e){
    return copyReportText(text).then(ok => {
      if (ok) reportNotify('ההורדה חסומה כאן — הדיווח הועתק ללוח. אפשר להדביק אותו ב-' + REPORT_ISSUES_URL, 'success');
      else window.prompt('העתיקו את הטקסט ושלחו אותו ב-' + REPORT_ISSUES_URL, text);
      return ok;
    });
  }
}

// ---- המודאל ----
function buildReportPanel(){
  const ov = document.createElement('div');
  ov.className = 'panel-overlay';
  ov.id = 'reportPanelOverlay';
  ov.setAttribute('dir', 'rtl');
  ov.innerHTML = '<div class="panel-box">'
    + '<h2>🐞 דיווח למפתח</h2>'
    + '<p class="panel-hint">הדיווח נשלח ישירות מתוך התוסף — בלי מייל ובלי לצאת לדפדפן. '
    +   'אם אין כרגע חיבור לרשת, הוא נשמר במכשיר ונשלח לבד בפתיחה הבאה.</p>'
    + '<select id="reportKind" aria-label="סוג הדיווח">'
    +   REPORT_KINDS.map(k => '<option value="' + esc(k.id) + '">' + esc(k.label) + '</option>').join('')
    + '</select>'
    + '<input type="text" id="reportTitle" maxlength="' + REPORT_TITLE_MAX + '" placeholder="כותרת קצרה — במשפט אחד">'
    + '<textarea id="reportDetails" placeholder="מה קרה? איפה? מה ציפיתם שיקרה? ככל שיהיה מפורט יותר — כך קל יותר לתקן."></textarea>'
    + '<div class="panel-actions">'
    +   '<button class="panel-btn" type="button" id="reportSend">📨 שליחה</button>'
    +   '<button class="panel-btn secondary" type="button" id="reportDownload">💾 הורדה לקובץ</button>'
    +   '<button class="panel-btn secondary" type="button" id="reportPanelClose">סגירה</button>'
    + '</div>'
    + '<p class="panel-hint" style="margin-top:12px;">'
    +   'מעדיפים לשלוח בעצמכם? ״הורדה לקובץ״ שומרת את הדיווח כקובץ טקסט (ואם ההורדה '
    +   'חסומה — מעתיקה אותו ללוח), ואפשר לפתוח אתו דיווח ידני בכל עת בכתובת:<br>'
    +   '<a href="#" data-external-link="' + esc(REPORT_ISSUES_URL) + '" '
    +      'style="color:var(--color-link);text-decoration:underline;">' + esc(REPORT_ISSUES_URL) + '</a>'
    + '</p></div>';
  document.body.appendChild(ov);
  // הפאנל נוצר בזמן ריצה ולכן אינו נתפס במאזין הכללי של .panel-overlay ב-results-ui.js
  ov.addEventListener('click', ev => { if (ev.target === ov) closeReportPanel(); });
  ov.querySelector('#reportPanelClose').addEventListener('click', closeReportPanel);
  ov.querySelector('#reportSend').addEventListener('click', submitReportPanel);
  ov.querySelector('#reportDownload').addEventListener('click', () => {
    const kind = ov.querySelector('#reportKind').value;
    const title = ov.querySelector('#reportTitle').value.trim();
    const details = ov.querySelector('#reportDetails').value;
    if (!title && !details.trim()){ window.alert('אין מה להוריד — הדיווח ריק.'); return; }
    reportEnv().then(env => {
      const item = newReportItem(kind, title || 'דיווח מהתוסף', details, env);
      saveReportsToFile([item], 'דיווח-תמונך');
    });
  });
  return ov;
}

function closeReportPanel(){
  const ov = document.getElementById('reportPanelOverlay');
  if (ov) ov.classList.remove('open');
}

function openReportPanel(preset){
  const ov = document.getElementById('reportPanelOverlay') || buildReportPanel();
  const kind = ov.querySelector('#reportKind');
  const title = ov.querySelector('#reportTitle');
  const details = ov.querySelector('#reportDetails');
  if (preset && preset.kind) kind.value = preset.kind;
  if (preset && preset.title != null) title.value = preset.title;
  if (preset && preset.details != null) details.value = preset.details;
  ov.classList.add('open');
  setTimeout(() => { try { title.focus(); } catch(e){} }, 30);
}

async function submitReportPanel(){
  const ov = document.getElementById('reportPanelOverlay');
  if (!ov) return;
  const btn = ov.querySelector('#reportSend');
  const title = ov.querySelector('#reportTitle');
  const details = ov.querySelector('#reportDetails');
  if (!title.value.trim()){ window.alert('יש לכתוב כותרת קצרה לדיווח.'); title.focus(); return; }
  if (btn.disabled) return;
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'שולח…';
  try {
    await sendReport(ov.querySelector('#reportKind').value, title.value, details.value);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
  // גם אם רק נכנס לתור — הטופס התרוקן והפאנל נסגר, כי הדיווח כבר שמור.
  title.value = '';
  details.value = '';
  closeReportPanel();
}

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

// נקודת השליחה היחידה בכל התוסף. מאז 2.13.2 היא עוברת בממסר ולא במייל —
// כל שאר הקבצים (edit-forms.js, home.js, results-ui.js) קוראים לכאן.
// מחזירה true רק אם הבקשה יצאה בלי חריגה; אחרת הדיווח שמור בתור.
async function sendToDev(subject, body, kind){
  return sendReport(kind || 'דיווח', subject, body);
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
  if (activePersonalTab === 'whatsnew') return renderPersonalWhatsNew();
}

function renderPersonalBookmarks(){
  const list = readBookmarks();
  personalBody.appendChild(sectionHead('⭐ סימניות', list.length ? list.length + ' ערכים' : ''));
  if (!list.length){
    personalBody.insertAdjacentHTML('beforeend',
      personalEmpty('אין עדיין סימניות. בכל כרטיס ערך יש כוכב (☆) בכותרת — לחיצה עליו תוסיף אותו לכאן.'));
    return;
  }
  // ייצוא כרטסת (2.5) — כל הסימניות כדף מקורות אחד, למגיד שיעור לפני השיעור
  const bulk = document.createElement('div');
  bulk.className = 'p-bulk';
  const printBtn = document.createElement('button');
  printBtn.type = 'button';
  printBtn.className = 'panel-btn';
  printBtn.textContent = '🖨 ייצוא כרטסת (' + list.length + ')';
  printBtn.addEventListener('click', () => printBookmarks());
  bulk.appendChild(printBtn);
  personalBody.appendChild(bulk);

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
  bulkBtn.textContent = '📨 שליחת כל העריכות למפתח (' + edits.length + ')';
  bulkBtn.addEventListener('click', () => {
    const body = 'עריכות מקומיות מתמונ״ך — ' + edits.length + ' כרטיסים\n\n'
      + edits.map(e => '• ' + e.origName + ' (' + catLabelOf(e.catId) + ') — נשמר ' + fmtDate(e.rec.savedAt)).join('\n')
      + '\n\n--- הנתונים המלאים ---\n'
      + edits.map(e => '### ' + e.origName + ' [' + e.catId + ']\n' + JSON.stringify(e.rec.entry, null, 1)).join('\n\n');
    sendToDev('עריכות מקומיות (' + edits.length + ' כרטיסים)', body, 'עריכות מקומיות');
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
            'עריכת כרטיס — ' + e.origName,
            'עריכה מקומית של הכרטיס "' + e.origName + '" במדריך ' + catLabelOf(e.catId)
              + '\nנשמר: ' + (e.rec.savedAt || '—') + '\n\n' + JSON.stringify(e.rec.entry, null, 1),
            'עריכת כרטיס'
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

// שורת מצב התור: כמה דיווחים ממתינים לשליחה, וכפתור לנסות שוב עכשיו.
// מתמלאת אסינכרונית כי הקריאה ל-plugin.storage אסינכרונית.
function appendOutboxStatus(){
  const box = document.createElement('div');
  box.className = 'p-row-sub';
  box.style.margin = '0 0 14px';
  personalBody.appendChild(box);
  reportOutboxRead().then(list => {
    if (!list.length){ box.remove(); return; }
    box.textContent = '📤 ' + (list.length === 1 ? 'דיווח אחד ממתין' : list.length + ' דיווחים ממתינים')
      + ' לשליחה (אין חיבור, או שהשליחה טרם הצליחה). ';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'panel-btn secondary';
    btn.textContent = 'לנסות לשלוח עכשיו';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'שולח…';
      await flushReportOutbox({ announce: true });
      renderPersonalBody();
    });
    box.appendChild(btn);
    const dl = document.createElement('button');
    dl.type = 'button';
    dl.className = 'panel-btn secondary';
    dl.style.marginInlineStart = '6px';
    dl.textContent = '💾 הורדה לקובץ';
    dl.addEventListener('click', () => saveReportsToFile(list, 'דיווחים-ממתינים-תמונך'));
    box.appendChild(dl);
  }).catch(()=>{ box.remove(); });
}

function renderPersonalDrafts(){
  const drafts = collectDrafts();
  personalBody.appendChild(sectionHead('📝 הצעות ודיווחים שמורים', drafts.length ? drafts.length + ' פריטים' : ''));

  // 4.1 — הכניסה לדיווח חופשי (באג / טעות בתוכן / הצעה)
  const newRow = document.createElement('div');
  newRow.className = 'p-bulk';
  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.className = 'panel-btn';
  newBtn.textContent = '🐞 דיווח חדש למפתח';
  newBtn.addEventListener('click', () => openReportPanel());
  newRow.appendChild(newBtn);
  personalBody.appendChild(newRow);
  appendOutboxStatus();

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
  bulkBtn.textContent = '📨 שליחה מרוכזת של הכל (' + drafts.length + ')';
  bulkBtn.addEventListener('click', async () => {
    const body = 'פריטים שמורים מתמונ״ך — ' + drafts.length + '\n\n'
      + drafts.map((d, i) => (i + 1) + '.\n' + draftBody(d)).join('\n\n');
    const ok = await sendToDev('שליחה מרוכזת (' + drafts.length + ' פריטים)', body, 'שליחה מרוכזת');
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
          d.kind === 'propose' ? ('הצעת תוספת — ' + (d.data.name || '')) : ('דיווח טעות בזיהוי — "' + (d.data.selectedText || '') + '"'),
          draftBody(d),
          d.kind === 'propose' ? 'הצעת ערך' : 'דיווח זיהוי'
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
          sendToDev('דף HTML מצורף — ' + name,
            'המשתמש הוסיף דף HTML בשם "' + name + '".\n\nתוכן הדף:\n\n' + (content || ''),
            'דף HTML');
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
    + 'ההודעה נשלחת ישירות מתוך התוסף; אם אין כרגע חיבור לרשת היא נשמרת ותישלח לבד בפתיחה הבאה.</p>';
  const ta = document.createElement('textarea');
  ta.placeholder = 'כתבו כאן את ההערה שלכם...';
  wrap.appendChild(ta);
  const row = document.createElement('div');
  row.className = 'p-bulk';
  row.style.marginTop = '12px';
  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'panel-btn';
  send.textContent = '📨 שליחה למפתח';
  send.addEventListener('click', async () => {
    const body = ta.value.trim();
    if (!body) return;
    // הכותרת היא השורה הראשונה של המשוב — כך ל-Issue יש שם אמיתי ולא "משוב" סתמי.
    const ok = await sendToDev(body.split('\n')[0], body, 'משוב');
    if (ok) ta.value = '';
  });
  row.appendChild(send);
  wrap.appendChild(row);
  personalBody.appendChild(wrap);
}

// ============================================================
//  🆕 מה חדש (2.13.1) — הגרסה המותקנת מול הגרסה האחרונה בגיטהאב, וסיכום
//  היומן. משתמשת ב-readLocalPluginVersion/fetchRemoteVersion/cmpVersion
//  הקיימים ב-bridge.js (בדיקת העדכון השקטה שכבר רצה ברקע) - לא כתובה שוב.
//  אין "התקנה אוטומטית" אמיתית מתוך ה-WebView, ולכן "כפתור עדכון" פותח את
//  דף ה-Releases בגיטהאב (דרך data-external-link, כמו כל קישור חיצוני כאן).
// ============================================================
function whatsNewStatusHTML(local, remote){
  let html = '<div class="field-label" style="margin-top:0;">הגרסה המותקנת אצלך</div><p>' + esc(local || 'לא ידועה') + '</p>';
  if (!remote){
    html += '<p class="mini-note">לא הצלחתי לבדוק את הגרסה האחרונה בגיטהאב כרגע (יש צורך בחיבור לרשת).</p>';
  } else if (local && cmpVersion(remote, local) > 0){
    html += '<p><strong>יש גרסה חדשה יותר: ' + esc(remote) + '.</strong></p>'
      + '<div class="p-bulk"><a href="#" class="panel-btn" data-external-link="' + esc(UPDATE_RELEASES_URL) + '">⬇️ לעדכון — דף ההורדות בגיטהאב</a></div>';
  } else if (local && cmpVersion(remote, local) < 0){
    html += '<p class="mini-note">הגרסה שאצלך (' + esc(local) + ') חדשה מהגרסה האחרונה שפורסמה בגיטהאב (' + esc(remote) + ') — טרם שוחררה שם.</p>';
  } else {
    html += '<p>✅ מעודכן לגרסה האחרונה (' + esc(remote) + ').</p>';
  }
  html += '<p class="mini-note" style="margin-top:10px;"><a href="#" data-external-link="' + esc(UPDATE_RELEASES_URL) + '">📦 כל הגרסאות בגיטהאב ↗</a></p>';
  return html;
}

// פרסינג קל ל-CHANGELOG.md: מפצל לפי כותרות "## " (גרסה+תאריך), וממיר כל
// גוף בלוק ל-HTML מינימלי (שורת בולט "* " -> <li>, **מודגש** -> <strong>).
// לא פרסר Markdown מלא - רק מה שהפורמט הקבוע של הקובץ הזה בפועל משתמש בו.
function mdBoldify(s){
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
}
function mdLiteToHtml(md){
  const lines = String(md || '').split('\n');
  let html = '', inList = false;
  lines.forEach(line => {
    const t = line.trim();
    if (!t){ if (inList){ html += '</ul>'; inList = false; } return; }
    const bullet = t.match(/^\*\s+(.*)$/);
    if (bullet){
      if (!inList){ html += '<ul>'; inList = true; }
      html += '<li>' + mdBoldify(bullet[1]) + '</li>';
    } else {
      if (inList){ html += '</ul>'; inList = false; }
      html += '<p>' + mdBoldify(t) + '</p>';
    }
  });
  if (inList) html += '</ul>';
  return html;
}
// EMBEDDED_CHANGELOG_MD (guides/_shared/changelog-embedded.js) מוטבע ב-build/
// pack.ps1 בזמן האריזה, מתוך CHANGELOG.md עצמו - לא fetch בזמן ריצה. fetch
// ל-CHANGELOG.md נכשל בפועל בתוך ה-WebView של אוצריא (הקובץ אכן ארוז בחבילה,
// אבל הטעינה בזמן ריצה לא עבדה שם); ההטבעה מסירה את התלות הזו לגמרי.
function loadChangelogBlocks(){
  const text = (typeof EMBEDDED_CHANGELOG_MD !== 'undefined') ? EMBEDDED_CHANGELOG_MD : '';
  if (!text) return Promise.resolve(null);
  return Promise.resolve(text.split(/\n(?=## )/).filter(p => p.trim().indexOf('## ') === 0).map(p => {
    const nl = p.indexOf('\n');
    return {
      header: (nl === -1 ? p : p.slice(0, nl)).replace(/^##\s*/, '').trim(),
      body: nl === -1 ? '' : p.slice(nl + 1).trim()
    };
  }));
}
function renderChangelogInto(container, blocks){
  if (!blocks || !blocks.length){
    container.innerHTML = '<p class="mini-note">לא הצלחתי לטעון את יומן השינויים (CHANGELOG.md).</p>';
    return;
  }
  // יומן מלא מההתחלה - הגרסאות האחרונות פתוחות, השאר מקופל (details/summary),
  // כדי שאפשר יהיה גם לגלול אחורה עד ההתחלה וגם לא להיטבע בעשרות גרסאות ישנות.
  container.innerHTML = blocks.map((b, i) =>
    `<details class="month-details"${i < 3 ? ' open' : ''}><summary>${esc(b.header)}</summary>${mdLiteToHtml(b.body)}</details>`
  ).join('');
}

function renderPersonalWhatsNew(){
  personalBody.appendChild(sectionHead('🆕 מה חדש', ''));

  const statusWrap = document.createElement('div');
  statusWrap.innerHTML = '<p class="mini-note" style="margin-top:0">בודק גרסה...</p>';
  personalBody.appendChild(statusWrap);

  const bulk = document.createElement('div');
  bulk.className = 'p-bulk';
  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'panel-btn secondary';
  refreshBtn.textContent = '🔄 בדיקת עדכון עכשיו';
  bulk.appendChild(refreshBtn);
  personalBody.appendChild(bulk);

  personalBody.appendChild(sectionHead('📜 מה התחדש', ''));
  const changelogWrap = document.createElement('div');
  changelogWrap.innerHTML = '<p class="mini-note">טוען יומן שינויים...</p>';
  personalBody.appendChild(changelogWrap);

  async function refreshStatus(){
    statusWrap.innerHTML = '<p class="mini-note" style="margin-top:0">בודק גרסה...</p>';
    const local = await readLocalPluginVersion();
    const remote = await fetchRemoteVersion().catch(() => null);
    statusWrap.innerHTML = whatsNewStatusHTML(local, remote);
  }
  refreshBtn.addEventListener('click', refreshStatus);
  refreshStatus();
  loadChangelogBlocks().then(blocks => renderChangelogInto(changelogWrap, blocks));
}

// בפתיחת התוסף: אם נשארו דיווחים בתור מפעם קודמת — ניסיון שקט לשלוח אותם.
// שקט מוחלט: אין הודעה בהצלחה ואין הודעה בכישלון. אותו עיכוב-אדיבות כמו
// בדיקת העדכונים ב-bridge.js, כדי לא להתחרות בטעינת המדריכים.
setTimeout(() => { flushReportOutbox().catch(()=>{}); }, REPORT_FLUSH_DELAY_MS);

document.getElementById('personalCard').addEventListener('click', () => openPersonalArea('bookmarks'));
document.getElementById('personalBackBtn').addEventListener('click', closePersonalArea);
document.querySelectorAll('#personalTabs .ptab').forEach(btn => {
  btn.addEventListener('click', () => openPersonalArea(btn.dataset.ptab));
});
