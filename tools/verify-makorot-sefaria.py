#!/usr/bin/env python3
"""
tools/verify-makorot-sefaria.py — אימות מראי מקום ב-makorot מול הטקסט עצמו (ספריא).

לכל מקור: פענוח מראה המקום → שליפת הטקסט מ-Sefaria → בדיקה שהציטוט (text) אכן
מופיע בו. אם לא — מחפשים את הציטוט בפרק/בעמודים הסמוכים ומציעים תיקון.
  python3 tools/verify-makorot-sefaria.py --cats colors,coins [--guide domem] --out report.json
סיווג: ok · fixed (נמצא במקום אחר קרוב — מוצע תיקון) · notfound · unparsed (אין מראה מקום בר-בדיקה).
"""
import json, re, sys, subprocess, urllib.parse, unicodedata, os, argparse, time
ap = argparse.ArgumentParser()
ap.add_argument('--guide', default='domem'); ap.add_argument('--cats', required=True); ap.add_argument('--out', required=True)
A = ap.parse_args()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILE = {'domem': 'guides/domem/data/domem-data.js'}[A.guide]
CACHE = '/tmp/claude-0/ver/cache.json'
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}

def strip(s):
    s = re.sub(r'<[^>]+>', ' ', s); s = unicodedata.normalize('NFC', s)
    s = re.sub('[֑-ׇ]', '', s).replace('־', ' ')
    return re.sub(r'[^א-ת ]', ' ', s)
def words(s): return [w for w in strip(s).split() if len(w) >= 2]
def flat(t):
    if isinstance(t, list): return ' '.join(flat(x) for x in t)
    return str(t or '')
def fetch(ref):
    if ref in cache: return cache[ref]
    url = 'https://www.sefaria.org/api/v3/texts/' + urllib.parse.quote(ref) + '?version=hebrew'
    r = subprocess.run(['curl', '-s', '-m', '40', url], capture_output=True, text=True)
    try: d = json.loads(r.stdout)
    except Exception: d = {}
    out = {'ref': d.get('ref'), 'text': flat((d.get('versions') or [{}])[0].get('text', '')) if d.get('ref') else ''}
    cache[ref] = out; return out

TANAKH = set('בראשית שמות ויקרא במדבר דברים יהושע שופטים שמואל מלכים ישעיהו ירמיהו יחזקאל הושע יואל עמוס עובדיה יונה מיכה נחום חבקוק צפניה חגי זכריה מלאכי תהלים תהילים משלי איוב שיר רות איכה קהלת אסתר דניאל עזרא נחמיה דברי'.split())
def norm_ref(raw):
    r = raw.strip().replace('״', '"').replace('׳', "'")
    r = re.sub(r'\bדף\s+', '', r)
    corpus = None
    m = re.match(r'^(בבלי|משנה|ירושלמי|תוספתא)\s*,?\s*(.*)$', r)
    if m: corpus, r = m.group(1), m.group(2)
    r = r.replace(',', ' ')
    r = re.sub(r'([א-ת]+)\.(?=\s|$)', r'\1 א', r); r = re.sub(r'([א-ת]+):(?=\s|$)', r'\1 ב', r)
    r = re.sub(r'ע"א', 'א', r); r = re.sub(r'ע"ב', 'ב', r)
    r = re.sub(r'\s+', ' ', r).strip()
    first = r.split(' ')[0] if r else ''
    if corpus is None and first not in TANAKH:
        # מסכת בלי ״בבלי״ — נבדק כבבלי אם יש דף+עמוד
        if re.search(r' [א-ת]{1,3} [אב]$', r): corpus = 'בבלי'
        else: return None, None
    if corpus == 'משנה': return 'משנה ' + r, 'mishnah'
    if corpus == 'ירושלמי': return 'ירושלמי ' + r, 'yerushalmi'
    if corpus == 'תוספתא': return 'תוספתא ' + r, 'tosefta'
    if corpus == 'בבלי': return r, 'bavli'
    return r, 'tanakh'

def score(quote, text):
    q = [w for w in words(quote) if w not in ('וכו', 'וגו')]
    if not q: return None
    t = set(words(text)); tj = ' '.join(words(text))
    hit = sum(1 for w in q if w in t or (len(w) > 3 and w in tj))
    return hit / len(q)

def neighbours(ref, kind, sref):
    """מראי מקום סמוכים לחיפוש — פרק שלם בתנ״ך, ±2 עמודים בבבלי"""
    if not sref: return []
    out = []
    if kind == 'tanakh':
        m = re.match(r'^(.*) (\d+):(\d+)$', sref)
        if m: out.append(m.group(1) + ' ' + m.group(2))
    elif kind == 'bavli':
        m = re.match(r'^(.*) (\d+)([ab])$', sref)
        if m:
            n = int(m.group(2)) * 2 + (m.group(3) == 'b')
            for d in (-2, -1, 1, 2):
                k = n + d; out.append(f"{m.group(1)} {k // 2}{'b' if k % 2 else 'a'}")
    return out

def find_in(container_ref, quote):
    d = fetch(container_ref)
    if not d['ref']: return None
    if ':' in (d['ref'] or '') or re.search(r'\d+[ab]$', d['ref']):
        s = score(quote, d['text']); return (d['ref'], s) if s and s >= 0.6 else None
    # פרק — מחפשים פסוק
    url = 'https://www.sefaria.org/api/v3/texts/' + urllib.parse.quote(container_ref) + '?version=hebrew'
    r = subprocess.run(['curl', '-s', '-m', '40', url], capture_output=True, text=True)
    try: vs = json.loads(r.stdout)['versions'][0]['text']
    except Exception: return None
    best = None
    for i, v in enumerate(vs if isinstance(vs, list) else []):
        s = score(quote, flat(v))
        if s and s >= 0.6 and (not best or s > best[1]): best = (f"{d['ref']}:{i+1}", s)
    return best

# הדאטה נטען דרך tools/lib/load.js (קובץ ה-data אינו JSON-לשורה בכל המדריכים)
DATA = json.loads(subprocess.run(['node', '-e', 'const {loadDataFile}=require("./tools/lib/load");process.stdout.write(JSON.stringify(loadDataFile(process.argv[1]).DATA))', FILE],
                                 capture_output=True, text=True, cwd=ROOT).stdout)
cats = set(A.cats.split(','))
report = []
for e in DATA:
    if e.get('cat') not in cats: continue
    for j, mk in enumerate(e.get('makorot') or []):
        ref, quote = mk.get('ref', ''), mk.get('text', '')
        sref, kind = norm_ref(ref)
        row = {'entry': e['name'], 'cat': e['cat'], 'i': j, 'ref': ref, 'quote': quote[:90]}
        if not sref or not quote:
            row['status'] = 'unparsed'; report.append(row); continue
        d = fetch(sref); row['sefaria'] = d['ref']
        s = score(quote, d['text']) if d['ref'] else None
        row['score'] = s
        if s is not None and s >= 0.6: row['status'] = 'ok'
        else:
            fix = None
            for nb in neighbours(ref, kind, d['ref']):
                fix = find_in(nb, quote)
                if fix: break
            if fix: row['status'] = 'fixed'; row['fix'] = fix[0]
            else: row['status'] = 'notfound'
        report.append(row)
json.dump(cache, open(CACHE, 'w'), ensure_ascii=False)
json.dump(report, open(A.out, 'w'), ensure_ascii=False, indent=1)
from collections import Counter
c = Counter(r['status'] for r in report)
print('אימות מקורות מול ספריא:', dict(c), '· סה״כ', len(report))
