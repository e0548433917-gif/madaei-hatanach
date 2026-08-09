# שיחה 0.1 — תוכנית פיצול `router.js` · לאישור לפני ביצוע

נבדק בפועל על עץ העבודה `madaei-hatanach/` · ג׳ באב תשפ״ו (03/08/2026)

---

## חלק 0 — שלושה ממצאים שצריך להכריע בהם **לפני** שמפצלים

### 1. עץ העבודה אינו 2.10.0 — ומישהו ערך אותו לפני דקות

| קובץ | ארוז 2.10.0 | עץ העבודה עכשיו |
|---|---|---|
| `shell/router.js` | 2,039 שורות | **2,136 שורות** (נכתב היום 20:32) |
| `index.html` | 167 שורות | **193 שורות** (נכתב היום 20:30) |
| `manifest.json` | 2.10.0 | 2.10.0 (לא עודכן) |

מה נוסף ל-`router.js` מעבר ל-2.10.0:

* **תיקון באג 996 כבר בוצע** — `setPendingIdentify` / `consumePendingIdentify` / `handoffAndShow`, בדיוק דפוס ה-handoff שהתוכנית הציעה. כלומר **חלק ממשימה 1.1 כבר עשוי**.
* **סימניות** — `BOOKMARKS_KEY`, `readBookmarks`/`writeBookmarks`/`isBookmarked`/`toggleBookmark`/`restoreBookmarksFromOtzaria`.

בזמן שבדקתי, הקובץ גדל מ-2,042 ל-2,136 שורות. **אי אפשר לפצל קובץ שנערך במקביל** — כל שינוי שייכנס אחרי הפיצול יגיע כ-diff מול קובץ שכבר לא קיים. צריך להקפיא את `router.js` לפני שמתחילים.

### 2. `index.html` הקדים את `router.js` — ויש כרגע ממשק מת

`index.html` כבר מכיל אלמנטים של סבבים 3.1/3.3 שאין להם שום JS:

| אלמנט | מצב |
|---|---|
| `#homeSearchWrap` / `#homeSearch` / `#homeSearchBtn` / `#homeSearchDrop` | HTML + CSS מלאים · **אפס JS** — שורת החיפוש לא עושה כלום |
| `#personalCard`, `#personalView`, `#personalTabs`, `#personalBody` | HTML קיים · **אפס JS ואפס CSS** — הכרטיס לא נפתח |
| `#feedbackCard`, `#addHtmlCard` | **נמחקו** מ-`index.html` — ולכן `openFeedbackPanel()` ו-`openAddHtmlPanel()` שב-`router.js` **אין להן שום קורא**. ״משוב״ ו״הוספת דף HTML״ בלתי־נגישים כרגע מהשער |

זה נוגע ישירות ליעד של 0.1 (״אפס שינוי תפקודי״): לשלוש היכולות האלה **אין בסיס תפקודי להשוות אליו**. שתי אפשרויות, ואני צריך את ההחלטה שלך:

* **א׳ (מומלץ) — לפצל את מה שקיים כמו שהוא**, כולל הקוד המת, בלי לתקן דבר. הפיצול נשאר מכני וניתן לאימות. אחרי שהוא נסגר, שיחה נפרדת בת 10 דקות מחזירה את הנגישות ל״משוב״/״הוספת HTML״ ומחברת את האזור האישי.
* **ב׳ — לתקן קודם את הנגישות** (להחזיר את שני הכרטיסים או לחווט אותם לאזור האישי), לוודא שהכול עובד, ורק אז לפצל.

### 3. אין ריפו גיטהב — ולכן סדר 0.1 → 0.2 הפוך

`madaei-hatanach/` אינו ריפו git. פיצול של 2,136 שורות ל-11 קבצים בלי גיט הוא בדיוק המקרה שבו אין דרך לענות על ״מה בדיוק זז?״ ואין דרך לחזור אחורה.

**המלצה: להריץ את 0.2 לפני 0.1.** `git init` + commit ראשון על המצב הנוכחי = 3 דקות עבודה, ואחריהן הפיצול הופך לניתן לאימות (`git diff --stat`) ולביטול (`git reset --hard`) במקום להיות פעולה חד-כיוונית.

### ממצא נלווה — ניקוי `view.html` כבר לא נדרש

התוכנית הניחה ש-`guides/<cat>/view.html` חסרים. הם **קיימים** בעץ הפיתוח (8.6MB), ו-`build/pack.ps1` כבר מסיר אותם מהחבילה במכוון (`$deadPatterns`, שורה ~70) עם הסבר מלא. הניקוי היחיד שנשאר ב-0.1 הוא **הסרת השדה `path` מ-`CATEGORIES`** — שדה מת לגמרי (רק `loaderPath` בשימוש). ה-`<iframe id="guideFrame">` **כן** נשאר — הוא משמש לדפי ה-HTML המותאמים (`openCustomHtmlPage`).

---

## חלק א׳ — הפיצול המוצע: 11 קבצים, לא 8

התוכנית נקבה ב-8 מודולי פיצ׳ר. הם נכונים — אבל שלושה קבצים נוספים הכרחיים, אחרת הפיצול לא עומד:

* **`core.js`** — קבועים וכלים שכל מודול צריך. בלעדיו כל קובץ ישכפל אותם או ייווצר תלות מעגלית.
* **`data.js`** — גישה לנתונים (טעינה, עריכות, סימניות, אחסון). מפריד את **הלוגיקה** של הזיהוי מ**מקור הנתונים** שלו.
* **`bridge.js`** — כל מה שרץ בעת הטעינה, בקובץ אחד אחרון. אחרת סדר האתחול מתפזר על 10 קבצים וכל שינוי עתידי יסכן אותו.

### סדר טעינה ב-`index.html` (קריטי — לא לשנות)

```html
<script src="shell/core.js"></script>
<script src="shell/data.js"></script>
<script src="shell/identify.js"></script>
<script src="shell/refs.js"></script>
<script src="shell/guides.js"></script>
<script src="shell/entry-detail.js"></script>
<script src="shell/edit-forms.js"></script>
<script src="shell/results-ui.js"></script>
<script src="shell/home.js"></script>
<script src="shell/settings.js"></script>
<script src="shell/bridge.js"></script>
```

במקום `<script src="shell/router.js"></script>` הבודד, באותו מקום בדיוק — בסוף `<body>`.

### טבלת הפיצול

| # | קובץ | מקור (שורות בקובץ הנוכחי) | תוכן | ~שורות |
|---|---|---|---|---|
| 1 | `core.js` | 1–24 · 226–227 · 400 · 402–462 · 1444 · 1747–1756 | קבועים, `CATEGORIES`, כל ה-caches, `esc`, `HEB_POINT_SRC/RE`, `hebWordSrc`, `wholeWordRe`, הסתרת שבעת השמות, `hasOtzaria`, `cmpVersion` | 130 |
| 2 | `data.js` | 26–202 · 1481–1493 | `storageGet/Set`, עריכות מקומיות (`editsKey`…`restoreEntryToOriginal`), `pristineCache`, סימניות (הכול), `loadGuideData`, `preloadAllGuides`, `getHtmlPagesIndex` | 250 |
| 3 | `identify.js` | 204–369 (פחות 226–227) | `normalizeHeb`, `looseForm`, `tokenizeHeb`, `candidateForms`, `buildLookup`, `getLookup`, `invalidateLookup`, `identify`, `identifyInCustomPages` | 165 |
| 4 | `refs.js` | 621–732 | `TANAKH_BOOKS`, `parseVerseRef`, `BAVLI_MASECHTOT`, `parseMidrashRef`, `parseAnyRef`, `openInReader`, `confirmOpenExternal` + מאזין הקישורים החיצוניים | 112 |
| 5 | `guides.js` | 371–398 · 464–620 · 1401–1443 | רפרנסי DOM של תצוגת המדריך, תמונות (`lookupEntryImage/Gallery`, ויקיפדיה, `entryCardHTML`, lazy-load), צ׳יפים, `renderGuideGrid`, `openGuide`/`closeGuideView`/`closeFrame`, קליק על כרטיסי השער | 230 |
| 6 | `entry-detail.js` | 734–1133 | סכימת שדות (`FIELD_LABELS`, `GUIDE_FIELDS`, `METHOD_FIELDS`, `readField`/`writeField`), קישורי אישים, ערכי הבחנה, `renderEntryDetailHTML`, מפה, `wireEntryDetail`, `focusMainMap`, `openEntryDetail` | 400 |
| 7 | `edit-forms.js` | 1135–1398 | `openGenericEditForm`, `openGenericProposeForm` | 265 |
| 8 | `results-ui.js` | 1603–1745 | `renderResultsChips`, `showResults`, `renderResultsListRows`, `openIdentifyErrorReport` | 145 |
| 9 | `home.js` | 1447–1473 · 1494–1601 | פאנל משוב, דפי HTML שמורים (`renderSavedHtmlList`, `openCustomHtmlPage`, `openAddHtmlPanel`), `renderCustomPageCards` | 155 |
| 10 | `settings.js` | 1900–2090 | `PREFS_KEY`, ערכות, גופנים, `applyPrefs`, `syncSettingsUI`, `wireSettings` | 195 |
| 11 | `bridge.js` | 1757–1898 · 2091–2138 | `isOpenSelfSupported`, `bringToFront`, handoff (`setPending`/`consumePending`/`handoffAndShow`), `handleIdentifyClick`, `registerUnifiedMenuItem`, `onOtzariaTheme`, `restorePrefsFromOtzaria`, `waitForOtzaria` + **כל קריאות האתחול** | 200 |

**רווח תפעולי:** תיקון בפונקציית זיהוי = העלאת `identify.js` (165 שורות ≈ 3K טוקנים) במקום 2,136 שורות ≈ 36K. שינוי עיצוב לחלון התוצאות = `results-ui.js` + CSS. זה בדיוק ההחזר שהתוכנית תיארה.

---

## חלק ב׳ — החלטה ארכיטקטונית אחת שכדאי לקבל עכשיו

`identify.js` צריך להיות **טהור**: בלי DOM, בלי `Otzaria`. זה מה שמאפשר להריץ אותו ב-Node מול סט הבדיקות של סבב 2 — סעיף 8 בתוכנית מנוע הזיהוי.

היום יש חריגה אחת: `getLookup(cat)` קורא ל-`loadGuideData(cat)`, שיוצר iframe. שתי דרכים:

* **א׳ (מומלץ ל-0.1) — לא לגעת.** משאירים את `getLookup` כמו שהוא. `identify.js` יהיה טהור **חוץ** מהשורה הזו, וסבב 2 יטפל בה כשיהיה צורך אמיתי.
* **ב׳ — לנתק כבר עכשיו:** `getLookup(cat, data)` מקבל נתונים מבחוץ, והקוראים מזרימים אותם. זהו **כן** שינוי תפקודי־פוטנציאלי, ולכן הוא סותר את ״אפס שינוי״ של 0.1.

אני ממליץ על א׳. 0.1 חייב להישאר העברת־טקסט מכנית בלבד.

---

## חלק ג׳ — סיכונים ואיך מנטרלים אותם

| סיכון | למה זה קורה | נטרול |
|---|---|---|
| **שם כפול בין קבצים** | `const` שהוגדר פעמיים בקבצי script רגילים = `SyntaxError` שמפיל את **כל** התוסף בשקט | סקריפט בדיקה שסופר מזהים top-level בכל 11 הקבצים ונופל על כפילות |
| **שימוש בזמן טעינה לפני שהתלות נטענה** | `DIVINE_NAME_RE` מחושב בזמן טעינה, וכל `getElementById`/`addEventListener` רץ מיד | כל הקריאות בזמן־טעינה מרוכזות ב-`bridge.js` האחרון; `core.js` ראשון |
| **`type="module"`** | היה הופך כל קובץ ל-scope נפרד ושובר את כל ההפניות החוצות | **לא משתמשים.** `<script>` רגיל, בדיוק כמו היום |
| **`pack.ps1` יארוז router.js ישן** | הסקריפט מעתיק את כל התיקייה | `router.js` נמחק בפועל, לא נשאר לצד המודולים |
| **בלוק שנשמט בהעברה** | 2,136 שורות ביד | אימות אוטומטי — למטה |

### אימות ״אפס שינוי תפקודי״ — לא בעין

1. **בדיקת שלמות אוטומטית:** סקריפט Node שמחלץ מכל 11 הקבצים את רשימת ההצהרות ה-top-level ואת ה-hash של גוף כל פונקציה, ומשווה לרשימה מתוך `router.js` המקורי. פלט תקין = **אותו סט בדיוק, אפס הפרשים**. זה תופס בלוק שנשמט, פונקציה שנחתכה באמצע ושם שהשתנה בטעות.
2. **בדיקת תחביר:** `node --check` על כל קובץ.
3. **בדיקת כפילויות:** כנ״ל בטבלה.
4. **סמוק ידני — 8 מסלולים:** פתיחת שער · פתיחת כל אחד מ-6 המדריכים · חיפוש בתוך מדריך + צ׳יפים · פתיחת כרטיס (כולל אישים עם קישורי משפחה ומקומות עם מפה) · לחיצה על פסוק ← נפתח בספרייה · טופס עריכה: שמירה מקומית + שחזור למקור · ״זהה בעינים למקרא״ מהספרייה ← תוצאות (בדיקת באג 996) · הגדרות תצוגה: החלפת ערכה/גופן/גודל + איפוס.
5. **גרסה:** `manifest.json` → **2.11.0**, ושורת changelog.

---

## חלק ד׳ — מה אני צריך ממך כדי להתחיל

1. **אישור לטבלת הפיצול** (11 קבצים) — או תיקון.
2. **הכרעה בסעיף 0.2:** אפשרות א׳ (מפצלים כמו שזה, כולל הקוד המת) או ב׳ (מתקנים נגישות קודם)?
3. **הכרעה בסעיף 0.3:** להריץ `git init` לפני הפיצול? (ממליץ בחום — כן)
4. **אישור להקפאת `router.js`** — לוודא שאין שיחה/סשן אחר שממשיך לערוך אותו בזמן העבודה.
5. **אישור לסעיף ב׳** — `getLookup` נשאר כמו שהוא ב-0.1.

לא נוגע בשום קובץ עד שיתקבלו התשובות.
