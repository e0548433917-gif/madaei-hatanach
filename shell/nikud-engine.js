// חיבור למנוע ניקוד מקומי ("הנקדן", אותו פרוטוקול כמו ב"שומר השם") — 10.8.26.
// לא משולב בתוך מנוע הזיהוי (identify.js) בכוונה: identify.js מוצהר במפורש בלי
// DOM/Otzaria כדי לרוץ ב-Node (ר' tools/validate.js) - חיבור הרשת חי כאן, בקובץ נפרד.
// identify() מקבל opts.allowStopwords - סט מילים (מנורמלות) שהתקבל כאן ומוזרם
// פנימה כפרמטר-נתונים גרידא, בלי ש-identify.js עצמו יזדקק לרשת/DOM.
//
// פיילוט ממוקד (לא כל סבב 3, ר' חלוקה-לשיחות-פשוטה.md): בדיקה חיה מול הנקדן
// לפתור מילים דו-משמעיות מתוך STOPWORDS ב-identify.js - כאלה שנפסלות היום *לגמרי*
// מזיהוי (למשל "אשר") למרות שלעיתים הן שם ערך אמיתי ("אשר" בן יעקב), כי אין דרך
// להבחין בין השימוש כמילת-קישור לשימוש כשם בלי הקשר.
//
// 🧪 נבדק בפועל מול הנקדן החי, 11.8.26: "האם התווסף ניקוד" (הגרסה הקודמת של
// הקובץ הזה, wordIsRecognized) נפסלה - Nakdan מנקד כמעט כל קלט, גם ג׳יבריש, אז
// "יש ניקוד" לא אומר "מילה מוכרת". מה שכן עובד: לשלוח את *המשפט המלא* (לא מילה
// בודדת) ולבדוק אם תבנית הניקוד שחזר תואמת לצורה הספציפית של השימוש המבוקש -
// "בא אל משה"→אֶל (יחס), "אל תעשה"→אַל (שלילה) וכו', בעקביות על פני כמה משפטים.
//
// שימוש לבדיקה ידנית (מתוך devtools בתוסף, כשאוצריא+הנקדן פתוחים):
//   await NikudEngine.findActivePort()
//   await NikudEngine.resolveAmbiguousStopwords('ובני זלפה שפחת לאה גד ואשר')

window.NikudEngine = window.NikudEngine || {};

(function () {
  const PORTS = [5000, 5001, 5002, 5003, 5004, 5005, 5006, 5007, 5008, 5009, 5010];
  let activePort = null;
  let watching = false;

  async function findActivePort() {
    for (const port of PORTS) {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 400);
        const res = await fetch(`http://127.0.0.1:${port}/api/status`, { signal: controller.signal });
        clearTimeout(tid);
        if (res.ok) { activePort = port; return port; }
      } catch (e) { /* פורט לא זמין, ממשיכים */ }
    }
    activePort = null;
    return null;
  }

  // ניסיון חוזר ברקע, בתדירות נמוכה - לא רלוונטי לחוות דעת על "רשת" (זה מנוע מקומי
  // אופציונלי, לא חלק מנעילת-הרשת של refs.js), רק כדי שהחיבור יתאושש לבד אם הנקדן
  // נפתח אחרי התוסף או קורס וחוזר.
  function watch() {
    if (watching) return;
    watching = true;
    (async function loop() {
      await findActivePort();
      setTimeout(loop, activePort ? 15000 : 3000);
    })();
  }

  async function vocalize(text) {
    if (!text || !text.trim()) return null;
    if (!activePort && !(await findActivePort())) return null;
    try {
      const res = await fetch(`http://127.0.0.1:${activePort}/api/nikud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (typeof data.vocalized === 'string') ? data.vocalized : null;
    } catch (e) { activePort = null; return null; }
  }

  // משתמשים ב-HEB_POINT_RE הגלובלי (core.js, נטען קודם) ולא בטווח יוניקוד עצמאי -
  // הוא מדויק (לא כולל מקף/פסק/סוף-פסוק, ר' ההערה עליו ב-core.js) ותואם בדיוק
  // ל-tokenizeHeb של identify.js, מה שקריטי כאן ליישור אינדקסים בין הטוקנים.
  function stripNikud(s) { return String(s || '').replace(HEB_POINT_RE, ''); }
  function consonantTokens(s) { return stripNikud(s).match(/[א-ת]+/g) || []; }
  function vocalizedTokens(s) { return String(s || '').match(new RegExp('[א-ת' + HEB_POINT_SRC.slice(1, -1) + ']+', 'g')) || []; }

  // מילים מתוך STOPWORDS (identify.js) שיש להן שימוש-שם אמיתי מאומת בתנ"ך, ותבנית
  // הניקוד הסטנדרטית של אותו שימוש-שם - קמץ+צירה, לעומת מילת-הקישור "אֲשֶׁר"
  // (חטף-פתח+סגול) שהיא השימוש השכיח וה-STOPWORD המקורי.
  // ⚠️ מאומת מול טבלת ניקוד תקנית בלבד - עדיין לא נבדק בפועל מול הנקדן החי (אין
  // גישה לשרת המקומי מתוך סביבת הפיתוח). לוודא בפועל לפני הרחבה.
  // מועמדות נוספות שנמצאו באותה בדיקה (יש להן ערך אמיתי במאגר) אך טרם אומתה תבנית
  // הניקוד שלהן בפועל - לא נוספו כדי לא לנחש: "אליה" (אֵלִיָּה הנביא מול "אֵלֶיהָ"),
  // "בהן" (בֹּהַן בן ראובן מול "בָּהֵן"/"בָּהֶן"), "אתם" (מקום אֵתָם מול "אַתֶּם").
  const AMBIGUOUS_WORDS = {
    'אשר': /^אָשֵׁר$/
  };

  // בודקת מול הנקדן החי, למשפט שלם (לא מילה בודדת - ר' הערת "נבדק בפועל" למעלה),
  // אילו מילים מתוך AMBIGUOUS_WORDS מופיעות ב-text בתבנית הניקוד של השימוש-שם.
  // מחזירה סט מילים מנורמלות (identify.js:normalizeHeb) שמותר לזרום דרכן על אף
  // ש-STOPWORDS פוסל אותן כברירת מחדל - להזרמה כ-opts.allowStopwords ל-identify().
  // כשל בכל שלב (אין חיבור, timeout, יישור טוקנים לא עקבי) = סט ריק בשקט גמור,
  // בדיוק כמו היום בלי הנקדן - הפיצ'ר הזה תוספת בלבד, לעולם לא מונע זיהוי קיים.
  async function resolveAmbiguousStopwords(text) {
    const result = new Set();
    try {
      if (!isConnected()) return result; // לא סורקים פורטים בתוך נתיב הלחיצה - ר' watch()
      const rawWords = consonantTokens(text);
      const candidates = rawWords.filter(w => Object.prototype.hasOwnProperty.call(AMBIGUOUS_WORDS, w));
      if (!candidates.length) return result;
      const vocalized = await vocalize(stripNikud(text));
      if (!vocalized) return result;
      const vocWords = vocalizedTokens(vocalized);
      if (vocWords.length !== rawWords.length) return result; // יישור לא עקבי - לא מנחשים
      for (let i = 0; i < rawWords.length; i++) {
        const w = rawWords[i];
        const pattern = AMBIGUOUS_WORDS[w];
        if (!pattern) continue;
        if (stripNikud(vocWords[i]) !== w) return result; // אימות יישור לפני שסומכים על ה-index
        if (pattern.test(vocWords[i])) result.add(w);
      }
    } catch (e) { /* שקט - ר' הערה למעלה */ }
    return result;
  }

  function isConnected() { return activePort !== null; }
  function getPort() { return activePort; }

  window.NikudEngine = { findActivePort, watch, vocalize, resolveAmbiguousStopwords, isConnected, getPort };
})();
