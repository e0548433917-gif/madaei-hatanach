// יכולות SDK חדשות של אוצריא (3.8.0) — מרוכזות בקובץ אחד כדי שאפשר יהיה
// להסיר/לגדר אותן בקלות. כל קריאה כאן שקטה בכישלון: הכרטיס עובד גם בלעדיה.
//
//   tools.biographies       (0.9.98) — ביוגרפיה מהמאגר של אוצריא בכרטיסי אישים/אמוראים
//   library.getBookDetails  (0.9.98) — "אודות המסכת" למסכת שאין לה עדיין מדריך
//   library.resolveRef      — סימון מקורות חז"ל שאינם נפתרים בספרייה המותקנת
//   search.query            — "היכן עוד מוזכר" מתוך הכרטיס
//   ui.setUnsavedChanges    — אזהרה לפני סגירה באמצע עריכה (edit-forms.js)

function otzOk(){ return !!(window.Otzaria && typeof Otzaria.call === 'function'); }
function otzData(res){ return (res && res.data !== undefined) ? res.data : res; }

// ---- ביוגרפיה מהמאגר של אוצריא ----
// רק לחכמים (אמוראים/תנאים) ולאישים — המאגר הוא של חכמי ישראל, ולכן התאמה
// נחשבת רק כשהשם או אחד הכינויים זהה לשם הערך, אחרת היינו מציגים אדם אחר.
async function fetchOtzariaBiography(name){
  if (!otzOk() || !name) return null;
  try {
    const d = otzData(await Otzaria.call('tools.biographies', { query: String(name).slice(0, 200), limit: 5 }));
    const list = (d && d.results) || [];
    const norm = s => String(s || '').replace(/["'״׳\s]/g, '');
    const want = norm(name);
    return list.find(b => norm(b.name) === want || (b.appelations || []).some(a => norm(a) === want)) || null;
  } catch(e){ return null; }
}

function biographyHtml(b){
  const parts = [];
  if (b.generation) parts.push('דור: ' + esc(b.generation));
  if (b.birth) parts.push('לידה: ' + esc(b.birth));
  if (b.death) parts.push('פטירה: ' + esc(b.death));
  if (b.countries && b.countries.length) parts.push(esc(b.countries.join(', ')));
  const text = b.summary || b.biographyShort || '';
  return `<div class="otz-bio" style="margin-top:12px;padding:10px 12px;border-radius:10px;border:1px solid var(--color-outline);">
    <div class="field-label" style="margin-top:0;">📜 ממאגר הביוגרפיות של אוצריא</div>
    ${parts.length ? `<div class="mini-note" style="margin:0 0 6px;">${parts.join(' · ')}</div>` : ''}
    ${text ? `<p style="margin:0;">${esc(text)}</p>` : ''}
  </div>`;
}

// ---- "היכן עוד מוזכר" — חיפוש מלא באוצריא ----
async function searchMentions(query, max){
  const out = [];
  let total = 0;
  let chunks = Otzaria.call('search.query', { query, mode: 'exact', limit: max || 30, order: 'relevance' });
  if (chunks && typeof chunks.then === 'function' && !chunks[Symbol.asyncIterator]) chunks = await chunks;
  if (!chunks || !chunks[Symbol.asyncIterator]) return { total: 0, results: [] };
  // אוספים למערך ומרנדרים אחרי הלולאה — צרכן איטי קוטע את הזרם (API_REFERENCE).
  for await (const c of chunks){
    if (!c) continue;
    if (typeof c.total === 'number') total = c.total;
    if (Array.isArray(c.results)) out.push(...c.results);
    if (out.length >= (max || 30)) break;
  }
  return { total, results: out.slice(0, max || 30) };
}

function wireMentionsSearch(container, entry){
  const name = entry && (entry.name || entry.title);
  if (!name || container.querySelector('.otz-mentions')) return;
  const box = document.createElement('div');
  box.className = 'otz-mentions';
  box.style.marginTop = '12px';
  box.innerHTML = `<button type="button" class="panel-btn secondary">🔎 היכן עוד מוזכר "${esc(name)}" בספרייה</button><div class="otz-mentions-list"></div>`;
  container.appendChild(box);
  const btn = box.querySelector('button');
  const list = box.querySelector('.otz-mentions-list');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    list.innerHTML = '<p class="mini-note">מחפש…</p>';
    try {
      const { total, results } = await searchMentions(name, 30);
      if (!results.length){ list.innerHTML = '<p class="mini-note">לא נמצאו מופעים.</p>'; return; }
      list.innerHTML = `<p class="mini-note">${total} מופעים${total > results.length ? ' — מוצגים ' + results.length + ' הראשונים' : ''}</p>` +
        results.map((r, i) => `<div class="src-item clickable" data-hit="${i}"><b>${esc(r.reference || r.book || '')}</b> — ${esc(String(r.text || '').replace(/<[^>]*>/g, '').slice(0, 140))}</div>`).join('');
      list.querySelectorAll('[data-hit]').forEach(el => el.addEventListener('click', () => {
        const r = results[+el.dataset.hit];
        Otzaria.call('reader.openBook', { bookId: r.bookId, type: r.type, index: r.index }).catch(() => {});
      }));
    } catch(e){
      list.innerHTML = '<p class="mini-note">החיפוש אינו זמין כרגע.</p>';
    } finally { btn.disabled = false; }
  });
}

// ---- סימון מקורות שאינם נפתרים בספרייה המותקנת ----
async function markUnresolvedSources(container, entry){
  const items = container.querySelectorAll('.src-item.clickable[data-mref]');
  for (const el of items){
    const m = (entry.midrash || [])[parseInt(el.dataset.mref, 10)];
    const ref = m && midrashSource(m);
    if (!ref) continue;
    try {
      const hits = otzData(await Otzaria.call('library.resolveRef', { ref, limit: 1 }));
      if (Array.isArray(hits) && !hits.length){
        el.classList.remove('clickable');
        el.style.opacity = '0.65';
        el.title = 'המקור לא נמצא בספרייה המותקנת';
      }
    } catch(e){ return; }   // API לא זמין — לא נוגעים בכלום
  }
}

// נקרא מסוף wireEntryDetail (entry-detail.js)
function enrichEntryDetail(container, entry){
  if (!otzOk() || !container || !entry) return;
  const catId = (typeof catIdOfEntry === 'function') ? catIdOfEntry(entry) : null;
  if ((catId === 'amoraim' || catId === 'people') && !container.querySelector('.otz-bio')){
    fetchOtzariaBiography(entry.name).then(b => {
      if (b && container.isConnected && !container.querySelector('.otz-bio')){
        container.insertAdjacentHTML('beforeend', biographyHtml(b));
      }
    });
  }
  wireMentionsSearch(container, entry);
  markUnresolvedSources(container, entry);
}

// ---- "אודות המסכת" למסכת שאין לה מדריך (talmud.js) ----
async function showMasechetAbout(name){
  const fallback = 'מסכת ' + name + ' — אין עדיין מדריך למסכת זו. אי״ה ייבנה בעתיד, ומי שרוצה לעזור להגדיל תורה מוזמן להצטרף.';
  if (!otzOk()){ window.alert(fallback); return; }
  let d = null;
  try { d = otzData(await Otzaria.call('library.getBookDetails', { bookId: name })); } catch(e){}
  const lines = [];
  if (d){
    if (d.categoryPath) lines.push(d.categoryPath.replace(/^\//, '').replace(/\//g, ' ← '));
    if (d.authors && d.authors.length) lines.push('מחברים: ' + d.authors.join(', '));
    if (d.generation) lines.push('דור: ' + d.generation);
    if (d.shortDescription) lines.push(d.shortDescription);
  }
  lines.push('', 'אין עדיין מדריך מלא למסכת זו בעינים למקרא. אישור — פתיחת המסכת בספרייה.');
  try {
    const res = await Otzaria.call('ui.showConfirm', { title: 'מסכת ' + name, content: lines.join('\n') });
    if (res && res.success && res.data && res.data.confirmed === true){
      await Otzaria.call('reader.openBook', { bookId: (d && d.bookId) || name });
    }
  } catch(e){ window.alert(fallback); }
}

// ---- אזהרת שינויים שלא נשמרו ----
function setUnsaved(on, message){
  if (!otzOk()) return;
  Otzaria.call('ui.setUnsavedChanges', on
    ? { hasChanges: true, message: message || 'העריכה בכרטיס תאבד' }
    : { hasChanges: false }).catch(() => {});
}
