// 4.7.0 — יכולות SDK של אוצריא 0.9.99 (מתועדות בענף dev של אוצריא, 07/10/2026,
// עוד לפני שהגרסה שוחררה). כל מה שכאן מופעל רק כשהגרסה בפועל היא 0.9.99 ומעלה
// (appVersionAtLeast), ובגרסה ישנה התוסף עובד בדיוק כמו קודם.
//
//   contexts: ['reader-book'] — לחיצה ימנית **בלי סימון**: ״זיהוי הפסקה בעינים
//                               למקרא״ מזהה את כל הפסקה שעליה לחצו.
//   printRange (reader)          — ״הדפסת הפרק״ בכרטיס: מסך ההדפסה של אוצריא על
//                               הפרק של הפסוק (גופן, ניקוד, מפרשים, PDF/Word).
//
// ⚠️ מלכודת האריזה (ר' core.js מעל appVersionAtLeast): הוולידטור של אוצריא
// חוסם אריזה כשמחרוזת של API חדש מ-minAppVersion מופיעה בקוד כליטרל. לכן שם
// המתודה printRange (reader) מורכב בזמן ריצה מחלקים. ״reader-book״ אינו שם מתודה
// ולכן אינו נבדק — אבל הוא **לא** נכנס למניפסט כל עוד minAppVersion < 0.9.99:
// ערך contexts לא חוקי במניפסט חוסם התקנה (2.19.1). הרישום כאן בזמן ריצה בלבד.

const PARAGRAPH_MENU_ITEM_ID = 'madaei-hatanach-identify-paragraph';
const SDK_999 = '0.9.99';

function otz999Data(res){ return (res && res.data !== undefined) ? res.data : res; }
function otz999Failed(res){ return !res || res.success === false || !!res.error; }

// ---- לחיצה ימנית בלי סימון ----
async function registerParagraphMenuItem(){
  if (!(window.Otzaria && Otzaria.call)) return;
  if (!(await appVersionAtLeast(SDK_999))) return;
  // פריט עליון שני (המכסה היא שניים לתוסף). רישום חוזר על אותו id מחליף את הקודם.
  Otzaria.call('reader.addContextMenuItem', {
    id: PARAGRAPH_MENU_ITEM_ID,
    label: 'זיהוי הפסקה בעינים למקרא',
    icon: 'eye_24_regular',
    contexts: ['reader-book']
  }).catch(() => {});
}

// מיקום הפסקה שנלחצה. לפי התיעוד: זהות הספר + sectionIndex/currentIndex,
// ו-selection עם text ריק. מקבלים כמה צורות, כמו בשאר הקוד.
function paragraphLocFromPayload(p){
  if (!p) return null;
  const sel = p.selection || {};
  const bookId = p.currentBookId || p.currentBook || p.bookId || sel.bookId;
  let idx = [p.sectionIndex, sel.sectionIndex, p.currentIndex].find(v => Number.isInteger(v) && v >= 0);
  if (!bookId || idx == null) return null;
  return { bookId: String(bookId), sectionIndex: idx, title: String(p.currentRef || p.currentBook || bookId) };
}

async function paragraphText(loc){
  try {
    const d = otz999Data(await Otzaria.call('reader.getSectionTextMap', {
      bookId: loc.bookId, sectionIndex: loc.sectionIndex, layer: 'both'
    }));
    const t = d && (d.renderedText || d.sourceText);
    if (t) return String(t).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  } catch(e){}
  return '';
}

async function handleParagraphClick(payload){
  const loc = paragraphLocFromPayload(payload);
  const text = loc ? await paragraphText(loc) : '';
  if (!text){
    Otzaria.call('notifications.showInApp', { message: 'לא הצלחנו לקרוא את הפסקה הזו. אפשר לסמן מילה וללחוץ ״זיהוי בעינים למקרא״.', type: 'info' }).catch(() => {});
    return;
  }
  // הדגשת כל הערכים שבפסקה (אין כאן sourceRange של בחירה להדגיש)
  try {
    if (!parashaDataReady()) await ensureAllGuidesLoaded();
    const matches = await identifyWithLiveContext(text, { includePossible: true, source: { book: loc.title } });
    const shown = matches.filter(m => m.confidence !== 'אפשרי');
    if (shown.length) highlightMatchesInSection(loc.bookId, loc.sectionIndex, shown);
  } catch(e){}
  // אותו מסלול כמו לחיצה על טקסט מסומן: חלון אישור ואז מעבר לתוצאות
  await handleIdentifyClick(Object.assign({}, payload, { selectedText: text, selection: null }));
}

// ---- הדפסת הפרק של פסוק מתוך הכרטיס ----
// טווח הפרק: מהכותרת האחרונה שלפני הפסוק ועד הכותרת הבאה באותה רמה או גבוהה ממנה.
async function chapterRangeForRef(ref){
  const hits = otz999Data(await Otzaria.call('library.resolveRef', { ref, limit: 1 }));
  const h = Array.isArray(hits) && hits[0];
  if (!h || h.isPdf || !h.bookId || !Number.isInteger(h.index)) return null;
  const toc = otz999Data(await Otzaria.call('library.getBookToc', { bookId: h.bookId }));
  const nodes = (Array.isArray(toc) ? toc : []).filter(n => n && Number.isFinite(Number(n.index)))
    .map(n => ({ index: Number(n.index), level: Number(n.level) || 1 }))
    .sort((a, b) => a.index - b.index);
  let start = null;
  for (const n of nodes){ if (n.index <= h.index) start = n; else break; }
  const range = { bookId: h.bookId, startIndex: start ? start.index : h.index };
  if (h.bookUid) range.bookUid = h.bookUid;
  if (start){
    const next = nodes.find(n => n.index > start.index && n.level <= start.level);
    if (next) range.endIndex = next.index;
  }
  return range;
}

async function printChapterOfRef(btn, ref){
  // הקריאה דורשת מחוות משתמש. לכן הטווח נשמר על הכפתור: אם אוצריא דחתה את
  // הלחיצה הראשונה (כי עברו כמה await עד שהטווח חושב), הלחיצה הבאה מיידית.
  let range = btn._mhRange;
  if (!range){
    btn.disabled = true;
    try { range = await chapterRangeForRef(ref); } catch(e){ range = null; }
    btn.disabled = false;
    if (!range){
      Otzaria.call('ui.showError', { message: 'הפרק לא נמצא בספרייה המותקנת.' }).catch(() => {});
      return;
    }
    btn._mhRange = range;
  }
  let res = null;
  try { res = await Otzaria.call(['reader', 'printRange'].join('.'), range); } catch(e){ res = { error: e }; }
  if (otz999Failed(res)){
    const code = String((res && res.error && (res.error.code || res.error)) || '');
    if (code.indexOf('forbidden') !== -1){
      Otzaria.call('notifications.showInApp', { message: 'הפרק מוכן להדפסה — לחצו שוב על ״הדפסת הפרק״.', type: 'info' }).catch(() => {});
    } else {
      Otzaria.call('ui.showError', { message: 'לא ניתן לפתוח את מסך ההדפסה לפרק הזה.' }).catch(() => {});
    }
  }
}

async function wireVersePrintRange(container, entry){
  if (!(window.Otzaria && Otzaria.call) || !container || !entry) return;
  if (!(await appVersionAtLeast(SDK_999))) return;
  const verses = entry.verses || entry.makorot || [];
  container.querySelectorAll('.verse-card[data-vref]').forEach(card => {
    if (card.querySelector('.otz-print-chapter-btn')) return;
    const v = verses[parseInt(card.dataset.vref, 10)];
    if (!v || !v.ref) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'tool-btn otz-print-chapter-btn'; btn.textContent = '🖨 הדפסת הפרק';
    btn.title = 'פתיחת מסך ההדפסה של אוצריא על הפרק של הפסוק';
    btn.addEventListener('click', (ev) => { ev.stopPropagation(); printChapterOfRef(btn, v.ref); });
    const comm = card.querySelector('.otz-comm-btn');
    if (comm) comm.insertAdjacentElement('afterend', btn); else card.appendChild(btn);
  });
}
