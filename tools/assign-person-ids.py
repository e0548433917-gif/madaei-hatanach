#!/usr/bin/env python3
"""
tools/assign-person-ids.py — ת.1ב (#67): מזהה id ייחודי לכל רשומה במדריך אישים,
וקישורי המשפחה מצביעים על id ולא על שם.

הבעיה (docs/ת0-ממצאים.md חלק א׳): ״שם״ אינו ייחודי. קישור לפי שם נצמד לאדם הלא נכון
(״רמון״ רושם ילד ״חם״ — והרשומה היחידה בשם חם היא בן נח).

מה הסקריפט עושה (אידמפוטנטי — הרצה חוזרת לא משנה id קיים):
  1. id לכל רשומה: ״p0001״…, לפי הסדר בקובץ. רשומה שכבר יש לה id שומרת אותו;
     רשומה חדשה מקבלת את המספר הבא אחרי הגבוה הקיים.
  2. relIds — לכל שדה קשר (father/mother/spouses/children/siblings) מערך מקביל
     לשמות, עם id של האדם הנכון או null כשאי אפשר להכריע בבטחה:
       • מועמדים = רשומות ששמן (בלי הסוגריים) או כינוי שלהן זהה לשם (בלי הסוגריים).
       • מועמד שבשדה הנגדי שלו רשום *אדם אחר* (לילד רשום אב אחר) — נפסל.
       • נשאר מועמד אחד → מקושר. כמה מועמדים → מעדיפים את מי שרושם אותנו בשדה
         הנגדי (הדדיות); אם עדיין יותר מאחד → null (לא מקשרים לנחש).
  3. דוח: כמה קישורים נפתרו, כמה נמנעו בגלל סתירה, כמה דו-משמעיים.

הממשק (shell/entry-detail.js) מקשר לפי relIds כשהוא קיים, ו-null = טקסט בלי קישור
— כלומר אין יותר קישור שגוי; לכל היותר חסר קישור.

  python3 tools/assign-person-ids.py            — כתיבה + דוח
  python3 tools/assign-person-ids.py --dry      — דוח בלבד
"""
import json, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILE = ROOT / 'guides/people/data/people-data.js'
DRY = '--dry' in sys.argv
FIELDS = ['father', 'mother', 'spouses', 'children', 'siblings']
RECIP = {'father': ('children',), 'mother': ('children',), 'children': ('father', 'mother'),
         'spouses': ('spouses',), 'siblings': ('siblings',)}

NIKUD = re.compile('[֑-ׇ]')
def core(s):
    s = re.sub(r'\s*\([^)]*\)\s*$', '', str(s or ''))
    s = NIKUD.sub('', unicodedata.normalize('NFC', s))
    return re.sub(r'\s+', ' ', s.replace('־', ' ')).strip()

def as_list(v):
    if isinstance(v, list): return v
    return [v] if v else []

lines = FILE.read_text(encoding='utf8').split('\n')
end = next(i for i, l in enumerate(lines) if l.startswith('];'))
recs = []   # (line index, obj, trailing comma)
for i in range(1, end):
    t = lines[i].strip()
    if not t: continue
    comma = t.endswith(',')
    recs.append([i, json.loads(t[:-1] if comma else t), comma])
data = [r[1] for r in recs]

# 1. ids
used = [int(e['id'][1:]) for e in data if re.fullmatch(r'p\d+', str(e.get('id', '')))]
nxt = max(used, default=0) + 1
for e in data:
    if not re.fullmatch(r'p\d+', str(e.get('id', ''))):
        e['id'] = 'p%04d' % nxt; nxt += 1
ids = [e['id'] for e in data]
assert len(set(ids)) == len(ids), 'id כפול'

# אינדקס שמות
by_name = {}
for e in data:
    keys = {core(e.get('name'))} | {core(a) for a in as_list(e.get('aliases'))}
    for k in keys:
        if k: by_name.setdefault(k, []).append(e)
names_of = {id(e): {core(e.get('name'))} | {core(a) for a in as_list(e.get('aliases'))} for e in data}

def lists_me(cand, me, fields):
    """True = cand רושם אותי בשדה הנגדי · False = רושם מישהו אחר · None = השדה ריק"""
    vals = [core(v) for f in fields for v in as_list(cand.get(f)) if v]
    if not vals: return None
    return any(v in names_of[id(me)] for v in vals)

stats = {'linked': 0, 'contradiction': 0, 'ambiguous': 0, 'missing': 0, 'self': 0}
for e in data:
    rel = {}
    for f in FIELDS:
        vals = as_list(e.get(f))
        if not vals: continue
        out = []
        for v in vals:
            cands = [c for c in by_name.get(core(v), []) if c is not e]
            if not cands:
                out.append(None); stats['self' if by_name.get(core(v)) else 'missing'] += 1; continue
            verdict = {id(c): lists_me(c, e, RECIP[f]) for c in cands}
            ok = [c for c in cands if verdict[id(c)] is not False]
            if not ok:
                out.append(None); stats['contradiction'] += 1; continue
            if len(ok) > 1:
                ok = [c for c in ok if 'שם משותף' not in as_list(c.get('roles'))] or ok   # טבלת מפתח
            if len(ok) > 1:
                recip = [c for c in ok if verdict[id(c)] is True]
                ok = recip if len(recip) == 1 else ok
            if len(ok) > 1:
                # ״C בן X״ — ילד של X / ״X בן Y״ כשהאב שלי הוא Y
                def ben_of(c):
                    m = re.match(r'^(\S+)\s+(?:בן|בת)\s+(.+)$', core(c.get('name')))
                    return m.group(2).strip() if m else None
                if f == 'children':
                    hit = [c for c in ok if ben_of(c) in names_of[id(e)]]
                elif f in ('siblings', 'spouses'):
                    fa = core(e.get('father'))
                    hit = [c for c in ok if fa and ben_of(c) == fa]
                else:
                    hit = []
                if len(hit) == 1: ok = hit

            if len(ok) == 1:
                out.append(ok[0]['id']); stats['linked'] += 1
            else:
                out.append(None); stats['ambiguous'] += 1
        rel[f] = out[0] if f in ('father', 'mother') and not isinstance(e.get(f), list) else out
    if rel: e['relIds'] = rel
    elif 'relIds' in e: del e['relIds']

print('ת.1ב — מזהים וקישורי משפחה (אישים):')
print(f"  רשומות {len(data)} · id ייחודי לכולן ({ids[0]}…{max(ids)})")
print(f"  קישורים שנפתרו ל-id: {stats['linked']}")
print(f"  נמנעו — סתירה (האדם בעל השם רושם מישהו אחר): {stats['contradiction']}")
print(f"  נמנעו — דו-משמעי (כמה רשומות, בלי הדדיות מכריעה): {stats['ambiguous']}")
print(f"  אין רשומה בשם הזה (ניסוח תיאורי/חסר): {stats['missing'] + stats['self']}")

if not DRY:
    for i, e, comma in recs:
        # id ראשון בסדר השדות — קריא בעין, ולא משנה שום שדה אחר
        o = {'id': e['id'], **{k: v for k, v in e.items() if k != 'id'}}
        lines[i] = json.dumps(o, ensure_ascii=False, separators=(',', ':')) + (',' if comma else '')
    FILE.write_text('\n'.join(lines), encoding='utf8')
    print(f"  נכתב: {FILE.relative_to(ROOT)}")
