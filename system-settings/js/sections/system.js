/* sections/system.js - system info and power actions */
(function () {
  'use strict';
  var SS = (window.SS = window.SS || {});
  var ui = SS.ui;
  SS.sections = SS.sections || [];

  var POWER = [
    { action: 'lock', label: 'נעילת מסך', icon: 'lock', title: 'לנעול את המסך?', text: 'המסך יינעל ויהיה צורך בסיסמת Windows כדי לחזור.', ok: 'נעל מסך' },
    { action: 'sleep', label: 'שינה', icon: 'sleep', title: 'להעביר למצב שינה?', text: 'המחשב יעבור למצב שינה. העבודה הפתוחה תישמר.', ok: 'שינה' },
    { action: 'restart', label: 'הפעלה מחדש', icon: 'restart', title: 'להפעיל מחדש את המחשב?', text: 'כל התוכנות ייסגרו והמחשב יופעל מחדש. שמרו עבודה פתוחה לפני כן.', ok: 'הפעל מחדש', danger: true },
    { action: 'shutdown', label: 'כיבוי', icon: 'power', title: 'לכבות את המחשב?', text: 'כל התוכנות ייסגרו והמחשב יכובה.', ok: 'כבה', danger: true }
  ];

  SS.sections.push({
    id: 'system', title: 'מערכת', icon: 'computer',
    mount: function (body) {
      body.innerHTML =
        '<div class="card"><div class="card-title">פרטי המחשב</div><div data-slot="info">' + ui.loading() + '</div></div>' +
        '<div class="card"><div class="card-title">הפעלה וכיבוי</div><div class="power-grid">' +
        POWER.map(function (p) {
          return '<button class="power-btn' + (p.danger ? ' danger' : '') + '" data-a="' + p.action + '">' + ui.icon(p.icon) + '<span>' + p.label + '</span></button>';
        }).join('') + '</div></div>';
      body.querySelectorAll('[data-a]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var p = POWER.find(function (x) { return x.action === b.dataset.a; });
          var ok = await ui.confirm(p.title, '<p>' + p.text + '</p>', p.ok, p.danger ? 'danger' : '');
          if (!ok) return;
          try {
            await SS.bridge.call('/sys/power', { action: p.action });
            ui.toast(p.label + ' — הפקודה נשלחה', 'success');
          } catch (e) { ui.error(e, p.label); }
        });
      });
    },
    load: async function (body) {
      var slot = body.querySelector('[data-slot=info]');
      var d;
      try { d = await SS.bridge.call('/sys/info'); }
      catch (e) { slot.innerHTML = ui.errorBox(e); return; }
      var bat = d.battery
        ? '<span class="battery"><span class="battery-shell"><i style="width:' + Math.max(4, Math.min(100, d.battery.percent)) + '%"></i></span>' +
          d.battery.percent + '%' + (d.battery.charging ? ' · בטעינה' : '') + '</span>'
        : '<span class="muted">אין סוללה (מחשב שולחני)</span>';
      slot.innerHTML = '<dl class="info-grid">' +
        '<dt>שם המחשב</dt><dd dir="ltr">' + ui.esc(d.computerName) + '</dd>' +
        '<dt>משתמש</dt><dd dir="ltr">' + ui.esc(d.userName) + '</dd>' +
        '<dt>מערכת הפעלה</dt><dd dir="ltr">' + ui.esc(d.os) + '</dd>' +
        '<dt>סוללה</dt><dd>' + bat + '</dd>' +
        (d.time ? '<dt>שעון המחשב</dt><dd>' + ui.esc(new Date(d.time).toLocaleString('he-IL')) + '</dd>' : '') +
        '</dl>';
    }
  });
})();
