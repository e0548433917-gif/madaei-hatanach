/* sections/wifi.js - Wi-Fi radio, networks, connect and disconnect */
(function () {
  'use strict';
  var SS = (window.SS = window.SS || {});
  var ui = SS.ui;
  SS.sections = SS.sections || [];

  SS.sections.push({
    id: 'wifi', title: 'רשת אלחוטית', icon: 'wifi',
    mount: function (body) {
      body.innerHTML =
        '<div class="card" data-slot="radio">' + ui.loading() + '</div>' +
        '<div class="card"><div class="card-title">רשתות זמינות</div><div data-slot="nets">' + ui.loading() + '</div></div>';
    },
    load: async function (body) {
      await SS.radioCard(body.querySelector('[data-slot=radio]'), 'wifi', 'Wi-Fi', function () {
        setTimeout(function () { loadNets(body); }, 400);
      });
      await loadNets(body);
    }
  });

  async function loadNets(body) {
    var slot = body.querySelector('[data-slot=nets]');
    if (!slot) return;
    var d;
    try { d = await SS.bridge.call('/sys/wifi/networks', {}, { timeoutMs: 20000 }); }
    catch (e) { slot.innerHTML = ui.errorBox(e); return; }
    var sw = body.querySelector('#sw-wifi');
    if (sw && !sw.classList.contains('on')) {
      slot.innerHTML = '<p class="muted">ה-Wi-Fi כבוי. הפעילו אותו כדי לראות רשתות.</p>';
      return;
    }
    var nets = (d.networks || []).slice().sort(function (a, b) {
      return (b.connected - a.connected) || (b.signal - a.signal);
    });
    if (!nets.length) {
      slot.innerHTML = '<div class="empty">' + ui.icon('wifi') + '<p>לא נמצאו רשתות.</p></div>';
      return;
    }
    slot.innerHTML = '<ul class="list">' + nets.map(function (n, i) {
      return '<li class="list-item' + (n.connected ? ' selected' : '') + '">' +
        '<span class="li-icon">' + ui.signalBars(n.signal) + '</span>' +
        '<span class="li-text"><b dir="auto">' + ui.esc(n.ssid || '(רשת נסתרת)') + '</b>' +
        (n.secured ? '<span class="lock-ic" title="מאובטחת">' + ui.icon('lock') + '</span>' : '<span class="muted small">פתוחה</span>') +
        (n.connected ? '<span class="chip ok">מחובר</span>' : n.known ? '<span class="chip">שמורה</span>' : '') + '</span>' +
        (n.connected ? '<button class="btn btn-text danger" data-dis="1">התנתק</button>'
          : '<button class="btn btn-tonal" data-i="' + i + '">התחבר</button>') +
        '</li>';
    }).join('') + '</ul>';

    slot.querySelectorAll('[data-i]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var n = nets[+b.dataset.i];
        var password;
        if (n.secured && !n.known) {
          var v = await ui.dialog({
            title: 'התחברות ל-' + n.ssid, icon: 'wifi',
            body: '<p>הרשת מאובטחת. הקלידו את סיסמת הרשת.</p>',
            fields: [{ name: 'pw', label: 'סיסמת הרשת', type: 'password', dir: 'ltr' }],
            actions: [{ label: 'ביטול', value: false }, { label: 'התחבר', value: true, kind: 'primary' }],
            validate: function (x) { return x.pw.length < 8 ? 'סיסמת Wi-Fi באורך 8 תווים לפחות' : ''; },
            onSubmit: async function (x) {
              await SS.bridge.call('/sys/wifi/connect', { ssid: n.ssid, password: x.pw }, { timeoutMs: 40000 });
              return true;
            }
          });
          if (!v) return;
          ui.toast('מחובר ל-' + n.ssid, 'success');
          loadNets(body);
          return;
        }
        b.disabled = true; b.innerHTML = '<span class="spinner sm"></span>מתחבר…';
        try {
          await SS.bridge.call('/sys/wifi/connect', password ? { ssid: n.ssid, password: password } : { ssid: n.ssid }, { timeoutMs: 40000 });
          ui.toast('מחובר ל-' + n.ssid, 'success');
          loadNets(body);
        } catch (e) { ui.error(e, 'התחברות'); b.disabled = false; b.textContent = 'התחבר'; }
      });
    });
    var dis = slot.querySelector('[data-dis]');
    if (dis) dis.addEventListener('click', async function () {
      dis.disabled = true;
      try {
        await SS.bridge.call('/sys/wifi/disconnect');
        ui.toast('הרשת נותקה', 'success');
        loadNets(body);
      } catch (e) { ui.error(e, 'ניתוק'); dis.disabled = false; }
    });
  }
})();
