#!/usr/bin/env python3
"""
שחזור 101 הערכים שנמחקו ב-clean-domem-rest-2026-10-08.py (08/10/2026, לבקשת בעלת הפרויקט).
הטעות שם: ציטוט שלא נמצא נחשב כ״מקור מומצא״ — וערך שזה היה מקורו היחיד נמחק, אף שהערך
עצמו (כף, פטיש, חבית…) נכון. כאן הערך חוזר, והמקור מטופל כך:
  1. שם הערך מופיע בטקסט שבמראה המקום (ספריא) — המקור נשאר; הציטוט המנוסח נמחק (text='').
  2. לא מופיע — מחפשים את שם הערך בספריא (משנה → בבלי → תנ״ך → ירושלמי) ומחליפים במראה
     מקום אמיתי שבו השם מופיע.
  3. לא נמצא בשום מקום — ר׳ restore-domem-fix21-2026-10-08.py (חיפוש שני; נמחק רק מושג שלא נמצא או כפול).
  ציטוט שלא אומת (ציון <0.6) מרוקן אחרי השחזור.
"""
import json, re, subprocess, urllib.parse, unicodedata, sys
FILE = 'guides/domem/data/domem-data.js'
CACHE = json.load(open('/tmp/claude-0/ver/cache.json'))
REPORT = {(r['entry'], r['i']): r for r in json.load(open('/tmp/claude-0/ver/rest.json'))}

def load(src):
    st = src.index('const DATA = ') + 13
    D, end = json.JSONDecoder().raw_decode(src, st); return D, st, end
def W(s):
    s = unicodedata.normalize('NFC', re.sub(r'<[^>]+>', ' ', s or ''))
    s = re.sub('[֑-ׇ]', '', s).replace('־', ' ')
    return ' ' + ' '.join(re.sub(r'[^א-ת ]', ' ', s).split()) + ' '
def keys(e):
    base = [e['name']] + (e.get('aliases') or [])
    out = set()
    for b in base:
        w = [x for x in W(b).split() if len(x) >= 2]
        if not w: continue
        k = w[0]                                   # ״מגרפה של רועים״ → ״מגרפה״
        out |= {k, k[:-1] + {'ה': 'א', 'א': 'ה'}.get(k[-1], k[-1])}
        if len(k) > 3: out |= {k[0] + 'י' + k[1:]} # כתיב מלא: מגרפה/מגריפה
    return out
def present(e, text):
    t = W(text)
    return any(re.search(rf'[ ](?:[ובכלמשה]{{0,2}}){re.escape(k)}(?:[ות]|ים|ין|ות|יות)?[ ]', t) for k in keys(e))

def api(url, body=None):
    cmd = ['curl', '-s', '-m', '60', url] + (['-X', 'POST', '-H', 'Content-Type: application/json', '-d', json.dumps(body)] if body else [])
    try: return json.loads(subprocess.run(cmd, capture_output=True, text=True).stdout)
    except Exception: return {}
def search(e):
    for path in ('Mishnah', 'Talmud/Bavli', 'Tanakh', 'Talmud/Yerushalmi'):
        for k in sorted(keys(e), key=len, reverse=True)[:2]:
            d = api('https://www.sefaria.org/api/search-wrapper', {'query': k, 'type': 'text', 'field': 'exact', 'filters': [path], 'filter_fields': ['path'], 'size': 5})
            for h in (d.get('hits') or {}).get('hits', []):
                ref = re.sub(r' \(.*', '', h['_id'])
                t = api('https://www.sefaria.org/api/v3/texts/' + urllib.parse.quote(ref) + '?version=hebrew')
                txt = json.dumps((t.get('versions') or [{}])[0].get('text', ''), ensure_ascii=False)
                if t.get('heRef') and present(e, txt): return t['heRef']
    return None

cur_src = open(FILE, encoding='utf8').read()
CUR, st, end = load(cur_src)
OLD, _, _ = load(subprocess.run(['git', 'show', 'd86fc56^:' + FILE], capture_output=True, text=True).stdout)
have = {e['name'] for e in CUR}
log = {'restored': 0, 'kept_ref': 0, 'new_ref': 0, 'no_source': []}
for e in OLD:
    if e.get('cat') in ('colors', 'coins') or e['name'] in have: continue
    e = dict(e)
    if (e.get('identification') or '').startswith('הזיהוי עולה מהקשר המקורות'): e['identification'] = ''
    mk = []
    for i, m in enumerate(e.get('makorot') or []):
        r = REPORT.get((e['name'], i), {})
        txt = (CACHE.get(r.get('sefaria') or '') or {}).get('text') if r.get('sefaria') else None
        if r.get('sefaria') and txt is None:
            for v in CACHE.values():
                if v.get('ref') == r['sefaria']: txt = v['text']; break
        if txt and present(e, txt):
            mk.append({'ref': m['ref'], 'text': m['text'] if r.get('status') == 'ok' else ''}); log['kept_ref'] += 1
    if not mk:
        ref = search(e)
        if ref: mk.append({'ref': ref, 'text': ''}); log['new_ref'] += 1
        else: log['no_source'].append(e['name'])
    e['makorot'] = mk
    CUR.append(e); log['restored'] += 1
open(FILE, 'w', encoding='utf8').write(cur_src[:st] + json.dumps(CUR, ensure_ascii=False, separators=(',', ':')) + cur_src[end:])
print('שחזור:', {k: (len(v) if isinstance(v, list) else v) for k, v in log.items()})
print('  בלי מקור שנמצא:', ', '.join(log['no_source']))
