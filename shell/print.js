// ייצוא כרטסת להדפסה/PDF (משימה 2.5, גרסה 2.12.3).
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.
//
// הרעיון: אין חלון חדש ואין window.open (ב-WebView של אוצריא אין כזה). במקום זה
// יש #printRoot אחד ב-index.html, מוסתר במסך, שמתמלא רגע לפני ההדפסה — וכל
// שאר הממשק מוסתר ב-@media print. כך אותה הדפסה עצמה עובדת גם ב״שמירה כ-PDF״.
//
// שלושה מקורות לייצוא רב-ערכי (״דף מקורות לשיעור״): הסימניות שבאזור האישי,
// תוצאות חלון הזיהוי, והתצוגה המסוננת של מדריך. בנוסף הכפתור 🖨️ שבכרטיס בודד,
// שעד 2.12.2 קרא ל-window.print() חשוף והדפיס את כל ממשק התוסף.

const printRoot = document.getElementById('printRoot');

// מעל זה שואלים לפני שמייצרים עשרות עמודים (הסינון ״הכל״ במדריך אישים = 1,914 ערכים)
const PRINT_CONFIRM_OVER = 60;

// הקשר אחרון להדפסה אוטומטית כשהמשתמש לוחץ Ctrl+P בעצמו, בלי הכפתור.
// נכתבים מבחוץ: openEntryDetail (entry-detail.js) ו-showResults (results-ui.js).
let printCtxEntry = null;
let printCtxResults = null;

function printDateStr(){
  try { return new Date().toLocaleDateString('he-IL', { year:'numeric', month:'2-digit', day:'2-digit' }); }
  catch(e){ return ''; }
}

// כרטיס מוכן לנייר: אותו renderEntryDetailHTML של המסך (ולכן maskDivineName כבר
// הוחל עליו), פחות כל מה שאין לו מובן מודפס — כפתורי הכלים, המפה האינטראקטיבית,
// ״↗ פתח בספרייה״, הקישורים החיצוניים ותיבת ״פרטים שאינם במדריך״.
function printableEntryEl(entry, catId, num){
  const cid = catId || catIdOfEntry(entry);
  const box = document.createElement('article');
  box.className = 'print-entry';
  box.innerHTML = renderEntryDetailHTML(entry, cid);
  box.querySelectorAll('.entry-tool-btn, .open-hint, .offline-map, .missing-box, .edited-note, [data-wiki-lazy]')
     .forEach(el => el.remove());
  box.querySelectorAll('a').forEach(a => a.remove());
  // פסקאות שנשארו ריקות אחרי הסרת הקישורים (״הצג במפה הראשית / פתח במפות גוגל״)
  box.querySelectorAll('p').forEach(p => { if (!p.textContent.trim() && !p.querySelector('img')) p.remove(); });
  const h2 = box.querySelector('h2');
  if (h2){
    if (num) h2.insertAdjacentHTML('afterbegin', '<span class="print-num">' + num + '.</span> ');
    const cat = CATEGORIES.find(c => c.id === cid);
    if (cat) h2.insertAdjacentHTML('afterend', '<div class="print-cat">' + esc(cat.icon + ' ' + cat.label) + '</div>');
  }
  return box;
}

// items: [{entry, catId}]
function buildPrintSheet(sourceLabel, items){
  printRoot.innerHTML = '';
  const head = document.createElement('header');
  head.className = 'print-head';
  head.innerHTML = '<div class="print-brand">תמונ״ך</div>'
    + '<div class="print-meta">' + esc(sourceLabel) + ' · ' + esc(printDateStr())
    + (items.length > 1 ? ' · ' + items.length + ' ערכים' : '') + '</div>';
  printRoot.appendChild(head);
  if (items.length > 1){
    const toc = document.createElement('ol');
    toc.className = 'print-toc';
    items.forEach(it => {
      const li = document.createElement('li');
      li.innerHTML = maskDivineName(esc(it.entry.name));
      toc.appendChild(li);
    });
    printRoot.appendChild(toc);
  }
  items.forEach((it, i) => {
    printRoot.appendChild(printableEntryEl(it.entry, it.catId, items.length > 1 ? i + 1 : 0));
  });
}

// ההדפסה עצמה. הניקוי אחריה נעשה ב-afterprint, ועם גיבוי בטיימר — ב-WebView
// לא כל מנוע יורה את האירוע הזה, ודף הדפסה שנשאר תקוע בזיכרון הוא בזבוז בלבד
// (הוא ממילא display:none במסך).
let printResetTimer = null;
function runPrintSheet(){
  const done = () => {
    window.removeEventListener('afterprint', done);
    clearTimeout(printResetTimer);
    printRoot.innerHTML = '';
  };
  window.addEventListener('afterprint', done);
  clearTimeout(printResetTimer);
  printResetTimer = setTimeout(done, 120000);
  // דחייה קצרה כדי שהדפדפן יספיק לפרוס את מה שהרגע נבנה לפני צילום העמוד
  setTimeout(() => {
    try { window.print(); }
    catch(e){ console.warn('madaei-hatanach: print failed', e); done(); }
  }, 60);
}

function printItems(sourceLabel, items){
  if (!items.length){ window.alert('אין ערכים לייצוא.'); return; }
  if (items.length > PRINT_CONFIRM_OVER &&
      !window.confirm('ייצוא ' + items.length + ' ערכים יפיק דף הדפסה ארוך מאוד (עשרות עמודים) '
        + 'ועלול לקחת זמן. אפשר לצמצם עם הסינון שלמעלה.\n\nלהמשיך בכל זאת?')) return;
  buildPrintSheet(sourceLabel, items);
  runPrintSheet();
}

// ---- ההקשרים ----

// כרטיס בודד — הכפתור 🖨️ שבכותרת הכרטיס
function printSingleEntry(entry, catId){
  printItems('כרטיס ערך', [{ entry: entry, catId: catId || catIdOfEntry(entry) }]);
}

// תוצאות חלון הזיהוי (בלי דפי HTML אישיים — אין להם כרטיס להדפיס)
function resultsPrintItems(){
  const ctx = printCtxResults;
  if (!ctx) return [];
  return (ctx.matches || [])
    .filter(m => m.catId !== 'custom' && m.entry)
    .map(m => ({ entry: m.entry, catId: m.catId }));
}
function printIdentifyResults(){
  const ctx = printCtxResults;
  const label = 'תוצאות זיהוי' + (ctx && ctx.selectedText ? ' — "' + String(ctx.selectedText).slice(0, 60) + '"' : '');
  printItems(label, resultsPrintItems());
}

// התצוגה המסוננת של מדריך — אותו חישוב בדיוק של renderGuideGrid, כדי שמה שמודפס
// יהיה מה שרואים על המסך ולא המדריך כולו
function guidePrintItems(){
  if (!currentGuideCat) return [];
  const q = normalizeHeb((guideSearchBox && guideSearchBox.value) || '').trim();
  let list = currentGuideData || [];
  if (activeGuideChip !== 'all') list = list.filter(e => e.cat === activeGuideChip);
  list = list.filter(matchesGuideFilters);
  if (q) list = list.filter(e => normalizeHeb(e.name + ' ' + (e.aliases || []).join(' ')).includes(q));
  return list.map(e => ({ entry: e, catId: currentGuideCat.id }));
}
function guidePrintLabel(){
  const parts = [currentGuideCat ? currentGuideCat.label : 'מדריך'];
  if (activeGuideChip !== 'all'){
    const c = guideCatOf(activeGuideChip);
    parts.push(c ? c.label : activeGuideChip);
  }
  if (activeGuideEra !== 'all') parts.push('תקופה: ' + activeGuideEra);
  if (activeGuideLetter !== 'all') parts.push('אות: ' + activeGuideLetter);
  const q = (guideSearchBox && guideSearchBox.value || '').trim();
  if (q) parts.push('חיפוש: ' + q);
  return parts.join(' · ');
}
function printGuideView(){ printItems(guidePrintLabel(), guidePrintItems()); }

// הסימניות שבאזור האישי. אסינכרוני: כל סימנייה מחזיקה catId+key בלבד, והערך עצמו
// נמצא בקובץ הדאטה של אותו מדריך — שלא בהכרח נטען עדיין.
async function printBookmarks(){
  const list = readBookmarks();
  if (!list.length){ window.alert('אין סימניות לייצוא.'); return; }
  const items = [];
  let missing = 0;
  for (const b of list.slice().reverse()){   // אותו סדר שמוצג בלשונית: החדש למעלה
    const cat = CATEGORIES.find(c => c.id === b.catId);
    if (!cat){ missing++; continue; }
    const data = await loadGuideData(cat).catch(() => []);
    const e = data.find(x => (x.__origName || x.name) === b.key) || data.find(x => x.name === b.key);
    if (e) items.push({ entry: e, catId: b.catId });
    else missing++;
  }
  if (missing) window.alert(missing + ' מהסימניות לא נמצאו במדריכים (ייתכן שהערך נמחק או ששמו שונה) ולא ייכללו בייצוא.');
  printItems('הסימניות שלי', items);
}

// ---- Ctrl+P ידני ----
// בלי זה, לחיצה על Ctrl+P בלי אחד הכפתורים הייתה מדפיסה עמוד ריק (כל הממשק מוסתר
// ב-@media print ו-#printRoot עדיין ריק). לכן ממלאים לפי מה שפתוח כרגע על המסך.
window.addEventListener('beforeprint', () => {
  if (printRoot.children.length) return;
  if (entryOverlay.classList.contains('open') && printCtxEntry){
    buildPrintSheet('כרטיס ערך', [{ entry: printCtxEntry, catId: catIdOfEntry(printCtxEntry) }]);
    return;
  }
  if (resultsOverlay.classList.contains('open')){
    const items = resultsPrintItems();
    if (items.length){ buildPrintSheet('תוצאות זיהוי', items); return; }
  }
  if (guideView.classList.contains('open')){
    const items = guidePrintItems();
    if (items.length){ buildPrintSheet(guidePrintLabel(), items); return; }
  }
});
window.addEventListener('afterprint', () => { printRoot.innerHTML = ''; });

document.getElementById('guidePrintBtn').addEventListener('click', printGuideView);
document.getElementById('resultsPrintBtn').addEventListener('click', printIdentifyResults);
