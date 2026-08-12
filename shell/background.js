// לוגיקת מנוע הרקע (background.html). נטען *רק* שם — לא ב-index.html.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.
//
// שתי משימות, ותו לא:
//   1. לחיצה על "זיהוי בעינים למקרא" בתפריט ההקשר → זיהוי, פופאפ אישור, ומסירה
//      ללשונית הנראית דרך האחסון (אותו מפתח PENDING_IDENTIFY_KEY שב-bridge.js).
//   2. app.startup → פרסום מאורעות "ערך היום" ליומן של אוצריא (publishedData).
//
// ⚠️ אין כאן DOM של תצוגה. אסור לקרוא מכאן ל-showResults / openGenericProposeForm /
// applyPrefs וכו' — הן לא נטענו בכלל. כל מה שהמשתמש רואה מכאן עובר דרך
// ui.showConfirm ו-notifications.showInApp של אוצריא.

// מזהה המופע הזה. bridge.js מתעלם מבקשה שה-origin שלה הוא הוא עצמו (כדי לא
// "לגנוב" בקשה ממופע הלשונית); מופע הרקע הוא origin אחר, ולכן הלשונית תצרוך אותה.
const BG_INSTANCE_ID = 'bg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// כמה משימות עדיין רצות. plugin.backgroundDone נקרא רק כשהמונה מתאפס — אחרת
// היינו מכבים את המנוע באמצע המתנה לתשובת המשתמש בפופאפ.
let bgPending = 0;
function bgStart(){ bgPending++; }
function bgEnd(){
  bgPending = Math.max(0, bgPending - 1);
  // plugin.backgroundDone נוסף ב-0.9.97. ב-0.9.96 פשוט לא קוראים לו והמנוע
  // נכבה לבד אחרי ~3 דקות חוסר פעילות — התנהגות תקינה, רק פחות חסכונית.
  if (bgPending === 0) callIfSupported(['plugin', 'backgroundDone'], '0.9.97');
}

// ---- 1. לחיצה על פריט תפריט ההקשר ------------------------------------------

function bgSnippet(s, max){
  const clean = String(s).replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : clean.slice(0, max - 1) + '…';
}

async function bgHandleIdentifyClick(payload){
  const text = (payload && (payload.selectedText || payload.text) || '').trim();
  if (!text){
    await Otzaria.call('notifications.showInApp', {
      message: 'יש לסמן תחילה מילה או ביטוי בטקסט', type: 'info'
    }).catch(()=>{});
    return;
  }

  const matches = await identify(text);

  // מוסרים ללשונית *לפני* המעבר אליה: plugin.openSelf עלול לטעון מחדש את מופע
  // הלשונית, וכל מה שצויר לפני הקריאה נמחק יחד עם ה-webview.
  const handoff = async (mode) => {
    await storageSetJson(PENDING_IDENTIFY_KEY, {
      text: text, mode: mode, ts: Date.now(), origin: BG_INSTANCE_ID
    });
    // שם המתודה מורכב בזמן ריצה — אותו שיקול כמו ב-bridge.js.
    Otzaria.call(['plugin', 'openSelf'].join('.'), {}).catch(()=>{});
  };

  if (!matches.length){
    const res = await Otzaria.call('ui.showConfirm', {
      title: 'לא נמצאה התאמה ל"' + bgSnippet(text, 40) + '"',
      content: 'לחיצה על אישור תפתח טופס הצעת ערך חדש — עם בחירת קטגוריה, שליחה למפתח או שמירה במחשב.'
        + '\n\nהקטע שנבחר: "' + bgSnippet(text, 120) + '"'
    }).catch(() => null);
    if (res && res.success && res.data && res.data.confirmed === true) await handoff('propose');
    return;
  }

  // אותו פורמט בדיוק כמו ב-bridge.js: ההוראה לפני הרשימה, כי הרשימה היא החלק
  // שגדל בלי גבול ודוחף כל מה שמתחתיה מחוץ לפופאפ החתוך.
  const lineFor = (m) => {
    const via = (m.matchedVia && m.matchedVia !== m.name) ? (m.matchedVia + ': ') : '';
    const modern = shortModernId(m.entry);
    return '• ' + via + m.catIcon + ' ' + m.name + ' — ' + m.catLabel + (modern ? ' · ' + modern : '');
  };
  const summaryLine = (list) => {
    const counts = new Map();
    list.forEach(m => {
      if (!counts.has(m.catId)) counts.set(m.catId, { icon: m.catIcon, label: m.catLabel.replace(/ בתנ״ך$/, ''), n: 0 });
      counts.get(m.catId).n++;
    });
    return Array.from(counts.values()).map(v => v.icon + ' ' + v.n + ' ' + v.label).join(' · ');
  };

  const top = matches.slice(0, 5);
  const restCount = matches.length - top.length;
  const title = matches.length === 1
    ? (matches[0].catIcon + ' ' + matches[0].name)
    : ('נמצאו ' + matches.length + ' התאמות ל"' + bgSnippet(text, 40) + '"');
  const action = 'לחיצה על אישור תפתח את עינים למקרא עם '
    + (matches.length === 1 ? 'הכרטיס המלא.' : 'כל ' + matches.length + ' ההתאמות.');

  const parts = [];
  if (matches.length === 1){
    parts.push(lineFor(matches[0]), action);
  } else {
    parts.push(summaryLine(matches), action,
      top.map(lineFor).join('\n') + (restCount > 0 ? '\nועוד ' + restCount + '…' : ''));
  }
  parts.push('⚠️ ייתכנו זיהויי שווא — בחלון התוצאות יש כפתור דיווח.');
  parts.push('הקטע שנבחר: "' + bgSnippet(text, 120) + '"');

  const res = await Otzaria.call('ui.showConfirm', { title, content: parts.join('\n\n') }).catch(() => null);
  // כשל בפופאפ עצמו לא אמור לבלוע את הזיהוי — פותחים בכל זאת.
  if (!res) { await handoff('results'); return; }
  if (res.success && res.data && res.data.confirmed === true) await handoff('results');
}

// ---- 2. "ערך היום" ליומן של אוצריא (ROADMAP 4.12) ---------------------------

// הרשומות שפורסמו אתמול חייבות לרדת, אחרת היומן מצטבר בלי סוף. שומרים את
// המפתחות שפורסמו, ומנקים אותם בהרצה הבאה לפני שמפרסמים את של היום.
const PUBLISHED_KEYS_KEY = 'madaei_hatanach_published_event_keys_v1';

async function publishTodayEvents(){
  if (!(window.Otzaria && Otzaria.call)) return;
  if (typeof eventsForToday !== 'function' || typeof todayHebrew !== 'function') return;

  // ניקוי הקודמות
  const prev = await storageGetJson(PUBLISHED_KEYS_KEY);
  if (Array.isArray(prev)){
    for (const key of prev){
      await Otzaria.call('publishedData.remove', {
        type: 'calendar.event', scope: 'global', key: key
      }).catch(()=>{});
    }
  }

  const t = todayHebrew();
  const events = eventsForToday();
  if (!events.length){ await storageSetJson(PUBLISHED_KEYS_KEY, []); return; }

  // היום הלועזי בחצות, מקומי. אלה מאורעות של יום שלם ולא של שעה מסוימת, ולכן
  // אין endsAt ואין שעה משמעותית.
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const tzMin = -now.getTimezoneOffset();
  const tz = (tzMin >= 0 ? '+' : '-') + pad(Math.floor(Math.abs(tzMin) / 60)) + ':' + pad(Math.abs(tzMin) % 60);
  const startsAt = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
    + 'T00:00:00' + tz;

  const keys = [];
  for (let i = 0; i < events.length; i++){
    const ev = events[i];
    const key = 'madaei:dailyEvent:' + i;
    const res = await Otzaria.call('publishedData.upsert', {
      type: 'calendar.event',
      scope: 'global',
      key: key,
      payload: {
        title: ev.event,
        startsAt: startsAt,
        source: 'עינים למקרא',
        importance: 'low',
        description: t.dayLetters + '׳ ' + t.monthName + (ev.source ? ' · ' + ev.source : '')
      }
    }).catch(() => null);
    if (res && res.success) keys.push(key);
  }
  await storageSetJson(PUBLISHED_KEYS_KEY, keys);
}

// ---- חיווט --------------------------------------------------------------

function bgWait(elapsed){
  if (!(window.Otzaria && typeof Otzaria.on === 'function')){
    if (elapsed < 10000) setTimeout(() => bgWait(elapsed + 200), 200);
    return;
  }

  Otzaria.on('plugin.boot', () => {
    bgStart();
    publishTodayEvents().catch(()=>{}).then(bgEnd, bgEnd);
  });

  Otzaria.on('reader.context_menu_item_clicked', (payload) => {
    if (!payload || payload.itemId !== MENU_ITEM_ID) return;
    bgStart();
    bgHandleIdentifyClick(payload).catch(()=>{}).then(bgEnd, bgEnd);
  });
}
bgWait(0);
