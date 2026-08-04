// הגדרות תצוגה: ערכת צבעים, גופן, גודל טקסט וצפיפות.
// נוצר בפיצול router.js (גרסה 2.11.2). המקור: shell/router.js שורות 2372-2571.
// אין להפוך ל-type="module" — כל הקבצים חולקים scope גלובלי אחד.


// ============================================================
//  הגדרות תצוגה — ערכת צבעים, גופן, גודל טקסט, צפיפות
//  ברירת המחדל ("קלאסי") היא בדיוק המראה שהיה כאן קודם; שאר
//  הערכות רק דורסות משתני CSS, בלי לשנות שום כלל עיצוב אחר.
// ============================================================
const PREFS_KEY = 'madaei_hatanach_ui_prefs_v1';
const DEFAULT_PREFS = { theme: 'otzaria', font: 'otzaria', scale: 100, density: 'normal', cardImg: true };
let uiPrefs = Object.assign({}, DEFAULT_PREFS);
let otzariaTheme = null; // ה-theme האחרון שהתקבל מאוצריא (boot / theme.changed)

const FONT_STACKS = {
  default: "'Heebo', Arial, sans-serif",
  frank:   "'Frank Ruhl Libre', 'David', serif",
  david:   "'David', 'Times New Roman', serif",
  arial:   "Arial, 'Segoe UI', sans-serif",
  times:   "'Times New Roman', 'David', serif"
};
const DENSITY = { compact: ['170px','9px'], normal: ['200px','12px'], roomy: ['250px','18px'] };

// כל המשתנים שערכת "תואם לאוצריא" מזריקה — נשמרים כדי שאפשר יהיה לנקות אותם
// בחזרה לערכה אחרת (אחרת ערכים ישנים היו נדבקים ל-<html> לנצח).
const OTZ_VARS = ['--color-primary','--color-on-primary','--color-secondary','--color-on-secondary',
  '--color-surface','--color-on-surface','--color-surface-container-highest','--color-error',
  '--color-on-error','--color-outline','--color-primary-subtle','--color-secondary-subtle',
  '--color-bg','--color-surface-2','--color-surface-3','--color-outline-faint',
  '--color-on-surface-dim','--color-on-surface-faint','--color-on-surface-ghost','--color-link',
  '--color-btn','--color-on-btn','--color-btn-hover','--color-hover','--color-scrim',
  '--color-scrim-light','--color-shadow','--color-shadow-strong','--color-glow','--color-map-bg'];

function hexToRgba(hex, alpha){
  const h = String(hex || '').replace('#','');
  if (h.length < 6) return 'rgba(0,0,0,' + alpha + ')';
  const off = h.length === 8 ? 2 : 0; // תמיכה ב-#AARRGGBB שפלאטר מחזירה לעתים
  const r = parseInt(h.slice(off, off+2), 16);
  const g = parseInt(h.slice(off+2, off+4), 16);
  const b = parseInt(h.slice(off+4, off+6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}
function normHex(hex){
  const h = String(hex || '').replace('#','');
  return h.length === 8 ? '#' + h.slice(2) : '#' + h;
}

function loadPrefs(){
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) uiPrefs = Object.assign({}, DEFAULT_PREFS, JSON.parse(raw));
  } catch(e){}
  if (!(uiPrefs.scale >= 85 && uiPrefs.scale <= 125)) uiPrefs.scale = 100;
}
function savePrefs(){
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(uiPrefs)); } catch(e){}
  // גיבוי בזיכרון של אוצריא, כדי שההגדרות ישרדו גם ניקוי של אחסון הדפדפן
  if (hasOtzaria()) storageSet(PREFS_KEY, uiPrefs);
}

function applyPrefs(){
  const root = document.documentElement;

  // --- ערכת צבעים ---
  const usingOtz = uiPrefs.theme === 'otzaria' && otzariaTheme && otzariaTheme.colorScheme;
  OTZ_VARS.forEach(v => root.style.removeProperty(v));
  if (uiPrefs.theme === 'dark' || uiPrefs.theme === 'plain') root.setAttribute('data-theme', uiPrefs.theme);
  else if (usingOtz) root.setAttribute('data-theme', 'otzaria');
  else root.removeAttribute('data-theme');

  if (usingOtz){
    const cs = otzariaTheme.colorScheme;
    const dark = otzariaTheme.mode === 'dark';
    const set = (k, v) => root.style.setProperty(k, v);
    // תפקידי הצבע הרשמיים של M3, ישירות מה-API
    set('--color-primary',      normHex(cs.primary));
    set('--color-on-primary',   normHex(cs.onPrimary));
    set('--color-secondary',    normHex(cs.secondary || cs.primary));
    set('--color-on-secondary', normHex(cs.onSecondary || cs.onPrimary));
    set('--color-surface',      normHex(cs.surface));
    set('--color-on-surface',   normHex(cs.onSurface));
    set('--color-surface-container-highest', normHex(cs.surfaceContainerHighest || cs.surface));
    set('--color-error',        normHex(cs.error || cs.secondary || cs.primary));
    set('--color-on-error',     normHex(cs.onError || cs.onPrimary));
    set('--color-outline',      hexToRgba(cs.outline, .55));
    // נגזרים (M3 מגדיר צבעי Container שאינם ב-API — מקרבים אותם בשקיפות)
    set('--color-primary-subtle',   hexToRgba(cs.primary, .12));
    set('--color-secondary-subtle', hexToRgba(cs.secondary || cs.primary, .16));
    set('--color-bg',               normHex(cs.surface));
    set('--color-surface-2',        normHex(cs.surfaceContainerHighest || cs.surface));
    set('--color-surface-3',        hexToRgba(cs.surfaceContainerHighest || cs.surface, .55));
    set('--color-outline-faint',    hexToRgba(cs.outline, .32));
    set('--color-on-surface-dim',   hexToRgba(cs.onSurface, .78));
    set('--color-on-surface-faint', hexToRgba(cs.onSurface, .62));
    set('--color-on-surface-ghost', hexToRgba(cs.onSurface, .45));
    set('--color-link',             normHex(cs.primary));
    set('--color-btn',              normHex(cs.primary));
    set('--color-on-btn',           normHex(cs.onPrimary));
    set('--color-btn-hover',        hexToRgba(cs.primary, .84));
    set('--color-hover',            hexToRgba(cs.primary, .10));
    set('--color-scrim',            dark ? 'rgba(0,0,0,.68)' : 'rgba(20,16,10,.55)');
    set('--color-scrim-light',      dark ? 'rgba(0,0,0,.55)' : 'rgba(0,0,0,.35)');
    set('--color-shadow',           dark ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.08)');
    set('--color-shadow-strong',    dark ? 'rgba(0,0,0,.55)' : 'rgba(0,0,0,.18)');
    set('--color-glow',             dark ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,0)');
    set('--color-map-bg',           hexToRgba(cs.surfaceContainerHighest || cs.surface, 1));
  }

  // --- גופן ---
  let stack = FONT_STACKS[uiPrefs.font] || FONT_STACKS.default;
  if (uiPrefs.font === 'otzaria'){
    const fam = otzariaTheme && otzariaTheme.typography && otzariaTheme.typography.fontFamily;
    stack = fam ? ("'" + fam + "', 'David', serif") : FONT_STACKS.default;
  }
  root.style.setProperty('--font-main', stack);

  // --- גודל טקסט (בשליטת המשתמש בלבד — לא נגזר מגודל הקריאה של אוצריא,
  //     שהוא גדול בהרבה ממה שמתאים לממשק כזה) ---
  root.style.setProperty('--ui-scale', String(uiPrefs.scale / 100));

  // --- צפיפות ---
  const d = DENSITY[uiPrefs.density] || DENSITY.normal;
  root.style.setProperty('--card-min', d[0]);
  root.style.setProperty('--card-pad', d[1]);

  // --- תמונות בכרטיסים ---
  root.setAttribute('data-cardimg', uiPrefs.cardImg ? 'on' : 'off');

  syncSettingsUI();
}

function syncSettingsUI(){
  const mark = (groupId, val) => {
    const g = document.getElementById(groupId);
    if (!g) return;
    g.querySelectorAll('.set-opt').forEach(b => b.classList.toggle('active', b.dataset.val === val));
  };
  mark('setTheme', uiPrefs.theme);
  mark('setFont', uiPrefs.font);
  mark('setDensity', uiPrefs.density);
  const sc = document.getElementById('setScale');
  const scv = document.getElementById('setScaleVal');
  if (sc) sc.value = uiPrefs.scale;
  if (scv) scv.textContent = uiPrefs.scale + '%';
  const ci = document.getElementById('setCardImg');
  if (ci) ci.checked = !!uiPrefs.cardImg;
}

function setPref(key, val){
  uiPrefs[key] = val;
  savePrefs();
  applyPrefs();
}

function openSettings(){
  document.getElementById('settingsScrim').classList.add('open');
  document.getElementById('settingsPanel').classList.add('open');
  syncSettingsUI();
}
function closeSettings(){
  document.getElementById('settingsScrim').classList.remove('open');
  document.getElementById('settingsPanel').classList.remove('open');
}

function wireSettings(){
  const btn = document.getElementById('settingsBtn');
  if (btn) btn.addEventListener('click', openSettings);
  const x = document.getElementById('settingsCloseBtn');
  if (x) x.addEventListener('click', closeSettings);
  const scrim = document.getElementById('settingsScrim');
  if (scrim) scrim.addEventListener('click', closeSettings);

  [['setTheme','theme'], ['setFont','font'], ['setDensity','density']].forEach(([id, key]) => {
    const g = document.getElementById(id);
    if (!g) return;
    g.addEventListener('click', (e) => {
      const b = e.target.closest('.set-opt');
      if (b) setPref(key, b.dataset.val);
    });
  });

  const sc = document.getElementById('setScale');
  if (sc) sc.addEventListener('input', () => setPref('scale', parseInt(sc.value, 10) || 100));

  const ci = document.getElementById('setCardImg');
  if (ci) ci.addEventListener('change', () => setPref('cardImg', ci.checked));

  const reset = document.getElementById('settingsReset');
  if (reset) reset.addEventListener('click', () => {
    uiPrefs = Object.assign({}, DEFAULT_PREFS);
    savePrefs();
    applyPrefs();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSettings();
  });
}

// החלת ההגדרות מיידית בטעינה (לפני שאוצריא בכלל זמינה) — מונע הבהוב.
loadPrefs();
applyPrefs();
wireSettings();
