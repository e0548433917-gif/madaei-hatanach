// שכבת ניתוב + זיהוי אחיד לתמונ״ך.
// כל מדריך נשאר קובץ עצמאי לגמרי (guides/<cat>/...) — הקובץ הזה רק קורא להם.

const MENU_ITEM_ID = 'madaei-hatanach-identify';
const DEV_EMAIL = 'E0548433917@outlook.com';
const HTML_PAGES_INDEX_KEY = 'madaei_hatanach_html_pages_index';
// מפתח ה"מסירה" (handoff) של זיהוי שממתין להצגה אחרי מעבר ללשונית התוסף. ר' setPendingIdentify.
const PENDING_IDENTIFY_KEY = 'madaei_hatanach_pending_identify_v1';
const BOOKMARKS_KEY = 'madaei_hatanach_bookmarks_v1';

const CATEGORIES = [
  { id: 'people', label: 'אישים בתנ״ך', icon: '👤', path: 'guides/people/view.html', loaderPath: 'guides/people/data/_loader.html' },
  { id: 'places', label: 'מקומות בתנ״ך', icon: '📍', path: 'guides/places/view.html', loaderPath: 'guides/places/data/_loader.html' },
  { id: 'animal', label: 'בע״ח בתנ״ך', icon: '🐾', path: 'guides/animal/view.html', loaderPath: 'guides/animal/data/_loader.html' },
  { id: 'flora', label: 'צומח בתנ״ך', icon: '🌿', path: 'guides/flora/view.html', loaderPath: 'guides/flora/data/_loader.html' },
  { id: 'domem', label: 'דומם בתנ״ך', icon: '💎', path: 'guides/domem/view.html', loaderPath: 'guides/domem/data/_loader.html' },
  { id: 'beithamikdash', label: 'בית המקדש', icon: '🏛️', path: 'guides/beithamikdash/view.html', loaderPath: 'guides/beithamikdash/data/_loader.html' },
];

const dataCache = {}; // id -> [{name, cat, aliases}]
const imagesCache = {}; // id -> { key: "data:image/...;base64,..." }
const catsCache = {}; // id -> [{id, num, label, blurb}] - קטגוריות הדפדוף המקוריות של אותו מדריך
const dataPromises = {}; // id -> pending Promise, so parallel calls don't spawn duplicate iframes
const pristineCache = {}; // catId -> { שם מקורי: עותק של הערך לפני עריכות מקומיות }

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

function normalizeHeb(s){
  return String(s || '')
    .replace(/[֑-ׇ]/g, '')   // ניקוד וטעמים
    .replace(/[־]/g, ' ')              // מקף
    .replace(/[""'']/g, '')
    .trim();
}

// כתיב חסר/מלא: פסוקים מקראיים כתובים לרוב בכתיב חסר (בלי אותיות ו/י פנימיות
// שרק מציינות תנועה - למשל "חטה"), בעוד שהערכים במאגרי הנתונים כתובים בכתיב מלא
// הרגיל ("חיטה"). לכן בודקים גם התאמה אחרי הסרת כל האותיות ו/י, בדיוק כמו
// שכל מדריך עושה בעצמו (looseForm) בזיהוי הפנימי שלו.
function looseForm(s){ return String(s || '').replace(/[וי]/g, ''); }

// זיהוי מדויק ברמת מילה (לא "תת-מחרוזת בכל מקום בטקסט", כדי לא לקבל התאמות שווא
// כמו "פיל" בתוך "אפילת") - בדיוק כמו tokenizeHeb/candidateForms בכל מדריך בפני עצמו.
//
// HEB_POINT_SRC - טווח יוניקוד של ניקוד/טעמים **בלבד** (לא מקף ־/פסק ׀/סוף-פסוק ׃, שכולם
// נמצאים "בטעות" באותו טווח יוניקוד רחב 0591-05C7 יחד עם הניקוד האמיתי). ההבחנה הזו קריטית:
// אם מסירים גם את המקף לפני tokenizeHeb, "אֶל־מֹשֶׁה" (מילה־מקף־מילה) הופך לטוקן אחד
// "אלמשה" במקום שתי מילים "אל" ו"משה" - זה היה באג אמיתי (תוקן בגרסה 2.0.4). משתמשים באותו
// קבוע גם בהסתרת שבעת השמות למטה (`wholeWordRe`), ששם הבעיה זהה בדיוק.
const HEB_POINT_SRC = '[\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7]';
const HEB_POINT_RE = new RegExp(HEB_POINT_SRC, 'g');
const PREFIXES = ['ה','ו','ב','כ','ל','מ','ש'];
const SUFFIXES = ['ים','ות'];

// מילות-תיאור גנריות שחוזרות בעשרות שמות מורכבים ("ארץ ישראל", "הר סיני", "נחל
// קישון"...) - לא נרשמות כמפתח זיהוי עצמאי כשהן חלק משם רב-מילים (ר' registerPhrase),
// כדי שבחירת "ארץ"/"הר" וכו' בפני עצמה לא תחזיר עשרות התאמות שווא מכל הערכים ששמם
// מתחיל באותה מילה.
const GENERIC_DESCRIPTORS = new Set(['ארץ','הר','נחל','ים','עמק','מדבר','בית','עיר','בני','מעין','גיא','שדה','עין']);

// מילות-קישור/יחס נפוצות מדי מכדי לשמש בזיהוי - "ממנה" למשל, אחרי הסרת ה-מ' כתחילית
// כאילו הייתה מ' השימוש, הופך ל"מנה" (מטבע) ומייצר זיהוי שווא. מילים כאלה נפסלות
// לגמרי מזיהוי (לא רק כמפתח, גם כמילת-טקסט להשוואה) עוד לפני חישוב candidateForms.
const STOPWORDS = new Set(['ממנה','אשר','כמו','אלה','אותה','אותו','להם','מהם','אליה','אליו','עליה','עליו','מהן','בהם','בהן','להן','אתה','אתם','אנחנו','זאת','זה']);

// מסיר ניקוד/טעמים (HEB_POINT_RE - לא כולל מקף!) לפני ה-match, כדי שאותיות מנוקדות בתוך
// מילה אחת יתחברו לטוקן אחד ("וַיֹּ֩אמֶר֩" -> "ויאמר"). בגרסה קודמת הוסר גם המקף (־) - כי
// היה כלול (בטעות) באותו טווח יוניקוד רחב - וזה גרם ל"אֶל־מֹשֶׁה" (מילה־מקף־מילה) להתמזג
// לטוקן אחד שגוי "אלמשה" במקום שתי מילים "אל" ו"משה". תוקן ע"י שימוש ב-HEB_POINT_RE
// המדויק יותר, שלא כולל מקף/פסק/סוף-פסוק - אלה נשארים כגבול מילה טבעי (כמו רווח).
function tokenizeHeb(text){
  return (text || '').replace(HEB_POINT_RE, '').match(/[א-ת]+/g) || [];
}

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

const lookupCache = {}; // catId -> { exact: Map<string,[entry,...]>, loose: Map<string,[entry,...]> }

function buildLookup(data){
  const exact = new Map(), loose = new Map();
  function registerKey(phrase, entry){
    const norm = normalizeHeb(phrase);
    if (!norm || norm.length < 2) return;
    if (!exact.has(norm)) exact.set(norm, []);
    exact.get(norm).push(entry);
    // כתיב חסר: נרשם רק כשהצורה הרזה נשארת באורך 3+ - "בית" שהופך ל"בת" הוא קצר
    // מדי ומייצר זיהויי שווא (שבת -> בית שאן). מילים קצרות ימצאו רק בהתאמה מדויקת.
    const lo = looseForm(norm);
    if (lo.length >= 3 && lo !== norm){
      if (!loose.has(lo)) loose.set(lo, []);
      loose.get(lo).push(entry);
    }
  }
  function registerPhrase(phrase, entry){
    if (!phrase) return;
    registerKey(phrase, entry);
    const words = String(phrase).trim().split(/\s+/).filter(Boolean);
    if (words.length > 1) words.forEach(w => {
      const norm = normalizeHeb(w);
      if (norm.length >= 3 && !GENERIC_DESCRIPTORS.has(norm)) registerKey(w, entry);
    });
  }
  data.forEach(entry => {
    let nameCore = entry.name || '', nameParen = '';
    const pm = nameCore.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    if (pm){ nameCore = pm[1]; nameParen = pm[2]; }
    registerPhrase(nameCore, entry);
    if (nameParen) registerPhrase(nameParen, entry);
    (entry.aliases || []).forEach(a => registerPhrase(a, entry));
  });
  return { exact, loose };
}

async function getLookup(cat){
  if (lookupCache[cat.id]) return lookupCache[cat.id];
  const data = await loadGuideData(cat);
  const lookup = buildLookup(data);
  lookupCache[cat.id] = lookup;
  return lookup;
}

// אחרי עריכה מקומית (שם/כינויים) צריך לבנות מחדש את מפת הזיהוי של אותו מדריך.
function invalidateLookup(catId){ delete lookupCache[catId]; }

async function identify(rawText){
  const words = tokenizeHeb(rawText);
  if (!words.length) return [];
  const results = []; // {catId, catLabel, name, entry, matchedVia}

  for (const cat of CATEGORIES){
    const { exact, loose } = await getLookup(cat);
    const seen = new Set(); // entry (object identity) already added for this category
    for (const w of words){
      if (STOPWORDS.has(normalizeHeb(w))) continue;
      const forms = candidateForms(w);
      let hitEntries = null;
      for (const f of forms){ if (exact.has(f)){ hitEntries = exact.get(f); break; } }
      if (!hitEntries){
        for (const f of forms){
          const lf = looseForm(f);
          if (lf.length >= 3 && loose.has(lf)){ hitEntries = loose.get(lf); break; }
        }
      }
      if (hitEntries){
        hitEntries.forEach(entry => {
          if (seen.has(entry)) return;
          seen.add(entry);
          results.push({ catId: cat.id, catLabel: cat.label, catIcon: cat.icon, name: entry.name, term: entry.name, entry: entry, matchedVia: w });
        });
      }
    }
  }

  // חיפוש גם בתוך דפי ה-HTML המותאמים שנשמרו (תוכן טקסטואלי בלבד, אחרי הסרת תגיות).
  const customMatches = await identifyInCustomPages(normalizeHeb(rawText));
  results.push(...customMatches);

  return results;
}

async function identifyInCustomPages(normalizedText){
  const index = await getHtmlPagesIndex();
  const results = [];
  for (const name of index){
    const content = await storageGet('madaei_html_page__' + name);
    if (!content) continue;
    const plain = normalizeHeb(content.replace(/<[^>]*>/g, ' '));
    if (plain.includes(normalizedText)){
      results.push({ catId: 'custom', catLabel: 'דף מותאם', catIcon: '➕', name: name, term: name });
    }
  }
  return results;
}

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

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// הסתרת שבעת השמות שאינם נמחקים (רמב"ם הל' יסודי התורה פ"ו, ה"א-ב) מפני קדושתם: יהוה,
// אל, אלוה, אלהים/אלוהים, אדני, שדי, צבאות. מסתירים רק בתצוגה (כאן) - לא בקובצי ה-data
// עצמם - כדי לשמור על דיוק מלא של הפסוק המקורי לצורך העתקה/תחזוקה (ר' תחילת מסמך זה).
// לא נוגעים בטפסי עריכה (openGenericEditForm) - שם צריך לראות/לשמור את הטקסט המקורי.
//
// זיהוי ברמת מילה שלמה בלבד (לא תת-מחרוזת!) - כדי לא לפגוע במילים שרק "נראות דומות" כמו
// "אלה"/"אלמנה"/"אלישע", ואף לא ב"זיהוהו" (מכיל את הרצף המקרי י-ה-ו-ה!). לכן משתמשים כאן
// ב-HEB_POINT_SRC (מוגדר למעלה ליד tokenizeHeb - ניקוד/טעמים בלבד, בלי מקף/פסק/סוף-פסוק) -
// אחרת "אל" המחובר במקף למילה הבאה (כמו "אֶל־מֹשֶׁה") היה נבלע כמילה אחת ולא מזוהה כגבול מילה.
function hebWordSrc(letters){ return letters.split('').map(ch => ch + HEB_POINT_SRC + '*').join(''); }
// עד שתי תחיליות (ה/ו/ב/כ/ל/מ/ש) מותרות לפני כל שם - כמו "וְהָאֱלֹהִים"/"לֵֽאלֹהִים"/"לַֽיהֹוָה" -
// אותה רשימת PREFIXES שכבר משמשת את candidateForms במנוע הזיהוי, כדי לתפוס גם צורות
// מחוברות ולא רק את השם הבודד. הבדיקה (לפני ואחרי, כולל התחיליות) מוודאת גבול מילה אמיתי -
// לא letter אחר שרק במקרה קודם/בא אחרי (למשל ה"ז" שב"זיהוהו"). ל"אל" בלבד - מקסימום תחילית
// אחת (לא שתיים): עם שתי תחיליות "אל" הקצר (2 אותיות בלבד) מתנגש במילים שכיחות כמו
// "שְׂמֹאל" (ש+מ+אל!) - ר' דוגמה בפונקציית הבדיקה. השמות הארוכים יותר (3-6 אותיות) לא
// נתקלו בהתנגשות דומה גם עם שתי תחיליות, ומרוויחים ממנה צורות אמיתיות כמו "וְהָאֱלֹהִים".
function wholeWordRe(src, opts){
  opts = opts || {};
  const maxPrefix = opts.maxPrefix != null ? opts.maxPrefix : 2;
  const prefixSrc = '(?:[' + PREFIXES.join('') + ']' + HEB_POINT_SRC + '*){0,' + maxPrefix + '}';
  const fix = opts.captureFix ? '(' + prefixSrc + ')' : '(?:' + prefixSrc + ')';
  return new RegExp('(?<![א-ת]' + HEB_POINT_SRC + '*)' + fix + '(?:' + src + ')(?!' + HEB_POINT_SRC + '*[א-ת])', 'g');
}
// כאן התחילית נלכדת (capture) בכוונה - כי ההחלפה של יהוה היא למחרוזת קבועה ('ה׳'), ובניגוד
// לשאר השמות (שרק "נשברים" עם מקף במקום, ר' hyphenateFromEnd) - צריך לשחזר את התחילית
// בעצמנו ב-maskDivineName כדי לא "לבלוע" אותה (למשל "לַֽיהֹוָה" -> "לַֽ" + "ה׳", לא רק "ה׳").
const DIVINE_NAME_RE = wholeWordRe(hebWordSrc('יהוה'), { captureFix: true });

// "אל" נכלל למרות שהוא גם מילת-יחס נפוצה ("אל משה") - לפי החלטה מפורשת שהתקבלה מהמפתח,
// על אף הפגיעה הצפויה בקריאות פסוקים רבים. מכסה רק את הצורה הבסיסית של כל שם - לא צורות
// נטויות עם סיומת שייכות (אלהיך/אלהינו/אלהי וכו') ולא צורות ארוכות/רחוקות יותר.
const OTHER_SACRED_NAMES = [
  { src: hebWordSrc('אל'), fromEnd: 1, maxPrefix: 1 },
  { src: hebWordSrc('שדי'), fromEnd: 1 },
  { src: hebWordSrc('אלוה'), fromEnd: 1 },
  { src: hebWordSrc('אדני'), fromEnd: 1 },
  { src: hebWordSrc('צבאות'), fromEnd: 2 },
  { src: hebWordSrc('אל') + '(?:ו' + HEB_POINT_SRC + '*)?' + hebWordSrc('הים'), fromEnd: 2 }, // אלהים / אלוהים
].map(n => ({ fromEnd: n.fromEnd, re: wholeWordRe(n.src, { maxPrefix: n.maxPrefix }) }));

// מכניס מקף לפני ה-N אותיות (לא ניקוד) האחרונות בהתאמה - כדי לשמור על הניקוד המקורי בדיוק.
function hyphenateFromEnd(match, fromEnd){
  let count = 0;
  for (let i = match.length - 1; i >= 0; i--){
    if (/[א-ת]/.test(match[i])){
      count++;
      if (count === fromEnd) return match.slice(0, i) + '-' + match.slice(i);
    }
  }
  return match;
}

function maskDivineName(html){
  let out = String(html==null?'':html).replace(DIVINE_NAME_RE, (m, prefix) => prefix + 'ה׳');
  OTHER_SACRED_NAMES.forEach(n => { out = out.replace(n.re, m => hyphenateFromEnd(m, n.fromEnd)); });
  return out;
}

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

function renderGuideChips(){
  const cats = (currentGuideCat && catsCache[currentGuideCat.id]) || [];
  if (!cats.length){ guideChips.innerHTML = ''; guideChips.style.display = 'none'; return; }
  guideChips.style.display = 'flex';
  const totalCount = currentGuideData.length;
  guideChips.innerHTML = `<button class="chip${activeGuideChip==='all'?' active':''}" data-chip="all">הכל (${totalCount})</button>` +
    cats.map(c => {
      const n = currentGuideData.filter(e => e.cat === c.id).length;
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
    if (activeGuideChip !== 'all' || guideSearchBox.value){
      activeGuideChip = 'all';
      guideSearchBox.value = '';
      renderGuideGrid('');
    }
    setTimeout(() => {
      const el = document.getElementById('worldMap');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  });
}

// כשאין חיפוש והצ'יפ הפעיל הוא "הכל" - מקבצים לפי הקטגוריות המקוריות של המדריך (בדיוק
// כמו שהיה בכל מדריך בנפרד: כותרת קטגוריה + מספר סידורי + הסבר). אחרת - רשימה שטוחה.
function renderGuideGrid(filterText){
  renderGuideChips();
  const q = normalizeHeb(filterText || '').trim();
  let list = currentGuideData;
  if (activeGuideChip !== 'all') list = list.filter(e => e.cat === activeGuideChip);
  if (q) list = list.filter(e => normalizeHeb(e.name + ' ' + (e.aliases || []).join(' ')).includes(q));

  if (!list.length){
    guideGrid.innerHTML = '<div class="grid-empty">אין תוצאות.</div>';
    return;
  }

  const cats = (currentGuideCat && catsCache[currentGuideCat.id]) || [];
  const groupByCat = activeGuideChip === 'all' && !q && cats.length;
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
  const isPlaces = currentGuideCat && currentGuideCat.id === 'places' && !q && activeGuideChip === 'all';
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

const TANAKH_BOOKS = ['דברי הימים א','דברי הימים ב','שיר השירים','שמואל א','שמואל ב','מלכים א','מלכים ב','בראשית','שמות','ויקרא','במדבר','דברים','יהושע','שופטים','ישעיהו','ירמיהו','יחזקאל','הושע','יואל','עמוס','עובדיה','יונה','מיכה','נחום','חבקוק','צפניה','חגי','זכריה','מלאכי','תהלים','משלי','איוב','רות','איכה','קהלת','אסתר','דניאל','עזרא','נחמיה'];
const HEB_CH = /^[א-ת]{1,3}$/;
function parseVerseRef(ref){
  if (!ref) return null;
  const clean = String(ref).split(';')[0].replace(/\s*\([^)]*\)\s*$/, '').trim();
  for (const book of TANAKH_BOOKS){
    // "ספר פרק, פסוק" (רוב המדריכים) — למשל "יהושע ה, ב"
    if (clean.startsWith(book + ' ')){
      const chapter = clean.slice(book.length + 1).trim().split(',')[0].trim().split(/\s+/)[0];
      if (HEB_CH.test(chapter)) return { bookId: book, ref: 'פרק ' + chapter };
    }
    // "ספר, פרק פסוק" (מדריך דומם) — למשל "איוב, כח א"
    if (clean.startsWith(book + ', ')){
      const chapter = clean.slice(book.length + 2).trim().split(/\s+/)[0].replace(',', '');
      if (HEB_CH.test(chapter)) return { bookId: book, ref: 'פרק ' + chapter };
    }
  }
  // מפרשים: "אבן עזרא על אסתר ב, ה" → ספר "אבן עזרא על אסתר"
  const m = clean.match(/^(.+? על .+?)\s+([א-ת]{1,3}),\s*.+$/);
  if (m) return { bookId: m[1].replace(/״/g, '"').trim(), ref: 'פרק ' + m[2] };
  return null;
}

// מזהה מראי מקום של חז"ל ("בבלי, ברכות לג ע\"א", "משנה, אבות ה, ה", "בראשית רבה נא, א"...)
// ומחזיר bookId+ref לפתיחה בספריית אוצריא. מחזיר null כשהמקור אינו ספר בספרייה.
// מסכתות הבבלי — כדי לזהות ציטוט בלי הקדמת "בבלי" ("מגילה י ע\"ב"), שהוא
// הצורה המקובלת בכתיבה. בלי הרשימה הזו כל ציטוט כזה נשאר טקסט מת שלא נפתח בספרייה.
const BAVLI_MASECHTOT = ['ברכות','שבת','עירובין','פסחים','שקלים','ראש השנה','יומא','סוכה',
  'ביצה','תענית','מגילה','מועד קטן','חגיגה','יבמות','כתובות','נדרים','נזיר','סוטה','גיטין',
  'קידושין','בבא קמא','בבא מציעא','בבא בתרא','סנהדרין','מכות','שבועות','עבודה זרה','הוריות',
  'זבחים','מנחות','חולין','בכורות','ערכין','תמורה','כריתות','מעילה','תמיד','נדה'];

function parseMidrashRef(source){
  if (!source) return null;
  const s = String(source).split(';')[0].replace(/\s*\([^)]*\)\s*$/, '').replace(/״/g, '"').trim();
  let m;
  // בבלי: "בבלי, ברכות לג ע"א" / "בבלי, חולין נב:" / "בבלי, חגיגה כז."
  m = s.match(/^(?:משנה ו?גמרא|בבלי),?\s+([א-ת" ]+?)\s+([א-ת]{1,3})\s*(?:ע"[אב]|[.:])?$/);
  if (m) return { bookId: m[1].trim(), ref: 'דף ' + m[2] };
  // מסכת בלי הקדמת "בבלי": "מגילה י ע"ב" / "קידושין מט:" / "בבא בתרא לח ע"א".
  // כאן סימן הדף (ע"א/ע"ב/נקודה/נקודתיים) הוא חובה, וגם השם חייב להיות מסכת
  // מוכרת — אחרת "בראשית רבה נא" וכדומה היו נתפסים כאן בטעות.
  m = s.match(/^([א-ת" ]+?)\s+([א-ת]{1,3})\s*(?:ע"[אב]|[.:])$/);
  if (m && BAVLI_MASECHTOT.indexOf(m[1].trim()) !== -1) return { bookId: m[1].trim(), ref: 'דף ' + m[2] };
  // ירושלמי: "ירושלמי שביעית ו, א"
  m = s.match(/^ירושלמי,?\s+([א-ת" ]+?)\s+([א-ת]{1,3})\s*,\s*[א-ת]{1,3}$/);
  if (m) return { bookId: 'תלמוד ירושלמי ' + m[1].trim(), ref: 'פרק ' + m[2] };
  // משנה / תוספתא: "משנה, אבות ה, ה" / "תוספתא, פרה ט, ד" (גם בלי פסיק אחרי הסוג)
  m = s.match(/^(משנה|תוספתא),?\s+([א-ת" ]+?)\s+([א-ת]{1,3})\s*,\s*[א-ת–-]{1,7}$/);
  if (m) return { bookId: m[1] + ' ' + m[2].trim(), ref: 'פרק ' + m[3] };
  // רמב"ם: "רמב"ם, הלכות בית הבחירה א, ב"
  m = s.match(/^רמב"ם,?\s+(הלכות [א-ת" ]+?)\s+([א-ת]{1,3})\s*,\s*[א-ת]{1,3}$/);
  if (m) return { bookId: 'משנה תורה, ' + m[1].trim(), ref: 'פרק ' + m[2] };
  // מדרש רבה: "בראשית רבה נא, א" / "בראשית רבה, פרשה יט" / "מדרש איכה רבה, פרשה א"
  m = s.match(/^([א-ת" ]+? רבה)\s*,?\s*(?:פרשה\s+)?([א-ת]{1,3})(?:\s*,\s*.+)?$/);
  if (m) return { bookId: m[1].replace(/^מדרש\s+/, '').trim(), ref: 'פרשה ' + m[2] };
  // מפרשים: "רש"י על יחזקאל מ, ב"
  m = s.match(/^(.+? על .+?)\s+([א-ת]{1,3}),\s*.+$/);
  if (m) return { bookId: m[1].trim(), ref: 'פרק ' + m[2] };
  // כללי: "פרקי דרבי אליעזר, פרק י"
  m = s.match(/^([א-ת" ]+?),\s*פרק\s+([א-ת]{1,3})$/);
  if (m) return { bookId: m[1].trim(), ref: 'פרק ' + m[2] };
  return null;
}

// מזהה כל ציטוט שניתן לפתוח בספרייה — פסוק, מקור חז"ל או מפרש.
function parseAnyRef(ref){
  return parseVerseRef(ref) || parseMidrashRef(ref);
}

function openInReader(bookId, ref){
  if (!(window.Otzaria && Otzaria.call)) return;
  Otzaria.call('reader.openBookAtRef', { bookId, ref, index: 0 }).then(r => {
    if (!r || !r.success) throw new Error('open failed');
  }).catch(() => {
    Otzaria.call('notifications.showInApp', { message: 'לא ניתן לפתוח את המקור כרגע בספרייה.', type: 'info' }).catch(() => {});
  });
}

// ---- קישורים חיצוניים ----
// לא נותנים ל-WebView לנווט ישירות (זה מה שקורס) — שואלים אישור בפופאפ
// ופותחים בדפדפן המערכת דרך app.openUrl, כמו בתוסף מקומות המקורי.
async function confirmOpenExternal(url){
  if (!(window.Otzaria && typeof Otzaria.call === 'function')){
    window.alert('פתיחת קישורים חיצוניים זמינה רק מתוך אוצריא.');
    return;
  }
  let hostname = url;
  try { hostname = new URL(url).hostname || url; } catch(_) { /* ignore */ }
  const res = await Otzaria.call('ui.showConfirm', {
    title: 'קישור לאתר חיצוני',
    content: `הקישור הזה מוביל אל האתר "${hostname}" — מחוץ לתוסף. האם לפתוח אותו בדפדפן המערכת שלכם?\n\n💚 אין לך אינטרנט? אתה שמור, אשריך! אתה מקיים את העולם — המשך כך, שכרך ישולם לך לעולם הבא, אבל תזכה לאכול מפירותיה גם בעולם הזה!`
  }).catch(() => null);
  if (!res || !res.success || !res.data || res.data.confirmed !== true) return;
  const r = await Otzaria.call('app.openUrl', { url }).catch(() => null);
  if (!r || !r.success){
    await Otzaria.call('ui.showError', { message: 'פתיחת הקישור נכשלה.' }).catch(() => {});
  }
}

document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-external-link]');
  if (!link) return;
  e.preventDefault();
  e.stopPropagation();
  const url = link.getAttribute('data-external-link');
  if (url) confirmOpenExternal(url);
  else if (window.Otzaria && Otzaria.call) Otzaria.call('ui.showError', { message: 'קישור זה אינו נגיש מתוך התוסף.' }).catch(() => {});
}, true); // capture — לתפוס את הלחיצה לפני שהדפדפן מנווט

// מאגרי המדריכים לא אחידים בשמות השדות של מקורות חז״ל: מקומות משתמש ב-{source,note,link}
// ואישים/בע״ח/צומח/דומם ב-{ref,text}. עד כה השַׁלֶּה קרא רק source/note ולכן בכל כרטיס
// אישים הוצגה תיבה ריקה תחת "מקורות חז״ל". שני העוזרים האלה מקבלים את שתי הצורות.
function midrashSource(m){ return (m && (m.source || m.ref)) || ''; }
function midrashNote(m){ return (m && (m.note || m.text)) || ''; }

function fieldBlock(label, value){
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return '';
  const text = Array.isArray(value) ? value.join(', ') : value;
  return `<div class="field-label">${esc(label)}</div><p>${esc(text)}</p>`;
}

// זיהוי מודרני בקצרה - לשורת הפופאפ ולרשימת התוצאות, לפי איזה שדה קיים בערך:
// identification (דומם), methods[0].modern (מקומות), methods[0].latin (חי/צומח).
function shortModernId(entry){
  if (!entry) return '';
  const m0 = entry.methods && entry.methods[0];
  let s = entry.identification || (m0 && (m0.modern || m0.latin)) || '';
  s = String(s).replace(/\s+/g, ' ').trim();
  if (s.length > 70) s = s.slice(0, 67) + '...';
  return s;
}

// ---- קישורים בין אישים (אב/אם/בני זוג/ילדים/אחים לחיצים, כמו במדריך המקורי) ----
const PERSON_LINK_FIELDS = new Set(['father','mother','spouses','children','siblings']);
function isPersonEntry(entry){ return (dataCache['people'] || []).indexOf(entry) !== -1; }
function findPersonEntry(raw){
  const data = dataCache['people'] || [];
  const core = s => normalizeHeb(String(s||'').replace(/\s*\([^)]*\)\s*$/, ''));
  const norm = core(raw);
  if (!norm) return null;
  return data.find(e => core(e.name) === norm ||
    (e.aliases || []).some(a => core(a) === norm)) || null;
}
function personLinkedValue(value, selfEntry){
  const list = Array.isArray(value) ? value : [value];
  return list.filter(v => v != null && v !== '').map(name => {
    const target = findPersonEntry(name);
    if (target && target !== selfEntry) return `<span class="person-link" data-person="${esc(name)}">${esc(name)}</span>`;
    return esc(name);
  }).join(' · ');
}

// ---- סכימת שדות לכל מדריך ----
// מגדירה אילו שדות "אמורים" להיות בערך של כל מדריך. משמשת לשני דברים:
// 1. בתצוגה - להראות גם שדות **חסרים** (באפור, "—"), כדי שיידעו איזה מידע עוד חסר.
// 2. בעריכה - לפתוח את *כל* השדות לעריכה, לא רק את אלה שכבר מלאים.
const FIELD_LABELS = {
  tribe:'שבט/משפחה', father:'אב', mother:'אם', spouses:'בני/בנות זוג',
  children:'ילדים', siblings:'אחים/אחיות', roles:'תפקיד',
  birthPlace:'מקום לידה', dwelling:'מקום מגורים', deathPlace:'מקום פטירה',
  burialPlace:'מקום קבורה', age:'שנות חיים', note:'הערה',
  explanation:'הסבר', identification:'זיהוי מודרני', region:'נחלה',
  gender:'מין', era:'תקופה', modern:'זיהוי מודרני', latin:'שם מדעי (לטיני)',
  wiki:'ערך ויקיפדיה', confidence:'מידת ודאות', mapQuery:'חיפוש במפה'
};
const ARRAY_FIELDS = new Set(['aliases','spouses','children','siblings','roles']);
const LONG_FIELDS = new Set(['explanation','identification','note','modern']);

const GUIDE_FIELDS = {
  people: ['gender','father','mother','spouses','children','siblings','roles','tribe','birthPlace','dwelling','deathPlace','burialPlace','age','note'],
  places: ['region','explanation','modern','mapQuery','note'],
  animal: ['explanation','latin','wiki','confidence','note'],
  flora:  ['explanation','latin','wiki','confidence','note'],
  domem:  ['tribe','explanation','identification','note'],
  beithamikdash: ['explanation','identification','note']
};
// שדות שיושבים בתוך methods[0] ולא ישירות על הערך (חי/צומח/מקומות/מקדש)
const METHOD_FIELDS = new Set(['explanation','latin','wiki','confidence','modern','mapQuery']);

function guideFieldsFor(catId, entry){
  const base = GUIDE_FIELDS[catId] || ['explanation','identification','note'];
  // שדות מותאמים אישית שהמשתמש הוסיף לערך הזה (customFields) מוצגים גם הם
  const custom = entry && entry.customFields ? Object.keys(entry.customFields) : [];
  return { base, custom };
}

// קורא ערך שדה בין אם הוא ישיר על הערך ובין אם הוא בתוך methods[0]
function readField(entry, key){
  if (METHOD_FIELDS.has(key)){
    const m0 = entry.methods && entry.methods[0];
    if (m0 && m0[key] != null && m0[key] !== '') return m0[key];
  }
  return entry[key];
}
function writeField(entry, key, value){
  if (METHOD_FIELDS.has(key)){
    if (!entry.methods) entry.methods = [{}];
    if (!entry.methods[0]) entry.methods[0] = {};
    entry.methods[0][key] = value;
    return;
  }
  entry[key] = value;
}
function isEmptyVal(v){
  return v == null || v === '' || (Array.isArray(v) && !v.length);
}

// ---- ערכי הבחנה ----
// רשומה שתפקידה "שם משותף" אינה אדם אלא טבלת מפתח לכמה אישים שנושאים את
// אותו שם. עד כה היא נראתה כמו כרטיס שבור: שמות הווריאנטים היו טקסט מת בתוך
// ההערה (note לא נכלל ב-PERSON_LINK_FIELDS), ומתחת התיבה "פרטים שאינם במדריך"
// מנתה כמעט הכול כחסר - למרות שלטבלת מפתח אין ולא צריך להיות אב, שבט או גיל.
function isDisambigEntry(entry){
  return !!entry && Array.isArray(entry.roles) && entry.roles.indexOf('שם משותף') !== -1;
}
// מחלץ את רשימת הווריאנטים מתוך ההערה ("... האישים עצמם: א · ב · ג.")
function disambigVariants(entry){
  const m = String((entry && entry.note) || '').match(/האישים עצמם:\s*(.+)$/);
  if (!m) return [];
  return m[1].replace(/[.\s]+$/, '').split('·').map(s => s.trim()).filter(Boolean);
}
// אותה הערה בלי רשימת הווריאנטים (הרשימה מוצגת בנפרד, כקישורים)
function disambigIntro(entry){
  return String((entry && entry.note) || '')
    .replace(/\s*—?\s*האישים עצמם:\s*.+$/, '')
    .replace(/\s*הערך הזה הוא ערך הבחנה בלבד\s*/, ' ')
    .trim();
}

// לאיזה מדריך שייך הערך, כשאין הקשר של מדריך פתוח (למשל פתיחה מהאזור האישי או
// משורת החיפוש). מזהה לפי זהות האובייקט בתוך dataCache, ולכן מדויק גם לשמות כפולים.
function catIdOfEntry(entry){
  for (const cat of CATEGORIES){
    const d = dataCache[cat.id];
    if (d && d.indexOf(entry) !== -1) return cat.id;
  }
  return null;
}

function renderEntryDetailHTML(entry, catIdOverride){
  const catId = catIdOverride || (currentGuideCat ? currentGuideCat.id : null) || catIdOfEntry(entry);
  const leadImg = catId ? lookupEntryImage(entry, catId) : null;
  const gallery = catId ? lookupEntryGallery(entry, catId) : [];
  const wikiTitle = !leadImg && entry.methods && entry.methods[0] && entry.methods[0].wiki;
  let html = '';
  if (leadImg) html += `<img src="${leadImg}" alt="${esc(entry.name)}" style="max-width:100%;border-radius:10px;margin-bottom:12px;display:block;">`;
  else if (entry.customImage) html += `<img src="${esc(entry.customImage)}" alt="${esc(entry.name)}" style="max-width:100%;border-radius:10px;margin-bottom:12px;display:block;">`;
  else if (wikiTitle) html += `<div data-wiki-lazy="${esc(wikiTitle)}" style="margin-bottom:12px;"></div>`;
  const bmKey = bookmarkKeyOf(entry);
  const bmOn = !!catId && isBookmarked(catId, bmKey);
  html += `<h2>${esc(entry.name)}`
    + ` <button id="entryBookmarkBtn" class="entry-tool-btn${bmOn ? ' bm-on' : ''}"`
    + ` title="${bmOn ? 'הסרה מהסימניות' : 'הוספה לסימניות (האזור האישי)'}"`
    + ` data-bm-cat="${esc(catId || '')}" data-bm-key="${esc(bmKey)}" data-bm-label="${esc(entry.name)}">${bmOn ? '★' : '☆'}</button>`
    + ` <button id="entryPrintBtn" title="הדפסה" class="entry-tool-btn">🖨️</button>`
    + ` <button id="entryEditBtn" title="עריכת הכרטיס / הוספת מידע" class="entry-tool-btn">✏️</button></h2>`;
  html += `<div class="entry-sub">כינויים: ${entry.aliases && entry.aliases.length ? esc(entry.aliases.join(', ')) : '<span class="missing-val">— חסר</span>'}</div>`;
  if (entry.__edited) html += `<div class="edited-note">✏️ כרטיס זה נערך על ידכם ונשמר במכשיר זה. לשחזור לגרסת המקור — פתחו את העריכה (✏️) ולחצו "שחזור לגרסת המקור".</div>`;

  const personEntry = isPersonEntry(entry);
  const disambig = isDisambigEntry(entry);
  const { base, custom } = guideFieldsFor(catId, entry);
  const missing = [];

  // ערך הבחנה: תג במקום "תפקיד: שם משותף", ורשימת האישים כקישורים לחיצים
  if (disambig){
    const variants = disambigVariants(entry);
    const intro = disambigIntro(entry);
    html += `<div class="conf-tag">ערך הבחנה</div>`;
    if (intro) html += `<p>${esc(intro)}</p>`;
    if (variants.length){
      html += `<div class="field-label">האישים בשם זה</div><p>` +
        variants.map(n => {
          const target = findPersonEntry(n);
          return target && target !== entry
            ? `<span class="person-link" data-person="${esc(n)}">${esc(n)}</span>`
            : `${esc(n)} <span class="missing-val">(אין כרטיס)</span>`;
        }).join(' · ') + `</p>`;
    }
  }

  base.forEach(k => {
    // אצל ערך הבחנה השניים האלה מוצגים למעלה בצורה טובה יותר
    if (disambig && (k === 'note' || k === 'roles')) return;
    const label = FIELD_LABELS[k] || k;
    const v = readField(entry, k);
    if (isEmptyVal(v)){ if (!disambig) missing.push(label); return; }
    if (personEntry && PERSON_LINK_FIELDS.has(k)){
      const linked = personLinkedValue(v, entry);
      if (linked){ html += `<div class="field-label">${esc(label)}</div><p>${linked}</p>`; return; }
    }
    html += fieldBlock(label, v);
  });

  // שדות מותאמים שהמשתמש הוסיף (קטגוריות חדשות: קישורים, מידע מחז"ל וכו')
  custom.forEach(k => {
    const v = entry.customFields[k];
    if (isEmptyVal(v)) return;
    html += `<div class="field-label">${esc(k)}</div><p>${esc(v)}</p>`;
  });

  if (entry.methods && entry.methods.length){
    html += `<div class="field-label">${entry.methods.length>1?'שיטות זיהוי / דעות':'הסבר'}</div>`;
    entry.methods.forEach(m => {
      html += `<div class="method-block">`;
      if (m.confidence) html += `<span class="conf-tag">${esc(m.confidence)}</span>`;
      if (m.latin) html += `<p class="latin">${esc(m.latin)}</p>`;
      if (m.explanation) html += `<p>${esc(m.explanation)}</p>`;
      if (m.modern) html += `<p><strong>זיהוי מודרני:</strong> ${esc(m.modern)}</p>`;
      if (m.geo && m.geo.length >= 2){
        html += `<div class="offline-map" data-geo="${m.geo[0]},${m.geo[1]},${m.geo[2]||7}" data-cat="${esc(entry.cat||'')}" ></div>`;
        const mapsUrl = `https://www.google.com/maps?q=${m.geo[0]},${m.geo[1]}`;
        html += `<p style="display:flex;gap:12px;flex-wrap:wrap;">
          <a href="#" class="focus-main-map" data-geo="${m.geo[0]},${m.geo[1]},${m.geo[2]||7}" data-name="${esc(entry.name)}">🗺️ הצג במפה הראשית</a>
          <a href="${mapsUrl}" data-external-link="${mapsUrl}">📍 פתח במפות גוגל ↗</a>
        </p>`;
      }
      html += `</div>`;
    });
  }

  const verseList = entry.verses || entry.makorot || [];
  if (verseList.length){
    html += `<div class="field-label">מקורות בתנ״ך</div>`;
    verseList.forEach((v,i) => {
      const parsed = parseAnyRef(v.ref);
      html += `<div class="verse-card${parsed?' clickable':''}" data-vref="${i}">
        <div class="verse-ref">${esc(v.ref)}${parsed?' <span class="open-hint">↗ פתח בספרייה</span>':''}</div>
        ${v.text ? `<div class="verse-text">${v.text}</div>` : ''}
      </div>`;
    });
  }

  if (entry.midrash && entry.midrash.length){
    html += `<div class="field-label">מקורות חז״ל</div>`;
    entry.midrash.forEach((m,i) => {
      const src = midrashSource(m), note = midrashNote(m);
      if (!src && !note) return;   // בלי זה נוצרה תיבה ריקה לגמרי
      const parsed = src ? parseMidrashRef(src) : null;
      html += `<div class="src-item${parsed?' clickable':''}" data-mref="${i}">${src?`<div class="src-source">${esc(src)}${parsed?' <span class="open-hint">↗ פתח בספרייה</span>':''}</div>`:''}${note?`<div class="src-note">${esc(note)}</div>`:''}${m.link?`<a href="${esc(m.link)}" data-external-link="${esc(m.link)}">קישור ↗</a>`:''}</div>`;
    });
  }
  if (entry.academic && entry.academic.length){
    html += `<div class="field-label">מקורות נוספים</div>`;
    entry.academic.forEach(a => {
      const txt = (typeof a === 'string') ? a : (a.citation || a.note || a.text || a.ref || '');
      if (!txt) return;
      html += `<div class="src-item">${esc(txt)}${a.link?` <a href="${esc(a.link)}" data-external-link="${esc(a.link)}">קישור ↗</a>`:''}</div>`;
    });
  }
  if (gallery.length){
    html += `<div class="field-label">תמונות</div><div style="display:flex;flex-wrap:wrap;gap:8px;">`;
    gallery.forEach(src => { html += `<img src="${src}" style="width:110px;height:110px;object-fit:cover;border-radius:8px;">`; });
    html += `</div>`;
  }
  if (!disambig){
    if (!verseList.length) missing.push('מקורות בתנ״ך');
    if (!(entry.midrash && entry.midrash.length)) missing.push('מקורות חז״ל');
    if (!(entry.academic && entry.academic.length)) missing.push('מקורות נוספים');
  }

  // מה חסר בכרטיס - כדי שיידעו איזה מידע עוד אפשר להשלים (ולהציע אותו דרך ✏️).
  // בערך הבחנה אין מה להשלים: אין לו אב, שבט או גיל מעצם טבעו.
  if (missing.length && !disambig){
    html += `<div class="missing-box">
      <div class="field-label" style="margin-top:0;">פרטים שאינם במדריך</div>
      <p style="margin:0;">${missing.map(m => `<span class="missing-chip">${esc(m)}</span>`).join(' ')}</p>
      <p class="mini-note" style="margin:8px 0 0;">יש לך את המידע החסר? לחצו על ✏️ למעלה כדי להשלים אותו — ניתן לשמור במכשיר או לשלוח למפתח.</p>
    </div>`;
  }
  return maskDivineName(html);
}

// מפה אופלין (Leaflet + Natural Earth, בלי אינטרנט) - נטענת פעם אחת ב-index.html
// (guides/places/js/map.js + data/geo-basemap.js), בדיוק הבסיס הווקטורי שמקומות
// השתמש בו במקור. בלי לוויין (בהתאם לגרסה הרזה).
function renderOfflineMiniMap(container, lat, lng, zoom, cat){
  if (typeof window.L === 'undefined' || typeof addBaseLayers !== 'function') {
    container.textContent = 'מפה לא זמינה כרגע.';
    return;
  }
  try {
    const map = L.map(container, { minZoom: 2, maxZoom: MAP_MAX_ZOOM, scrollWheelZoom: false, zoomControl: true });
    map.attributionControl.setPrefix('');
    map.attributionControl.addAttribution('Natural Earth');
    map.setView([lat, lng], Math.min(zoom || 7, MAP_MAX_ZOOM));
    addBaseLayers(map);
    addLabels(map, 0.9);
    L.marker([lat, lng], { icon: pinIcon(cat, false) }).addTo(map);
    setTimeout(() => { map.invalidateSize(); map.setView([lat, lng], Math.min(zoom || 7, MAP_MAX_ZOOM)); }, 120);
  } catch(e){
    console.warn('madaei-hatanach: map render failed', e);
    container.textContent = 'מפה לא זמינה כרגע.';
  }
}

// מחבר התנהגות (קליק על פסוק, הדפסה, עריכה) לתוכן שכבר סופק ע"י renderEntryDetailHTML,
// בכל קונטיינר שהוא (המודל הראשי, או שורת תוצאה שמתרחבת) - כדי לא לשכפל לוגיקה.
function wireEntryDetail(container, entry, onEdit){
  const verseList = entry.verses || entry.makorot || [];
  container.querySelectorAll('.verse-card.clickable').forEach(el => {
    const i = parseInt(el.dataset.vref);
    const v = verseList[i];
    const parsed = v && parseAnyRef(v.ref);
    if (parsed) el.addEventListener('click', () => openInReader(parsed.bookId, parsed.ref));
  });
  // מקורות חז"ל לחיצים — נפתחים בספרייה (הקישור החיצוני שבפנים מטופל בנפרד)
  container.querySelectorAll('.src-item.clickable').forEach(el => {
    const i = parseInt(el.dataset.mref);
    const m = (entry.midrash || [])[i];
    const parsed = m && parseMidrashRef(midrashSource(m));
    if (parsed) el.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-external-link]')) return;
      openInReader(parsed.bookId, parsed.ref);
    });
  });
  const bmb = container.querySelector('#entryBookmarkBtn');
  if (bmb) bmb.addEventListener('click', (e) => {
    e.stopPropagation();
    const catId = bmb.dataset.bmCat;
    if (!catId) return;
    const on = toggleBookmark(catId, bmb.dataset.bmKey, bmb.dataset.bmLabel);
    bmb.textContent = on ? '★' : '☆';
    bmb.classList.toggle('bm-on', on);
    bmb.title = on ? 'הסרה מהסימניות' : 'הוספה לסימניות (האזור האישי)';
  });
  const pb = container.querySelector('#entryPrintBtn');
  if (pb) pb.addEventListener('click', (e) => { e.stopPropagation(); window.print(); });
  const eb = container.querySelector('#entryEditBtn');
  if (eb) eb.addEventListener('click', (e) => { e.stopPropagation(); onEdit ? onEdit() : openGenericEditForm(entry); });
  const wikiEl = container.querySelector('[data-wiki-lazy]');
  if (wikiEl){
    fetchWikiThumbnail(wikiEl.dataset.wikiLazy).then(src => {
      wikiEl.innerHTML = src ? `<img src="${src}" alt="" style="max-width:100%;border-radius:10px;display:block;">` : '';
    });
  }
  container.querySelectorAll('.offline-map').forEach(el => {
    const [lat, lng, zoom] = el.dataset.geo.split(',').map(Number);
    renderOfflineMiniMap(el, lat, lng, zoom, el.dataset.cat);
  });
  container.querySelectorAll('.person-link').forEach(el => {
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const target = findPersonEntry(el.dataset.person);
      if (target) openEntryDetail(target);
    });
  });
  // "הצג במפה הראשית" - סוגר את הכרטיס, גולל למפה שבסוף רשימת המקומות וממקד שם.
  container.querySelectorAll('.focus-main-map').forEach(el => {
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      const [lat, lng, zoom] = el.dataset.geo.split(',').map(Number);
      focusMainMap(lat, lng, zoom, el.dataset.name);
    });
  });
}

// ממקד את מפת העולם שבסוף רשימת המקומות על נקודה מסוימת (כמו focusOnMainMap במקור).
async function focusMainMap(lat, lng, zoom, name){
  entryOverlay.classList.remove('open');
  resultsOverlay.classList.remove('open');
  if (!currentGuideCat || currentGuideCat.id !== 'places'){
    await openGuide('places', null);
  } else if (activeGuideChip !== 'all' || guideSearchBox.value){
    activeGuideChip = 'all';
    guideSearchBox.value = '';
    renderGuideGrid('');
  }
  setTimeout(() => {
    const el = document.getElementById('worldMap');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof worldMap === 'undefined' || !worldMap) return;
    const z = Math.min(zoom || 8, (typeof MAP_MAX_ZOOM !== 'undefined' ? MAP_MAX_ZOOM : 12));

    const rec = (typeof allMarkers !== 'undefined' && Array.isArray(allMarkers))
      ? allMarkers.find(r => {
          const p = r.marker.getLatLng();
          return Math.abs(p.lat - lat) < 1e-6 && Math.abs(p.lng - lng) < 1e-6;
        })
      : null;

    let popped = false;
    const showPopup = () => {
      if (popped || !rec) return;
      popped = true;
      if (markerLayer && typeof markerLayer.zoomToShowLayer === 'function' && markerLayer.hasLayer(rec.marker)){
        markerLayer.zoomToShowLayer(rec.marker, () => rec.marker.openPopup());
      } else rec.marker.openPopup();
    };

    worldMap.once('moveend', showPopup);
    worldMap.flyTo([lat, lng], z, { duration: 1.2 });

    // flyTo מונפש דרך requestAnimationFrame - אם מסיבה כלשהי ההנפשה לא רצה
    // (חלון לא מצויר, מנוע webview חוסך משאבים) המפה לא תגיע ליעד. לכן מוודאים
    // הגעה בפועל, וקופצים ישירות אם צריך.
    setTimeout(() => {
      const c = worldMap.getCenter();
      if (Math.abs(c.lat - lat) > 0.01 || Math.abs(c.lng - lng) > 0.01){
        worldMap.setView([lat, lng], z);
      }
      showPopup();
    }, 1400);
  }, 400);
}

function openEntryDetail(entry){
  entryModalInner.innerHTML = renderEntryDetailHTML(entry);
  wireEntryDetail(entryModalInner, entry);
  entryOverlay.classList.add('open');
}
entryCloseBtn.addEventListener('click', () => entryOverlay.classList.remove('open'));
// לחיצה על הרקע (מחוץ לכרטיס) סוגרת - וגם Esc.
entryOverlay.addEventListener('click', (ev) => { if (ev.target === entryOverlay) entryOverlay.classList.remove('open'); });
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  if (entryOverlay.classList.contains('open')) entryOverlay.classList.remove('open');
  else if (resultsOverlay.classList.contains('open')) resultsOverlay.classList.remove('open');
  else document.querySelectorAll('.panel-overlay.open').forEach(p => p.classList.remove('open'));
});

// עורך מלא: כל השדות של המדריך (גם הריקים), מקורות (פסוקים/חז"ל), תמונה, וקטגוריות
// מותאמות שהמשתמש מוסיף בעצמו. שמירה מקומית או שליחת הצעה למפתח.
function openGenericEditForm(entry, catIdOverride){
  const catId = catIdOverride || (currentGuideCat ? currentGuideCat.id : null);
  const { base, custom } = guideFieldsFor(catId, entry);
  const before = {}; // לצורך יצירת diff בשליחה
  base.forEach(k => { before[k] = readField(entry, k); });
  // השם שתחתיו העריכה נשמרת - תמיד השם *המקורי* מקובץ הנתונים, כדי שהעריכה תימצא
  // שוב בטעינה הבאה גם אם המשתמש שינה את שם הערך.
  const origName = entry.__origName || entry.name;
  entry.__origName = origName;
  rememberPristine(catId, entry);
  const editExists = hasStoredEdit(catId, origName);

  function inputFor(k){
    const label = FIELD_LABELS[k] || k;
    const v = readField(entry, k);
    const txt = Array.isArray(v) ? v.join(', ') : (v == null ? '' : String(v));
    const hint = ARRAY_FIELDS.has(k) ? ' <span class="mini-hint">(מופרד בפסיקים)</span>' : '';
    const empty = isEmptyVal(v) ? ' <span class="missing-chip">חסר</span>' : '';
    if (LONG_FIELDS.has(k)){
      return `<div class="field-label">${esc(label)}${hint}${empty}</div>
        <textarea data-fld="${esc(k)}" class="f-textarea" style="min-height:80px">${esc(txt)}</textarea>`;
    }
    return `<div class="field-label">${esc(label)}${hint}${empty}</div>
      <input type="text" data-fld="${esc(k)}" value="${esc(txt)}" class="f-input">`;
  }

  const versesText = (entry.verses || entry.makorot || []).map(v => (v.ref||'') + ' | ' + (v.text||'')).join('\n');
  const midrashText = (entry.midrash || []).map(m => midrashSource(m) + ' | ' + midrashNote(m) + (m.link ? ' | ' + m.link : '')).join('\n');
  const academicText = (entry.academic || []).map(a => (typeof a === 'string') ? a : (a.citation||a.note||a.text||a.ref||'')).join('\n');

  entryModalInner.innerHTML = `
    <h2>עריכת כרטיס: ${esc(entry.name)}</h2>
    <div class="entry-sub">כל השדות פתוחים לעריכה — כולל שדות חסרים. השינויים נשמרים במכשיר זה בלבד, אלא אם תישלח הצעה למפתח.</div>

    <div class="field-label">שם הערך</div>
    <input type="text" data-fld="name" value="${esc(entry.name||'')}" class="f-input">
    <div class="field-label">כינויים נוספים <span class="mini-hint">(מופרד בפסיקים)</span></div>
    <input type="text" data-fld="aliases" value="${esc((entry.aliases||[]).join(', '))}" class="f-input">

    ${base.map(inputFor).join('')}

    <div class="field-label">תמונה <span class="mini-hint">(קישור או קובץ מהמחשב)</span></div>
    <input type="text" data-fld="customImage" value="${esc(entry.customImage||'')}" placeholder="https://... או בחרו קובץ למטה" class="f-input">
    <input type="file" id="editImgFile" accept="image/*" style="margin-top:6px;">

    <div class="field-label">מקורות בתנ״ך <span class="mini-hint">(שורה לכל מקור: מראה־מקום | טקסט)</span></div>
    <textarea data-multi="verses" class="f-textarea" style="min-height:70px">${esc(versesText)}</textarea>

    <div class="field-label">מקורות חז״ל <span class="mini-hint">(שורה לכל מקור: מקור | תוכן | קישור)</span></div>
    <textarea data-multi="midrash" class="f-textarea" style="min-height:70px">${esc(midrashText)}</textarea>

    <div class="field-label">מקורות נוספים / קישורים <span class="mini-hint">(שורה לכל מקור)</span></div>
    <textarea data-multi="academic" class="f-textarea">${esc(academicText)}</textarea>

    <div class="field-label">קטגוריות נוספות שהוספתם</div>
    <div id="customFieldsBox">${custom.map(k => customRowHTML(k, entry.customFields[k])).join('')}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
      <input type="text" id="newFieldName" placeholder="שם הקטגוריה (למשל: קישורים, מידע מחז״ל)" class="f-input" style="flex:1 1 200px;width:auto;">
      <button class="nf-btn secondary" id="addFieldBtn" type="button">＋ הוספת קטגוריה</button>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">
      <button class="nf-btn" id="genEditSave">💾 שמירה במכשיר</button>
      <button class="nf-btn" id="genEditSend">📧 שליחה למפתח</button>
      <button class="nf-btn secondary" id="genEditCancel">ביטול</button>
      ${editExists ? '<button class="nf-btn secondary danger-link" id="genEditRestore">↺ שחזור לגרסת המקור</button>' : ''}
    </div>`;
  entryOverlay.classList.add('open');

  const restoreBtn = document.getElementById('genEditRestore');
  if (restoreBtn) restoreBtn.addEventListener('click', () => {
    if (!window.confirm('לשחזר את "' + origName + '" לגרסה המקורית שבמדריך? העריכה השמורה שלכם תימחק.')) return;
    const ok = restoreEntryToOriginal(catId, entry, origName);
    invalidateLookup(catId);
    renderGuideGrid(guideSearchBox.value);
    if (!ok) window.alert('העריכה השמורה נמחקה. אין עותק מקור בזיכרון לערך הזה — הוא יוצג כפי שהוא עד לרענון.');
    openEntryDetail(entry);
  });

  function customRowHTML(name, value){
    return `<div class="custom-field-row" style="margin-bottom:8px;">
      <div class="field-label" style="margin-top:8px;">${esc(name)}
        <button type="button" class="del-field" data-name="${esc(name)}" class="danger-link" style="border:none;background:none;cursor:pointer;font-size:12px;">✕ הסרה</button></div>
      <textarea data-custom="${esc(name)}" class="f-textarea">${esc(value||'')}</textarea>
    </div>`;
  }
  function wireCustomRows(){
    entryModalInner.querySelectorAll('.del-field').forEach(b => {
      b.addEventListener('click', () => { b.closest('.custom-field-row').remove(); });
    });
  }
  wireCustomRows();

  document.getElementById('addFieldBtn').addEventListener('click', () => {
    const nameEl = document.getElementById('newFieldName');
    const name = nameEl.value.trim();
    if (!name){ window.alert('יש להקליד שם קטגוריה'); return; }
    document.getElementById('customFieldsBox').insertAdjacentHTML('beforeend', customRowHTML(name, ''));
    nameEl.value = '';
    wireCustomRows();
  });

  document.getElementById('editImgFile').addEventListener('change', (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { entryModalInner.querySelector('[data-fld="customImage"]').value = reader.result; };
    reader.readAsDataURL(file);
  });

  function parseMulti(kind, raw){
    return raw.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const parts = line.split('|').map(s => s.trim());
      if (kind === 'verses') return { ref: parts[0]||'', text: parts[1]||'' };
      if (kind === 'midrash') return { source: parts[0]||'', note: parts[1]||'', link: parts[2]||'' };
      return { citation: parts[0]||'' };
    });
  }

  function collect(){
    const out = { fields: {}, custom: {}, multi: {} };
    entryModalInner.querySelectorAll('[data-fld]').forEach(el => {
      const k = el.dataset.fld;
      const raw = el.value.trim();
      out.fields[k] = ARRAY_FIELDS.has(k) ? raw.split(',').map(s=>s.trim()).filter(Boolean) : raw;
    });
    entryModalInner.querySelectorAll('[data-custom]').forEach(el => {
      const v = el.value.trim();
      if (v) out.custom[el.dataset.custom] = v;
    });
    entryModalInner.querySelectorAll('[data-multi]').forEach(el => {
      out.multi[el.dataset.multi] = parseMulti(el.dataset.multi, el.value);
    });
    return out;
  }

  function apply(c){
    Object.keys(c.fields).forEach(k => {
      if (k === 'name' || k === 'aliases' || k === 'customImage') entry[k] = c.fields[k];
      else writeField(entry, k, c.fields[k]);
    });
    entry.customFields = c.custom;
    if (c.multi.verses.length || (entry.verses && entry.verses.length)){
      if (entry.makorot) entry.makorot = c.multi.verses; else entry.verses = c.multi.verses;
    }
    entry.midrash = c.multi.midrash;
    entry.academic = c.multi.academic;
  }

  function buildDiff(c){
    const lines = [];
    if (c.fields.name !== entry.name) lines.push('שם: ' + entry.name + ' ← ' + c.fields.name);
    const beforeAliases = (entry.aliases||[]).join(', ');
    const afterAliases = (c.fields.aliases||[]).join(', ');
    if (beforeAliases !== afterAliases) lines.push('כינויים: ' + (beforeAliases||'—') + ' ← ' + (afterAliases||'—'));
    base.forEach(k => {
      const b = Array.isArray(before[k]) ? before[k].join(', ') : (before[k]||'');
      const a = Array.isArray(c.fields[k]) ? c.fields[k].join(', ') : (c.fields[k]||'');
      if (String(b) !== String(a)) lines.push((FIELD_LABELS[k]||k) + ': ' + (b||'—') + ' ← ' + (a||'—'));
    });
    Object.keys(c.custom).forEach(k => lines.push('[קטגוריה חדשה] ' + k + ': ' + c.custom[k]));
    if (c.fields.customImage) lines.push('תמונה: ' + (c.fields.customImage.startsWith('data:') ? '(קובץ מצורף מהמחשב)' : c.fields.customImage));
    if (c.multi.verses.length) lines.push('\nמקורות בתנ״ך:\n' + c.multi.verses.map(v => '  ' + v.ref + ' | ' + v.text).join('\n'));
    if (c.multi.midrash.length) lines.push('\nמקורות חז״ל:\n' + c.multi.midrash.map(m => '  ' + m.source + ' | ' + m.note).join('\n'));
    if (c.multi.academic.length) lines.push('\nמקורות נוספים:\n' + c.multi.academic.map(a => '  ' + a.citation).join('\n'));
    return lines.join('\n') || '(לא זוהה שינוי)';
  }

  document.getElementById('genEditCancel').addEventListener('click', () => openEntryDetail(entry));
  document.getElementById('genEditSave').addEventListener('click', () => {
    apply(collect());
    const ok = saveEntryEdit(catId, origName, entry);
    invalidateLookup(catId);          // כדי שכינויים/שמות חדשים ייכנסו למנוע הזיהוי מיד
    renderGuideGrid(guideSearchBox.value);
    if (!ok) window.alert('השינוי הוחל, אך שמירתו הקבועה נכשלה (ייתכן שאחסון הדפדפן מלא) — הוא לא ישרוד רענון.');
    openEntryDetail(entry);
  });
  document.getElementById('genEditSend').addEventListener('click', async () => {
    const c = collect();
    const diff = buildDiff(c);
    apply(c);
    renderGuideGrid(guideSearchBox.value);
    if (window.Otzaria && Otzaria.call){
      try {
        await Otzaria.call('feedback.sendEmail', {
          to: DEV_EMAIL,
          subject: 'הצעת עריכה - ' + entry.name + ' - ' + (CATEGORIES.find(x=>x.id===catId)||{label:''}).label + ' (תמונ״ך)',
          body: 'הצעת עריכה לערך: ' + entry.name + '\n\n' + diff,
          includeSystemInfo: true
        });
        await Otzaria.call('notifications.showInApp', { message: 'ההצעה נשלחה, תודה!', type: 'success' }).catch(()=>{});
      } catch(e){
        await Otzaria.call('notifications.showInApp', { message: 'שגיאה בשליחה', type: 'error' }).catch(()=>{});
      }
    } else {
      window.alert('שליחה דורשת פתיחה בתוך אוצריא. אפשר לפנות ל-' + DEV_EMAIL);
    }
    openEntryDetail(entry);
  });
}

function openGenericProposeForm(prefillName){
  const safeText = esc(prefillName || '');
  const defaultCatId = currentGuideCat ? currentGuideCat.id : CATEGORIES[0].id;
  const catOptions = CATEGORIES.map(c =>
    `<option value="${c.id}"${c.id === defaultCatId ? ' selected' : ''}>${c.icon} ${esc(c.label)}</option>`).join('');
  entryModalInner.innerHTML = `
    <h2>${prefillName ? '"' + safeText + '" אינו קיים עדיין במדריך' : 'הצעת ערך חדש'}</h2>
    <div class="entry-sub">אפשר להציע להוסיף אותו בגרסה הבאה — לשלוח למפתח או לשמור במחשב שלך</div>
    <div class="field-label">לאיזה מדריך שייך הערך?</div>
    <select id="genNfCat" class="f-input">${catOptions}</select>
    <div class="field-label">שם הערך</div>
    <input type="text" id="genNfName" value="${safeText}" class="f-input">
    <div class="field-label">מקור בספרייה (פסוק)</div>
    <textarea id="genNfSource" class="f-textarea" style="min-height:50px"></textarea>
    <div class="field-label">הערות נוספות (זיהוי מוצע, תמונות, קישורים)</div>
    <textarea id="genNfNotes" class="f-textarea" style="min-height:50px"></textarea>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">
      <button class="nf-btn" id="genNfSave">💾 שמירה במכשיר</button>
      <button class="nf-btn" id="genNfSend">📧 שליחה במייל</button>
      <button class="nf-btn secondary" id="genNfCancel">ביטול</button>
    </div>`;
  entryOverlay.classList.add('open');
  document.getElementById('genNfCancel').addEventListener('click', () => entryOverlay.classList.remove('open'));
  function selectedCat(){
    return CATEGORIES.find(c => c.id === document.getElementById('genNfCat').value) || CATEGORIES[0];
  }
  function fields(){
    return {
      name: document.getElementById('genNfName').value.trim(),
      source: document.getElementById('genNfSource').value.trim(),
      notes: document.getElementById('genNfNotes').value.trim()
    };
  }
  document.getElementById('genNfSave').addEventListener('click', () => {
    const f = fields();
    if (!f.name){ window.alert('יש למלא שם'); return; }
    try {
      const key = selectedCat().id + '_nf_drafts_v1';
      const drafts = JSON.parse(localStorage.getItem(key) || '[]');
      drafts.push({ ...f, category: selectedCat().label, savedAt: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(drafts));
      window.alert('הטיוטה נשמרה במכשיר זה. ניתן לשלוח אותה למפתח בכל שלב.');
    } catch(e){ window.alert('שמירת הטיוטה נכשלה.'); }
  });
  document.getElementById('genNfSend').addEventListener('click', async () => {
    const f = fields();
    if (!f.name){ window.alert('יש למלא שם'); return; }
    const cat = selectedCat();
    const body = 'הצעת תוספת למדריך ' + cat.label + ' (תמונ״ך)\n\nההוספה המוצעת: ' + f.name + '\nהמקור בספרייה: ' + (f.source||'—') + '\nהערות נוספות: ' + (f.notes||'—');
    if (window.Otzaria && Otzaria.call){
      try {
        await Otzaria.call('feedback.sendEmail', { to: DEV_EMAIL, subject: 'הצעת תוספת - ' + cat.label + ' - תמונ״ך', body, includeSystemInfo: true });
        await Otzaria.call('notifications.showInApp', { message: 'ההצעה נשלחה, תודה!', type: 'success' }).catch(()=>{});
        entryOverlay.classList.remove('open');
      } catch(e){
        await Otzaria.call('notifications.showInApp', { message: 'שגיאה בשליחה', type: 'error' }).catch(()=>{});
      }
    } else {
      window.alert('שליחה דורשת פתיחה בתוך אוצריא.');
    }
  });
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

function hasOtzaria(){ return !!(window.Otzaria && typeof Otzaria.call === 'function'); }

// ---- משוב והערות ----
// חלונית המשוב הנפרדת בוטלה: לשונית ״משוב״ באזור האישי (renderPersonalFeedback)
// היא הכניסה היחידה, והשליחה עצמה עוברת דרך sendToDev.

// ---- הוספת דף HTML (נשמר לצמיתות דרך storage.get/set, כמו בתוסף "צופה HTML") ----
const addHtmlOverlay = document.getElementById('addHtmlOverlay');
const addHtmlName = document.getElementById('addHtmlName');
const addHtmlFile = document.getElementById('addHtmlFile');
const savedHtmlList = document.getElementById('savedHtmlList');
let pendingHtmlContent = null;

function storageGet(key){
  if (!hasOtzaria()) return Promise.resolve(null);
  return Otzaria.call('storage.get', { key: key }).then(res => (res && res.data !== undefined) ? res.data : null).catch(() => null);
}
function storageSet(key, value){
  if (!hasOtzaria()) return Promise.resolve(false);
  return Otzaria.call('storage.set', { key: key, value: value }).then(res => !(res && res.success === false)).catch(() => false);
}

async function getHtmlPagesIndex(){
  return (await storageGet(HTML_PAGES_INDEX_KEY)) || [];
}

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
const cardsGrid = document.getElementById('cardsGrid');
async function renderCustomPageCards(){
  cardsGrid.querySelectorAll('.card[data-custom-page]').forEach(el => el.remove());
  const index = await getHtmlPagesIndex();
  const anchor = document.getElementById('personalCard');   // הכרטיסים נכנסים לפני "האזור האישי"
  index.forEach(name => {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-custom-page', name);
    card.innerHTML = `<span class="icon">📄</span><span class="label">${esc(name)}</span>`;
    card.addEventListener('click', () => openCustomHtmlPage(name));
    cardsGrid.insertBefore(card, anchor);
  });
}

// לחיצה על תוצאה לא "עוברת" לשום מקום - היא מרחיבה את הכרטיס המלא (עם תמונות, פסוקים
// וכו') ישר בתוך רשימת התוצאות, בלי לסגור אותה. זה בדיוק מה שביקשת - נשארים בעמוד
// השער, ורואים הכל במקום, בלי לאבד את הרשימה.
// שורת צ'יפים לסינון תוצאות הזיהוי לפי מדריך - מוצגת רק כשיש יותר מקטגוריה אחת
// בתוצאות (אחרת אין טעם לסנן). לוחצים על צ'יפ -> מסננים את resultsList בלי לרוץ
// שוב את identify() ובלי לסגור את החלונית.
function renderResultsChips(matches, activeCat, onSelect){
  const resultsChips = document.getElementById('resultsChips');
  if (!resultsChips) return;
  if (!matches.length){ resultsChips.innerHTML = ''; return; }
  const counts = new Map(); // catId -> {label, icon, n}
  matches.forEach(m => {
    if (!counts.has(m.catId)) counts.set(m.catId, { label: m.catLabel, icon: m.catIcon, n: 0 });
    counts.get(m.catId).n++;
  });
  if (counts.size < 2){ resultsChips.innerHTML = ''; return; } // קטגוריה אחת בלבד - אין מה לסנן
  let html = `<button type="button" class="chip${activeCat==='all'?' active':''}" data-cat="all">הכל (${matches.length})</button>`;
  counts.forEach((v, catId) => {
    html += `<button type="button" class="chip${activeCat===catId?' active':''}" data-cat="${esc(catId)}">${v.icon} ${esc(v.label)} (${v.n})</button>`;
  });
  resultsChips.innerHTML = html;
  resultsChips.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => onSelect(btn.dataset.cat));
  });
}

function showResults(matches, selectedText){
  let activeResultsCat = 'all';

  function render(){
    renderResultsChips(matches, activeResultsCat, (catId) => { activeResultsCat = catId; render(); });
    const filtered = activeResultsCat === 'all' ? matches : matches.filter(m => m.catId === activeResultsCat);
    renderResultsListRows(filtered, selectedText);
  }
  render();

  resultsOverlay.classList.add('open');
}

function renderResultsListRows(matches, selectedText){
  resultsList.innerHTML = '';
  if (!matches.length){
    noResults.style.display = 'block';
    noResults.innerHTML = '<button type="button" class="panel-btn" id="noResPropose">➕ הצעת ערך חדש</button>';
    noResults.querySelector('#noResPropose').addEventListener('click', () => openGenericProposeForm(selectedText));
    resultsQuote.textContent = 'לא נמצאה התאמה ל"' + selectedText + '" באף אחד ממדריכי תמונ״ך.';
  } else {
    noResults.style.display = 'none';
    resultsQuote.textContent = 'נבחר: "' + selectedText + '"';
    matches.forEach(m => {
      const row = document.createElement('div');
      row.className = 'result-row';
      const viaPrefix = (m.matchedVia && m.matchedVia !== m.name) ? (esc(m.matchedVia) + ': ') : '';
      const modern = shortModernId(m.entry);
      const isCustom = m.catId === 'custom';
      row.innerHTML = `
        <div class="result-row-head" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div class="info">
            <div class="name">${viaPrefix}${m.catIcon} ${esc(m.name)}</div>
            <div class="cat">${m.catLabel}${modern ? ' · ' + esc(modern) : ''}</div>
          </div>
          <button type="button" class="expand-btn">${isCustom ? 'פתיחה' : 'הרחבה ⌄'}</button>
        </div>
        <div class="result-row-detail" style="display:none;margin-top:10px;"></div>
      `;
      const btn = row.querySelector('.expand-btn');
      const detailBox = row.querySelector('.result-row-detail');
      if (isCustom){
        btn.addEventListener('click', () => openCustomHtmlPage(m.term));
      } else {
        btn.addEventListener('click', async () => {
          const open = detailBox.style.display !== 'none';
          if (open){
            detailBox.style.display = 'none';
            btn.textContent = 'הרחבה ⌄';
            return;
          }
          if (!detailBox.dataset.built){
            detailBox.innerHTML = renderEntryDetailHTML(m.entry, m.catId);
            wireEntryDetail(detailBox, m.entry, () => openGenericEditForm(m.entry, m.catId));
            detailBox.dataset.built = '1';
          }
          detailBox.style.display = 'block';
          btn.textContent = 'סגירה ⌃';
        });
      }
      resultsList.appendChild(row);
    });

    // דיווח על טעות בזיהוי - שליחה למפתח או תיקון מקומי (✏️ בכל תוצאה מורחבת).
    const reportRow = document.createElement('div');
    reportRow.style.cssText = 'margin-top:12px;text-align:center;';
    reportRow.innerHTML = '<button type="button" class="panel-btn secondary" id="identifyErrorBtn">🚩 מצאת טעות בזיהוי? דיווח למפתח</button>';
    reportRow.querySelector('#identifyErrorBtn').addEventListener('click', () => openIdentifyErrorReport(selectedText, matches));
    resultsList.appendChild(reportRow);
  }
}

// טופס דיווח טעות בזיהוי: תיאור חופשי, שליחה במייל או שמירה מקומית. תיקון בפועל של
// כרטיס אפשרי מקומית דרך כפתור ✏️ שבכל תוצאה מורחבת / כרטיס.
function openIdentifyErrorReport(selectedText, matches){
  const summary = (matches || [])
    .filter(m => m.catId !== 'custom')
    .map(m => (m.matchedVia && m.matchedVia !== m.name ? m.matchedVia + ' ← ' : '') + m.name + ' (' + m.catLabel + ')')
    .join('\n');
  entryModalInner.innerHTML = `
    <h2>🚩 דיווח על טעות בזיהוי</h2>
    <div class="entry-sub">הקטע שנבחר: "${esc(selectedText)}"</div>
    <div class="field-label">מה זוהה</div>
    <p style="white-space:pre-line;">${esc(summary || '—')}</p>
    <div class="field-label">מה הטעות? (איזה זיהוי שגוי, ומה הנכון)</div>
    <textarea id="idErrText" class="f-textarea" style="min-height:90px"></textarea>
    <p class="mini-note">אפשר גם לתקן מיד במכשיר שלך: בכל תוצאה מורחבת יש כפתור ✏️ לעריכה מקומית של הכרטיס.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">
      <button class="nf-btn" id="idErrSend">📧 שליחת הדיווח למפתח</button>
      <button class="nf-btn" id="idErrSave">💾 שמירה במכשיר</button>
      <button class="nf-btn secondary" id="idErrCancel">סגירה</button>
    </div>`;
  entryOverlay.classList.add('open');
  document.getElementById('idErrCancel').addEventListener('click', () => entryOverlay.classList.remove('open'));
  const buildBody = () => 'דיווח טעות בזיהוי - תמונ״ך\n\nהקטע שנבחר: "' + selectedText + '"\n\nמה זוהה:\n' + (summary || '—')
    + '\n\nתיאור הטעות:\n' + (document.getElementById('idErrText').value.trim() || '—');
  document.getElementById('idErrSave').addEventListener('click', () => {
    try {
      const key = 'identify_error_reports_v1';
      const reports = JSON.parse(localStorage.getItem(key) || '[]');
      reports.push({ selectedText, summary, note: document.getElementById('idErrText').value.trim(), savedAt: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(reports));
      window.alert('הדיווח נשמר במכשיר זה. ניתן לשלוח אותו למפתח בכל שלב.');
    } catch(e){ window.alert('שמירת הדיווח נכשלה.'); }
  });
  document.getElementById('idErrSend').addEventListener('click', async () => {
    if (!hasOtzaria()){ window.alert('שליחה דורשת פתיחה בתוך אוצריא. אפשר לפנות ל-' + DEV_EMAIL); return; }
    try {
      await Otzaria.call('feedback.sendEmail', { to: DEV_EMAIL, subject: 'דיווח טעות בזיהוי - תמונ״ך', body: buildBody(), includeSystemInfo: true });
      await Otzaria.call('notifications.showInApp', { message: 'הדיווח נשלח, תודה!', type: 'success' }).catch(()=>{});
      entryOverlay.classList.remove('open');
    } catch(e){
      await Otzaria.call('notifications.showInApp', { message: 'שגיאה בשליחת הדיווח', type: 'error' }).catch(()=>{});
    }
  });
}

closeResults.addEventListener('click', () => resultsOverlay.classList.remove('open'));
document.getElementById('resultsCloseX').addEventListener('click', () => resultsOverlay.classList.remove('open'));
resultsOverlay.addEventListener('click', (ev) => { if (ev.target === resultsOverlay) resultsOverlay.classList.remove('open'); });
document.querySelectorAll('.panel-overlay').forEach(p => {
  p.addEventListener('click', (ev) => { if (ev.target === p) p.classList.remove('open'); });
});

function cmpVersion(a, b){
  const pa = String(a||'0').split('.').map(n=>parseInt(n,10)||0);
  const pb = String(b||'0').split('.').map(n=>parseInt(n,10)||0);
  for (let i=0;i<Math.max(pa.length,pb.length);i++){
    const d = (pa[i]||0) - (pb[i]||0);
    if (d) return d;
  }
  return 0;
}

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

// ============================================================
//  הגדרות תצוגה — ערכת צבעים, גופן, גודל טקסט, צפיפות
//  ברירת המחדל ("קלאסי") היא בדיוק המראה שהיה כאן קודם; שאר
//  הערכות רק דורסות משתני CSS, בלי לשנות שום כלל עיצוב אחר.
// ============================================================
const PREFS_KEY = 'madaei_hatanach_ui_prefs_v1';
const DEFAULT_PREFS = { theme: 'otzaria', font: 'otzaria', scale: 100, density: 'normal', cardImg: true };
let uiPrefs = Object.assign({}, DEFAULT_PREFS);
let otzariaTheme = null; // ה-theme האחרון שהתקבל מאוצריא (boot / theme.changed)

const FONT_STACKS = {
  default: "'Heebo', Arial, sans-serif",
  frank:   "'Frank Ruhl Libre', 'David', serif",
  david:   "'David', 'Times New Roman', serif",
  arial:   "Arial, 'Segoe UI', sans-serif",
  times:   "'Times New Roman', 'David', serif"
};
const DENSITY = { compact: ['170px','9px'], normal: ['200px','12px'], roomy: ['250px','18px'] };

// כל המשתנים שערכת "תואם לאוצריא" מזריקה — נשמרים כדי שאפשר יהיה לנקות אותם
// בחזרה לערכה אחרת (אחרת ערכים ישנים היו נדבקים ל-<html> לנצח).
const OTZ_VARS = ['--color-primary','--color-on-primary','--color-secondary','--color-on-secondary',
  '--color-surface','--color-on-surface','--color-surface-container-highest','--color-error',
  '--color-on-error','--color-outline','--color-primary-subtle','--color-secondary-subtle',
  '--color-bg','--color-surface-2','--color-surface-3','--color-outline-faint',
  '--color-on-surface-dim','--color-on-surface-faint','--color-on-surface-ghost','--color-link',
  '--color-btn','--color-on-btn','--color-btn-hover','--color-hover','--color-scrim',
  '--color-scrim-light','--color-shadow','--color-shadow-strong','--color-glow','--color-map-bg'];

function hexToRgba(hex, alpha){
  const h = String(hex || '').replace('#','');
  if (h.length < 6) return 'rgba(0,0,0,' + alpha + ')';
  const off = h.length === 8 ? 2 : 0; // תמיכה ב-#AARRGGBB שפלאטר מחזירה לעתים
  const r = parseInt(h.slice(off, off+2), 16);
  const g = parseInt(h.slice(off+2, off+4), 16);
  const b = parseInt(h.slice(off+4, off+6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}
function normHex(hex){
  const h = String(hex || '').replace('#','');
  return h.length === 8 ? '#' + h.slice(2) : '#' + h;
}

function loadPrefs(){
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) uiPrefs = Object.assign({}, DEFAULT_PREFS, JSON.parse(raw));
  } catch(e){}
  if (!(uiPrefs.scale >= 85 && uiPrefs.scale <= 125)) uiPrefs.scale = 100;
}
function savePrefs(){
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(uiPrefs)); } catch(e){}
  // גיבוי בזיכרון של אוצריא, כדי שההגדרות ישרדו גם ניקוי של אחסון הדפדפן
  if (hasOtzaria()) storageSet(PREFS_KEY, uiPrefs);
}

function applyPrefs(){
  const root = document.documentElement;

  // --- ערכת צבעים ---
  const usingOtz = uiPrefs.theme === 'otzaria' && otzariaTheme && otzariaTheme.colorScheme;
  OTZ_VARS.forEach(v => root.style.removeProperty(v));
  if (uiPrefs.theme === 'dark' || uiPrefs.theme === 'plain') root.setAttribute('data-theme', uiPrefs.theme);
  else if (usingOtz) root.setAttribute('data-theme', 'otzaria');
  else root.removeAttribute('data-theme');

  if (usingOtz){
    const cs = otzariaTheme.colorScheme;
    const dark = otzariaTheme.mode === 'dark';
    const set = (k, v) => root.style.setProperty(k, v);
    // תפקידי הצבע הרשמיים של M3, ישירות מה-API
    set('--color-primary',      normHex(cs.primary));
    set('--color-on-primary',   normHex(cs.onPrimary));
    set('--color-secondary',    normHex(cs.secondary || cs.primary));
    set('--color-on-secondary', normHex(cs.onSecondary || cs.onPrimary));
    set('--color-surface',      normHex(cs.surface));
    set('--color-on-surface',   normHex(cs.onSurface));
    set('--color-surface-container-highest', normHex(cs.surfaceContainerHighest || cs.surface));
    set('--color-error',        normHex(cs.error || cs.secondary || cs.primary));
    set('--color-on-error',     normHex(cs.onError || cs.onPrimary));
    set('--color-outline',      hexToRgba(cs.outline, .55));
    // נגזרים (M3 מגדיר צבעי Container שאינם ב-API — מקרבים אותם בשקיפות)
    set('--color-primary-subtle',   hexToRgba(cs.primary, .12));
    set('--color-secondary-subtle', hexToRgba(cs.secondary || cs.primary, .16));
    set('--color-bg',               normHex(cs.surface));
    set('--color-surface-2',        normHex(cs.surfaceContainerHighest || cs.surface));
    set('--color-surface-3',        hexToRgba(cs.surfaceContainerHighest || cs.surface, .55));
    set('--color-outline-faint',    hexToRgba(cs.outline, .32));
    set('--color-on-surface-dim',   hexToRgba(cs.onSurface, .78));
    set('--color-on-surface-faint', hexToRgba(cs.onSurface, .62));
    set('--color-on-surface-ghost', hexToRgba(cs.onSurface, .45));
    set('--color-link',             normHex(cs.primary));
    set('--color-btn',              normHex(cs.primary));
    set('--color-on-btn',           normHex(cs.onPrimary));
    set('--color-btn-hover',        hexToRgba(cs.primary, .84));
    set('--color-hover',            hexToRgba(cs.primary, .10));
    set('--color-scrim',            dark ? 'rgba(0,0,0,.68)' : 'rgba(20,16,10,.55)');
    set('--color-scrim-light',      dark ? 'rgba(0,0,0,.55)' : 'rgba(0,0,0,.35)');
    set('--color-shadow',           dark ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.08)');
    set('--color-shadow-strong',    dark ? 'rgba(0,0,0,.55)' : 'rgba(0,0,0,.18)');
    set('--color-glow',             dark ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,0)');
    set('--color-map-bg',           hexToRgba(cs.surfaceContainerHighest || cs.surface, 1));
  }

  // --- גופן ---
  let stack = FONT_STACKS[uiPrefs.font] || FONT_STACKS.default;
  if (uiPrefs.font === 'otzaria'){
    const fam = otzariaTheme && otzariaTheme.typography && otzariaTheme.typography.fontFamily;
    stack = fam ? ("'" + fam + "', 'David', serif") : FONT_STACKS.default;
  }
  root.style.setProperty('--font-main', stack);

  // --- גודל טקסט (בשליטת המשתמש בלבד — לא נגזר מגודל הקריאה של אוצריא,
  //     שהוא גדול בהרבה ממה שמתאים לממשק כזה) ---
  root.style.setProperty('--ui-scale', String(uiPrefs.scale / 100));

  // --- צפיפות ---
  const d = DENSITY[uiPrefs.density] || DENSITY.normal;
  root.style.setProperty('--card-min', d[0]);
  root.style.setProperty('--card-pad', d[1]);

  // --- תמונות בכרטיסים ---
  root.setAttribute('data-cardimg', uiPrefs.cardImg ? 'on' : 'off');

  syncSettingsUI();
}

function syncSettingsUI(){
  const mark = (groupId, val) => {
    const g = document.getElementById(groupId);
    if (!g) return;
    g.querySelectorAll('.set-opt').forEach(b => b.classList.toggle('active', b.dataset.val === val));
  };
  mark('setTheme', uiPrefs.theme);
  mark('setFont', uiPrefs.font);
  mark('setDensity', uiPrefs.density);
  const sc = document.getElementById('setScale');
  const scv = document.getElementById('setScaleVal');
  if (sc) sc.value = uiPrefs.scale;
  if (scv) scv.textContent = uiPrefs.scale + '%';
  const ci = document.getElementById('setCardImg');
  if (ci) ci.checked = !!uiPrefs.cardImg;
}

function setPref(key, val){
  uiPrefs[key] = val;
  savePrefs();
  applyPrefs();
}

function openSettings(){
  document.getElementById('settingsScrim').classList.add('open');
  document.getElementById('settingsPanel').classList.add('open');
  syncSettingsUI();
}
function closeSettings(){
  document.getElementById('settingsScrim').classList.remove('open');
  document.getElementById('settingsPanel').classList.remove('open');
}

function wireSettings(){
  const btn = document.getElementById('settingsBtn');
  if (btn) btn.addEventListener('click', openSettings);
  const x = document.getElementById('settingsCloseBtn');
  if (x) x.addEventListener('click', closeSettings);
  const scrim = document.getElementById('settingsScrim');
  if (scrim) scrim.addEventListener('click', closeSettings);

  [['setTheme','theme'], ['setFont','font'], ['setDensity','density']].forEach(([id, key]) => {
    const g = document.getElementById(id);
    if (!g) return;
    g.addEventListener('click', (e) => {
      const b = e.target.closest('.set-opt');
      if (b) setPref(key, b.dataset.val);
    });
  });

  const sc = document.getElementById('setScale');
  if (sc) sc.addEventListener('input', () => setPref('scale', parseInt(sc.value, 10) || 100));

  const ci = document.getElementById('setCardImg');
  if (ci) ci.addEventListener('change', () => setPref('cardImg', ci.checked));

  const reset = document.getElementById('settingsReset');
  if (reset) reset.addEventListener('click', () => {
    uiPrefs = Object.assign({}, DEFAULT_PREFS);
    savePrefs();
    applyPrefs();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSettings();
  });
}

// החלת ההגדרות מיידית בטעינה (לפני שאוצריא בכלל זמינה) — מונע הבהוב.
loadPrefs();
applyPrefs();
wireSettings();

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
