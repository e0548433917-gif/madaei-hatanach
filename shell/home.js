// עמוד השער: דפי HTML שמורים, ריבועיהם, ושורת החיפוש העליונה.
// נוצר בפיצול router.js (גרסה 2.11.2). המקור: shell/router.js שורות 1455-1466, 1479-1583, 1882-2006.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.


// ---- משוב והערות ----
// חלונית המשוב הנפרדת בוטלה מזמן; לשונית ״משוב״ הנפרדת שבאה אחריה בוטלה
// גם היא (11.8.26) ואוחדה ללשונית "הצעות ודיווחים" (renderPersonalDrafts,
// personal.js) - שם סוג "משוב" ב-REPORT_KINDS. הכניסה היחידה כיום היא
// openReportPanel, והשליחה עצמה עוברת דרך sendReport.

// ---- שורת פסוק בסרגל העליון + הבהרת AI בתחתית (נוסף ב-JS ולא ב-HTML, כדי
// לא להסתכן בשבירת קינון ה-divים הקיים ב-index.html) ----
(function(){
  const tb = document.querySelector('.topbar');
  if (tb){
    const verse = document.createElement('div');
    verse.className = 'mini-hint';
    verse.style.cssText = 'text-align:center;padding:2px 8px 6px;font-size:.85em;';
    verse.textContent = 'על דרך אמרו "כִּי עַל־כֵּן יָדַעְתָּ חֲנֹתֵנוּ בַּמִּדְבָּר וְהָיִיתָ לָּנוּ לְעֵינָיִם" (במדבר, פרק י)';
    tb.after(verse);
  }
  // ⚠️ כאן היה מוזרק פתק שני, זהה במילה למה שכבר יושב ב-index.html כ-#aiDisclaimer,
  // כך שההודעה הופיעה פעמיים בעמוד השער. ההזרקה הוסרה ב-3.1.2 — הפתק ב-HTML הוא
  // המקור היחיד. אין להחזיר אותה: כל שינוי בנוסח צריך לקרות בקובץ ה-HTML בלבד.
})();


// מ-2.16 (מפרט 4.0, ג׳): לכל דף גם מיקום (עמוד ראשי / ליד מסכת) ואיקון אופציונלי.
const addHtmlOverlay = document.getElementById('addHtmlOverlay');
const addHtmlName = document.getElementById('addHtmlName');
const addHtmlFile = document.getElementById('addHtmlFile');
const addHtmlPlacementWrap = document.getElementById('addHtmlPlacement');
const addHtmlMasechetSel = document.getElementById('addHtmlMasechet');
const addHtmlIconInput = document.getElementById('addHtmlIcon');
const savedHtmlList = document.getElementById('savedHtmlList');
let pendingHtmlContent = null;
let pendingIconContent = null;
let addHtmlPlacementVal = 'home';

// רשימת 63 המסכתות מקובצת לפי סדר, כמו studySelectA ב-shas.js — נבנית פעם אחת,
// כי MISHNA_MASECHTOT/SEDER_ORDER (shas.js) קבועים ונטענים לפני home.js.
if (addHtmlMasechetSel){
  addHtmlMasechetSel.innerHTML = '<option value="" selected disabled>בחרו מסכת…</option>' +
    SEDER_ORDER.map(seder => `<optgroup label="סדר ${esc(seder)}">` +
      MISHNA_MASECHTOT.filter(m => m.seder === seder).map(m => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('') +
      '</optgroup>').join('');
}

function resetAddHtmlForm(){
  addHtmlName.value = '';
  addHtmlFile.value = '';
  pendingHtmlContent = null;
  if (addHtmlIconInput) addHtmlIconInput.value = '';
  pendingIconContent = null;
  addHtmlPlacementVal = 'home';
  if (addHtmlPlacementWrap) addHtmlPlacementWrap.querySelectorAll('.set-opt').forEach(b => b.classList.toggle('active', b.dataset.val === 'home'));
  if (addHtmlMasechetSel){ addHtmlMasechetSel.value = ''; addHtmlMasechetSel.style.display = 'none'; }
}

async function renderSavedHtmlList(){
  const index = await getHtmlPagesIndex();
  savedHtmlList.innerHTML = '';
  if (!index.length){
    savedHtmlList.innerHTML = '<div class="mini-note">אין עדיין דפים שמורים.</div>';
    return;
  }
  for (const page of index){
    const name = page.name;
    const placeLabel = (page.placement === 'masechet' && page.masechet) ? ('מסכת ' + page.masechet) : 'עמוד ראשי';
    const row = document.createElement('div');
    row.className = 'saved-html-row';
    row.innerHTML = `<span>${esc(name)} <span class="mini-note">(${esc(placeLabel)})</span></span>
      <span>
        <button class="panel-btn" data-open>פתיחה</button>
        <button class="panel-btn secondary" data-send>שליחה למפתח</button>
        <button class="panel-btn secondary" data-del>מחיקה</button>
      </span>`;
    row.querySelector('[data-open]').addEventListener('click', () => openCustomHtmlPage(name));
    row.querySelector('[data-send]').addEventListener('click', async () => {
      const content = await storageGet('madaei_html_page__' + name);
      // 2.13.2 — דרך ממסר הדיווחים (sendToDev ב-personal.js), לא במייל.
      await sendToDev('דף HTML מצורף — ' + name,
        'המשתמש הוסיף דף HTML בשם "' + name + '".\n\nתוכן הדף מצורף למטה:\n\n' + (content || ''),
        'דף HTML');
    });
    row.querySelector('[data-del]').addEventListener('click', async () => {
      if (!window.confirm('למחוק את "' + name + '"?')) return;
      const idx2 = await getHtmlPagesIndex();
      await saveHtmlPagesIndex(idx2.filter(p => p.name !== name));
      await storageSet('madaei_html_page__' + name, null);
      talmudRendered = false;   // ליד מסכת ייתכן שהיה מוצמד דף שנמחק - יש לבנות מחדש
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
  resetAddHtmlForm();
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
if (addHtmlPlacementWrap) addHtmlPlacementWrap.addEventListener('click', (e) => {
  const b = e.target.closest('.set-opt');
  if (!b) return;
  addHtmlPlacementVal = b.dataset.val;
  addHtmlPlacementWrap.querySelectorAll('.set-opt').forEach(x => x.classList.toggle('active', x === b));
  if (addHtmlMasechetSel) addHtmlMasechetSel.style.display = (addHtmlPlacementVal === 'masechet') ? '' : 'none';
});
if (addHtmlIconInput) addHtmlIconInput.addEventListener('change', () => {
  const file = addHtmlIconInput.files && addHtmlIconInput.files[0];
  if (!file){ pendingIconContent = null; return; }
  const reader = new FileReader();
  reader.onload = () => { pendingIconContent = reader.result; };
  reader.readAsDataURL(file);
});
document.getElementById('addHtmlSave').addEventListener('click', async () => {
  const name = addHtmlName.value.trim();
  if (!name){ window.alert('יש לתת שם לדף'); return; }
  if (!pendingHtmlContent){ window.alert('יש לבחור קובץ HTML'); return; }
  if (!hasOtzaria()){ window.alert('שמירה קבועה דורשת פתיחה בתוך אוצריא.'); return; }
  const masechet = (addHtmlPlacementVal === 'masechet') ? (addHtmlMasechetSel && addHtmlMasechetSel.value) : null;
  if (addHtmlPlacementVal === 'masechet' && !masechet){ window.alert('יש לבחור מסכת'); return; }
  const index = await getHtmlPagesIndex();
  const entry = { name: name, placement: addHtmlPlacementVal, masechet: masechet, icon: pendingIconContent };
  const existingIdx = index.findIndex(p => p.name === name);
  if (existingIdx >= 0) index[existingIdx] = entry; else index.push(entry);
  await saveHtmlPagesIndex(index);
  await storageSet('madaei_html_page__' + name, pendingHtmlContent);
  await Otzaria.call('notifications.showInApp', { message: 'הדף נשמר לצמיתות', type: 'success' }).catch(()=>{});
  resetAddHtmlForm();
  addHtmlOverlay.classList.remove('open');   // מפרט 4.0 ג.3 — שמירה סוגרת את הפאנל
  renderSavedHtmlList();
  renderCustomPageCards();
  refreshPersonalIfOpen();
  talmudRendered = false;   // אם הדף הוצמד למסכת - יש לבנות מחדש את כרטיסי המסכתות
});

// ---- ריבועים בעמוד השער עבור דפי HTML שנשמרו ----
// מאז 2.12.0 הכרטיסים האלה יושבים בשורה השנייה (#extraGrid) יחד עם האזור האישי,
// כדי ששורת ששת המדריכים תישאר 3+3 מלאה ולא תיקטע בכל פעם שנוסף דף.
const extraGrid = document.getElementById('extraGrid');
async function renderCustomPageCards(){
  extraGrid.querySelectorAll('.card[data-custom-page]').forEach(el => el.remove());
  const index = await getHtmlPagesIndex();
  // עד 3.1.0 הכרטיסים נכנסו לפני "האזור האישי". ב-3.1.1 הוא עבר לסרגל הצד
  // (#sideRail) ואינו ילד של extraGrid — insertBefore עם עוגן זר זורק
  // NotFoundError, ולכן נופלים ל-append כשהעוגן אינו כאן.
  const anchor = extraGrid.querySelector('#personalCard');
  // דף שהוצמד למסכת (placement:'masechet') מקבל כרטיס בעמוד המסכתות במקום כאן - ר' talmud.js.
  index.filter(page => page.placement !== 'masechet').forEach(page => {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-custom-page', page.name);
    const iconHtml = page.icon
      ? `<img class="icon-img" src="${esc(page.icon)}" alt="" onerror="this.outerHTML='&lt;span class=\\'icon\\'&gt;📄&lt;/span&gt;'">`
      : '<span class="icon">📄</span>';
    card.innerHTML = iconHtml + `<span class="label">${esc(page.name)}</span>`;
    card.addEventListener('click', () => openCustomHtmlPage(page.name));
    if (anchor) extraGrid.insertBefore(card, anchor); else extraGrid.appendChild(card);
  });
  toggleExtraSection();
}

// מ-3.1.2 שורת "שלי" מכילה רק דפי HTML שהמשתמש הוסיף בעצמו (האזור האישי עבר
// לסרגל הצד, וספר אקראי לבורר הספר). אצל רוב המשתמשים היא ריקה לגמרי, ולכן
// גם הכותרת נעלמת — אחרת נשארת כותרת מרחפת מעל אזור ריק.
function toggleExtraSection(){
  const sep = document.getElementById('extraSep');
  const empty = !extraGrid.querySelector('.card');
  extraGrid.classList.toggle('is-empty', empty);
  if (sep) sep.classList.toggle('is-empty', empty);
}
toggleExtraSection();

// ============================================================
//  שורת החיפוש בעמוד השער
//  אותו מנוע בדיוק של תפריט ההקשר בספרייה: הקלדה קצרה = השלמה חיה משמות
//  הערכים והכינויים שכבר נטענו לזיכרון; Enter/״זיהוי״ = identify() מלא, כך
//  שאפשר להדביק פסוק שלם ולקבל את כל הדצח״מ שבו.
// ============================================================
const homeSearch = document.getElementById('homeSearch');
const homeSearchBtn = document.getElementById('homeSearchBtn');
const homeSearchDrop = document.getElementById('homeSearchDrop');

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

// ההתנהגות הזו זהה בשער ובתוך כל מדריך, ולכן היא פונקציה אחת ולא שני עותקים (2.12.0):
//   input · drop · btn (אופציונלי) · wrapSel (לסגירה בלחיצה בחוץ) · preferCat
//   onBeforePick — נקרא לפני מעבר למדריך, כדי שכל שורה תנקה את מה ששייך לה.
// המדריך הפעיל (preferCat) עולה לראש ההשלמות, כי מי שמחפש בתוך ״אישים״ מתכוון
// כמעט תמיד לאישים — אבל ההשלמות מכל המדריכים נשארות, בדיוק כמו בשער.
function attachLiveSearch(opts){
  const input = opts.input, drop = opts.drop, btn = opts.btn || null;
  if (!input || !drop) return null;
  let rows = [], activeIdx = -1, timer = null;

  function close(){
    drop.classList.remove('open');
    drop.innerHTML = '';
    rows = []; activeIdx = -1;
  }

  function render(){
    let hits = searchEntriesByName(input.value.trim(), 12);
    const prefer = opts.preferCat && opts.preferCat();
    if (prefer && hits.length){
      hits = hits.filter(h => h.catId === prefer).concat(hits.filter(h => h.catId !== prefer));
    }
    if (!hits.length){ close(); return; }
    rows = hits; activeIdx = -1;
    drop.innerHTML = hits.map((h, i) => {
      const viaNote = (normalizeHeb(h.via) !== normalizeHeb(h.name)) ? ' <span class="hs-cat">(' + esc(h.via) + ')</span>' : '';
      return `<div class="hs-row" data-i="${i}">
        <span>${h.catIcon}</span>
        <span class="hs-name">${esc(h.name)}</span>${viaNote}
        <span class="hs-cat">${esc(h.catLabel)}</span>
      </div>`;
    }).join('') + '<div class="hs-note">Enter — זיהוי מלא של כל הטקסט שבשורה (גם פסוק שלם)</div>';
    drop.querySelectorAll('.hs-row').forEach(row => {
      row.addEventListener('click', () => {
        const h = rows[parseInt(row.dataset.i, 10)];
        if (h) pick(h);
      });
    });
    drop.classList.add('open');
  }

  function pick(h){
    close();
    input.value = '';
    if (opts.onBeforePick) opts.onBeforePick();
    openGuide(h.catId, h.name);
  }

  async function runIdentify(){
    const text = input.value.trim();
    if (!text) return;
    close();
    let label = null;
    if (btn){ btn.disabled = true; label = btn.textContent; btn.textContent = '…'; }
    try {
      const matches = await identifyWithLiveContext(text);
      showResults(matches, text);
    } finally {
      if (btn){ btn.disabled = false; btn.textContent = label; }
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(render, 140);
  });
  input.addEventListener('keydown', (ev) => {
    const els = drop.querySelectorAll('.hs-row');
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp'){
      if (!els.length) return;
      ev.preventDefault();
      activeIdx += (ev.key === 'ArrowDown' ? 1 : -1);
      if (activeIdx < 0) activeIdx = els.length - 1;
      if (activeIdx >= els.length) activeIdx = 0;
      els.forEach((r, i) => r.classList.toggle('active', i === activeIdx));
      els[activeIdx].scrollIntoView({ block: 'nearest' });
      return;
    }
    if (ev.key === 'Enter'){
      ev.preventDefault();
      if (activeIdx >= 0 && rows[activeIdx]) pick(rows[activeIdx]);
      else runIdentify();
      return;
    }
    if (ev.key === 'Escape') close();
  });
  if (btn) btn.addEventListener('click', runIdentify);
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest(opts.wrapSel)) close();
  });
  return { close: close, identify: runIdentify };
}

attachLiveSearch({
  input: homeSearch, drop: homeSearchDrop, btn: homeSearchBtn, wrapSel: '#homeSearchWrap'
});

// אותה שורה בדיוק בתוך כל מדריך. הסינון החי של הרשת (guides.js) נשאר כפי שהיה —
// כאן רק נוספו ההשלמה החיה וה-Enter שמריץ זיהוי מלא על הטקסט שבשורה.
attachLiveSearch({
  input: guideSearchBox,
  drop: document.getElementById('guideSearchDrop'),
  btn: document.getElementById('guideIdentifyBtn'),
  wrapSel: '#guideSearchWrap, #guideIdentifyBtn',
  preferCat: () => currentGuideCat && currentGuideCat.id
});

// ============================================================
//  "ערך היום" (2.10א): מאורעות התנ״ך לפי התאריך העברי של היום, מתוך
//  TANAKH_DATE_EVENTS (guides/_shared/dates.js). דאטה קבועה, בלי רשת.
// ============================================================
const dailyEventCard = document.getElementById('dailyEventCard');
const dailyEventLabel = document.getElementById('dailyEventLabel');
const dailyEventOverlay = document.getElementById('dailyEventOverlay');
const dailyEventBody = document.getElementById('dailyEventBody');

// מקור המאורע הופך לקישור לחיץ לספרייה כשהוא נפרש - קודם parseColonVerseRef
// (dates.js, "ספר פרק:פסוק" - רוב הרשומות, מקור תנ״כי) ואם זה נכשל parseMidrashRef
// (refs.js, "משנה, X Y, Z" / "בבלי, X Y" וכו' - מקורות חז״ל/הלכה חוץ-מקראיים,
// כמו "משנה, בכורות ט, ה"). "תלמוד בבלי, ..." (בניגוד ל"בבלי, ...") לא נתפס ע"י
// אף אחד מהשניים בכוונה - ר' הערת הכותב בראש dates.js.
// כפתור העריכה (✏️) יושב בתוך אותה שורה לחיצה שפותחת בספרייה - stopPropagation
// ב-wireDateEventLinks מונע פתיחה כפולה. __origKey/__addedIdx (allDateEvents,
// dates.js) מסומנים כ-data-* כדי שהכפתור ידע איזו רשומה לפתוח לעריכה.
function dateEventRow(ev, monthLabel){
  const parsed = parseColonVerseRef(ev.source) || parseMidrashRef(ev.source);
  const openAttr = parsed ? ` data-vbook="${esc(parsed.bookId)}" data-vref="${esc(parsed.ref)}"` : '';
  const editAttr = ev.__origKey != null ? ` data-edit-key="${esc(ev.__origKey)}"`
    : (ev.__addedIdx != null ? ` data-edit-idx="${ev.__addedIdx}"` : '');
  // לא נעשה שימוש ב-edited-badge/✏️ הכללי (guides.js) כאן - הוא היה מתנגש חזותית
  // עם כפתור העריכה הייעודי (גם הוא ✏️) שכל שורה כבר מציגה.
  const badge = ev.__edited ? ' <span class="mini-hint">(נערך)</span>' : (ev.__custom ? ' <span class="missing-chip">מותאם אישית</span>' : '');
  return `<div class="src-item${parsed ? ' clickable' : ''}"${openAttr}>
    <div class="src-source">${esc(ev.day)}' ${esc(monthLabel)} — ${esc(ev.event)}${badge}
      <button type="button" class="date-ev-edit-btn"${editAttr} title="עריכת מאורע">✏️</button>
    </div>
    ${ev.source ? `<div class="src-note">${esc(ev.source)}${parsed ? ' <span class="open-hint">↗ פתח בספרייה</span>' : ''}</div>` : ''}
  </div>`;
}
function wireDateEventLinks(container){
  container.querySelectorAll('.src-item.clickable[data-vbook]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.date-ev-edit-btn')) return;
      openInReader(el.dataset.vbook, el.dataset.vref);
    });
  });
  container.querySelectorAll('.date-ev-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.editKey, idx = btn.dataset.editIdx;
      const ev = (idx !== undefined)
        ? allDateEvents().find(x => x.__addedIdx === Number(idx))
        : allDateEvents().find(x => x.__origKey === key);
      if (ev) openDateEventForm(ev);
    });
  });
}

// טופס הוספה/עריכה של מאורע ב"ערך היום" - אותו entryOverlay/entryModalInner
// שמשמש את עורך הכרטיסים (edit-forms.js), כדי לא לבנות פאנל נפרד. ev=null → הוספה
// חדשה; ev.__origKey → עריכת רשומה מובנית (עם שחזור-למקור, בלי מחיקה - הסתרת רשומה
// מובנית בלי דרך לראות/לבטל את זה היא מלכודת UX); ev.__addedIdx → עריכת/מחיקת
// תוספת של המשתמש עצמו. השמירה תמיד "במכשיר זה" (localStorage, dates.js) - כאן
// אין ערוץ "שליחה למפתח" כמו בעורך הכרטיסים, כי מאורע-תאריך אינו "כרטיס" עם מדריך
// ו-catId שהצינור הזה (sendToDev, personal.js) בנוי סביבם.
function openDateEventForm(ev){
  const isBuiltin = !!(ev && ev.__origKey != null);
  const isCustom = !!(ev && ev.__custom);
  const monthOptions = HEBREW_MONTHS_ORDER.map(m =>
    `<option value="${esc(m)}"${ev && ev.month === m ? ' selected' : ''}>${esc(m)}</option>`).join('');
  entryModalInner.innerHTML = `
    <h2>${ev ? 'עריכת מאורע' : 'הוספת מאורע ל"ערך היום"'}</h2>
    <div class="entry-sub">השינוי נשמר במכשיר זה בלבד.${isBuiltin ? ' זו רשומה מובנית בתוסף - אפשר לשחזר לגרסת המקור בכל עת.' : ''}</div>

    <div class="field-label">יום <span class="mini-hint">(אותיות גימטריה, למשל "ה" או "כז-כה" לטווח ימים)</span></div>
    <input type="text" id="dateEvDay" value="${esc(ev ? ev.day : '')}" class="f-input" style="max-width:120px;">

    <div class="field-label">חודש</div>
    <select id="dateEvMonth" class="f-input">${monthOptions}</select>

    <div class="field-label">תיאור המאורע</div>
    <textarea id="dateEvText" class="f-textarea">${esc(ev ? ev.event : '')}</textarea>

    <div class="field-label">מקור <span class="mini-hint">(פסוק בנקודתיים - "עזרא ז:ט"; או מקור חז״ל בפורמט הרגיל - "משנה, בכורות ט, ה" / "בבלי, שבת פו ע\"ב")</span></div>
    <input type="text" id="dateEvSource" value="${esc(ev ? ev.source : '')}" class="f-input">
    <div id="dateEvRefCheck" class="ref-check-box"></div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">
      <button class="nf-btn" id="dateEvSave">💾 שמירה במכשיר</button>
      <button class="nf-btn secondary" id="dateEvCancel">ביטול</button>
      ${isCustom ? '<button class="nf-btn secondary danger-link" id="dateEvDelete">🗑 מחיקה</button>' : ''}
      ${isBuiltin && ev.__edited ? '<button class="nf-btn secondary" id="dateEvRestore">↺ שחזור למקור</button>' : ''}
    </div>`;
  entryOverlay.classList.add('open');

  function liveCheck(){
    const src = document.getElementById('dateEvSource').value.trim();
    const box = document.getElementById('dateEvRefCheck');
    if (!src){ box.innerHTML = ''; return; }
    const ok = !!(parseColonVerseRef(src) || parseMidrashRef(src));
    box.innerHTML = `<div style="font-size:12px;${ok ? 'color:var(--color-success,#2e7d32);' : 'color:var(--color-on-surface-faint,#888);'}">`
      + `${ok ? '✓ ייפתח כקישור לספרייה' : '○ לא יזוהה כקישור לספרייה (יוצג כטקסט בלבד)'}</div>`;
  }
  document.getElementById('dateEvSource').addEventListener('input', liveCheck);
  liveCheck();

  document.getElementById('dateEvCancel').addEventListener('click', () => entryOverlay.classList.remove('open'));

  document.getElementById('dateEvSave').addEventListener('click', () => {
    const day = document.getElementById('dateEvDay').value.trim();
    const month = document.getElementById('dateEvMonth').value;
    const event = document.getElementById('dateEvText').value.trim();
    const source = document.getElementById('dateEvSource').value.trim();
    if (!day || !event){ window.alert('יש למלא יום ותיאור מאורע.'); return; }
    const newEv = { day, month, event, source };
    const ok = isBuiltin ? saveDateEventEdit(ev.__origKey, newEv)
      : isCustom ? saveCustomDateEvent(ev.__addedIdx, newEv)
      : addCustomDateEvent(newEv);
    entryOverlay.classList.remove('open');
    if (!ok) window.alert('השמירה נכשלה (ייתכן שאחסון הדפדפן מלא).');
    renderDailyEventBody();
  });

  if (isCustom) document.getElementById('dateEvDelete').addEventListener('click', () => {
    if (!window.confirm('למחוק את המאורע הזה לצמיתות?')) return;
    deleteCustomDateEvent(ev.__addedIdx);
    entryOverlay.classList.remove('open');
    renderDailyEventBody();
  });
  if (isBuiltin && ev.__edited) document.getElementById('dateEvRestore').addEventListener('click', () => {
    restoreBuiltinDateEvent(ev.__origKey);
    entryOverlay.classList.remove('open');
    renderDailyEventBody();
  });
}

function renderDailyEventBody(){
  const t = todayHebrew();
  const today = eventsForToday();
  let html = `<p class="panel-hint">היום ${esc(t.dayLetters)}' ${esc(t.monthName)} ${esc(hebYearStr(t.raw.year))} (${esc(gregDateStr())})</p>`;
  if (today.length){
    html += '<div class="field-label">מאורעות התנ״ך והתלמוד היום</div>' + today.map(ev => dateEventRow(ev, t.monthName)).join('');
  } else {
    html += '<p class="mini-note">אין מאורע רשום לתאריך זה ברשימה (חלקית - ר׳ הרשימה המלאה למטה).</p>';
  }
  html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:16px;">
    <div class="field-label" style="margin:0;">כל מאורעות התנ״ך והתלמוד לפי חודש</div>
    <button type="button" class="nf-btn secondary" id="dateEventAddBtn" style="padding:4px 10px;font-size:13px;">＋ הוספת מאורע</button>
  </div>`;
  const all = allDateEvents();
  HEBREW_MONTHS_ORDER.forEach(month => {
    const items = all.filter(e => e.month === month);
    if (!items.length) return;
    html += `<details class="month-details"><summary>${esc(month)} (${items.length})</summary>`
      + items.map(ev => dateEventRow(ev, month)).join('') + '</details>';
  });
  html += '<p class="mini-note" style="margin-top:14px;">'
    + 'הרשימה התחילה על בסיס תוסף ״ביוגרפיות״ מאת Yair Daniel, ונוספה עליה '
    + '<b>מסכת בכורות</b> לטובת לומדי הדף היומי. חלק מהרשומות ממקורות נוספים '
    + '(ר׳ מקור בכל רשומה).<br>'
    + 'אי״ה בסבב התוכן ייכנסו כל התאריכים שבתנ״ך, במשנה ובתלמוד. '
    + 'מצאתם תאריך שאינו כאן? אפשר להוסיף אותו בעצמכם (＋ למעלה), או '
    + '<a href="#" id="dailyEventReportLink">לשלוח לנו דיווח</a> ונוסיף אותו לכולם.'
    + '</p>';
  dailyEventBody.innerHTML = html;
  wireDateEventLinks(dailyEventBody);
  const addBtn = dailyEventBody.querySelector('#dateEventAddBtn');
  if (addBtn) addBtn.addEventListener('click', () => openDateEventForm(null));
  // "שלחו לנו דיווח" — לשונית הדיווחים באזור האישי, אותו דפוס כמו הבאנר
  // ב-talmud.js. הפאנל נסגר קודם, אחרת הוא נשאר פתוח מעל האזור האישי.
  const reportLink = dailyEventBody.querySelector('#dailyEventReportLink');
  if (reportLink) reportLink.addEventListener('click', (e) => {
    e.preventDefault();
    dailyEventOverlay.classList.remove('open');
    openPersonalArea('drafts');
  });
}
if (dailyEventLabel){
  const t = todayHebrew();
  dailyEventLabel.textContent = 'ערך היום — ' + t.dayLetters + "' " + t.monthName + ' ' + hebYearStr(t.raw.year) + ' (' + gregDateStr() + ')';
}
// טיימר בית המקדש - מועתק כלשונו מ-guides/beithamikdash/view.html:1024 (רק ה-DOM
// updates זהים; שם רץ תמיד, כאן רק כשהפאנל פתוח - אין טעם ב-setInterval ברקע).
const TEMPLE_DESTRUCTION = new Date(Date.UTC(2000, 6, 4, 0, 0, 0));
TEMPLE_DESTRUCTION.setUTCFullYear(70); // 4 ביולי 70 לספירה - תוקן בעקבות אותה שגיאה שתוקנה
// ב-yearsSinceChurban (guides/_shared/dates.js): (2000,7,4)/gregToHebDate(70,8,4) נפלו
// בטעות בחודש אוגוסט/אלול, לא ביולי/אב.
let templeTimerInterval = null;
function updateTempleTimer(){
  const now = new Date();
  let y = now.getUTCFullYear() - TEMPLE_DESTRUCTION.getUTCFullYear();
  let m = now.getUTCMonth() - TEMPLE_DESTRUCTION.getUTCMonth();
  let d = now.getUTCDate() - TEMPLE_DESTRUCTION.getUTCDate();
  let h = now.getUTCHours() - TEMPLE_DESTRUCTION.getUTCHours();
  let mi = now.getUTCMinutes() - TEMPLE_DESTRUCTION.getUTCMinutes();
  let s = now.getUTCSeconds() - TEMPLE_DESTRUCTION.getUTCSeconds();
  if (s < 0){ s += 60; mi--; }
  if (mi < 0){ mi += 60; h--; }
  if (h < 0){ h += 24; d--; }
  if (d < 0){
    const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    d += prevMonth.getUTCDate();
    m--;
  }
  if (m < 0){ m += 12; y--; }
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('ttYears', y); set('ttMonths', m); set('ttDays', d);
  set('ttHours', h); set('ttMinutes', mi); set('ttSeconds', s);
}

if (dailyEventCard) dailyEventCard.addEventListener('click', () => {
  renderDailyEventBody();
  dailyEventOverlay.classList.add('open');
  updateTempleTimer();
  if (!templeTimerInterval) templeTimerInterval = setInterval(updateTempleTimer, 1000);
});
document.getElementById('dailyEventClose').addEventListener('click', () => {
  dailyEventOverlay.classList.remove('open');
  if (templeTimerInterval){ clearInterval(templeTimerInterval); templeTimerInterval = null; }
});
