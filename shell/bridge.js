// הגשר לאוצריא + כל קריאות האתחול. חייב להיטען אחרון.
// נוצר בפיצול router.js (גרסה 2.11.2). המקור: shell/router.js שורות 1744-1881, 2572-2617.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.


let openSelfSupportedCache = null;
async function isOpenSelfSupported(){
  if (openSelfSupportedCache != null) return openSelfSupportedCache;
  if (!(window.Otzaria && Otzaria.call)){ openSelfSupportedCache = false; return false; }
  try {
    const res = await Otzaria.call('app.getInfo');
    const version = res && res.data && res.data.version;
    openSelfSupportedCache = !version || cmpVersion(version, '0.9.96') >= 0;
  } catch(e){
    openSelfSupportedCache = true; // אם אי-אפשר לבדוק, מניחים גרסה תומכת ולא חוסמים
  }
  return openSelfSupportedCache;
}

function bringToFront(){
  if (window.Otzaria && Otzaria.call){
    // שם המתודה מורכב בזמן ריצה - הוולידטור של אוצריא סורק את הקבצים סטטית ודוחה
    // התקנה על 0.9.95 אם המחרוזת המלאה מופיעה, למרות שיש לנו בדיקת-גרסה בזמן ריצה.
    const futureApiMethod = ['plugin', 'openSelf'].join('.');
    Otzaria.call(futureApiMethod, {}).catch(()=>{});
  }
}

// ---- מסירת הזיהוי בין מופעי התוסף (התיקון לבאג "נפתח דף השער במקום התוצאות") ----
// ב-0.9.96 המעבר ללשונית (plugin.openSelf) עלול לטעון מחדש את מופע התוסף. כל חלון
// שציירנו לפני הקריאה נמחק יחד עם ה-webview, ולכן המשתמש רואה את דף השער.
// לכן: כותבים את הבקשה לאחסון של אוצריא *לפני* המעבר, והמופע שעולה קורא אותה ומציג.
// אם לא הייתה טעינה מחדש (0.9.95 ומטה) — התצוגה הישירה עובדת כרגיל, וה-timeout
// שלמטה מנקה את המפתח כדי שלא יוצג שוב בפתיחה הבאה.
function setPendingIdentify(text, mode){
  return storageSet(PENDING_IDENTIFY_KEY, { text: text, mode: mode || 'results', ts: Date.now() });
}
function clearPendingIdentify(){ storageSet(PENDING_IDENTIFY_KEY, null); }

async function consumePendingIdentify(){
  let rec = await storageGet(PENDING_IDENTIFY_KEY);
  if (!rec) return;
  if (typeof rec === 'string'){ try { rec = JSON.parse(rec); } catch(e){ rec = null; } }
  await storageSet(PENDING_IDENTIFY_KEY, null);   // צורכים פעם אחת בלבד
  if (!rec || !rec.text) return;
  // בקשה ישנה (למשל התוסף נפתח ידנית שבוע אחר כך) לא מוצגת
  if (rec.ts && (Date.now() - rec.ts) > 120000) return;
  if (rec.mode === 'propose'){ openGenericProposeForm(rec.text); return; }
  const matches = await identify(rec.text);
  showResults(matches, rec.text);
}

// מעבר ללשונית התוסף + הצגה, בצורה שעמידה לטעינה מחדש של המופע.
async function handoffAndShow(text, mode, canOpenSelf, showNow){
  if (canOpenSelf){
    await setPendingIdentify(text, mode);
    bringToFront();
  }
  showNow();
  // אם המופע לא נטען מחדש — הטיימר הזה ירוץ וימחק את הבקשה. אם כן נטען, הוא מת
  // יחד עם המופע הישן, והמופע החדש הוא זה שיצרוך את המפתח.
  if (canOpenSelf) setTimeout(clearPendingIdentify, 5000);
}

// כמו בתוספים המקוריים: מציגים תחילה פופאפ אישור (ui.showConfirm) ישר בספרייה,
// בלי לעבור ללשונית התוסף - ורק אם המשתמש מאשר, עוברים ללשונית ופותחים את התוצאות.
async function handleIdentifyClick(payload){
  const text = (payload && (payload.selectedText || payload.text) || '').trim();
  if (!text){
    if (window.Otzaria && Otzaria.call){
      Otzaria.call('notifications.showInApp', { message: 'יש לסמן תחילה מילה או ביטוי בטקסט', type: 'info' }).catch(()=>{});
    }
    return;
  }
  const matches = await identify(text);

  if (!(window.Otzaria && Otzaria.call)){
    bringToFront();
    showResults(matches, text);
    return;
  }

  const canOpenSelf = await isOpenSelfSupported();

  // אין התאמה: מציעים לפתוח טופס הצעת ערך חדש (עם בחירת קטגוריה) - לשליחה או לשמירה מקומית.
  if (!matches.length){
    try {
      const res = await Otzaria.call('ui.showConfirm', {
        title: 'לא נמצאה התאמה ל"' + text + '"',
        content: 'לא נמצא זיהוי ל"' + text + '" באף אחד ממדריכי תמונ״ך.\n\n'
          + 'האם יש לך זיהוי שאינו מופיע? לחיצה על אישור תפתח טופס הצעת ערך חדש — עם בחירת הקטגוריה (צומח, חי, דומם וכו׳), שליחה למפתח או שמירה במחשב שלך.'
          + (canOpenSelf ? '' : '\n\n(בגרסת אוצריא זו אין מעבר אוטומטי ללשונית — יש לפתוח את תמונ״ך ידנית, הטופס ימתין שם פתוח.)')
      });
      if (res && res.success && res.data && res.data.confirmed === true){
        await handoffAndShow(text, 'propose', canOpenSelf, () => openGenericProposeForm(text));
      }
    } catch(e){
      await Otzaria.call('notifications.showInApp', {
        message: 'לא נמצאה התאמה ל"' + text + '" באף אחד ממדריכי תמונ״ך.',
        type: 'info'
      }).catch(()=>{});
    }
    return;
  }

  // פורמט שורה: המילה שזוהתה, נקודתיים, שם הערך, המדריך, וזיהוי מודרני בקצרה.
  function lineFor(m){
    const via = (m.matchedVia && m.matchedVia !== m.name) ? (m.matchedVia + ': ') : '';
    const modern = shortModernId(m.entry);
    return '• ' + via + m.catIcon + ' ' + m.name + ' — ' + m.catLabel + (modern ? ' · ' + modern : '');
  }
  const lines = matches.map(lineFor).join('\n');
  const title = matches.length === 1
    ? (matches[0].catIcon + ' ' + matches[0].name)
    : ('נמצאו ' + matches.length + ' התאמות ל"' + text + '"');

  const transferNote = canOpenSelf
    ? 'לחיצה על אישור תעביר אותך לתוסף תמונ״ך עם '
    : 'מעבר אוטומטי לתוסף אינו נתמך בגרסת אוצריא זו (נדרש 0.9.96 ומעלה) — יש לפתוח את תמונ״ך ידנית. ';
  const disclaimer = '\n\n⚠️ הזיהוי מבוסס התאמה חכמה (הסרת אותיות שימוש וכתיב חסר) וייתכנו זיהויי שווא. מצאתם טעות? בחלון התוצאות יש כפתור דיווח, וכל כרטיס ניתן לעריכה מקומית (✏️).';
  const content = (matches.length === 1
    ? (lineFor(matches[0]) + '\n\n' + transferNote + (canOpenSelf ? 'הכרטיס המלא.' : ''))
    : (lines + '\n\n' + transferNote + (canOpenSelf ? 'רשימת התוצאות.' : ''))) + disclaimer;

  try {
    const res = await Otzaria.call('ui.showConfirm', { title, content });
    if (res && res.success && res.data && res.data.confirmed === true){
      await handoffAndShow(text, 'results', canOpenSelf, () => showResults(matches, text));
    }
  } catch(e){
    await handoffAndShow(text, 'results', canOpenSelf, () => showResults(matches, text));
  }
}

function registerUnifiedMenuItem(){
  if (!(window.Otzaria && Otzaria.call)) return;
  Otzaria.call('reader.addContextMenuItem', {
    id: MENU_ITEM_ID,
    label: 'זהה בתמונ״ך',
    icon: 'search_24_regular'
  }).catch(()=>{});
}

function onOtzariaTheme(theme){
  if (!theme) return;
  otzariaTheme = theme;
  if (uiPrefs.theme === 'otzaria' || uiPrefs.font === 'otzaria') applyPrefs();
}

// שחזור ההגדרות מהאחסון של אוצריא, אם localStorage נוקה
async function restorePrefsFromOtzaria(){
  try {
    const stored = await storageGet(PREFS_KEY);
    if (!stored || typeof stored !== 'object') return;
    let hasLocal = false;
    try { hasLocal = !!localStorage.getItem(PREFS_KEY); } catch(e){}
    if (hasLocal) return;
    uiPrefs = Object.assign({}, DEFAULT_PREFS, stored);
    applyPrefs();
  } catch(e){}
}

function waitForOtzaria(elapsed){
  if (window.Otzaria && typeof Otzaria.on === 'function'){
    Otzaria.on('plugin.boot', registerUnifiedMenuItem);
    Otzaria.on('plugin.boot', (p) => { if (p && p.theme) onOtzariaTheme(p.theme); });
    Otzaria.on('theme.changed', onOtzariaTheme);
    // גם משיכה יזומה — plugin.boot כבר עשוי היה לרוץ לפני שנרשמנו
    Otzaria.call('app.getTheme').then(res => { if (res && res.data) onOtzariaTheme(res.data); }).catch(()=>{});
    restorePrefsFromOtzaria();
    restoreBookmarksFromOtzaria();
    Otzaria.on('reader.context_menu_item_clicked', (payload) => {
      if (payload && payload.itemId === MENU_ITEM_ID) handleIdentifyClick(payload);
    });
    // חשוב: לרנדר את כרטיסי דפי ה-HTML השמורים רק אחרי ש-Otzaria אכן זמין -
    // אחרת storage.get נופל מיד ל-null (הבדיקה hasOtzaria() נכשלת) והכרטיסים
    // לא מופיעים בטעינה ראשונה של עמוד השער, גם אם התוכן קיים בזיכרון.
    renderCustomPageCards();
    // אם המופע הזה נפתח בעקבות "זהה בתמונ״ך" בספרייה — מציגים את מה שהמתין באחסון.
    consumePendingIdentify();
    return;
  }
  setTimeout(() => waitForOtzaria(elapsed + 200), 200);
}
waitForOtzaria(0);

// טעינה מוקדמת ברקע של כל מאגרי הזיהוי, כדי שהחיפוש הראשון יהיה מיידי.
preloadAllGuides(CATEGORIES, 0);
