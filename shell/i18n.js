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

function i18nT(s){
  if (!I18N.dict || s == null) return s;
  const key = String(s).trim();
  const hit = I18N.dict[key];
  return hit ? String(s).replace(key, hit) : s;
}

function i18nTranslateNode(root){
  if (!I18N.dict || !root) return;
  const ATTRS = ['placeholder', 'title', 'aria-label'];
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
  } catch(e){ /* בעיה בתרגום לעולם לא שוברת את התוסף — נשארים בעברית */ }
  return true;
}

async function detectLanguage(bootPayload){
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
