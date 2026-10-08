#!/usr/bin/env python3
"""#83 — אימות 48 הערכים של השלמת-ערכים-מורחבת-פי-22.docx מול ספריא ודה-דופ מול הדאטה.
מקור נשמר רק אם המילה הראשית של אחד משמות הערך מופיע בטקסט שבמראה המקום; ציטוט נשמר רק אם נמצא שם."""
import json, re, sys
sys.argv = ['x', '--cats', 'x', '--out', '/dev/null']
src = open('tools/verify-makorot-sefaria.py', encoding='utf8').read().split('# הדאטה נטען')[0]
V = {'__file__': 'tools/verify-makorot-sefaria.py'}; exec(src, V)
N = set(json.load(open('/tmp/claude-0/ver/names.json')))
PL = open('guides/places/data/places.js', encoding='utf8').read()
T = json.load(open('/tmp/claude-0/ver/x22.json'))
out = []
for ti, t in enumerate(T):
    for r in t[1:]:
        nm, refs, quote, ident, expl = r[:5]
        variants = [v.strip() for v in re.split(r'[/,()]|\s ו(?=\S)', nm) if v.strip()]
        dup = [v for v in variants if v in N or f'"{v}"' in PL]
        row = {'table': ti, 'name': nm, 'variants': variants, 'dup': dup, 'ident': ident, 'expl': expl, 'makorot': []}
        if not dup:
            for i, ref in enumerate(x.strip() for x in refs.split(';')):
                sref, kind = V['norm_ref'](ref)
                if not sref or not re.search(r'[א-ת]\s*$|\d', ref) : continue
                d = V['fetch'](sref)
                if not d['ref'] or not re.search(r'\d', d['ref']): continue
                txt = ' '.join(V['words'](d['text']))
                keys = {w for v in variants for w in V['words'](v)[:1] if len(w) >= 3}
                keys |= {k[:-1] + {'ה': 'א', 'א': 'ה'}.get(k[-1], k[-1]) for k in keys}   # אושה/אושא
                if not any(k in txt for k in keys): continue
                q = quote.strip('"״ .…') if i == 0 else ''
                s = V['score'](q, d['text']) if q else None
                row['makorot'].append({'ref': ref, 'sefaria': d['ref'], 'text': q if s and s >= 0.8 else ''})
        out.append(row)
json.dump(out, open('/tmp/claude-0/ver/x22-verified.json', 'w'), ensure_ascii=False, indent=1)
ok = [o for o in out if o['makorot']]
print(f"סה״כ {len(out)} · כפולים {sum(1 for o in out if o['dup'])} · אומתו {len(ok)}")
for o in ok: print(' ', o['table'], o['name'], [m['ref'] + ('✓ציטוט' if m['text'] else '') for m in o['makorot']])
