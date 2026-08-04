// מקור הנתונים: אחסון אוצריא, עריכות מקומיות, סימניות וטעינת המדריכים.
// נוצר בפיצול router.js (גרסה 2.11.2). המקור: shell/router.js שורות 25-202, 1467-1478.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.


// ---- עריכות מקומיות: שמירה, טעינה מחדש ושחזור ----
// כל עריכה שנשמרת "במכשיר" נכתבת ל-localStorage תחת <catId>_edits_v1, במבנה:
//   { "<שם מקורי של הערך>": { savedAt, entry: <עותק מלא של הערך אחרי העריכה> } }
// המפתח הוא תמיד השם *המקורי* (לא השם אחרי העריכה) - אחרת שינוי שם היה מנתק את
// העריכה מהערך שלה בטעינה הבאה.
function editsKey(catId){ return (catId || 'general') + '_edits_v1'; }

function readStoredEdits(catId){
  try { return JSON.parse(localStorage.getItem(editsKey(catId)) || '{}'); }
  catch(e){ return {}; }
}

function rememberPristine(catId, entry){
  if (!pristineCache[catId]) pristineCache[catId] = {};
  if (!pristineCache[catId][entry.name]) {
    pristineCache[catId][entry.name] = JSON.parse(JSON.stringify(entry));
  }
}

// מחיל את העריכות השמורות על הנתונים שזה עתה נטענו מקובץ ה-data.
// נקרא פעם אחת לכל מדריך, מיד אחרי הטעינה - כך שהעריכות שורדות רענון/סגירה.
function applyStoredEdits(catId, data){
  const edits = readStoredEdits(catId);
  const names = Object.keys(edits);
  if (!names.length) return data;
  names.forEach(origName => {
    const rec = edits[origName];
    if (!rec || !rec.entry) return;
    const target = data.find(e => e.name === origName);
    if (target){
      rememberPristine(catId, target);   // שומרים את המקור כדי לאפשר שחזור
      Object.assign(target, rec.entry);
      target.__edited = true;
      target.__origName = origName;
    } else {
      // ערך שנוסף מקומית ואינו קיים בקובץ הנתונים המקורי
      data.push(Object.assign({}, rec.entry, { __edited: true, __origName: origName }));
    }
  });
  return data;
}

function saveEntryEdit(catId, origName, entry){
  try {
    const edits = readStoredEdits(catId);
    edits[origName] = { savedAt: new Date().toISOString(), entry: JSON.parse(JSON.stringify(entry)) };
    localStorage.setItem(editsKey(catId), JSON.stringify(edits));
    entry.__edited = true;
    return true;
  } catch(e){
    console.warn('madaei-hatanach: failed to persist edit', e);
    return false;
  }
}

function hasStoredEdit(catId, origName){
  return Object.prototype.hasOwnProperty.call(readStoredEdits(catId), origName);
}

// מחזיר ערך לגרסת המקור שבקובץ הנתונים, ומוחק את העריכה השמורה.
function restoreEntryToOriginal(catId, entry, origName){
  const pristine = pristineCache[catId] && pristineCache[catId][origName];
  try {
    const edits = readStoredEdits(catId);
    delete edits[origName];
    localStorage.setItem(editsKey(catId), JSON.stringify(edits));
  } catch(e){ /* גם אם המחיקה נכשלה, נשחזר לפחות בזיכרון */ }
  if (pristine){
    Object.keys(entry).forEach(k => { delete entry[k]; });
    Object.assign(entry, JSON.parse(JSON.stringify(pristine)));
    return true;
  }
  // אין עותק מקור בזיכרון (הערך נוסף מקומית מלכתחילה) - רק מסירים את סימון העריכה
  delete entry.__edited;
  return false;
}

// ---- סימניות ----
// נשמרות ב-localStorage וממוזערות גם לאחסון של אוצריא (כמו העדפות התצוגה), כדי
// שינוי גרסה או ניקוי של localStorage לא ימחקו אותן. המפתח הוא השם *המקורי* של
// הערך (כמו בעריכות), כדי ששינוי שם מקומי לא ינתק את הסימנייה.
function bookmarkKeyOf(entry){ return (entry && (entry.__origName || entry.name)) || ''; }

function readBookmarks(){
  try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]'); }
  catch(e){ return []; }
}

function writeBookmarks(list){
  try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list)); } catch(e){}
  storageSet(BOOKMARKS_KEY, list);
}

function isBookmarked(catId, key){
  return readBookmarks().some(b => b.catId === catId && b.key === key);
}

// מחזיר true אם הסימנייה נוספה, false אם הוסרה.
function toggleBookmark(catId, key, label){
  const list = readBookmarks();
  const i = list.findIndex(b => b.catId === catId && b.key === key);
  if (i >= 0){ list.splice(i, 1); writeBookmarks(list); return false; }
  list.push({ catId: catId, key: key, label: label || key, addedAt: new Date().toISOString() });
  writeBookmarks(list);
  return true;
}

// שחזור מהאחסון של אוצריא — רק אם אין כלום מקומית (אותו דפוס כמו restorePrefsFromOtzaria).
async function restoreBookmarksFromOtzaria(){
  try {
    let hasLocal = false;
    try { hasLocal = !!localStorage.getItem(BOOKMARKS_KEY); } catch(e){}
    if (hasLocal) return;
    const stored = await storageGet(BOOKMARKS_KEY);
    if (Array.isArray(stored) && stored.length){
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(stored));
    }
  } catch(e){}
}

// טוען את מאגר הנתונים (ואם קיימות - התמונות המוטבעות וחלוקת הקטגוריות) של מדריך
// ע"י iframe נסתר שטוען את קובץ ה-data שלו דרך תגית <script> רגילה (בדיוק כמו שכל
// מדריך טוען את הנתונים של עצמו) - לא דרך fetch, כדי לא להיתקל באפשרות שסביבת
// ה-webview של אוצריא חוסמת fetch לקבצים מקומיים.
function loadGuideData(cat){
  if (dataCache[cat.id]) return Promise.resolve(dataCache[cat.id]);
  if (dataPromises[cat.id]) return dataPromises[cat.id];

  dataPromises[cat.id] = new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    let settled = false;
    const finish = (data, images, cats) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      // מחילים עריכות מקומיות שמורות *לפני* השמירה במטמון, כדי שגם מנוע הזיהוי
      // (שנבנה מאותם נתונים) יכיר את הכינויים/השמות שהמשתמש הוסיף.
      dataCache[cat.id] = applyStoredEdits(cat.id, data);
      imagesCache[cat.id] = images || {};
      catsCache[cat.id] = cats || [];
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      resolve(dataCache[cat.id]);
    };
    function onMessage(ev){
      const msg = ev.data;
      if (!msg || !msg.__madaeiHatanachLoader || msg.cat !== cat.id) return;
      finish(msg.ok ? (msg.data || []) : [], msg.images, msg.cats);
    }
    window.addEventListener('message', onMessage);
    // מאגרי הנתונים כבדים (עד ~6MB לקטגוריה). בטעינה איטית - דיסק עמוס, מכשיר חלש -
    // 8 שניות לא הספיקו והמדריך היה נפתח ריק בלי שום דרך לנסות שוב. עכשיו: חלון ארוך,
    // ובכישלון לא שומרים תוצאה ריקה במטמון כדי שהניסיון הבא ייטען מחדש.
    const timer = setTimeout(() => {
      console.warn('madaei-hatanach: timeout loading data for', cat.id);
      if (!settled) {
        settled = true;
        window.removeEventListener('message', onMessage);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        delete dataPromises[cat.id];   // מאפשר ניסיון חוזר
        resolve([]);
      }
    }, 45000);
    iframe.src = cat.loaderPath;
    document.body.appendChild(iframe);
  });
  return dataPromises[cat.id];
}

// טעינה מוקדמת בטור ולא במקביל: שישה קבצי ענק שנטענים יחד מרעיבים זה את זה
// (ובמיוחד מול שרת/דיסק איטי) ומייצרים בדיוק את הטיימאאוט שלמעלה.
function preloadAllGuides(list, i){
  if (i >= list.length) return;
  loadGuideData(list[i]).then(() => preloadAllGuides(list, i + 1),
                              () => preloadAllGuides(list, i + 1));
}
// אוצריא אינה עקבית בצורת התשובה של storage.get, ושני תוספים שעובדים בפועל קוראים
// אותה הפוך: ״יומא דהילולא״ קורא res.data.value, ו״עיון ההלכה״ קורא res.data עצמו.
// עד היום החזרנו את res.data כמות שהוא — כלומר במעטפת { value: ... } קיבלנו את
// המעטפת ולא את הערך, ‏rec.text יצא undefined, והקוד יצא בשקט בלי שום שגיאה.
// זו הסיבה האמיתית לבאג 996, וגם למה restoreBookmarksFromOtzaria לא שחזר כלום.
// מעכשיו: מקלפים את המעטפת אם היא קיימת, ותומכים בשתי הצורות.
function unwrapStorageValue(data){
  if (data === undefined) return null;
  if (data && typeof data === 'object' && !Array.isArray(data)
      && Object.prototype.hasOwnProperty.call(data, 'value')){
    return data.value === undefined ? null : data.value;
  }
  return data;
}

function storageGet(key){
  if (!hasOtzaria()) return Promise.resolve(null);
  return Otzaria.call('storage.get', { key: key }).then(res => unwrapStorageValue(res && res.data)).catch(() => null);
}
function storageSet(key, value){
  if (!hasOtzaria()) return Promise.resolve(false);
  return Otzaria.call('storage.set', { key: key, value: value }).then(res => !(res && res.success === false)).catch(() => false);
}

// ---- רשומות מבניות באחסון אוצריא ----
// אוצריא אינה מבטיחה שמירת אובייקטים ב-storage.set. בדיקת תוספים שעובדים בפועל
// מראה שני דפוסים סותרים: ״יומא דהילולא״ כותב value: JSON.stringify(...) ואילו
// ״עיון ההלכה״ מעביר את האובייקט כמות שהוא. אם השכבה שמתחת ממירה למחרוזת בעצמה,
// אובייקט נשמר כ-"[object Object]" והקריאה חוזרת שבורה בלי שום שגיאה גלויה —
// בדיוק התסמין של באג 996 (המעבר ללשונית קרה, אבל שום תוצאה לא הוצגה).
// לכן: כותבים תמיד מחרוזת JSON, וקוראים בסובלנות לשני המצבים גם יחד.
function storageSetJson(key, value){
  if (value === null || value === undefined) return storageSet(key, null);
  let payload;
  try { payload = JSON.stringify(value); }
  catch(e){ return Promise.resolve(false); }
  return storageSet(key, payload);
}

function storageGetJson(key){
  return storageGet(key).then(raw => {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'object') return raw;               // גרסה ששומרת אובייקטים כמו שהם
    if (typeof raw !== 'string') return null;
    if (raw === '[object Object]') return null;            // נשמר בגרסה ישנה בלי stringify
    try { return JSON.parse(raw); } catch(e){ return null; }
  });
}

async function getHtmlPagesIndex(){
  return (await storageGet(HTML_PAGES_INDEX_KEY)) || [];
}
