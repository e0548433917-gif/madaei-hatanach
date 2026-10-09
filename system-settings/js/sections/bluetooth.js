/* sections/bluetooth.js - radio toggle, paired devices, scan, pair and unpair */
(function () {
  'use strict';
  var SS = (window.SS = window.SS || {});
  var ui = SS.ui;
  SS.sections = SS.sections || [];

  /* shared radio helper, used by wifi too */
  SS.radioCard = async function (slot, kind, label, onChange) {
    var r;
    try { r = await SS.bridge.call('/sys/radios/get'); }
    catch (e) { slot.innerHTML = ui.errorBox(e); return null; }
    var radio = (r.radios || []).find(function (x) { return x.kind === kind; });
    if (!radio) {
      slot.innerHTML = '<div class="state-box">' + ui.icon('info') + '<div><b>לא נמצא מתאם ' + ui.esc(label) + '</b><p class="muted">ייתכן שאין במחשב זה רכיב ' + ui.esc(label) + ' או שהוא מושבת במנהל ההתקנים.</p></div></div>';
      return null;
    }
    var on = radio.state === 'on';
    var disabled = radio.state === 'disabled';
    slot.innerHTML = '<div class="setting-row"><div class="setting-text"><b>' + ui.esc(label) + '</b><span class="muted">' +
      (disabled ? 'המתאם מושבת במערכת' : on ? 'פועל' : 'כבוי') + '</span></div>' +
      (disabled ? '' : ui.switchHtml('sw-' + kind, on, label)) + '</div>';
    var sw = slot.querySelector('.switch');
    if (sw) sw.addEventListener('click', async function () {
      var next = !sw.classList.contains('on');
      ui.setSwitch(sw, next);
      sw.disabled = true;
      try {
        await SS.bridge.call('/sys/radios/set', { kind: kind, on: next });
        slot.querySelector('.setting-text .muted').textContent = next ? 'פועל' : 'כבוי';
        onChange && onChange(next);
      } catch (e) { ui.setSwitch(sw, !next); ui.error(e, label); }
      sw.disabled = false;
    });
    return on;
  };

  function devIcon(kind, name) {
    var k = (kind || '') + ' ' + (name || '');
    if (/audio|head|אוזני|רמקול|speaker/i.test(k)) return 'headphones';
    if (/input|mouse|keyboard|עכבר|מקלדת/i.test(k)) return 'mouse';
    return 'device';
  }

  var scanning = false;

  SS.sections.push({
    id: 'bluetooth', title: 'בלוטות׳', icon: 'bluetooth',
    mount: function (body) {
      body.innerHTML =
        '<div class="card" data-slot="radio">' + ui.loading() + '</div>' +
        '<div class="card"><div class="card-title-row"><div class="card-title">מכשירים</div>' +
        '<button class="btn btn-primary" data-act="scan">' + ui.icon('search') + '<span>חפש מכשירים</span></button></div>' +
        '<div data-slot="devs">' + ui.loading() + '</div></div>';
      body.querySelector('[data-act=scan]').addEventListener('click', function () { loadDevices(body, true); });
    },
    load: async function (body) {
      var on = await SS.radioCard(body.querySelector('[data-slot=radio]'), 'bluetooth', 'בלוטות׳', function () { loadDevices(body, false); });
      body.dataset.on = on === false ? '0' : '1';
      await loadDevices(body, false);
    }
  });

  async function loadDevices(body, scan) {
    var slot = body.querySelector('[data-slot=devs]');
    var btn = body.querySelector('[data-act=scan]');
    if (scanning) return;
    if (scan) {
      scanning = true;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner sm"></span><span>מחפש…</span>';
      slot.insertAdjacentHTML('afterbegin', '<div class="scan-banner">' + '<span class="spinner sm"></span>מחפש מכשירים בסביבה — עד כ-10 שניות. ודאו שהמכשיר במצב צימוד.</div>');
    }
    var d;
    try { d = await SS.bridge.call('/sys/bluetooth/devices', { scan: !!scan }, { timeoutMs: 30000 }); }
    catch (e) {
      slot.innerHTML = ui.errorBox(e);
      resetBtn(); return;
    }
    resetBtn();
    if (!body.isConnected) return;
    var list = d.devices || [];
    var radioSw = body.querySelector('#sw-bluetooth');
    if (radioSw && !radioSw.classList.contains('on')) {
      slot.innerHTML = '<p class="muted">הבלוטות׳ כבוי. הפעילו אותו כדי לראות מכשירים.</p>';
      return;
    }
    if (!list.length) {
      slot.innerHTML = '<div class="empty">' + ui.icon('bluetooth') + '<p>אין מכשירים מוצמדים.</p><p class="muted small">לחצו על „חפש מכשירים” כדי למצוא מכשירים חדשים.</p></div>';
      return;
    }
    var paired = list.filter(function (x) { return x.paired; });
    var found = list.filter(function (x) { return !x.paired; });
    function row(x) {
      return '<li class="list-item">' +
        '<span class="li-icon">' + ui.icon(devIcon(x.kind, x.name)) + '</span>' +
        '<span class="li-text"><b>' + ui.esc(x.name || 'מכשיר ללא שם') + '</b>' +
        (x.paired ? '<span class="chip ' + (x.connected ? 'ok' : '') + '">' + (x.connected ? 'מחובר' : 'מוצמד') + '</span>' : '<span class="chip">זמין</span>') + '</span>' +
        (x.paired ? '<button class="btn btn-text danger" data-unpair="' + ui.esc(x.id) + '" data-name="' + ui.esc(x.name) + '">הסר</button>'
          : '<button class="btn btn-tonal" data-pair="' + ui.esc(x.id) + '">צמד</button>') +
        '</li>';
    }
    slot.innerHTML =
      (paired.length ? '<div class="list-label">מכשירים מוצמדים</div><ul class="list">' + paired.map(row).join('') + '</ul>' : '') +
      (found.length ? '<div class="list-label">נמצאו בסביבה</div><ul class="list">' + found.map(row).join('') + '</ul>' : '');
    slot.querySelectorAll('[data-pair]').forEach(function (b) {
      b.addEventListener('click', async function () {
        b.disabled = true; b.innerHTML = '<span class="spinner sm"></span>מצמד…';
        try {
          await SS.bridge.call('/sys/bluetooth/pair', { id: b.dataset.pair }, { timeoutMs: 45000 });
          ui.toast('המכשיר צומד בהצלחה', 'success');
          loadDevices(body, false);
        } catch (e) { ui.error(e, 'צימוד'); b.disabled = false; b.textContent = 'צמד'; }
      });
    });
    slot.querySelectorAll('[data-unpair]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var ok = await ui.confirm('הסרת מכשיר', 'להסיר את <b>' + ui.esc(b.dataset.name) + '</b> מרשימת המכשירים המוצמדים? כדי להשתמש בו שוב יהיה צריך לצמד מחדש.', 'הסר', 'danger');
        if (!ok) return;
        b.disabled = true;
        try {
          await SS.bridge.call('/sys/bluetooth/unpair', { id: b.dataset.unpair });
          ui.toast('המכשיר הוסר', 'success');
          loadDevices(body, false);
        } catch (e) { ui.error(e, 'הסרה'); b.disabled = false; }
      });
    });

    function resetBtn() {
      if (!scan) return;
      scanning = false;
      btn.disabled = false;
      btn.innerHTML = ui.icon('search') + '<span>חפש מכשירים</span>';
    }
  }
})();
