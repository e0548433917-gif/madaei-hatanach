// מודול המפה: בסיס וקטורי ללא אינטרנט + שכבת לוויין Sentinel-2 אופציונלית (מופיעה רק כשיש רשת)
"use strict";
// ---------- מפה מוטמעת ללא אינטרנט — Natural Earth + Leaflet ----------
const CAT_COLORS = {
  cities:'#C93A2C', villages:'#D97E10', mountains:'#7C4DD4', water:'#1F7FB8',
  valleys:'#2E8B57', deserts:'#B8860B', lands:'#2F6F6F', stations:'#D6408A'
};
const MAP_MAX_ZOOM = 12;

let worldMap = null, markerLayer = null, allMarkers = [], miniMapInst = null, labelMarkers = [];

function leafletReady(){ return typeof window.L !== 'undefined' && typeof L.map === 'function'; }

const NE_STYLE = {
  land:    {fillColor:'#E6D8B0', fillOpacity:1, stroke:false},
  wline:   {color:'#A08D5F', weight:.6, opacity:.75, fill:false},
  rline:   {color:'#8A7648', weight:.9, opacity:.8, fill:false},
  lake:    {fillColor:'#9FBCC8', fillOpacity:1, color:'#7796A3', weight:.8},
  river:   {color:'#7796A3', weight:1.1, opacity:.85, fill:false}
};

function addBaseLayers(map){
  const renderer = L.canvas({padding:.4});
  const group = L.layerGroup([
    L.geoJSON(NE_DATA.world,       {renderer, style:()=>NE_STYLE.land,  interactive:false}),
    L.geoJSON(NE_DATA.worldlines,  {renderer, style:()=>NE_STYLE.wline, interactive:false}),
    L.geoJSON(NE_DATA.region,      {renderer, style:()=>NE_STYLE.land,  interactive:false}),
    L.geoJSON(NE_DATA.regionlines, {renderer, style:()=>NE_STYLE.rline, interactive:false}),
    L.geoJSON(NE_DATA.rivers,      {renderer, style:()=>NE_STYLE.river, interactive:false}),
    L.geoJSON(NE_DATA.lakes,       {renderer, style:()=>NE_STYLE.lake,  interactive:false})
  ]);
  group.addTo(map);
  return group;
}

// ---- שכבת לוויין אופציונלית (Sentinel-2) — מוצעת רק כשיש בפועל גישה לאינטרנט ----
const S2_URL = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg';
const S2_OVERLAY_URL = 'https://tiles.maps.eox.at/wmts/1.0.0/overlay_bright_3857/default/g/{z}/{y}/{x}.png';
const S2_ATTR = 'Sentinel-2 cloudless 2024 by EOX (Contains modified Copernicus Sentinel data)';
const SAT_MAX_ZOOM = 17;
let satAvailable = false, satActive = false, satBase = null, satLabels = null, vectorBase = null, satToggleBtn = null;

function zoomCap(){ return satActive ? SAT_MAX_ZOOM : MAP_MAX_ZOOM; }

function probeSatellite(cb){
  let done = false;
  const finish = ok => { if(done) return; done = true; cb(ok); };
  const t = setTimeout(()=>finish(false), 6000);
  const img = new Image();
  img.onload  = ()=>{ clearTimeout(t); finish(true); };
  img.onerror = ()=>{ clearTimeout(t); finish(false); };
  img.src = S2_URL.replace('{z}','2').replace('{y}','1').replace('{x}','2') + '?t=' + Date.now();
}

function setSatellite(on){
  if(!worldMap || !satAvailable) return;
  satActive = !!on;
  if(satActive){
    if(!satBase)   satBase   = L.tileLayer(S2_URL, {maxZoom:SAT_MAX_ZOOM, attribution:S2_ATTR});
    if(!satLabels) satLabels = L.tileLayer(S2_OVERLAY_URL, {maxZoom:SAT_MAX_ZOOM, opacity:.95});
    if(vectorBase) worldMap.removeLayer(vectorBase);
    satBase.addTo(worldMap);
    satLabels.addTo(worldMap);
    worldMap.setMaxZoom(SAT_MAX_ZOOM);
  } else {
    if(satBase)   worldMap.removeLayer(satBase);
    if(satLabels) worldMap.removeLayer(satLabels);
    if(vectorBase) vectorBase.addTo(worldMap);
    worldMap.setMaxZoom(MAP_MAX_ZOOM);
  }
  if(satToggleBtn) satToggleBtn.innerHTML = satActive ? '🗺️ מפה מצוירת' : '🛰️ תצלום לוויין';
  document.getElementById('worldMap').classList.toggle('sat-on', satActive);
}

function addSatToggle(){
  const Ctl = L.Control.extend({
    options:{position:'topright'},
    onAdd(){
      const btn = L.DomUtil.create('button', 'sat-toggle-btn');
      btn.type = 'button';
      btn.innerHTML = '🛰️ תצלום לוויין';
      L.DomEvent.disableClickPropagation(btn);
      btn.addEventListener('click', ()=>setSatellite(!satActive));
      satToggleBtn = btn;
      return btn;
    }
  });
  worldMap.addControl(new Ctl());
}

function addLabels(map, sizeFactor){
  const made = [];
  NE_DATA.labels.forEach(lb=>{
    const cls = lb.kind === 'water' ? 'ne-label ne-label-water' : lb.kind === 'city' ? 'ne-label ne-label-city' : 'ne-label';
    const dot = lb.kind === 'city' ? '<span class="ne-city-dot"></span>' : '';
    const marker = L.marker([lb.lat, lb.lng], {
      icon: L.divIcon({className:'', html:`<div class="${cls}" style="font-size:${Math.round((lb.size||13)*(sizeFactor||1))}px">${dot}${lb.he}</div>`, iconSize:[0,0]}),
      interactive:false, keyboard:false
    }).addTo(map);
    made.push({marker, minZoom: lb.z});
  });
  const refresh = ()=>{
    const z = map.getZoom();
    made.forEach(rec=>{
      const el = rec.marker.getElement();
      if(el) el.style.display = z >= rec.minZoom ? '' : 'none';
    });
  };
  map.on('zoomend', refresh);
  refresh();
  return made;
}

function pinIcon(cat, secondary){
  const color = CAT_COLORS[cat] || '#555';
  const s = secondary ? 21 : 30;
  const html = `<svg width="${s}" height="${s}" viewBox="0 0 24 24"${secondary ? ' opacity="0.85"' : ''}>
    <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" fill="${color}" stroke="#FFF8E7" stroke-width="1.3"/>
    <circle cx="12" cy="9" r="2.7" fill="#FFF8E7" opacity=".85"/></svg>`;
  return L.divIcon({className:'geo-pin', html, iconSize:[s,s], iconAnchor:[s/2,s], popupAnchor:[0,-s+6]});
}

function clusterIcon(cluster){
  const n = cluster.getChildCount();
  const s = n < 10 ? 34 : n < 30 ? 41 : 48;
  return L.divIcon({html:`<div class="s2-cluster" style="width:${s}px;height:${s}px;font-size:${n<10?13:14}px">${n}</div>`,
    className:'', iconSize:[s,s], iconAnchor:[s/2,s/2]});
}

function popupHTML(item, idx, mi){
  const m = item.methods[mi];
  const catLabel = CATS.find(c=>c.id===item.cat)?.label || '';
  const methodLine = item.methods.length > 1 ? ` · ${m.label}` : '';
  const desc = (m.modern || m.explanation || '');
  return `<div class="s2-pop">
    <div class="s2-pop-name">${item.name}</div>
    <div class="s2-pop-cat">${catLabel}${methodLine} · ${m.confidence}</div>
    <p class="s2-pop-desc">${desc}</p>
    <button class="s2-pop-btn" data-open-idx="${idx}">לכרטיס המלא ⬅</button>
  </div>`;
}

function buildMarkers(){
  allMarkers = [];
  DATA.forEach((item, idx)=>{
    item.methods.forEach((m, mi)=>{
      if(!m.geo) return;
      const marker = L.marker([m.geo[0], m.geo[1]], {icon: pinIcon(item.cat, mi > 0), title: item.name});
      marker.bindPopup(popupHTML(item, idx, mi), {maxWidth: 250});
      allMarkers.push({marker, idx, mi});
    });
  });
}

function currentVisibleIdxSet(){
  const set = new Set();
  document.querySelectorAll('.category-section:not(.hidden) .card:not(.hidden)').forEach(card=>{
    set.add(parseInt(card.dataset.idx));
  });
  return set;
}

function updateMapFilter(){
  if(!worldMap || !markerLayer) return;
  const visible = currentVisibleIdxSet();
  markerLayer.clearLayers();
  allMarkers.forEach(rec=>{ if(visible.has(rec.idx)) markerLayer.addLayer(rec.marker); });
}

function fitAllMarkers(){
  const pts = [];
  markerLayer.eachLayer(l=>pts.push(l.getLatLng()));
  if(pts.length) worldMap.fitBounds(L.latLngBounds(pts), {padding:[30,30], maxZoom:6});
}

function resetWorldMap(){
  if(worldMap){ try{ worldMap.remove(); }catch(_){} }
  worldMap = null; markerLayer = null; allMarkers = []; labelMarkers = [];
}

function initWorldMap(){
  if(worldMap || !leafletReady()) return;
  const el = document.getElementById('worldMap');
  if(!el) return;
  worldMap = L.map(el, {minZoom:2, maxZoom:MAP_MAX_ZOOM, zoomControl:true,
    maxBounds:[[-65,-180],[82,180]], maxBoundsViscosity:.8});
  worldMap.attributionControl.setPrefix('');
  worldMap.attributionControl.addAttribution('מפה: Natural Earth · Leaflet — פועלת ללא אינטרנט');
  vectorBase = addBaseLayers(worldMap);
  probeSatellite(ok=>{ if(ok){ satAvailable = true; addSatToggle(); } });
  labelMarkers = addLabels(worldMap, 1);
  markerLayer = (typeof L.markerClusterGroup === 'function')
    ? L.markerClusterGroup({maxClusterRadius:36, iconCreateFunction:clusterIcon, showCoverageOnHover:false, spiderfyOnMaxZoom:true, disableClusteringAtZoom:12})
    : L.layerGroup();
  buildMarkers();
  allMarkers.forEach(rec=>markerLayer.addLayer(rec.marker));
  worldMap.addLayer(markerLayer);
  fitAllMarkers();
  el.addEventListener('click', e=>{
    const btn = e.target.closest('.s2-pop-btn');
    if(btn){ openModal(DATA[parseInt(btn.dataset.openIdx)]); }
  });
}

function focusOnMainMap(item, mi){
  if(!worldMap) return;
  const idx = DATA.indexOf(item);
  const m = item.methods[mi];
  if(!m || !m.geo) return;
  closeModal();
  document.getElementById('mapSection').scrollIntoView({behavior:'smooth'});
  const z = Math.min(m.geo[2], zoomCap());
  worldMap.flyTo([m.geo[0], m.geo[1]], z, {duration:1.6});
  worldMap.once('moveend', ()=>{
    const rec = allMarkers.find(r=>r.idx===idx && r.mi===mi) || allMarkers.find(r=>r.idx===idx);
    if(!rec) return;
    if(markerLayer && typeof markerLayer.zoomToShowLayer === 'function' && markerLayer.hasLayer(rec.marker)){
      markerLayer.zoomToShowLayer(rec.marker, ()=>rec.marker.openPopup());
    } else {
      rec.marker.openPopup();
    }
  });
}

function destroyMiniMap(){
  if(miniMapInst){ try{ miniMapInst.remove(); }catch(_){} miniMapInst = null; }
}

function renderMiniMap(item, mi){
  destroyMiniMap();
  const el = document.getElementById('miniMap');
  const m = item.methods[mi];
  if(!el || !m.geo || !leafletReady()) return;
  const z = Math.min(m.geo[2], zoomCap());
  miniMapInst = L.map(el, {minZoom:2, maxZoom:zoomCap(), scrollWheelZoom:false, zoomControl:true});
  miniMapInst.attributionControl.setPrefix('');
  miniMapInst.setView([m.geo[0], m.geo[1]], z);
  if(satAvailable && satActive){
    el.classList.add('sat-on');
    miniMapInst.attributionControl.addAttribution(S2_ATTR);
    L.tileLayer(S2_URL, {maxZoom:SAT_MAX_ZOOM}).addTo(miniMapInst);
    L.tileLayer(S2_OVERLAY_URL, {maxZoom:SAT_MAX_ZOOM, opacity:.95}).addTo(miniMapInst);
  } else {
    miniMapInst.attributionControl.addAttribution('Natural Earth');
    addBaseLayers(miniMapInst);
  }
  addLabels(miniMapInst, .9);
  L.marker([m.geo[0], m.geo[1]], {icon: pinIcon(item.cat, false)}).addTo(miniMapInst);
  // המודאל עדיין display:none ברגע היצירה — מדידה מחדש אחרי שהוא נפתח
  const inst = miniMapInst;
  setTimeout(()=>{
    if(inst === miniMapInst && miniMapInst){
      miniMapInst.invalidateSize();
      miniMapInst.setView([m.geo[0], m.geo[1]], z);
    }
  }, 120);
}


