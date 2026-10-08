// ״הפרק על המפה״ (4.18.0) — המקומות שבתוצאות הזיהוי על מפה אחת, לפי סדר הפסוקים,
// עם מסלול מונפש ביניהם. לחיצה על מקום (בסמן או ברשימה) מציגה את הפסוק ופותחת אותו
// בספרייה או את כרטיס הערך.
// מקור הנקודות: תוצאות showResults שהמדריך שלהן ״מקומות״ ויש להן methods[].geo.
// הסדר: כשהתוצאות באו מפרק או מפרשה (scope), לפי הפסוק הראשון של המקום בתוך הטווח;
// אחרת (סימון חופשי, דף פתוח) — לפי סדר התוצאות, בלי מספרי פסוקים.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.
"use strict";

let chapterMapCtx = null;       // { matches, title, scope } — נקבע ב-showResults
let chapterMapInst = null;
let chapterMapAnim = null;      // { raf, timer }

// scope: { label, inScope(book, chapter, verse) → bool }
function chapterScopeForTanakh(book, chapter){
  return {
    label: 'הפרק',
    inScope: (b, c) => b === book && c === chapter,
  };
}
function chapterScopeForParasha(p){
  return {
    label: 'הפרשה',
    inScope: (b, c, v) => typeof verseInParasha === 'function' && verseInParasha(b, c, v, p),
  };
}

function chapterMapGeoOf(entry){
  const ms = (entry && entry.methods) || [];
  for (let i = 0; i < ms.length; i++){
    const g = ms[i] && ms[i].geo;
    if (g && g.length >= 2 && isFinite(g[0]) && isFinite(g[1])) return { geo: g, mi: i, alt: ms.length - 1 };
  }
  return null;
}

// הפסוק הראשון של הערך בתוך הטווח: { c, v, ref } — או null
function chapterMapFirstVerse(entry, scope){
  if (!scope) return null;
  let best = null;
  [].concat(entry.verses || [], entry.makorot || []).forEach(vr => {
    const ref = vr && vr.ref;
    if (!ref) return;
    verseKeysOfRef(ref).forEach(k => {
      const p = k.split('|');
      const b = p[0], c = +p[1], v = +p[2];
      if (!scope.inScope(b, c, v)) return;
      if (!best || c < best.c || (c === best.c && v < best.v)) best = { b, c, v, ref };
    });
  });
  return best;
}

function chapterMapPoints(ctx){
  if (!ctx) return [];
  const seen = new Set();
  const pts = [];
  (ctx.matches || []).forEach((m, order) => {
    if (m.catId !== 'places' || !m.entry || seen.has(m.entry)) return;
    const g = chapterMapGeoOf(m.entry);
    if (!g) return;
    const first = chapterMapFirstVerse(m.entry, ctx.scope);
    if (ctx.scope && !first) return;   // הוזכר בפרשה רק כשם נרדף/מקור אחר — לא בפסוק בטווח
    seen.add(m.entry);
    pts.push({ entry: m.entry, name: m.entry.name, lat: +g.geo[0], lng: +g.geo[1], alt: g.alt,
      cat: m.entry.cat, first, order });
  });
  if (ctx.scope){
    pts.sort((a, b) => (a.first.c - b.first.c) || (a.first.v - b.first.v) || (a.order - b.order));
  }
  return pts;
}

function chapterVerseLabel(first){
  if (!first) return '';
  return first.b + ' ' + numToHeb(first.c) + ', ' + numToHeb(first.v);
}

// ---------- ממשק ----------

function chapterMapEnsureDom(){
  let ov = document.getElementById('chapterMapOverlay');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.id = 'chapterMapOverlay';
  ov.innerHTML =
    '<div class="cm-box" role="dialog" aria-modal="true" aria-labelledby="cmTitle">' +
      '<div class="cm-head">' +
        '<h2 id="cmTitle"></h2>' +
        '<div class="cm-actions">' +
          '<button type="button" class="panel-btn" id="cmPlay">▶ לפי סדר הפסוקים</button>' +
          '<button type="button" class="panel-btn secondary" id="cmBase" hidden></button>' +
          '<button type="button" class="cm-close" id="cmClose" title="סגירה" aria-label="סגירה">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="cm-body">' +
        '<ol class="cm-list" id="cmList"></ol>' +
        '<div class="cm-map" id="cmMap"></div>' +
      '</div>' +
      '<div class="cm-note" id="cmNote"></div>' +
    '</div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) closeChapterMap(); });
  ov.querySelector('#cmClose').addEventListener('click', closeChapterMap);
  // שלב הלכידה, כדי לרוץ לפני המאזין שב-entry-detail.js: Esc אחד סוגר שכבה אחת
  // (קודם הכרטיס, אחר כך המפה, ורק אז חלון התוצאות)
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !ov.classList.contains('open')) return;
    const entryOv = document.getElementById('entryOverlay');
    if (entryOv && entryOv.classList.contains('open')) return;
    closeChapterMap();
    e.stopImmediatePropagation();
  }, true);
  return ov;
}

function chapterMapStop(){
  if (!chapterMapAnim) return;
  cancelAnimationFrame(chapterMapAnim.raf);
  clearTimeout(chapterMapAnim.timer);
  const onStop = chapterMapAnim.onStop;
  chapterMapAnim = null;
  if (onStop) onStop();
  const b = document.getElementById('cmPlay');
  if (b) b.textContent = '▶ לפי סדר הפסוקים';
}

function closeChapterMap(){
  chapterMapStop();
  if (chapterMapInst){ try { chapterMapInst.remove(); } catch(_){} chapterMapInst = null; }
  const ov = document.getElementById('chapterMapOverlay');
  if (ov) ov.classList.remove('open');
}

function chapterMapPin(color, num, active){
  const s = active ? 34 : 28;
  const html = '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24">' +
    '<path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" fill="' + color + '" stroke="#FFF8E7" stroke-width="1.3"/>' +
    '<text x="12" y="11.7" text-anchor="middle" font-size="' + (num > 99 ? 7 : 9) + '" font-weight="700" fill="#FFF8E7">' + num + '</text></svg>';
  return L.divIcon({ className: 'geo-pin' + (active ? ' cm-pin-active' : ''), html, iconSize: [s, s], iconAnchor: [s / 2, s], popupAnchor: [0, -s + 6] });
}

function openChapterMap(){
  const ctx = chapterMapCtx;
  const pts = chapterMapPoints(ctx);
  if (!pts.length || typeof window.L === 'undefined' || typeof addBaseLayers !== 'function') return;
  const ov = chapterMapEnsureDom();
  closeChapterMap();
  const ordered = !!ctx.scope;
  ov.querySelector('#cmTitle').textContent = '🗺️ ' + (ordered ? ctx.scope.label + ' על המפה' : 'המקומות על המפה') + ' — ' + ctx.title;
  ov.querySelector('#cmNote').textContent = ordered
    ? 'המקומות ממוספרים לפי הפסוק הראשון שהם מוזכרים בו. המיקום לפי שיטת הזיהוי הראשונה בכרטיס; במקום שיש לו כמה שיטות — הן בכרטיס.'
    : 'המקומות ממוספרים לפי סדר התוצאות. המיקום לפי שיטת הזיהוי הראשונה בכרטיס.';
  ov.querySelector('#cmPlay').hidden = !ordered || pts.length < 2;
  ov.classList.add('open');

  const color = (p) => (typeof CAT_COLORS !== 'undefined' && CAT_COLORS[p.cat]) || '#9C4A2E';
  const map = L.map(ov.querySelector('#cmMap'), { minZoom: 2, maxZoom: MAP_MAX_ZOOM, zoomControl: true });
  chapterMapInst = map;
  map.attributionControl.setPrefix('');
  const vector = addBaseLayers(map);
  // תוויות המפה המצוירת — במפה המפורטת יש שמות משלה, ולכן הן יורדות שם
  const labelMarkers = addLabels(map, 1) || [];
  let detailed = null, mode = 'vector';
  const baseBtn = ov.querySelector('#cmBase');
  const setMode = (m) => {
    mode = m;
    if (m === 'osm'){
      if (!detailed) detailed = L.layerGroup(osmOfflineLayers());
      map.removeLayer(vector); detailed.addTo(map);
      labelMarkers.forEach(l => map.removeLayer(l.marker));
      map.setMaxZoom(OSM_OFFLINE_MAX_ZOOM);
      baseBtn.textContent = '🗺️ מפה מצוירת';
    } else {
      if (detailed) map.removeLayer(detailed);
      vector.addTo(map);
      labelMarkers.forEach(l => l.marker.addTo(map));
      map.fire('zoomend');   // addLabels מסתיר תוויות לפי זום רק באירוע הזה
      map.setMaxZoom(MAP_MAX_ZOOM);
      baseBtn.textContent = '🌍 מפה מפורטת';
    }
  };
  baseBtn.onclick = () => setMode(mode === 'osm' ? 'vector' : 'osm');
  // המפה המפורטת קיימת רק בעינים למקרא+ (אריחים בחבילה) — בודקים לפני שמציעים
  if (typeof probeTile === 'function' && typeof OSM_PROBE_URL !== 'undefined'){
    probeTile(OSM_PROBE_URL, ok => {
      if (!ok || map !== chapterMapInst) return;
      baseBtn.hidden = false;
      setMode('osm');
    });
  }
  map.attributionControl.addAttribution('Natural Earth');

  const latlngs = pts.map(p => [p.lat, p.lng]);
  // ״ארצות ועמים״ (מצרים, עילם, כנען) הם אזורים — הנקודה שלהם היא מרכז משוער, ולכן הם
  // מסומנים ומודגשים בתורם, אבל הקו לא עובר דרכם (אחרת הוא נראה כמו מסע שלא היה)
  const onRoute = pts.map(p => p.cat !== 'lands');
  const routeLL = latlngs.filter((_, i) => onRoute[i]);
  const ghost = ordered && routeLL.length > 1
    ? L.polyline(routeLL, { color: '#6b5637', weight: 2, opacity: .45, dashArray: '4,7' }).addTo(map) : null;
  const trail = ordered ? L.polyline([], { color: '#9C4A2E', weight: 3.5, opacity: .9 }).addTo(map) : null;

  const list = ov.querySelector('#cmList');
  list.innerHTML = pts.map((p, i) =>
    '<li class="cm-item" data-i="' + i + '">' +
      '<span class="cm-num" style="background:' + color(p) + '">' + (i + 1) + '</span>' +
      '<span class="cm-txt"><span class="cm-name">' + esc(p.name) + '</span>' +
      (p.first ? '<span class="cm-ref">' + esc(chapterVerseLabel(p.first)) + '</span>' : '') +
      '</span></li>').join('');

  let active = -1;
  const markers = pts.map((p, i) => {
    const mk = L.marker([p.lat, p.lng], { icon: chapterMapPin(color(p), i + 1, false), riseOnHover: true }).addTo(map);
    mk.bindTooltip((i + 1) + '. ' + p.name, { direction: 'top', offset: [0, -24] });
    const pop = document.createElement('div');
    pop.className = 'cm-pop';
    pop.innerHTML = '<b>' + esc(p.name) + '</b>' +
      (p.first ? '<div class="cm-pop-ref">' + esc(p.first.ref) + '</div>' : '') +
      (p.alt > 0 ? '<div class="cm-pop-alt">' + (p.alt === 1 ? 'יש שיטת זיהוי נוספת' : 'יש ' + p.alt + ' שיטות זיהוי נוספות') + ' — בכרטיס</div>' : '') +
      '<div class="cm-pop-btns">' +
        (p.first ? '<button type="button" class="panel-btn" data-act="verse">📖 לפסוק</button>' : '') +
        '<button type="button" class="panel-btn secondary" data-act="card">כרטיס</button>' +
      '</div>';
    pop.addEventListener('click', e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'verse'){
        const parsed = typeof parseAnyRef === 'function' && parseAnyRef(p.first.ref);
        if (parsed) openInReader(parsed.bookId, parsed.ref);
      } else if (typeof openEntryDetail === 'function'){
        openEntryDetail(p.entry);
      }
    });
    mk.bindPopup(pop, { maxWidth: 260 });
    mk.on('click', () => setActive(i, false));
    return mk;
  });

  function setActive(i, fromAnim){
    if (active >= 0 && markers[active]){
      markers[active].setIcon(chapterMapPin(color(pts[active]), active + 1, false));
      markers[active].setZIndexOffset(0);
      markers[active].closeTooltip();
    }
    active = i;
    list.querySelectorAll('.cm-item').forEach((li, k) => li.classList.toggle('active', k === i));
    if (i < 0) return;
    markers[i].setIcon(chapterMapPin(color(pts[i]), i + 1, true));
    markers[i].setZIndexOffset(1000);
    if (fromAnim) markers[i].openTooltip();
    const li = list.querySelector('.cm-item[data-i="' + i + '"]');
    if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
  }

  list.addEventListener('click', e => {
    const li = e.target.closest('.cm-item');
    if (!li) return;
    chapterMapStop();
    const i = +li.dataset.i;
    setActive(i, false);
    map.flyTo([pts[i].lat, pts[i].lng], map.getZoom(), { duration: .6 });
    map.once('moveend', () => { if (map === chapterMapInst) markers[i].openPopup(); });
  });

  // ---- לפי סדר הפסוקים: כל מקום מודגש בתורו, והקו נמתח אליו מהמקום הקודם שעל הקו ----
  function play(){
    if (chapterMapAnim){ chapterMapStop(); return; }
    map.closePopup();
    map.fitBounds(latlngs, { padding: [34, 34], maxZoom: 9 });
    ov.querySelector('#cmPlay').textContent = '⏸ עצירה';
    chapterMapAnim = { raf: 0, timer: 0, onStop: null };
    // משך כולל של כ-25 שניות, בלי קשר למספר המקומות (מסעי בני ישראל: 42 תחנות)
    const legMs = Math.max(320, Math.min(900, 16000 / Math.max(1, pts.length - 1)));
    const pauseMs = Math.round(legMs * .6);
    const drawn = [];
    let i = 0;
    const arrive = () => {
      setActive(i, true);
      if (onRoute[i]) drawn.push(latlngs[i]);
      trail.setLatLngs(drawn);
      i++;
      chapterMapAnim.timer = setTimeout(next, pauseMs + (onRoute[i - 1] ? 0 : legMs));
    };
    const next = () => {
      if (!chapterMapAnim) return;
      if (i >= pts.length){ chapterMapStop(); return; }
      if (!onRoute[i] || !drawn.length){ arrive(); return; }
      const a = drawn[drawn.length - 1], b = latlngs[i];
      const t0 = performance.now();
      const frame = (now) => {
        if (!chapterMapAnim) return;
        const f = Math.min(1, (now - t0) / legMs);
        const k = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        trail.setLatLngs(drawn.concat([[a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]]));
        if (f < 1){ chapterMapAnim.raf = requestAnimationFrame(frame); return; }
        arrive();
      };
      chapterMapAnim.raf = requestAnimationFrame(frame);
    };
    trail.setLatLngs([]);
    chapterMapAnim.timer = setTimeout(next, 400);
  }
  ov.querySelector('#cmPlay').onclick = play;

  // המיכל נבנה זה עתה — מדידה מחדש אחרי שהשכבה מוצגת
  const fit = () => {
    map.invalidateSize();
    if (latlngs.length === 1) map.setView(latlngs[0], 8);
    else map.fitBounds(latlngs, { padding: [34, 34], maxZoom: 9 });
  };
  fit();
  setTimeout(() => { if (map === chapterMapInst) fit(); }, 120);
  if (ghost) ghost.bringToBack();
}

// נקרא מ-showResults: שומר את ההקשר ומציג/מסתיר את הכפתור בתחתית חלון התוצאות
function updateChapterMapButton(matches, title, scope){
  chapterMapCtx = { matches: matches || [], title: title || '', scope: scope || null };
  const btn = document.getElementById('resultsMapBtn');
  if (!btn) return;
  const n = chapterMapPoints(chapterMapCtx).length;
  btn.hidden = n === 0;
  btn.textContent = '🗺️ ' + (scope ? scope.label + ' על המפה' : 'על המפה') + ' (' + n + ')';
}

(function(){
  const btn = document.getElementById('resultsMapBtn');
  if (btn) btn.addEventListener('click', openChapterMap);
})();
