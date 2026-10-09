/* sections/display.js - brightness */
(function () {
  'use strict';
  var SS = (window.SS = window.SS || {});
  var ui = SS.ui;
  SS.sections = SS.sections || [];

  SS.sections.push({
    id: 'display', title: 'מסך', icon: 'display',
    mount: function (body) {
      body.innerHTML = '<div class="card"><div class="card-title">בהירות מסך</div><div data-slot="br">' + ui.loading() + '</div></div>';
    },
    load: async function (body) {
      var slot = body.querySelector('[data-slot=br]');
      var d;
      try { d = await SS.bridge.call('/sys/display/get'); }
      catch (e) {
        if (e.code === 'unsupported') d = { supported: false, brightness: null };
        else { slot.innerHTML = ui.errorBox(e); return; }
      }
      if (!d.supported || d.brightness == null) {
        slot.innerHTML = '<div class="state-box">' + ui.icon('info') + '<div><b>לא נתמך במחשב זה</b>' +
          '<p class="muted">שליטה בבהירות זמינה בדרך כלל רק במחשבים ניידים ובטאבלטים. במסך חיצוני יש לכוון את הבהירות בכפתורי המסך עצמו.</p></div></div>';
        return;
      }
      slot.innerHTML = '<div class="slider-row">' +
        '<span class="icon-btn big static">' + ui.icon('sun') + '</span>' +
        '<input type="range" class="range" min="0" max="100" step="1" value="' + d.brightness + '" aria-label="בהירות">' +
        '<output class="range-val">' + d.brightness + '%</output></div>' +
        '<div class="preset-row">' + [25, 50, 75, 100].map(function (v) {
          return '<button class="btn btn-tonal" data-v="' + v + '">' + v + '%</button>';
        }).join('') + '</div>';
      var range = slot.querySelector('.range');
      var out = slot.querySelector('.range-val');
      SS.paintRange(range);
      var push = ui.debounce(async function (v) {
        try { await SS.bridge.call('/sys/display/set', { brightness: v }); }
        catch (e) { ui.error(e, 'שינוי בהירות'); }
      }, 200);
      function set(v) { range.value = v; out.textContent = v + '%'; SS.paintRange(range); push(+v); }
      range.addEventListener('input', function () { set(range.value); });
      slot.querySelectorAll('[data-v]').forEach(function (b) {
        b.addEventListener('click', function () { set(b.dataset.v); });
      });
    }
  });
})();
