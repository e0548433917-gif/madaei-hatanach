// שש הבדיקות של ת.0 — משימה ת.0. ר' tools/validate.js.
'use strict';

const { isEmpty, normName, collectRefs, hasImage } = require('./util');
const { FIELD_RULES } = require('./config');

// ---------------------------------------------------------------------------
// הבדיקות
// ---------------------------------------------------------------------------

const REL_FIELDS = [
  { key: 'father',   label: 'אב',      single: true },
  { key: 'mother',   label: 'אם',      single: true },
  { key: 'spouses',  label: 'בן/בת זוג', single: false },
  { key: 'children', label: 'ילד',     single: false },
  { key: 'siblings', label: 'אח/אחות', single: false },
];

// חלק גדול מהערכים בשדות הקשר אינם שם נקי אלא שם + הבהרה בסוגריים
// ("אמנון (בכורו, בן אחינעם היזרעאלית, נולד בחברון)"). מסירים את ההבהרה כדי לבדוק
// אם השם עצמו קיים — זה ההבדל בין ״חסרה רשומה״ ל״הרשומה קיימת, המחרוזת פשוט לא תואמת״.
function stripQualifier(name) {
  return String(name == null ? '' : name).replace(/\s*\([^()]*\)\s*$/, '').trim();
}

// ניסוח תיאורי = לא שם של אדם, ולכן אין ולא תהיה לו רשומה.
// שתי אמות מידה, אחרי הסרת ההבהרה בסוגריים: מילת מפתח מובהקת, או ביטוי בן 4+ מילים.
const DESCRIPTIVE_WORDS = /(^|\s)(בנים|בנות|אחיו|אחיותיו|אחותו|פילגש|פילגשים|נשים|אישה|איש|שבעים)(\s|$)|נוספ|נקראו|נקרא בשם|נזכר|נישאה|מפורש|וכו/;
function isDescriptive(name) {
  const base = stripQualifier(name);
  if (!base) return true;
  if (base.split(/\s+/).length >= 4) return true;
  return DESCRIPTIVE_WORDS.test(base);
}

function relValues(entry, field) {
  const v = entry[field.key];
  if (field.single) return isEmpty(v) ? [] : [String(v)];
  return (Array.isArray(v) ? v : []).filter((x) => !isEmpty(x)).map(String);
}

// אינדקס שמות. **קריטי:** שמות מקראיים רבים נישאים בידי יותר מאדם אחד ("ראש", "אמנון",
// "שמעא"), ולכן שם אינו מזהה ייחודי. אינדקס שבוחר שרירותית את הרשומה הראשונה מייצר
// ממצאי שווא המוניים ("רמון רשם את חם כילד, אבל אביו של חם הוא נח"). לכן:
// שם שיש לו יותר מרשומה אחת מסומן **דו-משמעי**, וכל הבדיקות מדלגות עליו ומדווחות
// אותו בנפרד — כי בלי הבחנה בין הנושאים אין דרך לדעת אם הקשר נכון או שגוי.
function buildIndex(data) {
  const byName = new Map();    // שם -> [רשומות]
  const byAlias = new Map();
  const duplicates = [];
  data.forEach((e, i) => {
    const n = normName(e.name);
    if (!n) return;
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(e);
    if (byName.get(n).length > 1) duplicates.push({ name: e.name, index: i, cat: e.cat });
    (Array.isArray(e.aliases) ? e.aliases : []).forEach((a) => {
      const na = normName(a);
      if (!na) return;
      if (!byAlias.has(na)) byAlias.set(na, []);
      byAlias.get(na).push(e);
    });
  });

  const pick = (name) => {
    const n = normName(name);
    return byName.get(n) || byAlias.get(n) || null;
  };

  return {
    duplicates,
    // כמה רשומות נושאות את השם הזה: 0 = לא קיים, 1 = חד-משמעי, 2+ = דו-משמעי.
    countFor(name) {
      const hit = pick(name) || pick(stripQualifier(name));
      return hit ? hit.length : 0;
    },
    isAmbiguous(name) { return this.countFor(name) > 1; },
    // התאמה מדויקת בלבד — כפי שכל קוד שינסה למצוא את הרשומה לפי המחרוזת יתנהג.
    // מחזיר רשומה רק אם היא יחידה; שם דו-משמעי מחזיר null (ר' resolveAmbiguous).
    resolveExact(name) {
      const hit = pick(name);
      return hit && hit.length === 1 ? hit[0] : null;
    },
    // האם השם מוכר בכלל — גם אם הוא דו-משמעי. משמש את בדיקה 1 בלבד.
    existsExact(name) { return !!pick(name); },
    // התאמה סלחנית: מסירה הבהרה בסוגריים בסוף. משמשת את בדיקות ההדדיות (2 ו-3),
    // כדי שהן יבדקו את הקשר האמיתי ולא ייחסמו על מחרוזת לא תואמת.
    resolve(name) {
      return this.resolveExact(name) || this.resolveExact(stripQualifier(name));
    },
    exists(name) { return this.existsExact(name) || this.existsExact(stripQualifier(name)); },
    has(name) { return !!this.resolve(name); },
  };
}

// --- 1. קשרים המצביעים על רשומה שאינה קיימת ---
// שלוש קבוצות, וזה ההבדל בין ״ליצור רשומה״ ל״לתקן מחרוזת״ ל״לא לגעת״:
//   qualifier — הרשומה קיימת, אבל המחרוזת נושאת הבהרה בסוגריים ולכן אינה תואמת
//   missing   — שם ממשי שאין לו רשומה כלל
//   descriptive — ניסוח תיאורי, לא שם. אין ולא תהיה לו רשומה
function checkMissingTargets(data, index) {
  const rows = [];
  const ambiguous = [];
  data.forEach((e) => {
    REL_FIELDS.forEach((f) => {
      relValues(e, f).forEach((val) => {
        if (index.existsExact(val)) {
          if (index.isAmbiguous(val)) {
            ambiguous.push({ from: e.name, field: f.key, target: val, n: index.countFor(val) });
          }
          return;
        }
        const strippedExists = index.existsExact(stripQualifier(val));
        let kind = 'missing';
        if (strippedExists) kind = 'qualifier';
        else if (isDescriptive(val)) kind = 'descriptive';
        const resolved = index.resolveExact(stripQualifier(val));
        rows.push({
          from: e.name,
          cat: e.cat,
          field: f.key,
          fieldLabel: f.label,
          target: val,
          kind,
          resolvedTo: resolved ? resolved.name : (strippedExists ? `${stripQualifier(val)} (דו-משמעי)` : null),
        });
        if (kind === 'qualifier' && index.isAmbiguous(stripQualifier(val))) {
          ambiguous.push({ from: e.name, field: f.key, target: val, n: index.countFor(stripQualifier(val)) });
        }
      });
    });
  });
  return { rows, ambiguous };
}

// --- 2. בני זוג לא הדדיים ---
function checkSpouses(data, index) {
  const rows = [];
  data.forEach((e) => {
    relValues(e, REL_FIELDS[2]).forEach((sp) => {
      const other = index.resolve(sp);
      // לא קיים -> בדיקה 1. דו-משמעי -> אי אפשר להכריע, מדווח בנפרד.
      if (!other) return;
      const back = relValues(other, REL_FIELDS[2]);
      const mutual = back.some((b) => index.resolve(b) === e);
      if (!mutual) rows.push({ from: e.name, to: other.name, otherSpouses: back });
    });
  });
  return rows;
}

// --- 3. הורים וילדים לא מקבילים (+ אחים) ---
function checkParentChild(data, index) {
  const childNoParent = [];   // X רשם את Y כילד, אבל Y לא רשם את X כהורה
  const parentNoChild = [];   // Y רשם את X כהורה, אבל X לא רשם את Y כילד
  const siblingOneWay = [];
  const undecidable = [];     // הקשר מפנה לשם דו-משמעי — אי אפשר להכריע
  const dupRelations = [];    // שתי מחרוזות שונות באותו שדה מצביעות על אותה רשומה

  const seen = new Set();
  const push = (arr, key, row) => { if (seen.has(key)) return; seen.add(key); arr.push(row); };

  data.forEach((e) => {
    // כפילות בתוך שדה קשר: "לבן" ו-"לבן (הארמי)" באותו children
    REL_FIELDS.forEach((f) => {
      const hits = new Map();
      relValues(e, f).forEach((v) => {
        const t = index.resolve(v);
        if (!t) return;
        if (!hits.has(t)) hits.set(t, []);
        hits.get(t).push(v);
      });
      hits.forEach((strings, target) => {
        if (strings.length > 1) dupRelations.push({ from: e.name, field: f.key, target: target.name, strings });
      });
    });

    // כיוון א׳: children -> father/mother
    relValues(e, REL_FIELDS[3]).forEach((cn) => {
      if (index.isAmbiguous(cn)) {
        undecidable.push({ from: e.name, field: 'children', target: cn, n: index.countFor(cn), why: 'שם הילד נישא ביותר מרשומה אחת' });
        return;
      }
      const child = index.resolve(cn);
      if (!child) return;                       // לא קיים -> בדיקה 1
      // אם ההורה הרשום אצל הילד הוא שם דו-משמעי, אי אפשר לדעת אם הוא מצביע חזרה על e
      if (index.isAmbiguous(child.father) || index.isAmbiguous(child.mother)) {
        undecidable.push({ from: e.name, field: 'children', target: child.name, n: Math.max(index.countFor(child.father), index.countFor(child.mother)), why: 'ההורה הרשום אצל הילד הוא שם דו-משמעי' });
        return;
      }
      const f = index.resolve(child.father);
      const m = index.resolve(child.mother);
      if (f !== e && m !== e) {
        // שתי חומרות שונות לגמרי:
        //   conflict — לילד כבר רשום הורה *אחר* וקיים. או שהשדה שגוי, או — וזה
        //              הסביר יותר — הקישור מצביע על האדם הלא נכון בעל אותו שם.
        //   missing  — שדות ההורה של הילד ריקים. חסרה רק הדדיות, אין סתירה.
        const hasOtherParent = !!(f || m);
        push(childNoParent, `cnp|${e.name}|${child.name}`, {
          parent: e.name, child: child.name,
          childFather: child.father || '—', childMother: child.mother || '—',
          kind: hasOtherParent ? 'conflict' : 'missing',
        });
      }
    });

    // כיוון ב׳: father/mother -> children
    [REL_FIELDS[0], REL_FIELDS[1]].forEach((f) => {
      relValues(e, f).forEach((pn) => {
        if (index.isAmbiguous(pn)) {
          undecidable.push({ from: e.name, field: f.key, target: pn, n: index.countFor(pn), why: 'שם ההורה נישא ביותר מרשומה אחת' });
          return;
        }
        const parent = index.resolve(pn);
        if (!parent) return;
        const kids = relValues(parent, REL_FIELDS[3]);
        // אם אחד מילדי ההורה הוא שם דו-משמעי, ייתכן שדווקא הוא זה שמצביע על e
        if (kids.some((k) => index.isAmbiguous(k) && normName(stripQualifier(k)) === normName(e.name))) {
          undecidable.push({ from: e.name, field: f.key, target: parent.name, n: index.countFor(e.name), why: 'שם הילד עצמו דו-משמעי ברשימת הילדים של ההורה' });
          return;
        }
        if (!kids.some((k) => index.resolve(k) === e)) {
          push(parentNoChild, `pnc|${e.name}|${parent.name}|${f.key}`,
            { child: e.name, parent: parent.name, role: f.label, childrenCount: kids.length });
        }
      });
    });

    // אחים — הדדיות
    relValues(e, REL_FIELDS[4]).forEach((sn) => {
      if (index.isAmbiguous(sn)) {
        undecidable.push({ from: e.name, field: 'siblings', target: sn, n: index.countFor(sn), why: 'שם האח נישא ביותר מרשומה אחת' });
        return;
      }
      const sib = index.resolve(sn);
      if (!sib) return;
      const back = relValues(sib, REL_FIELDS[4]);
      if (back.some((b) => index.isAmbiguous(b) && normName(stripQualifier(b)) === normName(e.name))) return;
      if (!back.some((b) => index.resolve(b) === e)) {
        push(siblingOneWay, `sib|${e.name}|${sib.name}`, { from: e.name, to: sib.name });
      }
    });
  });
  return { childNoParent, parentNoChild, siblingOneWay, undecidable, dupRelations };
}

// --- 3ד. רשומות בלי שום קשר משפחתי ---
// ״בני המן״ הוא הדוגמה: לפרשנדתא אין `father`, ולהמן אין `children` — ולכן *שום*
// בדיקת עקביות לא יכולה לתפוס את זה, כי אין בדאטה שום סימן לקשר. זו לא סתירה
// אלא חֶסֶר תוכן, ולכן מדווח כאן בנפרד: זו הבריכה שממנה ת.1 שולה ידנית.
function checkOrphans(data) {
  return data
    .filter((e) => REL_FIELDS.every((f) => relValues(e, f).length === 0))
    .map((e) => ({ name: e.name, cat: e.cat }));
}

// --- 4. שדות חובה ---
function checkFields(guideId, data, cats) {
  const rules = FIELD_RULES[guideId] || { required: ['name', 'cat'], recommended: [] };
  const catIds = new Set((cats || []).map((c) => c.id));
  const missingRequired = [];
  const missingRecommended = [];
  const unknownCat = [];
  data.forEach((e, i) => {
    rules.required.forEach((f) => {
      if (isEmpty(e[f])) missingRequired.push({ name: e.name || `(ללא שם, אינדקס ${i})`, cat: e.cat, field: f });
    });
    rules.recommended.forEach((f) => {
      if (isEmpty(e[f])) missingRecommended.push({ name: e.name || `(אינדקס ${i})`, cat: e.cat, field: f });
    });
    if (!isEmpty(e.cat) && catIds.size && !catIds.has(e.cat)) {
      unknownCat.push({ name: e.name, cat: e.cat });
    }
  });
  return { missingRequired, missingRecommended, unknownCat, rules };
}

// --- 5. מראי מקום ---
// סיווג שורש הכשל. כל סיווג **מאומת בפועל**: מתקנים את מראה המקום בדרך אחת, מריצים
// שוב את אותו פרסר, ומסווגים רק אם הוא באמת נפרס אחרי התיקון. אין כאן ניחוש.

// כתיב חסר/מלא: מסירים אימות קריאה כדי להשוות "תהילים" ל-"תהלים" שברשימת TANAKH_BOOKS.
const deMatres = (s) => String(s).replace(/[יו]/g, '');

function buildBookVariantMap(parsers) {
  // TANAKH_BOOKS אינו מיוצא מ-refs.js. מרכיבים את הרשימה מהפרסר עצמו: כל שם ספר
  // שנבדק כאן עובר דרך parseVerseRef, ולכן הרשימה שלמטה היא עותק מוצהר של השורה 5
  // ב-shell/refs.js. אם היא משתנה שם — הבדיקה תדווח פחות סיווגים, לא סיווגים שגויים.
  const BOOKS = ['דברי הימים א', 'דברי הימים ב', 'שיר השירים', 'שמואל א', 'שמואל ב', 'מלכים א',
    'מלכים ב', 'בראשית', 'שמות', 'ויקרא', 'במדבר', 'דברים', 'יהושע', 'שופטים', 'ישעיהו', 'ירמיהו',
    'יחזקאל', 'הושע', 'יואל', 'עמוס', 'עובדיה', 'יונה', 'מיכה', 'נחום', 'חבקוק', 'צפניה', 'חגי',
    'זכריה', 'מלאכי', 'תהלים', 'משלי', 'איוב', 'רות', 'איכה', 'קהלת', 'אסתר', 'דניאל', 'עזרא', 'נחמיה'];
  const m = new Map();
  BOOKS.forEach((b) => { if (!m.has(deMatres(b))) m.set(deMatres(b), b); });
  return m;
}

// מנסה לתקן את מראה המקום בכמה דרכים ידועות, ומחזיר את הסיבה הראשונה שבאמת עובדת.
// מסכתות הבבלי — עותק מוצהר של BAVLI_MASECHTOT ב-shell/refs.js:32. משמש **רק** כמסנן
// כנגד התנגשות בהסרת אימות הקריאה: deMatres("עבודה") === deMatres("עובדיה"), ובלעדיו
// "עבודה זרה טז:" היה מסווג בטעות כשגיאת כתיב של ספר עובדיה.
const MASECHTOT_GUARD = ['ברכות', 'שבת', 'עירובין', 'פסחים', 'שקלים', 'ראש השנה', 'יומא', 'סוכה',
  'ביצה', 'תענית', 'מגילה', 'מועד קטן', 'חגיגה', 'יבמות', 'כתובות', 'נדרים', 'נזיר', 'סוטה', 'גיטין',
  'קידושין', 'בבא קמא', 'בבא מציעא', 'בבא בתרא', 'סנהדרין', 'מכות', 'שבועות', 'עבודה זרה', 'הוריות',
  'זבחים', 'מנחות', 'חולין', 'בכורות', 'ערכין', 'תמורה', 'כריתות', 'מעילה', 'תמיד', 'נדה'];

function diagnoseRef(ref, parse, bookVariants) {
  const attempts = [];
  const words = ref.split(/\s+/);

  // parseMidrashRef ממילא מסיר הבהרה בסוגריים בסוף, ולכן הבדיקות התבניתיות שלמטה
  // רצות על המחרוזת בלעדיה — אחרת ״בבלי סנהדרין ע, ב (הובא בעין יעקב)״ לא היה מסווג.
  const base = ref.replace(/\s*\([^)]*\)\s*$/, '').trim();

  // א. טווח דפים / מקורות ("חולין סא ע\"א – סג ע\"ב")
  const dash = ref.split(/\s*[–—]\s*|\s+-\s+/)[0];
  if (dash !== ref) attempts.push({ cause: 'טווח דפים במקום דף בודד', fix: dash.trim(), detail: `נחתך אחרי ״${dash.trim()}״` });

  // א2. העמוד נרשם כאות אחרי פסיק ("בבלי שבת קכח, א") במקום כסימן דף ("ע\"א").
  // כאן **אסור** לחתוך את הסיומת — זה היה מאבד את העמוד. התיקון הוא המרה.
  const amud = base.match(/^(.*?[א-ת])\s*,\s*([אב])$/);
  if (amud) {
    attempts.push({
      cause: 'העמוד נרשם כ״, א/ב״ במקום ״ע״א/ע״ב״',
      fix: `${amud[1]} ע"${amud[2]}`,
      detail: `, ${amud[2]} ← ע"${amud[2]}`,
    });
  }

  // א3. מפרש/מדרש בפורמט "רש״י, במדבר לא נ" במקום "רש״י על במדבר לא, נ".
  // חלק הספר חייב להיות בלי פסיק, אחרת "ספרא, שמיני, פרק ו, ה" היה מתפרק לשטות.
  const comm = base.match(/^([^,]+),\s*([^,]+?)\s+([א-ת"׳']{1,4})\s*,?\s*([א-ת"׳']{1,4})$/);
  if (comm) {
    attempts.push({
      cause: 'מפרש/מדרש בפורמט ״X, ספר פרק פסוק״ במקום ״X על ספר פרק, פסוק״',
      fix: `${comm[1]} על ${comm[2]} ${comm[3]}, ${comm[4]}`,
      detail: `${comm[1]}, ← ${comm[1]} על`,
    });
  }

  // ב. סיומת נוספת אחרי מראה המקום ("ראש השנה לא:, א")
  const cut = ref.replace(/,\s*[^,]*$/, '').trim();
  if (cut && cut !== ref) attempts.push({ cause: 'סיומת נוספת אחרי מראה המקום', fix: cut, detail: `נחתך אחרי ״${cut}״` });
  // ג. שני מקורות מופרדים בנקודה-פסיק
  const semi = ref.split(';')[0].trim();
  if (semi !== ref) attempts.push({ cause: 'שני מקורות במחרוזת אחת', fix: semi, detail: `רק החלק הראשון: ״${semi}״` });
  // ד. כתיב שונה של שם הספר ("תהילים" מול "תהלים"). אחרון בכוונה — התיקונים
  // התחביריים שלמעלה מדויקים יותר, וזה הרחב ביותר.
  for (let k = Math.min(3, words.length); k >= 1; k--) {
    const prefix = words.slice(0, k).join(' ').replace(/,$/, '');
    const canon = bookVariants.get(deMatres(prefix));
    if (!canon || canon === prefix) continue;
    // אם המילה הבאה משלימה את הרצף לשם מסכת מוכרת — זו מסכת, לא ספר בכתיב אחר.
    const extended = words.slice(0, k + 1).join(' ').replace(/[,.:]$/, '');
    if (MASECHTOT_GUARD.includes(extended) || MASECHTOT_GUARD.includes(prefix)) continue;
    attempts.push({ cause: 'כתיב שונה של שם הספר', fix: ref.replace(prefix, canon), detail: `${prefix} ← ${canon}` });
  }

  for (const a of attempts) {
    const parsed = parse(a.fix);
    // ⚠️ parsed מוכיח שהמחרוזת *נפרסת*, לא ש-bookId הוא ספר שקיים בספריית אוצריא.
    // לכן מחזירים גם את ה-bookId — כדי שהעין האנושית תוכל לפסול פענוח שנראה תקין
    // ובפועל מוליד שם ספר שלא קיים (למשל ״אוצר מדרשים על חופת אליהו״).
    if (parsed) return { cause: a.cause, detail: a.detail, fixed: a.fix, bookId: parsed.bookId, fixedRef: parsed.ref };
  }
  return { cause: 'אחר — דורש בדיקה ידנית', detail: '', fixed: null, bookId: null };
}

function checkRefs(data, parsers, bookVariants) {
  const bad = new Map();   // ref -> { ref, parser, field, count, samples[] }
  let total = 0;
  data.forEach((e) => {
    collectRefs(e).forEach((r) => {
      total++;
      const fn = r.parser === 'parseAnyRef' ? parsers.parseAnyRef : parsers.parseMidrashRef;
      if (fn(r.ref)) return;
      const key = r.parser + '|' + r.ref;
      if (!bad.has(key)) {
        const diag = diagnoseRef(r.ref, fn, bookVariants);
        bad.set(key, { ref: r.ref, parser: r.parser, field: r.field, count: 0, samples: [], ...diag });
      }
      const rec = bad.get(key);
      rec.count++;
      if (rec.samples.length < 3) rec.samples.push(e.name);
      // האם parseAnyRef היה מציל אותו? רלוונטי רק ל-midrash, שעובר רק ב-parseMidrashRef
      if (r.parser === 'parseMidrashRef' && parsers.parseAnyRef(r.ref)) rec.rescuedByAnyRef = true;
    });
  });
  return { total, bad: [...bad.values()].sort((a, b) => b.count - a.count) };
}

// --- 6. תמונות ---
function checkImages(data, cardImages) {
  const without = [];
  data.forEach((e) => { if (!hasImage(e, cardImages)) without.push({ name: e.name, cat: e.cat }); });
  return without;
}


module.exports = {
  REL_FIELDS, stripQualifier, isDescriptive, relValues, buildIndex,
  checkMissingTargets, checkSpouses, checkParentChild, checkOrphans,
  checkFields, buildBookVariantMap, diagnoseRef, checkRefs, checkImages,
};
