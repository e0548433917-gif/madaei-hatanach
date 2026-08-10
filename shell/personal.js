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
//  4.1 — ממסר הדיווחים (2.13.2, מסלול ראשי הוחלף ב-2.15.1)
//  שלושה תנאים מחייבים: לא מייל · לא קישור חיצוני · לא ליפול כשאין רשת.
//
//  ✅ מסלול א׳ (ראשי) — Web App (doPost + פריסה כ-`/exec`) על אותו פרויקט
//  Apps Script הקיים. **זה בדיוק הדפוס שהתוסף "ביוגרפיות" מריץ בהצלחה בפועל
//  בתוך אוצריא** (ר' סקריפט-גוגל-אוצריא.txt, שסופק ע"י מפתחו): fetch רגיל
//  (לא no-cors!) עם CORS preflight אמיתי - EmailJS שם שולח
//  Content-Type: application/json ומקבל תשובה קריאה בחזרה. זו ההוכחה
//  שה-WebView של אוצריא **תומך** ב-fetch מלא, כולל preflight - אז אין סיבה
//  להסתפק בניחוש עיוור דרך no-cors כמו קודם. Content-Type כאן הוא
//  text/plain דווקא (לא application/json): בניגוד ל-EmailJS, Web App של
//  Apps Script לא מיישם doOptions, ופרילייט אמיתי היה נכשל שם - text/plain
//  הוא "בקשה פשוטה" בלי preflight, ו-doPost קורא את e.postData.contents
//  כטקסט גולמי בכל מקרה ומפרק בעצמו עם JSON.parse (בדיוק כמו הסקריפט של
//  אוצריא עצמה). "הצלחה" כאן היא result.success===true אמיתי, לא ניחוש.
//
//  מסלול ב׳ (גיבוי) — docs.google.com/.../formResponse, כפי שהיה עד כה:
//  אם script.google.com חסום אצל משתמש מסוים אבל docs.google.com פתוח,
//  עדיין יש דרך לצאת. כאן עדיין no-cors, ולכן "הצלחה" = "לא זרק" בלבד -
//  ומכאן שה-outbox חובה: פריט נמחק מהתור רק אחרי שליחה שלא זרקה, ואם זרקה
//  הוא נשאר לניסיון הבא בפתיחה הבאה.
// ============================================================
// נפרס ואומת 10.8.26 — curl/fetch אמיתי דרך הכתובת הזו פתח את
// github.com/e0548433917-gif/madaei-hatanach/issues/8 בפועל, עם
// success:true אמיתי בתשובה (לא ניחוש דרך no-cors).
const REPORT_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxzlCAZzhaEM68jRqqekW8InrtbSiZrtiiIjgCKOInUvyBG43wLY29MYY6PrbHijpO6/exec';
const REPORT_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd7NiGDUahnwpaestosEcDxPJoAkYXzVRUa2yB5EiXkLPSWvQ/formResponse';
const REPORT_FIELD_KIND    = 'entry.1407711891';   // סוג
const REPORT_FIELD_TITLE   = 'entry.261441606';    // כותרת
const REPORT_FIELD_DETAILS = 'entry.1548335987';   // פרטים
const REPORT_FIELD_ENV     = 'entry.932826683';    // סביבה
const REPORT_OUTBOX_KEY = 'madaei_report_outbox_v1';
const REPORT_DEBUG_KEY = 'madaei_report_debug_v1';   // 5 הניסיונות האחרונים, לאבחון
const REPORT_DEBUG_MAX = 5;
const REPORT_OUTBOX_MAX = 20;             // מעבר לזה — הישן ביותר נמחק
const REPORT_SEND_TIMEOUT_MS = 8000;      // שלא תישאר בקשה תלויה
const REPORT_STEP_TIMEOUT_MS = 4000;      // תקרה לכל קריאת גשר/קובץ מקומי
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

// כל קריאה לגשר של אוצריא או ל-fetch מקבלת תקרת זמן. Promise שנתקע (ולא
// נכשל!) הוא כישלון שקט שאי-אפשר לאבחן — בדיוק מה שקרה ב-2.13.2, שם
// reportEnv רץ *לפני* השמירה בתור, וכל תקיעה שלו מנעה גם את השמירה וגם את
// השליחה בלי שום הודעה. מאז: קודם שומרים, ולכל שלב יש timeout.
function withTimeout(promise, ms, label){
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => { if (!done){ done = true; reject(new Error('timeout: ' + (label || ''))); } }, ms);
    Promise.resolve(promise).then(
      v => { if (!done){ done = true; clearTimeout(timer); resolve(v); } },
      e => { if (!done){ done = true; clearTimeout(timer); reject(e); } }
    );
  });
}

// "סביבה" — גרסת התוסף מהמניפסט שנארז (לא קבוע בקוד שיתיישן) + גרסת אוצריא.
// לעולם לא זורקת ולעולם לא נתקעת: הגרוע ביותר הוא מחרוזת עם "—".
let reportEnvCache = null;
async function reportEnv(){
  if (reportEnvCache) return reportEnvCache;
  let plug = '—', otz = '—';
  try {
    const res = await withTimeout(fetch('manifest.json', { cache: 'no-store' }), REPORT_STEP_TIMEOUT_MS, 'manifest');
    if (res && res.ok){ const m = JSON.parse(await withTimeout(res.text(), REPORT_STEP_TIMEOUT_MS, 'manifest-text')); if (m && m.version) plug = String(m.version); }
  } catch(e){}
  if (hasOtzaria()){
    try {
      const res = await withTimeout(Otzaria.call('app.getInfo'), REPORT_STEP_TIMEOUT_MS, 'app.getInfo');
      const v = res && res.data && res.data.version;
      if (v) otz = String(v);
    } catch(e){}
  }
  reportEnvCache = 'עינים למקרא ' + plug + ' · אוצריא ' + otz;
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

function reportParams(item, env){
  const p = new URLSearchParams();
  p.set(REPORT_FIELD_KIND, item.kind || 'דיווח');
  p.set(REPORT_FIELD_TITLE, item.title || 'דיווח מהתוסף');
  p.set(REPORT_FIELD_DETAILS, item.details || '');
  p.set(REPORT_FIELD_ENV, env || item.env || '');
  return p;
}

// מסלול א׳ (ראשי) — Web App עם תשובה אמיתית שאפשר לקרוא, לא no-cors.
// "הצלחה" כאן היא result.success===true בפועל. ר' הערת הארכיטקטורה למעלה.
function postViaWebApp(item, env){
  if (!REPORT_WEBAPP_URL) return Promise.reject(new Error('webapp not configured'));
  const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  const timer = setTimeout(() => { try { ctrl && ctrl.abort(); } catch(e){} }, REPORT_SEND_TIMEOUT_MS);
  const payload = {
    kind: item.kind || 'דיווח',
    title: item.title || 'דיווח מהתוסף',
    details: item.details || '',
    env: env || item.env || ''
  };
  return fetch(REPORT_WEBAPP_URL, {
    method: 'POST',
    // text/plain ולא application/json בכוונה: "בקשה פשוטה" בלי CORS preflight
    // (ר' הסבר מפורט למעלה) — doPost מפרק בעצמו עם JSON.parse.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    signal: ctrl ? ctrl.signal : undefined
  }).then(
    res => {
      clearTimeout(timer);
      return res.text().then(text => {
        let data = null;
        try { data = JSON.parse(text); } catch(e){}
        if (!data || data.success !== true){
          throw new Error('webapp: HTTP ' + res.status + ' — ' + String(text || '').slice(0, 200));
        }
        return 'webapp';
      });
    },
    err => { clearTimeout(timer); throw err; }
  );
}

// מסלול ב׳ (גיבוי) — fetch עם no-cors לטופס. גוף URLSearchParams מייצר לבדו
// Content-Type: application/x-www-form-urlencoded, כלומר "בקשה פשוטה" בלי preflight.
function postViaFetch(params){
  const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
  const timer = setTimeout(() => { try { ctrl && ctrl.abort(); } catch(e){} }, REPORT_SEND_TIMEOUT_MS);
  return fetch(REPORT_FORM_URL, {
    method: 'POST',
    mode: 'no-cors',
    body: params,
    signal: ctrl ? ctrl.signal : undefined
  }).then(
    () => { clearTimeout(timer); return 'fetch'; },
    err => { clearTimeout(timer); throw err; }
  );
}

// מסלול ג׳ — שליחת טופס אמיתי לתוך iframe מוסתר. זו **ניווט של הדפדפן**
// ולא קריאת fetch, ולכן היא עוברת גם כשה-WebView של אוצריא חוסם/עוטף fetch.
// זה הדפוס הוותיק של Google Forms, ואין בו CORS כלל.
// ⚠️ סיכון ידוע: אם ה-WebView חוסם ניווט לגמרי אבל עדיין מיידה load על
// about:blank, זה עלול להיקרא "הצלחה" בטעות. לכן הוא רק המסלול השלישי -
// אחרי שגם ה-Web App וגם ה-fetch הרגיל נכשלו בפועל (לא רק "לא הוגדר").
function postViaIframe(params){
  return new Promise((resolve, reject) => {
    let ifr, form, done = false, submitted = false;
    const cleanup = () => { try { ifr && ifr.remove(); } catch(e){} try { form && form.remove(); } catch(e){} };
    const timer = setTimeout(() => {
      if (done) return;
      done = true; cleanup(); reject(new Error('iframe timeout'));
    }, REPORT_SEND_TIMEOUT_MS);
    try {
      const name = 'tmnchRelay' + Math.random().toString(36).slice(2, 9);
      ifr = document.createElement('iframe');
      ifr.name = name;
      ifr.setAttribute('aria-hidden', 'true');
      ifr.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;';
      // ה-load הראשון הוא about:blank של ההוספה עצמה — סופרים רק את זה שאחרי השליחה
      ifr.addEventListener('load', () => {
        if (done || !submitted) return;
        done = true; clearTimeout(timer); cleanup(); resolve('iframe');
      });
      document.body.appendChild(ifr);
      form = document.createElement('form');
      form.action = REPORT_FORM_URL;
      form.method = 'POST';
      form.target = name;
      form.style.display = 'none';
      params.forEach((v, k) => {
        const inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = k; inp.value = v;
        form.appendChild(inp);
      });
      document.body.appendChild(form);
      submitted = true;
      form.submit();
    } catch(e){
      if (!done){ done = true; clearTimeout(timer); cleanup(); reject(e); }
    }
  });
}

// זורק חריגה רק אם **כל** המסלולים נכשלו. מחזיר את שם המסלול שהצליח,
// ושומר את נוסח כל הכישלונות ל-lastError של הפריט (לאבחון באזור האישי).
// Web App קודם (תשובה אמיתית) — הטופס רק אם הוא לא הוגדר או נכשל בפועל.
async function postReportToRelay(item, env){
  const errors = [];
  if (REPORT_WEBAPP_URL){
    try { return await postViaWebApp(item, env); }
    catch(e){ errors.push((e && (e.name + ': ' + e.message)) || String(e)); }
  }
  const params = reportParams(item, env);
  for (const t of [postViaFetch, postViaIframe]){
    try { return await t(params); }
    catch(e){ errors.push((e && (e.name + ': ' + e.message)) || String(e)); }
  }
  const err = new Error(errors.join(' | '));
  err.attempts = errors;
  throw err;
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

// מסמן על הפריט למה הניסיון האחרון נכשל — כדי שאפשר יהיה לראות זאת
// באזור האישי במקום לנחש.
async function markOutboxError(id, message){
  const list = await reportOutboxRead();
  const hit = list.find(x => x && x.id === id);
  if (!hit) return list;
  hit.lastError = String(message || '').slice(0, 300);
  hit.tries = (hit.tries || 0) + 1;
  await reportOutboxWrite(list);
  return list;
}

// יומן אבחון קצר — בלעדיו "שלחתי ולא הגיע" הוא חידה סתומה.
// נשמר לצד התור, ומוצג באזור האישי מתחת לשורת הממתינים.
async function reportDebugLog(entry){
  try {
    let list = null;
    if (hasOtzaria()) list = await withTimeout(storageGetJson(REPORT_DEBUG_KEY), REPORT_STEP_TIMEOUT_MS, 'debug-read').catch(() => null);
    else list = readJsonLS(REPORT_DEBUG_KEY, []);
    if (!Array.isArray(list)) list = [];
    list.push(Object.assign({ at: new Date().toISOString() }, entry));
    while (list.length > REPORT_DEBUG_MAX) list.shift();
    if (hasOtzaria()) await storageSetJson(REPORT_DEBUG_KEY, list);
    else localStorage.setItem(REPORT_DEBUG_KEY, JSON.stringify(list));
  } catch(e){}
}

function reportDebugRead(){
  if (hasOtzaria()) return storageGetJson(REPORT_DEBUG_KEY).then(v => Array.isArray(v) ? v : []).catch(() => []);
  const v = readJsonLS(REPORT_DEBUG_KEY, []);
  return Promise.resolve(Array.isArray(v) ? v : []);
}

// שליחה יזומה של המשתמש: **קודם לתור, ורק אחר כך כל השאר.**
// הסדר הזה הוא התיקון של 2.13.3: ב-2.13.2 חישוב ה"סביבה" רץ ראשון, וכל
// תקיעה שלו (קריאת גשר שלא חוזרת) בלעה גם את השמירה וגם את השליחה בשקט.
// מחזירה true רק אם הבקשה לא זרקה — "נכנס לתור" אינו "נשלח".
async function sendReport(kind, title, details){
  const item = newReportItem(kind, title, details, '');
  await queueReport(item);                       // ← שמור לפני הכול
  let env = '';
  try { env = await reportEnv(); } catch(e){}    // best-effort בלבד
  item.env = env;
  try {
    const via = await postReportToRelay(item, env);
    await reportDebugLog({ ok: true, via: via, title: item.title });
  } catch(e){
    await reportDebugLog({ ok: false, err: (e && e.message) || String(e), title: item.title });
    await markOutboxError(item.id, (e && e.message) || String(e));
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
    let env = '';
    try { env = await reportEnv(); } catch(e){}
    for (const item of list.slice()){
      if (!item || !item.id) continue;
      let via = null;
      try { via = await postReportToRelay(item, item.env || env); }
      catch(e){
        failed = true;
        await reportDebugLog({ ok: false, err: (e && e.message) || String(e), title: item.title });
        list = await markOutboxError(item.id, (e && e.message) || String(e));
        break;
      }
      await reportDebugLog({ ok: true, via: via, title: item.title });
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
    'דיווח מתוסף עינים למקרא',
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
  const name = (baseName || 'דיווח-עינים-למקרא') + '-' + new Date().toISOString().slice(0, 10) + '.txt';
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
    +   'חסומה — מעתיקה אותו ללוח), ואפשר לפתוח אתו דיווח ידני בכל עת. '
    // הקישור אינו מוצג כטקסט/כתובת גלויים בכוונה (רק כפתור העתקה) - כדי לא לחשוף
    // את כתובת ה-Issues (ומתוכה שם המשתמש בגיטהאב) בממשק עצמו.
    +   '<button type="button" class="panel-btn secondary" id="reportCopyIssuesLink" style="margin-top:6px;">📋 העתקת קישור לדיווח ידני</button>'
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
      saveReportsToFile([item], 'דיווח-עינים-למקרא');
    });
  });
  ov.querySelector('#reportCopyIssuesLink').addEventListener('click', () => {
    copyReportText(REPORT_ISSUES_URL).then(ok => {
      reportNotify(ok ? 'הקישור הועתק ללוח.' : 'ההעתקה נכשלה כאן — נסו שוב.', ok ? 'success' : 'error');
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
    const body = 'עריכות מקומיות מעינים למקרא — ' + edits.length + ' כרטיסים\n\n'
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
    const err = (list.find(x => x && x.lastError) || {}).lastError;
    box.textContent = '📤 ' + (list.length === 1 ? 'דיווח אחד ממתין' : list.length + ' דיווחים ממתינים')
      + ' לשליחה (אין חיבור, או שהשליחה טרם הצליחה). '
      + (err ? '· הסיבה האחרונה: ' + err + ' ' : '');
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
    dl.addEventListener('click', () => saveReportsToFile(list, 'דיווחים-ממתינים-עינים-למקרא'));
    box.appendChild(dl);
  }).catch(()=>{ box.remove(); });
}

// אבחון: מה קרה בניסיונות האחרונים, וכפתור לבדיקת חיבור חיה.
// זו התשובה ל"שלחתי ולא הגיע" — במקום לנחש, רואים אם הבקשה יצאה, ובאיזה מסלול.
function appendReportDiagnostics(){
  const wrap = document.createElement('details');
  wrap.style.margin = '0 0 14px';
  wrap.innerHTML = '<summary style="cursor:pointer;font-size:.86em;color:var(--color-on-surface-dim);">'
    + '🔎 בדיקת שליחה (למי שהדיווח שלו לא הגיע)</summary>'
    // ה-mode:'no-cors' ההכרחי כאן (גוגל לא מחזירה תשובה קריאה) הוא גם נקודה עיוורת:
    // "הבקשה יצאה" רק אומר שהדפדפן/ה-WebView לא זרק שגיאה - לא שהיא באמת הגיעה
    // ליעד. סנן תוכן שמחזיר "הצלחה" מזויפת לבקשה חסומה (כמו שקרה בעבר עם
    // script.google.com/…/exec, שנחסם בנתיב הפנימי אף שהדומיין עצמו היה פתוח)
    // ייצור בדיוק את התסמין הזה: "נשלח" בתוסף, ושום דבר לא נפתח בגיטהאב.
    + '<p class="mini-note" style="margin:6px 0 0;">"יצאה" אינו "התקבלה" — אם סינון '
    +   'תוכן ברשת חוסם בשקט את הנתיב הזה (מוכר מ-script.google.com בעבר), הבדיקה '
    +   'כאן תראה הצלחה בכל זאת. האימות הוודאי היחיד: פתיחת Issue חדש בגיטהאב.</p>';
  const body = document.createElement('div');
  body.style.cssText = 'font-size:.82em;color:var(--color-on-surface-dim);margin-top:8px;';
  wrap.appendChild(body);
  personalBody.appendChild(wrap);

  const testRow = document.createElement('div');
  testRow.className = 'p-bulk';
  testRow.style.marginTop = '8px';
  const testBtn = document.createElement('button');
  testBtn.type = 'button';
  testBtn.className = 'panel-btn secondary';
  testBtn.textContent = '📡 שליחת בדיקה עכשיו';
  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true;
    testBtn.textContent = 'בודק…';
    const env = await reportEnv().catch(() => '');
    const item = newReportItem('בדיקה', 'בדיקת חיבור מהתוסף', 'שליחת בדיקה יזומה מהאזור האישי.', env);
    try {
      const via = await postReportToRelay(item, env);
      await reportDebugLog({ ok: true, via: via, title: item.title });
      // בכוונה לא "נשלח בהצלחה" - זו רק אמירה שהדפדפן לא זרק שגיאה, לא שגוגל קיבלה.
      reportNotify('הבקשה יצאה במסלול "' + via + '" בלי שגיאה. זה עדיין לא אישור הגעה — '
        + 'בדקו אם נפתח Issue חדש בגיטהאב תוך דקה-שתיים.', 'success');
    } catch(e){
      await reportDebugLog({ ok: false, err: (e && e.message) || String(e), title: item.title });
      reportNotify('הבקשה נכשלה: ' + ((e && e.message) || e), 'error');
    }
    renderPersonalBody();
  });
  testRow.appendChild(testBtn);
  wrap.appendChild(testRow);

  reportDebugRead().then(log => {
    if (!log.length){ body.textContent = 'עדיין לא נרשם ניסיון שליחה במכשיר הזה.'; return; }
    body.innerHTML = log.slice().reverse().map(r =>
      '<div style="margin-bottom:4px;">' + (r.ok ? '✅' : '❌') + ' ' + esc(fmtDate(r.at)) + ' — '
      + esc(r.title || '') + (r.ok ? ' · מסלול: ' + esc(r.via || '—') : ' · ' + esc(r.err || '')) + '</div>'
    ).join('');
  }).catch(()=>{ body.textContent = ''; });
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
  appendReportDiagnostics();

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
    const body = 'פריטים שמורים מעינים למקרא — ' + drafts.length + '\n\n'
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
      + '<div class="p-bulk"><a href="#" class="panel-btn" data-external-link="' + esc(UPDATE_RELEASES_URL) + '" data-requires-net>⬇️ לעדכון — דף ההורדות בגיטהאב</a></div>';
  } else if (local && cmpVersion(remote, local) < 0){
    html += '<p class="mini-note">הגרסה שאצלך (' + esc(local) + ') חדשה מהגרסה האחרונה שפורסמה בגיטהאב (' + esc(remote) + ') — טרם שוחררה שם.</p>';
  } else {
    html += '<p>✅ מעודכן לגרסה האחרונה (' + esc(remote) + ').</p>';
  }
  html += '<p class="mini-note" style="margin-top:10px;"><a href="#" data-external-link="' + esc(UPDATE_RELEASES_URL) + '" data-requires-net>📦 כל הגרסאות בגיטהאב ↗</a></p>';
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
function renderChangelogInto(container, blocks, missingLabel){
  if (!blocks || !blocks.length){
    container.innerHTML = '<p class="mini-note">לא הצלחתי לטעון את ' + (missingLabel || 'יומן השינויים (CHANGELOG.md)') + '.</p>';
    return;
  }
  // יומן מלא מההתחלה - הגרסאות האחרונות פתוחות, השאר מקופל (details/summary),
  // כדי שאפשר יהיה גם לגלול אחורה עד ההתחלה וגם לא להיטבע בעשרות גרסאות ישנות.
  container.innerHTML = blocks.map((b, i) =>
    `<details class="month-details"${i < 3 ? ' open' : ''}><summary>${esc(b.header)}</summary>${mdLiteToHtml(b.body)}</details>`
  ).join('');
}

// EMBEDDED_ROADMAP_MD (guides/_shared/roadmap-embedded.js) מוטבע ב-build/pack.ps1
// באותו אופן בדיוק כמו EMBEDDED_CHANGELOG_MD למעלה, מתוך ROADMAP.md שבשורש
// הריפו - לא קבוע ידני יותר, ולא fetch בזמן ריצה.
function loadRoadmapBlocks(){
  const text = (typeof EMBEDDED_ROADMAP_MD !== 'undefined') ? EMBEDDED_ROADMAP_MD : '';
  if (!text) return Promise.resolve(null);
  return Promise.resolve(text.split(/\n(?=## )/).filter(p => p.trim().indexOf('## ') === 0).map(p => {
    const nl = p.indexOf('\n');
    return {
      header: (nl === -1 ? p : p.slice(0, nl)).replace(/^##\s*/, '').trim(),
      body: nl === -1 ? '' : p.slice(nl + 1).trim()
    };
  }));
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

  // מוטבע מ-ROADMAP.md בזמן האריזה (ר' loadRoadmapBlocks למעלה) - מתעדכן אוטומטית
  // בכל אריזה, בלי תחזוקה ידנית נפרדת מ-docs/.
  personalBody.appendChild(sectionHead('🛣️ מה מתוכנן בהמשך', ''));
  const roadmapWrap = document.createElement('div');
  roadmapWrap.innerHTML = '<p class="mini-note" style="margin-top:0">טוען תכנון עתידי...</p>';
  personalBody.appendChild(roadmapWrap);

  async function refreshStatus(){
    statusWrap.innerHTML = '<p class="mini-note" style="margin-top:0">בודק גרסה...</p>';
    const local = await readLocalPluginVersion();
    const remote = await fetchRemoteVersion().catch(() => null);
    statusWrap.innerHTML = whatsNewStatusHTML(local, remote);
  }
  refreshBtn.addEventListener('click', refreshStatus);
  refreshStatus();
  loadChangelogBlocks().then(blocks => renderChangelogInto(changelogWrap, blocks));
  loadRoadmapBlocks().then(blocks => renderChangelogInto(roadmapWrap, blocks, 'מה מתוכנן (ROADMAP.md)'));
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
