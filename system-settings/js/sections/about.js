/* sections/about.js - plugin and bridge info, download link */
(function () {
  'use strict';
  var SS = (window.SS = window.SS || {});
  var ui = SS.ui;
  SS.sections = SS.sections || [];

  SS.sections.push({
    id: 'about', title: 'אודות', icon: 'info',
    mount: function (body) {
      body.innerHTML =
        '<div class="card about-hero"><div class="about-ic">' + ui.icon('computer') + '</div><div>' +
        '<h3>הגדרות מערכת</h3><p class="muted">גרסה ' + ui.esc(SS.VERSION) + ' · מאת חד בדרא</p>' +
        '<p>שליטה בשמע, במסך, בבלוטות׳, ברשת ובהפעלת המחשב — ומצב נעילה שהופך את המחשב לעמדת לימוד באוצריא בלבד.</p></div></div>' +
        '<div class="card"><div class="card-title">גשר אוצריא</div><div data-slot="bridge">' + ui.loading() + '</div></div>' +
        '<div class="card"><div class="card-title">התקנת הגשר</div><ol class="steps">' +
        '<li>מורידים את <b dir="ltr">OtzariaBridge.exe</b> מהקישור.</li>' +
        '<li>מפעילים פעם אחת. הגשר מעתיק את עצמו ל-<span dir="ltr">%LOCALAPPDATA%\\OtzariaBridge</span>, נרשם להפעלה אוטומטית ומופיע כאייקון ליד השעון.</li>' +
        '<li>הגשר מאזין רק למחשב המקומי (127.0.0.1) ואינו נגיש מהרשת.</li>' +
        '<li>להסרה: <code dir="ltr">OtzariaBridge.exe --uninstall</code></li></ol>' +
        '<div class="row-actions"><button class="btn btn-primary" data-act="dl">' + ui.icon('download') + 'הורדת הגשר</button></div></div>';
      body.querySelector('[data-act=dl]').addEventListener('click', function () { SS.openUrl(SS.BRIDGE_URL); });
    },
    load: async function (body) {
      var slot = body.querySelector('[data-slot=bridge]');
      var h = null;
      try { h = await SS.bridge.probe(); } catch (e) { h = null; }
      SS.setStatus(!!h);
      if (!h) {
        slot.innerHTML = '<div class="state-box error">' + ui.icon('warning') + '<div><b>הגשר אינו מחובר</b></div></div>';
        return;
      }
      slot.innerHTML = '<dl class="info-grid">' +
        '<dt>מצב</dt><dd><span class="chip ok">מחובר</span>' + (SS.bridge.isMock ? ' <span class="chip">תצוגה מקדימה</span>' : '') + '</dd>' +
        '<dt>גרסת הגשר</dt><dd dir="ltr">' + ui.esc(h.version) + '</dd>' +
        '<dt>פורט</dt><dd dir="ltr">127.0.0.1:' + ui.esc(h.port || SS.bridge.port) + '</dd>' +
        '<dt>מערכת</dt><dd dir="ltr">' + ui.esc(h.platform || '') + '</dd>' +
        '<dt>מצב נעילה</dt><dd>' + (h.kioskActive ? 'פעיל' : 'לא פעיל') + '</dd></dl>';
    }
  });
})();
