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
//
// **האות הראשונה נשמרת תמיד.** כתיב חסר/מלא הוא תופעה של ו/י *באמצע* המילה; ו/י
// פותחת היא לעולם לא זה - היא או שורש אמיתי (יעקב, יצחק, ירושלים) או תחילית
// דקדוקית (י' של עתיד: יאמר, ילך). מחיקתה גררה זיהויי שווא עקביים: "וַיֹּאמֶר"
// נחתך ל"אמר" והחזיר את האישים "אומר"/"אמרי" בכל פסוק שיש בו ויאמר. נבדק על כל
// חמשת המדריכים: 294 ערכים ששמם עצמו נפתח ב-ו/י ממשיכים להירשם כרגיל.
function looseForm(s){
  s = String(s || '');
  return s.length > 1 ? s[0] + s.slice(1).replace(/[וי]/g, '') : s;
}
const SUFFIXES = ['ים','ות'];

// מילות-תיאור גנריות שחוזרות בעשרות שמות מורכבים ("ארץ ישראל", "הר סיני", "נחל
// קישון"...) - לא נרשמות כמפתח זיהוי עצמאי כשהן חלק משם רב-מילים (ר' registerPhrase),
// כדי שבחירת "ארץ"/"הר" וכו' בפני עצמה לא תחזיר עשרות התאמות שווא מכל הערכים ששמם
// מתחיל באותה מילה.
const GENERIC_DESCRIPTORS = new Set(['ארץ','הר','נחל','ים','עמק','מדבר','בית','עיר','בני','מעין','גיא','שדה','עין']);

// מילות-קישור/יחס נפוצות מדי מכדי לשמש בזיהוי - "ממנה" למשל, אחרי הסרת ה-מ' כתחילית
// כאילו הייתה מ' השימוש, הופך ל"מנה" (מטבע) ומייצר זיהוי שווא. מילים כאלה נפסלות
// לגמרי מזיהוי (לא רק כמפתח, גם כמילת-טקסט להשוואה) עוד לפני חישוב candidateForms.
// v2 (01/09/2026) — "את" נוסף: מילית-מושא ישיר, מהמילים השכיחות ביותר בתנ"ך
// (כמעט בכל פסוק שיש בו פועל יוצא), והתנגשה עם ערך דומם בשם זהה ("את" = להב
// מחרשה). כל הופעה שלה כמילית זוהתה בטעות ככלי-עבודה. זו בדיוק המחלקה שה-Set
// הזה קיים בשבילה, ופשוט נשכחה ממנו.
const STOPWORDS = new Set(['ממנה','אשר','כמו','אלה','אותה','אותו','להם','מהם','אליה','אליו','עליה','עליו','מהן','בהם','בהן','להן','אתה','אתם','אנחנו','זאת','זה','את']);

// מסיר ניקוד/טעמים (HEB_POINT_RE - לא כולל מקף!) לפני ה-match, כדי שאותיות מנוקדות בתוך
// מילה אחת יתחברו לטוקן אחד ("וַיֹּ֩אמֶר֩" -> "ויאמר"). בגרסה קודמת הוסר גם המקף (־) - כי
// היה כלול (בטעות) באותו טווח יוניקוד רחב - וזה גרם ל"אֶל־מֹשֶׁה" (מילה־מקף־מילה) להתמזג
// לטוקן אחד שגוי "אלמשה" במקום שתי מילים "אל" ו"משה". תוקן ע"י שימוש ב-HEB_POINT_RE
// המדויק יותר, שלא כולל מקף/פסק/סוף-פסוק - אלה נשארים כגבול מילה טבעי (כמו רווח).
function tokenizeHeb(text){
  return (text || '').replace(HEB_POINT_RE, '').match(/[א-ת]+/g) || [];
}

// ---- אימות ניקוד (2.17.2) ----
// הטקסט המקראי שמסמנים באוצריא מגיע מנוקד, ומחצית משמות הערכים מופיעים מנוקדים
// בתוך שדה verses של הערך עצמו. שני הצדדים האלה נזרקו עד כה (tokenizeHeb מסיר את
// הניקוד בשורה הראשונה) - וזו בדיוק האינפורמציה שמבדילה בין "מֹשֶׁה" ל"שֵׂה"
// (שׁ ימנית מול שׂ שמאלית) ובין "מַחֲנֶה" ל"חַנָּה". ר' ההסבר המלא ב-nikudRejects.
//
// להשוואה שומרים תנועות ונקודת שין/שין-שמאלית, ומסירים:
//   * טעמי המקרא (0591-05AF) - סימני פיסוק/נגינה, משתנים בין הופעה להופעה
//   * דגש (05BC) - נוסף/נעלם בגלל התחילית עצמה ("בַּמַּחֲנֶה" מול "מַחֲנֶה"),
//     ולכן הכללתו הייתה פוסלת התאמות לגיטימיות. התנועות לבדן מספיקות להבחנה.
//   * מתג/רפה (05BD/05BF) - סימני הטעמה, לא חלק מהניקוד
const VOWEL_KEEP_SRC = '[\\u05B0-\\u05BB\\u05C1\\u05C2\\u05C7]';
const NON_VOWEL_POINT_RE = new RegExp('(?!' + VOWEL_KEEP_SRC + ')' + HEB_POINT_SRC, 'g');
const HAS_VOWEL_RE = new RegExp(VOWEL_KEEP_SRC);

// הצורה המנוקדת המנורמלת של טוקן: אותיות + תנועות + נקודת שין בלבד.
// ⚠️ normalize('NFC') חובה ולא קישוט: אותו רצף מקודד בשני סדרים שונים במקורות
// שונים - "מֹשֶׁה" במאגר הפסוקים הוא שין→נקודת-שין→סגול, ובטקסט אחר שין→סגול→
// נקודת-שין. אותם תווים בדיוק, ולכן השוואת מחרוזות נכשלה על צורות זהות לגמרי.
// NFC ממיין את תווי הצירוף לפי ה-combining class ומיישר את שני המקורות.
function vowelForm(s){ return String(s || '').replace(NON_VOWEL_POINT_RE, '').normalize('NFC'); }

// פירוק לטוקנים ששומר את הניקוד, ומחזיר לכל טוקן גם את צורת העיצורים שלו.
// היישור בין השניים מובטח מעצם הבנייה (אותה התאמה, הסרת ניקוד לכל טוקן בנפרד),
// ולכן הוא לא יכול "להחליק" כמו שקורה בהשוואת שתי טוקניזציות נפרדות.
function tokenizeHebPairs(text){
  const toks = (text || '').match(new RegExp('[א-ת]' + HEB_POINT_SRC + '*(?:[א-ת]' + HEB_POINT_SRC + '*)*', 'g')) || [];
  return toks.map(t => ({ c: t.replace(HEB_POINT_RE, ''), v: vowelForm(t) }));
}

// המקרה השכיח הוא בדיוק ההפך ממה שהאימות הסטטי (harvestVocalForms) מכסה: המשתמש
// מסמן טקסט שאינו מנוקד כלל (הועתק ממקור אחר, או שהניקוד פשוט הוסר בדרך), ואז
// לכל טוקן יש tok.v ריק - ואין עם מה להשוות מול הלקסיקון המנוקד. vocalizedText
// הוא הטקסט הנבחר *עצמו* אחרי שהנקדן החי ניקד אותו (ר' nikud-engine.js:getLiveContext,
// bridge.js:identifyWithLiveContext) - ניקוד לצורה הספציפית שבחר המשתמש, לא לכל
// הופעה אפשרית של המילה. ממלאת tok.v רק לטוקנים חסרי-ניקוד משלהם, ורק אחרי אימות
// מלא ששני הצדדים מתיישרים עיצור-אחר-עיצור על פני הטקסט *כולו* - לא רק בנקודה
// הבודדת שנדרשת. יישור חלקי לא נבדק ולא נסמכים עליו; זו אותה זהירות "לא מנחשים"
// שכבר קיימת ב-resolveAmbiguousStopwords/getLiveContext.
function applyLiveVocalization(toks, vocalizedText){
  if (!vocalizedText) return;
  if (!toks.some(t => !HAS_VOWEL_RE.test(t.v))) return; // הכל כבר מנוקד - אין צורך בהנקדן
  const vocToks = tokenizeHebPairs(vocalizedText);
  if (vocToks.length !== toks.length) return;
  for (let i = 0; i < toks.length; i++){ if (vocToks[i].c !== toks[i].c) return; }
  for (let i = 0; i < toks.length; i++){
    if (!HAS_VOWEL_RE.test(toks[i].v)) toks[i] = { c: toks[i].c, v: vocToks[i].v };
  }
}

// מנוע הזיהוי v2 (01/09/2026) — הבעיה שדווחה: התוסף "מזהה בערך פי 10 מהאמת",
// כלומר זיהויי-שווא בכמות גדולה. שלושה מקורות קונקרטיים אותרו ותוקנו כאן,
// בלי לשכתב את הארכיטקטורה: (1) candidateForms הרשה צורות-נגזרת (אחרי חיתוך
// תחילית/סיומת) באורך 2 בלבד — שורש עברי בן 2 אותיות הוא כמעט תמיד רב-משמעי,
// וזו הייתה נקודת הכניסה הרחבה ביותר לזיהוי שווא. (2) חיתוך עד שתי תחיליות
// ברצף ("וכ", "מש" וכו') הוא ספקולטיבי בהרבה מחיתוך תחילית בודדת, ולא נדרש
// בפועל — כל התחיליות הדקדוקיות האמיתיות (ה/ו/ב/כ/ל/מ/ש) הן אות אחת.
// (3) GENERIC_DESCRIPTORS הוגדר עם הערה שהוא "לא נרשם כמפתח זיהוי עצמאי" —
// אבל מעולם לא היה מקושר בפועל ל-registerKey; ר' שם.
function candidateForms(word){
  const w = normalizeHeb(word);
  if (!w) return [];
  const prefixVariants = [w];
  let cur = w;
  // חיתוך תחילית אחת בלבד (היה עד שתיים) — ר' ההערה למעלה.
  if (cur.length > 2 && PREFIXES.includes(cur[0])){
    prefixVariants.push(cur.slice(1));
  }
  const all = new Set([w]);              // הצורה המקורית תמיד תקפה, בכל אורך
  prefixVariants.forEach(p => {
    if (p.length >= 3) all.add(p);
    SUFFIXES.forEach(suf => {
      if (p.endsWith(suf) && p.length > suf.length + 1){
        const stripped = p.slice(0, -suf.length);
        if (stripped.length >= 3) all.add(stripped);
      }
    });
  });
  return Array.from(all);
}

const lookupCache = {}; // catId -> { exact, loose, vocal }

// קוצר את הצורות המנוקדות של מילות השם מתוך הפסוקים של הערך עצמו. אין כאן רשת
// ואין נקדן - הפסוקים כבר מנוקדים במאגר. נמדד על חמשת המדריכים: 994 מתוך 2,043
// השמות חד-המילתיים (48.7%) נמצאים כך. אוספים *את כל* הווריאנטים ולא רק את
// הראשון, כי אותו שם מופיע גם בצורת הֶקְשֵׁר וגם בצורת הֶפְסֵק ("חַנָּה"/"חַנָּ֑ה"
// אחרי הסרת הטעמים זהות, אבל תנועות אחרונות כן משתנות בהפסק) - וריאנט חסר היה
// גורם לפסילת שווא של התאמה לגיטימית.
function harvestVocalForms(entry, vocal){
  const verses = entry.verses || [];
  if (!verses.length) return;
  const wanted = new Set();
  const collect = (phrase) => String(phrase || '').trim().split(/\s+/).forEach(w => {
    const n = normalizeHeb(w);
    if (n.length >= 2) wanted.add(n);
  });
  collect((entry.name || '').replace(/\s*\(([^)]*)\)\s*$/, ' $1'));
  (entry.aliases || []).forEach(collect);
  if (!wanted.size) return;
  for (const v of verses){
    for (const tok of tokenizeHebPairs(v.text || '')){
      if (!wanted.has(tok.c) || !HAS_VOWEL_RE.test(tok.v)) continue;
      if (!vocal.has(tok.c)) vocal.set(tok.c, new Set());
      vocal.get(tok.c).add(tok.v);
    }
  }
}

function buildLookup(data){
  const exact = new Map(), loose = new Map(), vocal = new Map();
  function registerKey(phrase, entry){
    const norm = normalizeHeb(phrase);
    if (!norm || norm.length < 2) return;
    // v2 — GENERIC_DESCRIPTORS הוגדר להסביר בדיוק את זה (ר' ההערה על המשתנה
    // עצמו) אבל מעולם לא נקשר לכאן. מילה גנרית יחידה ("הר", "עין", "בית"...)
    // כמפתח זיהוי עצמאי מחזירה התאמת-שווא בכל הופעה שלה בטקסט — היא לגיטימית
    // רק כחלק מצירוף ("הר סיני"), שכבר נרשם כמפתח נפרד ושלם על ידי הקריאה
    // הראשונה ל-registerPhrase (שם phrase הוא הצירוף המלא, לא המילה הבודדת).
    if (GENERIC_DESCRIPTORS.has(norm)) return;
    if (!exact.has(norm)) exact.set(norm, []);
    exact.get(norm).push(entry);
    // כתיב חסר: נרשם רק כשהצורה הרזה נשארת ארוכה מספיק. מילים קצרות ימצאו רק
    // בהתאמה מדויקת.
    //
    // ⚠️ v2 (01/09/2026) — הסף הועלה מ-3 ל-5. מדידה על 12 פסוקים אמיתיים
    // הראתה שרוב זיהויי-השווא נוצרים בדיוק כאן: שני שמות עבריים שונים לגמרי
    // מתכווצים לאותו שלד-עיצורים אחרי הסרת ו/י, ואז כל הופעה של האחד מחזירה
    // גם את השני. שלוש דוגמאות שנמדדו בפועל:
    //   "שְׁלֹשִׁים" (המספר, בפסוק) → שלד "שלשם" ← "שלישים" (ערך דומם)
    //   "אָדָם"     (שם האדם)       → שלד "אדם"  ← "אודם"/"אדום" (אבן וצבע)
    //   "וַיֵּשֶׁב"  (פועל)          → שלד "ישב"  ← "ישבי"/"ישוב"/"יושב" (שלושה אישים)
    // שלד בן 3-4 אותיות בעברית כמעט תמיד רב-משמעי, ולכן הוא רועש יותר משהוא
    // מועיל. שלד בן 5+ כבר ספציפי מספיק. המחיר: שמות קצרים בכתיב מלא שהטקסט
    // כותב בכתיב חסר לא יימצאו יותר בנפילת-החזרה — הם עדיין נמצאים בהתאמה
    // מדויקת, וב-aliases אם הוזנו.
    const lo = looseForm(norm);
    if (lo.length >= 5 && lo !== norm){
      if (!loose.has(lo)) loose.set(lo, []);
      loose.get(lo).push(entry);
    }
  }
  // עד 2.19 גם רשמנו כאן כל מילה בתוך שם רב-מילים בנפרד ("יהושע" מתוך "רבי
  // יהושע בן לוי"), כדי שסימון מילה בודדת עדיין ימצא את הערך. זה בדיוק מה
  // שגרם לזיהוי ודאי-אך-שגוי: סימון "רבי יהושע בן לוי" השלם היה מחזיר גם
  // "יהושע" (חכם/דמות אחר/ת לגמרי) וגם "לוי" בנפרד, כי שתי המילים נרשמו
  // כמפתחות עצמאיים. entry-detail.js (placesNameIndex) כבר נמנע מזה במכוון
  // ומדד שיפור נטו (99 קישורים מול 89 — עשרה פחות, וכולם היו שגויים). התיקון
  // האמיתי הוא לא ברישום אלא בסריקה: identify() למטה סורק צירופים ארוכים
  // ככל האפשר (greedy) ומדלג מעל הצירוף שנמצא, כך ש"רבי יהושע בן לוי" נתפס
  // כמכלול אחד ואינו "נבלע" חלקית ע"י מילה בודדת מתוכו.
  function registerPhrase(phrase, entry){
    if (!phrase) return;
    registerKey(phrase, entry);
  }
  data.forEach(entry => {
    let nameCore = entry.name || '', nameParen = '';
    const pm = nameCore.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    if (pm){ nameCore = pm[1]; nameParen = pm[2]; }
    registerPhrase(nameCore, entry);
    if (nameParen) registerPhrase(nameParen, entry);
    (entry.aliases || []).forEach(a => registerPhrase(a, entry));
    harvestVocalForms(entry, vocal);
  });
  return { exact, loose, vocal };
}

// האם הניקוד *סותר* את ההתאמה, ולכן יש לפסול אותה.
//
// חל **רק על התאמה שהושגה בחיתוך תחילית** ("מֹשֶׁה" -> "שה", "בַּמַּחֲנֶה" -> "חנה"),
// שהיא מקור זיהויי-השווא העיקרי: המילה המלאה נמצאת במדריך אחד, ובמדריך אחר שאין
// בו את המילה המלאה מנצחת דווקא הגרסה החתוכה. התאמה מדויקת אינה נבדקת כלל, ולכן
// אין כאן שום סיכון רגרסיה לזיהויים שעובדים היום.
//
// שמרנית בכוונה - מחזירה false (כלומר "לא לפסול") בכל מצב של ספק:
// כשאין צורה מנוקדת ידועה לערך (מחצית מהמקרים), כשהטקסט הנבחר אינו מנוקד,
// או כשההתאמה לא נוצרה מחיתוך תחילית פשוט. פוסלת אך ורק כשיש עדות ניקוד חיובית
// לשני הצדדים והן *נסתרות* זו את זו.
// N האותיות האחרונות של מחרוזת מנוקדת, יחד עם סימני הניקוד שעליהן.
function tailByLetters(v, n){
  let count = 0, i = v.length;
  while (i > 0 && count < n){ i--; if (/[א-ת]/.test(v[i])) count++; }
  return count === n ? v.slice(i) : null;
}

// מסירה את *תנועת* האות הראשונה בלבד, ומשאירה את נקודת השין/שין-שמאלית.
// חובה: כשנוספת תחילית, תנועת האות הראשונה של הגזע משתנה - "יְהוֹשֻׁעַ" הופך
// ל"וִיהוֹשֻׁעַ" (השווא עובר לוו כחיריק), "כְּמֹשֶׁה", "לְמֹשֶׁה" וכן הלאה. השוואה
// שכוללת את התנועה הזו פסלה שמות לגיטימיים לגמרי. נקודת השין דווקא כן נשמרת,
// כי היא בדיוק מה שמבדיל בין "מֹשֶׁה" (שׁ ימנית) ל"שֵׂה" (שׂ שמאלית).
function dropLeadVowel(s){
  const m = String(s || '').match(/^([א-ת])([ְ-ׇֻׁׂ]*)/);
  if (!m) return String(s || '');
  return m[1] + m[2].replace(/[ְ-ׇֻ]/g, '') + s.slice(m[0].length);
}

function nikudRejects(tok, matchedForm, vocal){
  const nw = normalizeHeb(tok.c);
  if (nw === matchedForm) return false;              // התאמה מדויקת - לא נוגעים
  if (!nw.endsWith(matchedForm)) return false;       // לא חיתוך תחילית (סיומת/כתיב חסר)
  const known = vocal.get(matchedForm);
  if (!known || !known.size) return false;           // אין נתוני ניקוד לערך
  if (!HAS_VOWEL_RE.test(tok.v)) return false;       // הטקסט הנבחר אינו מנוקד
  const tail = tailByLetters(tok.v, matchedForm.length);
  if (!tail) return false;
  const got = dropLeadVowel(tail);
  for (const kv of known){ if (dropLeadVowel(kv) === got) return false; }
  return true;                                        // יש עדות משני הצדדים, והיא סותרת
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
// שמות אנשים (בעיקר תנאים/אמוראים) הם צירופים באורך משתנה — עד 7 מילים
// נצפו בפועל ("רבי אלעזר ברבי יהודה איש כפר ברתותא"). MAX_WINDOW נדיב
// בכוונה; הסריקה עצמה זולה (טקסט נבחר, לא ספר שלם).
const MAX_WINDOW = 8;

// מכינה מראש את מה שאינו תלוי בקטגוריה (הביטוי, צורותיו המועמדות, בדיקת
// STOPWORDS) פעם אחת לכל (מיקום, אורך) — לא לכל קטגוריה בנפרד. בלעדי זה
// candidateForms היה מחושב מחדש פי מספר הקטגוריות (10) על כל חלון, וזה
// בדיוק מה שהאט זיהוי על טקסט ארוך (דף גמרא שלם: ~900ms; אחרי הייעול: מתחת
// ל-150ms על אותו טקסט, נמדד).
function prepWindow(windowToks, allowStopwords){
  const phrase = windowToks.map(t => t.c).join(' ');
  const normPhrase = normalizeHeb(phrase);
  if (windowToks.length === 1 && STOPWORDS.has(normPhrase) && !(allowStopwords && allowStopwords.has(normPhrase))){
    return null;
  }
  return { phrase, forms: candidateForms(phrase) };
}

// מתאימה חלון-טוקנים מוכן-מראש (ר' prepWindow) מול lookup של קטגוריה אחת.
// עבור חלון-מילה-יחידה משמרת בדיוק את בדיקת הניקוד הקיימת; עבור צירוף
// רב-מילים מדלגת עליה (צירוף ספציפי כבר די ודאי מעצמו, ובדיקת ניקוד לצירוף
// שלם היא הרחבה נפרדת שלא נדרשה כאן).
function matchWindow(windowToks, prepped, lookup){
  if (!prepped) return null;
  const { exact, loose, vocal } = lookup;
  const { phrase, forms } = prepped;
  let hitEntries = null, nikudBlocked = false;
  for (const f of forms){
    if (!exact.has(f)) continue;
    // הניקוד סותר את הצורה הזו. עוצרים לגמרי ולא ממשיכים לצורה הבאה: הצורות
    // הבאות ברשימה חתוכות עוד יותר (עוד תחילית הוסרה) ולכן ספקולטיביות יותר.
    // המשך לולאה כאן החליף בפועל התאמה נכונה שנפסלה בהתאמה גרועה ממנה
    // ("וִיהוֹשֻׁעַ" -> נפסל "יהושע" ואז נתפס "הושע").
    if (windowToks.length === 1 && nikudRejects(windowToks[0], f, vocal)){ nikudBlocked = true; break; }
    hitEntries = exact.get(f); break;
  }
  // גם נפילת-החזרה לכתיב חסר מדולגת אחרי פסילת ניקוד. אחרת הפסילה רק הייתה
  // מפנה את המקום להתאמה רופפת עוד יותר, שאין עליה שום בדיקת ניקוד.
  if (!hitEntries && !nikudBlocked){
    for (const f of forms){
      const lf = looseForm(f);
      // v2 — אותו סף כמו בצד הרישום (registerKey). חייבים להיות זהים, אחרת
      // צד אחד מסנן והשני לא.
      if (lf.length >= 5 && loose.has(lf)){ hitEntries = loose.get(lf); break; }
    }
  }
  return hitEntries ? { entries: hitEntries, matchedVia: phrase } : null;
}

async function identify(rawText, opts){
  const allowStopwords = (opts && opts.allowStopwords) || null;
  // הטוקנים נשמרים מנוקדים (tokenizeHebPairs) כדי שאימות הניקוד יוכל להשוות מול
  // הצורה המנוקדת שנקצרה מהמאגר. tok.c הוא בדיוק מה ש-tokenizeHeb היה מחזיר.
  const toks = tokenizeHebPairs(rawText);
  if (!toks.length) return [];
  // opts.vocalizedText (אופציונלי): הטקסט הנבחר עצמו, אחרי ניקוד חי מהנקדן - ר'
  // applyLiveVocalization. מזרים ניקוד רק כשלטקסט המקורי אין ניקוד משלו כלל.
  if (opts && opts.vocalizedText) applyLiveVocalization(toks, opts.vocalizedText);
  const results = []; // {catId, catLabel, name, entry, matchedVia}

  const catLookups = [];
  for (const cat of CATEGORIES) catLookups.push({ cat, lookup: await getLookup(cat) });
  const seenPerCat = new Map(); // catId -> Set(entry) — כפילות של אותו ערך בהמשך אותו טקסט

  // סריקה חמדנית (greedy) אחת **על פני כל הקטגוריות יחד**, מהצירוף הארוך
  // לקצר, בלי חפיפה. קריטי שזו סריקה אחת משותפת ולא לולאה נפרדת לכל קטגוריה:
  // "רבי יהושע בן לוי" (4 מילים, במדריך "אנשים מהתלמוד") ו"יהושע" (מילה אחת,
  // במדריך "אישים בתנ״ך") הם שני ערכים שונים לגמרי בשני מדריכים שונים — אם
  // כל קטגוריה נסרקת בנפרד, שתיהן "מנצחות" כל אחת בתוך עצמה ומתקבלות שתי
  // התאמות, בדיוק הבאג שדווח. כשהסריקה משותפת, האורך הארוך ביותר שיש לו
  // התאמה **בכל קטגוריה שהיא** קובע את i הבא, ומדריכים עם צירוף קצר יותר
  // באותו מיקום כלל לא נבדקים.
  let i = 0;
  while (i < toks.length){
    let bestLen = 0;
    const hitsAtBestLen = []; // [{cat, entries, matchedVia}] — רק אם יש כמה קטגוריות שוות-אורך בדיוק
    for (let len = Math.min(MAX_WINDOW, toks.length - i); len >= 1; len--){
      const windowToks = toks.slice(i, i + len);
      const prepped = prepWindow(windowToks, allowStopwords);
      if (prepped){
        for (const { cat, lookup } of catLookups){
          const m = matchWindow(windowToks, prepped, lookup);
          if (m) hitsAtBestLen.push({ cat, entries: m.entries, matchedVia: m.matchedVia });
        }
      }
      if (hitsAtBestLen.length){ bestLen = len; break; } // הראשון (=הארוך ביותר) שיש בו משהו בכלל
    }
    if (bestLen){
      hitsAtBestLen.forEach(({ cat, entries, matchedVia }) => {
        if (!seenPerCat.has(cat.id)) seenPerCat.set(cat.id, new Set());
        const seen = seenPerCat.get(cat.id);
        entries.forEach(entry => {
          if (seen.has(entry)) return;
          seen.add(entry);
          results.push({ catId: cat.id, catLabel: cat.label, catIcon: cat.icon, name: entry.name, term: entry.name, entry: entry, matchedVia });
        });
      });
      i += bestLen;
    } else {
      i++;
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
