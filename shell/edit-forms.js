// טופס עריכת ערך וטופס הצעת ערך חדש.
// נוצר בפיצול router.js (גרסה 2.11.2). המקור: shell/router.js שורות 1142-1407.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.


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
