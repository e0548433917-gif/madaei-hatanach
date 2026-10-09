/* sections/kiosk.js - lock mode (kiosk): password, recovery code, enable, disable, settings */
(function () {
  'use strict';
  var SS = (window.SS = window.SS || {});
  var ui = SS.ui;
  SS.sections = SS.sections || [];

  var MIN_PW = 4;

  SS.sections.push({
    id: 'kiosk', title: 'מצב נעילה', icon: 'lock',
    mount: function (body) { body.innerHTML = ui.loading('טוען מצב נעילה…'); },
    load: load
  });

  async function load(body) {
    var st;
    try { st = await SS.bridge.call('/kiosk/status'); }
    catch (e) { body.innerHTML = ui.errorBox(e); return; }
    if (SS.bridge.health) { SS.bridge.health.kioskActive = !!st.active; SS.setStatus(true); }
    render(body, st);
  }

  function render(body, st) {
    var active = !!st.active;
    var html =
      '<div class="status-card ' + (active ? 'active' : '') + '">' +
      '<div class="status-ic">' + ui.icon(active ? 'lock' : 'unlock') + '</div>' +
      '<div class="status-text"><span class="eyebrow">מצב נעילה</span><h3>' + (active ? 'פעיל' : 'לא פעיל') + '</h3>' +
      '<p>' + (active
        ? 'המחשב נעול לאוצריא בלבד' + (st.strict ? ' · נעילה קפדנית' : '') + (st.blockTaskManager ? ' · מנהל המשימות חסום' : '') + '.'
        : 'המחשב פועל כרגיל. אפשר להפעיל נעילה כדי שישמש ללימוד בלבד.') + '</p></div>' +
      (st.hasPassword
        ? (active
          ? '<button class="btn btn-lg btn-on-status" data-act="disable">' + ui.icon('unlock') + 'ביטול נעילה</button>'
          : '<button class="btn btn-lg btn-primary" data-act="enable">' + ui.icon('lock') + 'הפעלת נעילה</button>')
        : '') +
      '</div>';

    html += '<div class="card explain"><div class="card-title">מה עושה מצב נעילה?</div><ul class="feature-list">' +
      '<li>' + ui.icon('shield') + '<span><b>רק אוצריא פתוחה.</b> אם מישהו סוגר אותה — היא נפתחת מחדש מעצמה ונשארת בחזית.</span></li>' +
      '<li>' + ui.icon('computer') + '<span><b>שורת המשימות ותפריט התחל מוסתרים,</b> כך שאי אפשר לפתוח תוכנות אחרות.</span></li>' +
      '<li>' + ui.icon('key') + '<span><b>מקשי מעבר חסומים:</b> Win, ‏Alt+Tab, ‏Alt+F4, ‏Ctrl+Esc ומנהל המשימות.</span></li>' +
      '<li>' + ui.icon('lock') + '<span><b>יציאה רק עם סיסמה</b> — מכאן, מתוך התוסף. הנעילה חוזרת אוטומטית גם אחרי הפעלה מחדש.</span></li>' +
      '</ul></div>';

    if (!st.hasPassword) {
      html += '<div class="card"><div class="card-title">שלב ראשון: הגדרת סיסמה</div>' +
        '<p class="muted">לפני הפעלת הנעילה צריך לבחור סיסמה. רק מי שיודע אותה יוכל לבטל את הנעילה או לשנות הגדרות.</p>' +
        '<form class="form-grid" data-form="setpw" novalidate>' +
        '<label class="field"><span class="field-label">סיסמה</span><input class="input" type="password" name="pw" autocomplete="new-password" dir="ltr"></label>' +
        '<label class="field"><span class="field-label">אימות סיסמה</span><input class="input" type="password" name="pw2" autocomplete="new-password" dir="ltr"></label>' +
        '<div class="form-msg" hidden></div>' +
        '<div class="row-actions"><button class="btn btn-primary btn-lg" type="submit">' + ui.icon('key') + 'שמירת סיסמה</button></div>' +
        '<p class="muted small">לפחות ' + MIN_PW + ' תווים. אחרי השמירה יוצג קוד שחזור חד-פעמי — חשוב לרשום אותו.</p>' +
        '</form></div>';
    } else {
      html += '<div class="card"><div class="card-title">סיסמה והגדרות</div>' +
        '<div class="setting-row"><div class="setting-text"><b>שינוי סיסמה</b><span class="muted">החלפת סיסמת הנעילה (נדרשת הסיסמה הנוכחית)</span></div>' +
        '<button class="btn btn-tonal" data-act="chpw">' + ui.icon('edit') + 'שינוי</button></div>' +
        '<div class="setting-row"><div class="setting-text"><b>קבצים שמותר לפתוח בזמן נעילה</b><span class="muted"><bdi dir="ltr">' +
        ui.esc((st.allowOpenExtensions || []).length ? st.allowOpenExtensions.map(function (x) { return '.' + x; }).join(', ') : '—') + '</bdi></span></div>' +
        '<button class="btn btn-tonal" data-act="settings">' + ui.icon('edit') + 'עריכה</button></div>' +
        '<div class="setting-row"><div class="setting-text"><b>נתיב אוצריא</b><span class="muted path"><bdi dir="ltr">' + ui.esc(st.otzariaPath || 'זיהוי אוטומטי') + '</bdi></span></div></div>' +
        '</div>';
      html += '<div class="card subtle"><div class="card-title">שכחתם את הסיסמה?</div>' +
        '<p class="muted">בחלון „ביטול נעילה” אפשר להקליד גם את <b>קוד השחזור</b> שקיבלתם בהגדרת הסיסמה. במקרה חירום אפשר להריץ משורת הפקודה:</p>' +
        '<code class="cmd" dir="ltr">OtzariaBridge.exe --unlock &lt;קוד-שחזור&gt;</code>' +
        '<p class="muted small">אפשרות נוספת: הפעלה ב-Safe Mode, שבו הגשר אינו עולה והנעילה אינה חלה.</p></div>';
    }

    body.innerHTML = html;
    wire(body, st);
  }

  function wire(body, st) {
    var f = body.querySelector('[data-form=setpw]');
    if (f) {
      setTimeout(function () { var i = f.querySelector('input'); if (i) i.focus(); }, 50);
      f.addEventListener('submit', async function (e) {
        e.preventDefault();
        var msg = f.querySelector('.form-msg');
        var pw = f.pw.value, pw2 = f.pw2.value;
        var bad = pw.length < MIN_PW ? 'הסיסמה חייבת להכיל לפחות ' + MIN_PW + ' תווים' : pw !== pw2 ? 'הסיסמאות אינן תואמות' : '';
        if (bad) { msg.textContent = bad; msg.hidden = false; return; }
        msg.hidden = true;
        var btn = f.querySelector('button[type=submit]');
        btn.disabled = true;
        try {
          var r = await SS.bridge.call('/kiosk/set-password', { newPassword: pw });
          if (r && r.recoveryCode) await showRecovery(r.recoveryCode);
          else ui.toast('הסיסמה נשמרה', 'success');
          load(body);
        } catch (err) {
          msg.textContent = ui.errText(err); msg.hidden = false; btn.disabled = false;
        }
      });
    }
    on('enable', function () { enable(body, st); });
    on('disable', function () { disable(body); });
    on('chpw', function () { changePw(body); });
    on('settings', function () { editSettings(body, st); });

    function on(act, fn) {
      var b = body.querySelector('[data-act=' + act + ']');
      if (b) b.addEventListener('click', fn);
    }
  }

  function showRecovery(code) {
    var pretty = code.replace(/(.{4})(?=.)/g, '$1-');
    return ui.dialog({
      title: 'קוד השחזור שלכם', icon: 'key', tone: 'recovery', dismissible: false,
      body:
        '<p>זהו <b>קוד שחזור חד-פעמי</b>. הוא יוצג <b>רק עכשיו</b> ולא יהיה אפשר לראות אותו שוב.</p>' +
        '<div class="recovery-code" dir="ltr">' + ui.esc(pretty) + '</div>' +
        '<p>רשמו אותו על דף ושמרו במקום בטוח, <b>לא ליד המחשב</b>. אם תשכחו את הסיסמה, אפשר לבטל את הנעילה עם הקוד הזה בחלון „ביטול נעילה”, או מחלון פקודה:</p>' +
        '<code class="cmd" dir="ltr">OtzariaBridge.exe --unlock ' + ui.esc(code) + '</code>',
      fields: [{ name: 'ack', type: 'checkbox', label: 'רשמתי את הקוד' }],
      actions: [{ label: 'סיום', value: true, kind: 'primary' }],
      validate: function (v) { return v.ack ? '' : 'יש לסמן „רשמתי את הקוד” לפני הסגירה'; },
      onOpen: function (form) {
        var btn = form.querySelector('button[type=submit]');
        var cb = form.querySelector('input[name=ack]');
        btn.disabled = true;
        cb.addEventListener('change', function () { btn.disabled = !cb.checked; });
      }
    });
  }

  async function enable(body, st) {
    var v = await ui.dialog({
      title: 'הפעלת מצב נעילה', icon: 'lock',
      body: '<p>הקלידו את סיסמת הנעילה ובחרו אפשרויות.</p>',
      fields: [
        { name: 'pw', label: 'סיסמת נעילה', type: 'password', dir: 'ltr' },
        { name: 'tm', type: 'checkbox', label: 'חסום מנהל משימות', value: st.blockTaskManager !== false, hint: 'מונע סגירה של אוצריא דרך Ctrl+Shift+Esc' },
        { name: 'strict', type: 'checkbox', label: 'נעילה קפדנית (החלפת מעטפת Windows — מהכניסה הבאה)', value: false,
          hint: '<span class="warn-text">' + ui.icon('warning') + 'אוצריא תחליף את שולחן העבודה של Windows למשתמש זה. השתמשו רק אם רשמתם את קוד השחזור.</span>' }
      ],
      actions: [{ label: 'ביטול', value: false }, { label: 'המשך', value: true, kind: 'primary' }],
      validate: function (x) { return x.pw ? '' : 'יש להקליד סיסמה'; }
    });
    if (!v) return;
    var summary = '<p>לאחר האישור:</p><ul class="bullets">' +
      '<li>שורת המשימות ותפריט התחל ייעלמו.</li><li>רק אוצריא תישאר פתוחה, ומקשי המעבר ייחסמו.</li>' +
      (v.tm ? '<li>מנהל המשימות ייחסם.</li>' : '') +
      (v.strict ? '<li><b>נעילה קפדנית:</b> מהכניסה הבאה ל-Windows תיפתח אוצריא במקום שולחן העבודה.</li>' : '') +
      '</ul><p>כדי לצאת — חזרו למסך זה ובחרו „ביטול נעילה”.</p>';
    var ok = await ui.dialog({
      title: 'לנעול את המחשב?', icon: 'warning', tone: v.strict ? 'danger' : '', body: summary,
      actions: [{ label: 'חזרה', value: false }, { label: 'נעל עכשיו', value: true, kind: v.strict ? 'danger' : 'primary' }],
      onSubmit: async function () {
        await SS.bridge.call('/kiosk/enable', { password: v.pw, strict: !!v.strict, blockTaskManager: !!v.tm }, { timeoutMs: 30000 });
        return true;
      }
    });
    if (ok) { ui.toast('מצב נעילה הופעל', 'success'); load(body); }
  }

  async function disable(body) {
    var ok = await ui.dialog({
      title: 'ביטול מצב נעילה', icon: 'unlock',
      body: '<p>הקלידו את סיסמת הנעילה, או את קוד השחזור.</p>',
      fields: [{ name: 'pw', label: 'סיסמה או קוד שחזור', type: 'password', dir: 'ltr' }],
      actions: [{ label: 'ביטול', value: false }, { label: 'בטל נעילה', value: true, kind: 'primary' }],
      validate: function (x) { return x.pw ? '' : 'יש להקליד סיסמה'; },
      onSubmit: async function (x) {
        var pw = x.pw.trim();
        await SS.bridge.call('/kiosk/disable', { password: /^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){2}$/.test(pw) ? pw.replace(/-/g, '') : x.pw }, { timeoutMs: 30000 });
        return true;
      }
    });
    if (ok) { ui.toast('מצב נעילה בוטל', 'success'); load(body); }
  }

  async function changePw(body) {
    var ok = await ui.dialog({
      title: 'שינוי סיסמת נעילה', icon: 'key',
      fields: [
        { name: 'old', label: 'סיסמה נוכחית', type: 'password', dir: 'ltr' },
        { name: 'n1', label: 'סיסמה חדשה', type: 'password', dir: 'ltr' },
        { name: 'n2', label: 'אימות סיסמה חדשה', type: 'password', dir: 'ltr' }
      ],
      actions: [{ label: 'ביטול', value: false }, { label: 'שמירה', value: true, kind: 'primary' }],
      validate: function (x) {
        if (!x.old) return 'יש להקליד את הסיסמה הנוכחית';
        if (x.n1.length < MIN_PW) return 'הסיסמה החדשה חייבת להכיל לפחות ' + MIN_PW + ' תווים';
        if (x.n1 !== x.n2) return 'הסיסמאות החדשות אינן תואמות';
        return '';
      },
      onSubmit: async function (x) {
        var r = await SS.bridge.call('/kiosk/set-password', { oldPassword: x.old, newPassword: x.n1 });
        return r || true;
      }
    });
    if (ok) {
      if (ok.recoveryCode) await showRecovery(ok.recoveryCode);
      ui.toast('הסיסמה עודכנה', 'success');
      load(body);
    }
  }

  async function editSettings(body, st) {
    var ok = await ui.dialog({
      title: 'הגדרות נעילה', icon: 'edit',
      body: '<p class="muted">סוגי קבצים שמותר לפתוח בתוכנות אחרות גם בזמן נעילה (למשל pdf). הפרידו בפסיקים.</p>',
      fields: [
        { name: 'ext', label: 'סיומות מותרות', value: (st.allowOpenExtensions || []).join(', '), dir: 'ltr', placeholder: 'pdf, txt' },
        { name: 'path', label: 'נתיב אוצריא (ריק = זיהוי אוטומטי)', value: st.otzariaPath || '', dir: 'ltr', placeholder: 'C:\\Program Files\\Otzaria\\otzaria.exe' },
        { name: 'pw', label: 'סיסמת נעילה', type: 'password', dir: 'ltr' }
      ],
      actions: [{ label: 'ביטול', value: false }, { label: 'שמירה', value: true, kind: 'primary' }],
      validate: function (x) {
        if (!x.pw) return 'יש להקליד את סיסמת הנעילה';
        var bad = parseExt(x.ext).filter(function (e) { return !/^[a-z0-9]{1,10}$/.test(e); });
        return bad.length ? 'סיומת לא תקינה: ' + bad[0] : '';
      },
      onSubmit: async function (x) {
        await SS.bridge.call('/kiosk/settings', { password: x.pw, allowOpenExtensions: parseExt(x.ext), otzariaPath: x.path.trim() });
        return true;
      }
    });
    if (ok) { ui.toast('ההגדרות נשמרו', 'success'); load(body); }
  }

  function parseExt(s) {
    return String(s || '').split(/[,;\s]+/).map(function (e) { return e.trim().toLowerCase().replace(/^\*?\./, ''); })
      .filter(Boolean).filter(function (e, i, a) { return a.indexOf(e) === i; });
  }
})();
