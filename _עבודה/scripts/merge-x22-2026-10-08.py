#!/usr/bin/env python3
"""#83 — שילוב מה שאומת מ-השלמת-ערכים-מורחבת-פי-22.docx (ר' verify-x22-2026-10-08.py).
מתוך 48: 35 כפולים, 7 בלי שום מקור מאומת. מה שנשאר:
  * ״שיש טהור״ — ערך חדש (metals), עם שני המקורות שאומתו.
  * ״אבוב של משה״, ״מורג חרוץ״ — וריאנטים של ״אבוב״/״מורג״ הקיימים: המקורות המאומתים מתווספים אליהם.
  * ״סלמנדרה״ (=סלמנדרא), ״אושה״ (=אושא), ״אחד עשר סממני הקטורת״ (מכוסה בקטגוריית הקטורת) — לא נכנסו."""
import json
FILE = 'guides/domem/data/domem-data.js'
V = {o['name']: o for o in json.load(open('/tmp/claude-0/ver/x22-verified.json'))}
mk = lambda n: [{'ref': m['ref'], 'text': m['text']} for m in V[n]['makorot']]
src = open(FILE, encoding='utf8').read()
st = src.index('const DATA = ') + 13
D, end = json.JSONDecoder().raw_decode(src, st)
by = {e['name']: e for e in D}
added = 0
for tgt, n in (('אבוב', 'אבוב של משה'), ('מורג', 'מורג חרוץ')):
    have = {m['ref'] for m in by[tgt].get('makorot') or []}
    for m in mk(n):
        if m['ref'] not in have: by[tgt].setdefault('makorot', []).append(m); added += 1
    al = n if n != tgt else None
    if al: by[tgt]['aliases'] = sorted(set((by[tgt].get('aliases') or []) + [al]))
if 'שיש טהור' not in by:
    o = V['שיש טהור']
    D.append({'name': 'שיש טהור', 'cat': 'metals', 'img': '', 'aliases': [], 'tribe': None,
              'explanation': o['expl'], 'identification': o['ident'], 'note': '', 'gallery': [], 'makorot': mk('שיש טהור')})
open(FILE, 'w', encoding='utf8').write(src[:st] + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + src[end:])
print('נוסף ערך: שיש טהור · מקורות שנוספו לערכים קיימים:', added)
