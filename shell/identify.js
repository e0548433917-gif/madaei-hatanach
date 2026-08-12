// מנוע הזיהוי. אין כאן DOM ואין Otzaria — כדי שאפשר יהיה להריץ אותו ב-Node.
// נוצר בפיצול router.js (גרסה 2.11.2). המקור: shell/router.js שורות 203-216, 229-368.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.


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
function invalidateLookup(catId){
  delete lookupCache[catId];
  // אינדקס שמות המקומות (entry-detail.js) ואינדקס ״מוזכר יחד עם״ (co-mentions.js)
  // נבנים מאותם נתונים ומתיישנים יחד איתם
  if (catId === 'places' && typeof invalidatePlaceNameIndex === 'function') invalidatePlaceNameIndex();
  if (typeof invalidateCoMentions === 'function') invalidateCoMentions();
}

// opts.allowStopwords (אופציונלי): Set<string> של מילים מנורמלות (normalizeHeb) שלא
// ייפסלו למרות היותן ב-STOPWORDS. פרמטר-נתונים גרידא - identify.js עצמו לא יודע
// שהמקור הוא בדיקת-הקשר חיה מול הנקדן (shell/nikud-engine.js); הוא רק צריך לרוץ
// בלי DOM/רשת גם ב-Node (ר' tools/validate.js), ולכן ה-opts שקוף/אופציונלי לגמרי.
async function identify(rawText, opts){
  const allowStopwords = (opts && opts.allowStopwords) || null;
  const words = tokenizeHeb(rawText);
  if (!words.length) return [];
  const results = []; // {catId, catLabel, name, entry, matchedVia}

  for (const cat of CATEGORIES){
    const { exact, loose } = await getLookup(cat);
    const seen = new Set(); // entry (object identity) already added for this category
    for (const w of words){
      const normW = normalizeHeb(w);
      if (STOPWORDS.has(normW) && !(allowStopwords && allowStopwords.has(normW))) continue;
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

// בודקת אם רצף הטוקנים needle מופיע ברצף (ובסדר) בתוך haystack - התאמת
// טוקנים מלאה, לא substring גולמי. משתמשת ב-tokenizeHeb, בדיוק כמו הפירוק
// שהמנוע הראשי עושה לטקסט הנבחר לפני חיפוש ב-lookup.
function containsTokenSequence(haystack, needle){
  if (!needle.length || needle.length > haystack.length) return false;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++){
    for (let j = 0; j < needle.length; j++){
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

// היה plain.includes(normalizedText) - substring גולמי. שני כשלים: (א) מילה קצרה
// כמו "עוד" נתפסת כ-substring כמעט בכל דף (למשל בתוך "לעודד"), זיהוי שווא שלחיצה
// עליו לא "פותחת" כלום. (ב) חיפוש רב-מילים כמעט אף פעם לא תואם בגלל רווחים/פיסוק
// שונים בין הטקסט הנבחר לתוכן הדף. פתרון: פירוק שני הצדדים לטוקנים (tokenizeHeb,
// כמו במנוע הראשי) והתאמת רצף טוקנים מלא במקום substring של תווים.
async function identifyInCustomPages(normalizedText){
  const searchTokens = tokenizeHeb(normalizedText);
  if (!searchTokens.length) return [];
  const index = await getHtmlPagesIndex();
  const results = [];
  for (const page of index){
    const name = page.name;
    const content = await storageGet('madaei_html_page__' + name);
    if (!content) continue;
    const plain = normalizeHeb(content.replace(/<[^>]*>/g, ' '));
    const pageTokens = tokenizeHeb(plain);
    if (containsTokenSequence(pageTokens, searchTokens)){
      results.push({ catId: 'custom', catLabel: 'דף מותאם', catIcon: '➕', name: name, term: name });
    }
  }
  return results;
}
