// =====================================================================
//  shell/i18n.js — שכבת שפת ממשק (#94 / #53, ROADMAP 4.13 — שלב א׳: תשתית)
//
//  מפתח המילון = מחרוזת המקור בעברית. בלי מילון לשפה (או בשפה עברית) —
//  שום דבר לא משתנה: i18nT() מחזירה את המקור, ומעבר ה-DOM לא רץ בכלל.
//
//  איך זה עובד בלי לגעת ב-~320 מקומות בקוד: כשהשפה אינה עברית, עוברים על
//  צמתי הטקסט ועל placeholder/title/aria-label, ומחליפים כל מחרוזת שיש לה
//  תרגום מדויק במילון. MutationObserver מתרגם גם תוכן שנבנה אחר כך.
//  לא מתורגמים: פסוקים, ציטוטים, שמות ערכים — הם פשוט לא במילון.
//
//  זיהוי השפה: payload.app.language ב-plugin.boot, או app.getLocale (קיים מ-0.9.89).
//  dir="ltr" נקבע בזמן ריצה בלבד — ה-HTML הסטטי נשאר rtl (ולידציית החנות).
//  שלב ג׳ (מעבר שפה חי, events.subscribe:settings.changed) חסום עד שאוצריא
//  תשחרר גרסה עם #758 — אפס שינוי במניפסט עד אז.
// =====================================================================

const I18N = { lang: 'he', dict: null };
const I18N_DICTS = (typeof window !== 'undefined' && window.TRANSLATIONS) || {};

const I18N_PATTERN_SRC = (typeof window !== 'undefined' && window.TRANSLATION_PATTERNS) || {};
let I18N_PATTERNS = [];   // [{ re, lit, out }] — לשפה הפעילה

// #94 שלב ג׳-א (4.19.0): תבניות למחרוזות שנבנות משרשור — ״הכל (41)״, ״נבחר: "…"״.
// המפתח הוא המחרוזת העברית עם {0} {1}… במקום החלקים המשתנים. החלקים עצמם
// עוברים שוב במילון המדויק (למשל ״הפרק״ בתוך ״{0} על המפה ({1})״).
function i18nCompilePatterns(src){
  return Object.keys(src || {}).map(k => {
    const parts = k.split(/\{(t?\d)\}/);
    let re = '^', lits = [];
    const order = [];
    parts.forEach((p, i) => {
      if (i % 2){ re += '([\\s\\S]+?)'; order.push(p); }
      else { re += p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); if (p.trim()) lits.push(p.trim()); }
    });
    const lit = lits.sort((a, b) => b.length - a.length)[0] || '';
    return { re: new RegExp(re + '$'), lit, order, out: src[k] };
  }).filter(p => p.lit);   // תבנית בלי שום טקסט קבוע הייתה תופסת הכל
}

function i18nExact(key){
  const hit = I18N.dict && I18N.dict[key];
  return hit || null;
}

function i18nT(s){
  if (!I18N.dict || s == null) return s;
  const str = String(s);
  const key = str.trim();
  if (!key) return s;
  const hit = i18nExact(key);
  if (hit) return str.replace(key, hit);
  if (!/[א-ת]/.test(key)) return s;
  for (const p of I18N_PATTERNS){
    if (key.indexOf(p.lit) === -1) continue;
    const m = key.match(p.re);
    if (!m) continue;
    let out = p.out;
    p.order.forEach((n, i) => {
      const v = m[i + 1];
      const tr = n[0] === 't' && i18nExact(v.trim());
      out = out.split('{' + n + '}').join(tr ? v.replace(v.trim(), tr) : v);
    });
    if (out === key) continue;   // תבנית כללית שלא הייתה לה מה לתרגם — ממשיכים לחפש
    return str.replace(key, out);
  }
  return s;
}

// הודעות שעוברות מחוץ ל-DOM (דיאלוגים של אוצריא, alert/confirm): קודם כמחרוזת
// שלמה, ואם אין — שורה אחר שורה, כי רוב ההודעות מורכבות מכמה פסקאות.
function i18nMsg(s){
  if (!I18N.dict || typeof s !== 'string' || !/[א-ת]/.test(s)) return s;
  const whole = i18nT(s);
  if (whole !== s) return whole;
  return s.split('\n').map(line => i18nT(line)).join('\n');
}

// דיאלוגים שאינם חלק מה-DOM של התוסף. עטיפה אחת, כשהשפה אינה עברית.
const I18N_CALL_FIELDS = ['message', 'title', 'content', 'label', 'text', 'confirmText', 'cancelText'];
function i18nCallNeedsText(method){
  return /^(ui|notifications)\./.test(method) || /^fs\.(pick|save)/.test(method)
    || method === 'reader.updateToolbarItem' || method === 'reader.addContextMenuItem';
}
function i18nWrapDialogs(){
  try {
    if (!window.__i18nAlerts){
      window.__i18nAlerts = true;
      ['alert', 'confirm', 'prompt'].forEach(fn => {
        const orig = window[fn];
        if (typeof orig !== 'function') return;
        window[fn] = function(msg, ...rest){ return orig.call(window, i18nMsg(msg), ...rest); };
      });
    }
    const O = window.Otzaria;
    if (O && typeof O.call === 'function' && !O.__i18nWrapped){
      const origCall = O.call.bind(O);
      O.call = function(method, params, ...rest){
        if (I18N.dict && params && typeof params === 'object' && i18nCallNeedsText(String(method))){
          const p = Object.assign({}, params);
          I18N_CALL_FIELDS.forEach(f => { if (typeof p[f] === 'string') p[f] = i18nMsg(p[f]); });
          return origCall(method, p, ...rest);
        }
        return origCall(method, params, ...rest);
      };
      O.__i18nWrapped = true;
    }
  } catch(e){ /* לעולם לא שוברים את התוסף בגלל תרגום */ }
}

// פסקאות עם תגיות בתוכן (<b>, <a>) מסומנות data-i18n="מפתח" — התרגום הוא HTML שלם
// ומחליף את התוכן. קישורים וכפתורים בתוך הפסקה שומרים על ה-id שלהם בתרגום.
function i18nBlocks(root){
  if (!I18N.dict || !root || !root.querySelectorAll) return;
  const list = [];
  if (root.matches && root.matches('[data-i18n]')) list.push(root);
  root.querySelectorAll('[data-i18n]').forEach(el => list.push(el));
  list.forEach(el => {
    if (el.dataset.i18nDone === I18N.lang) return;
    const html = I18N.dict[el.getAttribute('data-i18n')];
    if (!html) return;
    el.dataset.i18nDone = I18N.lang;
    // אלמנטים עם id (קישור, כפתור) מוחזרים כמו שהם — עם המאזינים שכבר חוברו אליהם
    const keep = {};
    el.querySelectorAll('[id]').forEach(c => { keep[c.id] = c; });
    el.innerHTML = html;
    el.querySelectorAll('[id]').forEach(n => {
      const old = keep[n.id];
      if (!old) return;
      old.innerHTML = n.innerHTML;
      n.replaceWith(old);
    });
  });
}

function i18nTranslateNode(root){
  if (!I18N.dict || !root) return;
  const ATTRS = ['placeholder', 'title', 'aria-label', 'label'];   // label — optgroup
  const fixEl = (el) => {
    ATTRS.forEach(a => {
      const v = el.getAttribute && el.getAttribute(a);
      if (v){ const nv = i18nT(v); if (nv !== v) el.setAttribute(a, nv); }
    });
  };
  if (root.nodeType === 3){
    const nv = i18nT(root.nodeValue); if (nv !== root.nodeValue) root.nodeValue = nv;
    return;
  }
  if (root.nodeType !== 1) return;
  i18nBlocks(root);
  // לא נוגעים בתוכן תורני: פסוקים וכרטיסי טקסט מסומנים כך בקוד הקיים
  if (root.closest && root.closest('script,style,textarea,[contenteditable],.verse,.verse-text,.no-i18n')) return;
  fixEl(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = walker.nextNode())){
    if (n.nodeType === 1){
      if (n.matches && n.matches('script,style,textarea,[contenteditable],.verse,.verse-text,.no-i18n')) continue;
      fixEl(n);
    } else if (n.nodeValue && n.nodeValue.trim()){
      const p = n.parentElement;
      if (p && p.closest && p.closest('script,style,textarea,.verse,.verse-text,.no-i18n')) continue;
      const nv = i18nT(n.nodeValue); if (nv !== n.nodeValue) n.nodeValue = nv;
    }
  }
}

let i18nObserver = null;
function setLanguage(lang){
  const code = String(lang || 'he').toLowerCase().split(/[-_]/)[0];
  const dict = code !== 'he' ? I18N_DICTS[code] : null;
  I18N.lang = dict ? code : 'he';
  I18N.dict = dict || null;
  if (!I18N.dict) return false;
  I18N_PATTERNS = i18nCompilePatterns(I18N_PATTERN_SRC[code]);
  i18nWrapDialogs();
  try {
    document.documentElement.setAttribute('lang', code);
    document.documentElement.setAttribute('dir', 'ltr');   // זמן ריצה בלבד
    i18nTranslateNode(document.body);
    if (!i18nObserver && typeof MutationObserver !== 'undefined'){
      i18nObserver = new MutationObserver(muts => muts.forEach(m => {
        if (m.type === 'characterData') i18nTranslateNode(m.target);
        else m.addedNodes.forEach(i18nTranslateNode);
      }));
      i18nObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    // פריטי תפריט ההקשר נרשמו כבר בעלייה, לפני שהשפה זוהתה — רישום חוזר על אותו id מחליף
    if (typeof registerUnifiedMenuItem === 'function') registerUnifiedMenuItem();
    if (typeof registerParagraphMenuItem === 'function') registerParagraphMenuItem();
  } catch(e){ /* בעיה בתרגום לעולם לא שוברת את התוסף — נשארים בעברית */ }
  return true;
}

function uiLangOverride(){
  try { return (JSON.parse(localStorage.getItem('madaei_hatanach_ui_prefs_v1') || '{}').uiLang) || 'auto'; }
  catch(e){ return 'auto'; }
}

async function detectLanguage(bootPayload){
  const ov = uiLangOverride();                // #94: בחירה ידנית בהגדרות
  if (ov === 'he') return;
  if (ov !== 'auto'){ setLanguage(ov); return; }
  const bp = bootPayload || {};
  let lang = (bp.app && (bp.app.language || bp.app.locale)) || bp.locale || bp.language || null;
  if (!lang && window.Otzaria && typeof Otzaria.call === 'function'){
    try {
      const res = await Otzaria.call('app.getLocale');
      const d = (res && res.data) || res;
      lang = (d && (d.locale || d.language)) || (typeof d === 'string' ? d : null);
    } catch(e){ /* גרסה בלי app.getLocale — עברית */ }
  }
  if (lang) setLanguage(lang);
}

if (typeof window !== 'undefined' && window.Otzaria && typeof Otzaria.on === 'function'){
  Otzaria.on('plugin.boot', (p) => { detectLanguage(p).catch(() => {}); });
}
// #94: בחירה ידנית חלה גם בלי plugin.boot (למשל בתצוגה מקדימה בדפדפן)
if (typeof document !== 'undefined' && uiLangOverride() !== 'auto' && uiLangOverride() !== 'he'){
  const go = () => setLanguage(uiLangOverride());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
}
