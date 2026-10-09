/* sections/audio.js - volume, mute, output devices */
(function () {
  'use strict';
  var SS = (window.SS = window.SS || {});
  var ui = SS.ui;
  SS.sections = SS.sections || [];

  SS.sections.push({
    id: 'audio', title: 'שמע', icon: 'speaker',
    mount: function (body) {
      body.innerHTML =
        '<div class="card"><div class="card-title">עוצמת שמע</div><div data-slot="vol">' + ui.loading() + '</div></div>' +
        '<div class="card"><div class="card-title">התקן פלט</div><div data-slot="dev">' + ui.loading() + '</div></div>';
    },
    load: async function (body) {
      await Promise.all([loadVol(body), loadDevices(body)]);
    }
  });

  async function loadVol(body) {
    var slot = body.querySelector('[data-slot=vol]');
    var a;
    try { a = await SS.bridge.call('/sys/audio/get'); }
    catch (e) { slot.innerHTML = ui.errorBox(e); return; }
    slot.innerHTML =
      '<div class="slider-row">' +
      '<button class="icon-btn big" data-act="mute" title="השתקה">' + ui.icon(a.muted ? 'mute' : 'speaker') + '</button>' +
      '<input type="range" class="range" min="0" max="100" step="1" value="' + a.volume + '" aria-label="עוצמת שמע">' +
      '<output class="range-val">' + a.volume + '%</output></div>' +
      '<div class="setting-row"><div class="setting-text"><b>השתקה</b><span class="muted">' + ui.esc(a.deviceName || '') + '</span></div>' +
      ui.switchHtml('sw-mute', a.muted, 'השתקה') + '</div>';
    var range = slot.querySelector('.range');
    var out = slot.querySelector('.range-val');
    var sw = slot.querySelector('#sw-mute');
    var muteBtn = slot.querySelector('[data-act=mute]');
    paintRange(range);
    slot.classList.toggle('is-muted', !!a.muted);

    function render(d) {
      a = d;
      sw && ui.setSwitch(sw, d.muted);
      muteBtn.innerHTML = ui.icon(d.muted ? 'mute' : 'speaker');
      slot.classList.toggle('is-muted', !!d.muted);
    }
    var push = ui.debounce(async function (v) {
      try { render(await SS.bridge.call('/sys/audio/set', { volume: v })); }
      catch (e) { ui.error(e, 'שינוי עוצמה'); }
    }, 180);
    range.addEventListener('input', function () {
      out.textContent = range.value + '%';
      paintRange(range);
      push(+range.value);
    });
    async function toggleMute() {
      var next = !a.muted;
      render(Object.assign({}, a, { muted: next }));
      try { render(await SS.bridge.call('/sys/audio/set', { muted: next })); }
      catch (e) { render(Object.assign({}, a, { muted: !next })); ui.error(e, 'השתקה'); }
    }
    sw.addEventListener('click', toggleMute);
    muteBtn.addEventListener('click', toggleMute);
  }

  async function loadDevices(body) {
    var slot = body.querySelector('[data-slot=dev]');
    var d;
    try { d = await SS.bridge.call('/sys/audio/devices'); }
    catch (e) { slot.innerHTML = ui.errorBox(e); return; }
    var list = d.devices || [];
    if (!list.length) { slot.innerHTML = '<p class="muted">לא נמצאו התקני פלט.</p>'; return; }
    slot.innerHTML = '<ul class="list">' + list.map(function (x) {
      var ic = /אוזני|head|bud|Soundcore|AirPods/i.test(x.name) ? 'headphones' : /HDMI|מסך|Display|NVIDIA|LG|Samsung/i.test(x.name) ? 'display' : 'speaker';
      return '<li class="list-item' + (x.isDefault ? ' selected' : '') + '">' +
        '<span class="li-icon">' + ui.icon(ic) + '</span>' +
        '<span class="li-text"><b>' + ui.esc(x.name) + '</b>' + (x.isDefault ? '<span class="chip">ברירת מחדל</span>' : '') + '</span>' +
        (x.isDefault ? '<span class="li-check">' + ui.icon('check') + '</span>'
          : '<button class="btn btn-tonal" data-id="' + ui.esc(x.id) + '">הגדר כברירת מחדל</button>') +
        '</li>';
    }).join('') + '</ul>';
    slot.querySelectorAll('button[data-id]').forEach(function (b) {
      b.addEventListener('click', async function () {
        b.disabled = true; b.textContent = 'מגדיר…';
        try {
          await SS.bridge.call('/sys/audio/set-default', { id: b.dataset.id });
          ui.toast('התקן הפלט הוחלף', 'success');
          await Promise.all([loadDevices(body), loadVol(body)]);
        } catch (e) { ui.error(e, 'החלפת התקן'); b.disabled = false; b.textContent = 'הגדר כברירת מחדל'; }
      });
    });
  }

  function paintRange(r) {
    r.style.setProperty('--p', r.value + '%');
  }
  SS.paintRange = paintRange;
})();
