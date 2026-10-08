#!/usr/bin/env python3
"""
ניפוי שאר הקטגוריות במדריך דומם (08/10/2026, לבקשת בעלת הפרויקט) — בדגם
clean-colors-coins-2026-10-08.py. מבוסס על:
  python3 tools/verify-makorot-sefaria.py --cats <כל הקטגוריות חוץ מ-colors,coins> --out /tmp/claude-0/ver/rest.json

כללים (זהים לדגם, בלי טבלאות שינוי-שם ידניות):
  * ok — נשאר; fixed — מראה המקום מתוקן והטקסט מוחלף באמיתי (תנ״ך/משנה).
  * ציון 0.4–0.6 — בתנ״ך/משנה הטקסט מוחלף באמיתי; בגמרא/מדרש נשאר מראה המקום, הציטוט המומצא נמחק.
  * ציון <0.4 / מראה מקום שאינו מתפענח בספריא — נמחק.
  * משנה שלא נמצאה — חיפוש הציטוט כצירוף רציף בכל המסכת (mfixed) ותיקון מראה המקום.
  * unparsed (מפרשים, מדרשים בלי מראה מקום בר-בדיקה) — נשאר כמות שהוא (רש״י וכו׳ לא נבדקו).
  * ערך שלא נשאר לו שום מקור — נמחק.
  * identification = ״הזיהוי עולה מהקשר המקורות…״ (197 ערכים) — מרוקן.
"""
import json, re, subprocess, urllib.parse, sys
ROOT = '/home/claude/madaei-hatanach'
FILE = ROOT + '/guides/domem/data/domem-data.js'
REPORT = json.load(open('/tmp/claude-0/ver/rest.json'))
SKIP_CATS = {'colors', 'coins'}

def heb(n):
    ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']; tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ']
    if n % 100 == 15: return 'ק' * (n // 100) + 'טו'
    if n % 100 == 16: return 'ק' * (n // 100) + 'טז'
    h = 'ק' * (n // 100); n %= 100
    return h + tens[n // 10] + ones[n % 10]
EN2HE = dict(Genesis='בראשית', Exodus='שמות', Leviticus='ויקרא', Numbers='במדבר', Deuteronomy='דברים', Joshua='יהושע',
             Judges='שופטים', Isaiah='ישעיהו', Jeremiah='ירמיהו', Ezekiel='יחזקאל', Hosea='הושע', Joel='יואל', Amos='עמוס',
             Obadiah='עובדיה', Jonah='יונה', Micah='מיכה', Nahum='נחום', Habakkuk='חבקוק', Zephaniah='צפניה', Haggai='חגי',
             Zechariah='זכריה', Malachi='מלאכי', Psalms='תהלים', Proverbs='משלי', Job='איוב', Ruth='רות', Lamentations='איכה',
             Ecclesiastes='קהלת', Esther='אסתר', Daniel='דניאל', Ezra='עזרא', Nehemiah='נחמיה')
EN2HE.update({'I Samuel': 'שמואל א', 'II Samuel': 'שמואל ב', 'I Kings': 'מלכים א', 'II Kings': 'מלכים ב',
              'I Chronicles': 'דברי הימים א', 'II Chronicles': 'דברי הימים ב', 'Song of Songs': 'שיר השירים'})
TANAKH_RE = '|'.join(sorted(map(re.escape, EN2HE), key=len, reverse=True))
def he_ref(sef):
    m = re.match(rf'^({TANAKH_RE}) (\d+):(\d+)$', sef)
    if m: return f"{EN2HE[m.group(1)]} {heb(int(m.group(2)))}, {heb(int(m.group(3)))}"
    m = re.match(r'^(.+) (\d+)([ab])$', sef)   # בבלי — נשאר בצורת ספריא אם אין מיפוי
    return None

def clean_text(t):
    t = re.sub(r'<[^>]+>', '', t); t = re.sub(r'&[a-z]+;', ' ', t)
    t = re.sub('[֑-֯]', '', t)
    return re.sub(r'\s+', ' ', t).strip()
def real_text(sef):
    url = 'https://www.sefaria.org/api/v3/texts/' + urllib.parse.quote(sef) + '?version=hebrew'
    r = subprocess.run(['curl', '-s', '-m', '40', url], capture_output=True, text=True)
    try: t = json.loads(r.stdout)['versions'][0]['text']
    except Exception: return None
    if isinstance(t, list): t = ' '.join(x if isinstance(x, str) else ' '.join(x) for x in t)
    return clean_text(t) or None

ACTION = {}
for r in REPORT:
    k = (r['entry'], r['i']); st = r['status']; s = r.get('score') or 0
    sef = r.get('fix') or r.get('sefaria') or ''
    simple = bool(re.match(rf'^({TANAKH_RE}|Mishnah) ', sef)) and ':' in sef
    if st == 'mfixed':                       # משנה: הציטוט נמצא כצירוף רציף במשנה אחרת באותה מסכת
        ACTION[k] = ('keep', r['heref'], None); continue
    if st == 'unparsed':
        ACTION[k] = ('keep', None, None)
    elif st in ('ok', 'fixed') or s >= 0.4:
        if not sef or not re.search(r'\d', sef):     # פוענח לספר שלם — לא מראה מקום אמיתי
            ACTION[k] = ('drop',); continue
        newref = he_ref(r['fix']) if st == 'fixed' else None
        if st == 'fixed' and not newref and not simple: ACTION[k] = ('keep', None, None); continue
        if simple and (st == 'fixed' or s < 0.6): ACTION[k] = ('keep', newref, real_text(sef))
        elif s < 0.6 and st != 'fixed': ACTION[k] = ('keep', None, '')
        else: ACTION[k] = ('keep', newref, None)
    else:
        ACTION[k] = ('drop',)

src = open(FILE, encoding='utf8').read()
start = src.index('const DATA = ') + len('const DATA = ')
DATA, endpos = json.JSONDecoder().raw_decode(src, start)
out, log = [], {'dropped_src': 0, 'fixed_ref': 0, 'real_text': 0, 'quote_removed': 0, 'id_emptied': 0, 'dropped_entries': []}
for e in DATA:
    if e.get('cat') in SKIP_CATS: out.append(e); continue
    if (e.get('identification') or '').startswith('הזיהוי עולה מהקשר המקורות'):
        e['identification'] = ''; log['id_emptied'] += 1
    mk = []
    for i, m in enumerate(e.get('makorot') or []):
        a = ACTION.get((e['name'], i), ('keep', None, None))
        if a[0] == 'drop': log['dropped_src'] += 1; continue
        m = dict(m)
        if a[1]: m['ref'] = a[1]; log['fixed_ref'] += 1
        if a[2] is not None:
            m['text'] = a[2]
            log['real_text' if a[2] else 'quote_removed'] += 1
        mk.append(m)
    had = bool(e.get('makorot'))
    e['makorot'] = mk
    if had and not mk: log['dropped_entries'].append(e['name']); continue
    out.append(e)

new = src[:start] + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + src[endpos:]
if '--dry' not in sys.argv: open(FILE, 'w', encoding='utf8').write(new)
print('ניפוי שאר דומם:', {k: (len(v) if isinstance(v, list) else v) for k, v in log.items()})
print('  ערכים שנמחקו:', ', '.join(log['dropped_entries']))
