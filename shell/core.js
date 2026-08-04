// קבועים, מטמונים וכלים משותפים — נטען ראשון, כל השאר נשען עליו.
// נוצר בפיצול router.js (גרסה 2.11.2). המקור: shell/router.js שורות 1-24, 217-228, 400-459, 1453-1454, 1734-1743.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.

// שכבת ניתוב + זיהוי אחיד לתמונ״ך.
// כל מדריך נשאר קובץ עצמאי לגמרי (guides/<cat>/...) — הקובץ הזה רק קורא להם.

const MENU_ITEM_ID = 'madaei-hatanach-identify';
const DEV_EMAIL = 'E0548433917@outlook.com';
const HTML_PAGES_INDEX_KEY = 'madaei_hatanach_html_pages_index';
// מפתח ה"מסירה" (handoff) של זיהוי שממתין להצגה אחרי מעבר ללשונית התוסף. ר' setPendingIdentify.
const PENDING_IDENTIFY_KEY = 'madaei_hatanach_pending_identify_v1';
const BOOKMARKS_KEY = 'madaei_hatanach_bookmarks_v1';

const CATEGORIES = [
  { id: 'people', label: 'אישים בתנ״ך', icon: '👤', loaderPath: 'guides/people/data/_loader.html' },
  { id: 'places', label: 'מקומות בתנ״ך', icon: '📍', loaderPath: 'guides/places/data/_loader.html' },
  { id: 'animal', label: 'בע״ח בתנ״ך', icon: '🐾', loaderPath: 'guides/animal/data/_loader.html' },
  { id: 'flora', label: 'צומח בתנ״ך', icon: '🌿', loaderPath: 'guides/flora/data/_loader.html' },
  { id: 'domem', label: 'דומם בתנ״ך', icon: '💎', loaderPath: 'guides/domem/data/_loader.html' },
  { id: 'beithamikdash', label: 'בית המקדש', icon: '🏛️', loaderPath: 'guides/beithamikdash/data/_loader.html' },
];

const dataCache = {}; // id -> [{name, cat, aliases}]
const imagesCache = {}; // id -> { key: "data:image/...;base64,..." }
const catsCache = {}; // id -> [{id, num, label, blurb}] - קטגוריות הדפדוף המקוריות של אותו מדריך
const dataPromises = {}; // id -> pending Promise, so parallel calls don't spawn duplicate iframes
const pristineCache = {}; // catId -> { שם מקורי: עותק של הערך לפני עריכות מקומיות }

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

function hasOtzaria(){ return !!(window.Otzaria && typeof Otzaria.call === 'function'); }

function cmpVersion(a, b){
  const pa = String(a||'0').split('.').map(n=>parseInt(n,10)||0);
  const pb = String(b||'0').split('.').map(n=>parseInt(n,10)||0);
  for (let i=0;i<Math.max(pa.length,pb.length);i++){
    const d = (pa[i]||0) - (pb[i]||0);
    if (d) return d;
  }
  return 0;
}
