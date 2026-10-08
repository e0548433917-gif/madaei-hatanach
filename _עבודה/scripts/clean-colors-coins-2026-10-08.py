#!/usr/bin/env python3
"""
ניפוי קטגוריות ״צבעים״ ו״מטבעות ומידות כסף״ במדריך דומם (08/10/2026, לבקשת בעלת הפרויקט).
מבוסס על אימות מול ספריא: tools/verify-makorot-sefaria.py --cats colors,coins.

כללים:
  * מקור שהציטוט שלו נמצא (ok) — נשאר; בתנ״ך/משנה הציטוט מוחלף בטקסט האמיתי.
  * מראה מקום שהציטוט נמצא בסמוך (fixed) — מתוקן, והטקסט מוחלף באמיתי.
  * ציון חלקי (0.4–0.6) — מראה המקום נכון, הציטוט מנוסח מחדש: בתנ״ך/משנה הטקסט מוחלף
    באמיתי; בגמרא/מדרש — נשאר מראה המקום, הציטוט המומצא נמחק.
  * ציון 0 / ספר שאינו קיים (״שמות רבתי״, ״פסיקתא דשמעוני״) / מראה מקום שבור — נמחק.
  * ערך שלא נשאר לו שום מקור, או כפילות של ערך קיים — נמחק.
  * שם = השם עצמו, בלי תיאור בסוגריים; חלופות אמיתיות עוברות ל-aliases.
"""
import json, re, subprocess, urllib.parse, unicodedata, sys
ROOT = '/home/claude/madaei-hatanach'
FILE = ROOT + '/guides/domem/data/domem-data.js'
REPORT = json.load(open('/tmp/claude-0/ver/cc.json'))
CACHE = json.load(open('/tmp/claude-0/ver/cache.json'))

HEB_NUM = {}
def heb(n):
    ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']; tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ']
    if n == 15: return 'טו'
    if n == 16: return 'טז'
    h = 'ק' * (n // 100); n %= 100
    return h + tens[n // 10] + ones[n % 10]
EN2HE = {'Genesis': 'בראשית', 'Exodus': 'שמות', 'Leviticus': 'ויקרא', 'Numbers': 'במדבר', 'Deuteronomy': 'דברים',
         'Nahum': 'נחום', 'Proverbs': 'משלי'}
def he_ref(sef):
    m = re.match(r'^(\w+) (\d+):(\d+)$', sef)
    if m and m.group(1) in EN2HE: return f"{EN2HE[m.group(1)]} {heb(int(m.group(2)))}, {heb(int(m.group(3)))}"
    return None

def clean_text(t):
    t = re.sub(r'<[^>]+>', '', t); t = re.sub(r'&[a-z]+;', ' ', t)
    t = re.sub('[֑-֯]', '', t)       # טעמים בלבד — הניקוד נשאר
    return re.sub(r'\s+', ' ', t).strip()
def real_text(sef):
    url = 'https://www.sefaria.org/api/v3/texts/' + urllib.parse.quote(sef) + '?version=hebrew'
    r = subprocess.run(['curl', '-s', '-m', '40', url], capture_output=True, text=True)
    try: t = json.loads(r.stdout)['versions'][0]['text']
    except Exception: return None
    if isinstance(t, list): t = ' '.join(x if isinstance(x, str) else ' '.join(x) for x in t)
    return clean_text(t)

ACTION = {}   # (entry, i) -> ('keep', newref|None, newtext|None) | ('drop',)
for r in REPORT:
    k = (r['entry'], r['i']); st = r['status']; s = r.get('score') or 0
    sef = r.get('fix') or r.get('sefaria') or ''
    tanakh_or_mishnah = bool(re.match(r'^(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Nahum|Proverbs|Mishnah) ', sef))
    if st == 'unparsed':
        ACTION[k] = ('keep', None, None) if r['ref'].startswith('רש״י') else ('drop',)
    elif st in ('ok', 'fixed') or s >= 0.4:
        if not sef or sef in ('Exodus',):   # ״שמות, רבתי״ פוענח כספר שמות כולו
            ACTION[k] = ('drop',); continue
        newref = he_ref(r['fix']) if st == 'fixed' else None
        if tanakh_or_mishnah and (st == 'fixed' or s < 0.6):
            ACTION[k] = ('keep', newref, real_text(sef) or None)
        elif s < 0.6 and st != 'fixed':
            ACTION[k] = ('keep', None, '')     # גמרא/מדרש: מראה מקום נכון, הציטוט לא
        else:
            ACTION[k] = ('keep', newref, None)
    else:
        ACTION[k] = ('drop',)

RENAME = {
    'אדמדם / ורוד': ('אדמדם', []), 'זהוב / פז': ('ירקרק', ['ירקרק חרוץ']),
    'חוור (לבן-חיוור)': ('חוור', []), 'חלמוני (צהוב-חלמון)': ('חלמוני', []),
    'חשמל (זהב-פלאי / זהר)': ('חשמל', None), 'ירוק / ירק': ('ירוק', ['ירק']),
    'ירוק ככרתי (ירוק-כהה)': ('ירוק ככרתי', []), 'שני / תולעת שני': ('שני', ['תולעת שני']),
    'שחור-אדום (כחמץ)': ('שחור-אדום', []), 'דינר זהב (זהוב)': ('דינר זהב', ['זהוב']),
}
# כפילויות של ערכים קיימים (מנת ״פי 22״ של גמיני) ותיאורים שאינם שם צבע
DROP = {'שש (לבן-שן)': 'שש', 'פתוח (תערובת צבעים)': None, 'תכלת-כחול (אבן ספיר)': None,
        'תרשיש (ירוק-ים / פירוז)': None, 'סגול-ארגמן (נופך / אחלמה)': None,
        'מעה (גרה)': None, 'דינר / זוז (כסף)': None, 'מחצית השקל (בקע)': None, 'סלע / שקל צורי': None,
        'אדרכון / דרכמון': None, 'דרכמון (יווני)': None, 'ככר (חול)': None, 'ככר של קודש': None}
BOILER_EXP = re.compile(r'^גוון (?:ה|המ)?(?:נ|מ)?וזכר במקורות שלהלן:\s*|^גוון הנזכר במקורות שלהלן:\s*')
BOILER_ID = 'זיהוי הגוון עולה מהקשר המקורות שלהלן (ר\' רשימת המקורות).'

src = open(FILE, encoding='utf8').read()
start = src.index('const DATA = ') + len('const DATA = ')
DATA, endpos = json.JSONDecoder().raw_decode(src, start)
out, log = [], {'dropped_src': 0, 'fixed_ref': 0, 'real_text': 0, 'dropped_entries': [], 'renamed': 0, 'merged': 0}
by_name = {e['name']: e for e in DATA}
for e in DATA:
    if e.get('cat') not in ('colors', 'coins'): out.append(e); continue
    mk = []
    for i, m in enumerate(e.get('makorot') or []):
        a = ACTION.get((e['name'], i), ('keep', None, None))
        if a[0] == 'drop': log['dropped_src'] += 1; continue
        m = dict(m)
        if a[1]: m['ref'] = a[1]; log['fixed_ref'] += 1
        if a[2] is not None: m['text'] = a[2]; log['real_text'] += 1 if a[2] else 0
        mk.append(m)
    e['makorot'] = mk
    if e['name'] in DROP:
        tgt = DROP[e['name']]
        if tgt and tgt in by_name and mk:
            by_name[tgt]['makorot'] = (by_name[tgt].get('makorot') or []) + mk; log['merged'] += 1
        log['dropped_entries'].append(e['name']); continue
    if not mk:
        log['dropped_entries'].append(e['name']); continue
    if e['name'] in RENAME:
        nn, al = RENAME[e['name']]
        e['name'] = nn
        if al is not None: e['aliases'] = sorted(set((e.get('aliases') or []) + al))
        log['renamed'] += 1
    if e.get('explanation'): e['explanation'] = BOILER_EXP.sub('', e['explanation']).strip()
    if (e.get('identification') or '').startswith(('זיהוי הגוון עולה מהקשר', 'הזיהוי עולה מהקשר')): e['identification'] = ''
    out.append(e)

new = src[:start] + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + src[endpos:]
if '--dry' not in sys.argv: open(FILE, 'w', encoding='utf8').write(new)
print('ניפוי צבעים/מטבעות:', {k: (len(v) if isinstance(v, list) else v) for k, v in log.items()})
print('  ערכים שנמחקו:', ', '.join(log['dropped_entries']))
