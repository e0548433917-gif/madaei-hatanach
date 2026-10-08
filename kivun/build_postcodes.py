"""בונה את postcodes.js: מיקוד (7 ספרות) ← נקודת מרכז, מכתובות OpenStreetMap בישראל.
גם קידומת של 5 ספרות (יישוב/אזור) כגיבוי. נתונים: © OpenStreetMap contributors, ODbL."""
import json, time, urllib.parse, urllib.request, datetime, collections

SERVERS = ["https://overpass-api.de/api/interpreter",
           "https://overpass.kumi.systems/api/interpreter",
           "https://overpass.private.coffee/api/interpreter"]
Q = ('[out:json][timeout:900][maxsize:1073741824];'
     'area["ISO3166-1"="IL"][admin_level=2]->.a;'
     'nwr["addr:postcode"~"^[0-9]{7}$"](area.a);'
     'convert pc ::id=id(),::geom=center(geom()),p=t["addr:postcode"];out geom;')


def fetch(q):
    last = None
    for rnd in range(3):
        for s in SERVERS:
            try:
                req = urllib.request.Request(s, data=urllib.parse.urlencode({"data": q}).encode(),
                                             headers={"User-Agent": "kivun-tefila-otzaria-plugin/1.3 (build)"})
                with urllib.request.urlopen(req, timeout=1000) as r:
                    return json.load(r)
            except Exception as e:
                last = e
                print("retry", s, e, flush=True)
                time.sleep(20)
        time.sleep(60 * (rnd + 1))
    raise last


import re
els = []
try:
    els = fetch(Q).get("elements", [])
except Exception as e:
    print("israel failed", e)
full, pre = collections.defaultdict(list), collections.defaultdict(list)
for e in els:
    g = e.get("geometry") or {}
    c = g.get("coordinates")
    p = (e.get("tags") or {}).get("p", "")
    if not c or len(p) != 7:
        continue
    lon, lat = c[0], c[1]
    full[p].append((lat, lon))
    pre[p[:5]].append((lat, lon))

# חו"ל: מיקודים סביב כל ריכוז קהילה מובנה (ברדיוס 6 ק"מ). מפתח: אותיות גדולות בלי רווחים;
# לבריטניה גם החלק הראשון (למשל N16).
abroad = collections.defaultdict(list)
C = json.load(open("kivun/centers.json", encoding="utf-8"))
for name, lat, lon in C:
    if 29 < lat < 34 and 34 < lon < 36:
        continue
    q = (f'[out:json][timeout:180];nwr["addr:postcode"](around:6000,{lat},{lon});'
         'convert pc ::id=id(),::geom=center(geom()),p=t["addr:postcode"];out geom;')
    try:
        res = fetch(q).get("elements", [])
    except Exception as e:
        print("abroad failed", name, e, flush=True)
        continue
    n = 0
    for e in res:
        c = (e.get("geometry") or {}).get("coordinates")
        raw = ((e.get("tags") or {}).get("p") or "").upper().strip()
        if not c or not raw or len(raw) > 10:
            continue
        k = re.sub(r"[^0-9A-Z]", "", raw)
        if not k:
            continue
        abroad[k].append((c[1], c[0]))
        if " " in raw and re.match(r"^[A-Z]{1,2}[0-9]", raw):
            abroad[raw.split()[0]].append((c[1], c[0]))
        n += 1
    print(f"{name}: {n}", flush=True)
    time.sleep(3)


def mean(v):
    return [round(sum(x[0] for x in v) / len(v), 4), round(sum(x[1] for x in v) / len(v), 4)]


F = {k: mean(v) for k, v in full.items()}
P = {k: mean(v) for k, v in pre.items()}
X = {k: mean(v) for k, v in abroad.items()}
today = datetime.date.today().isoformat()
open("kivun/postcodes.js", "w", encoding="utf-8").write(
    "/* מיקודים: © OpenStreetMap contributors, ODbL. נבנה ב-" + today + " */\nPC_PUT("
    + json.dumps({"d": today, "f": F, "p": P, "x": X}, separators=(",", ":")) + ");\n")
print(f"israel elements {len(els)}, full {len(F)}, prefix {len(P)}, abroad {len(X)}")
open("kivun/build-log.txt", "a", encoding="utf-8").write(f"postcodes: israel full {len(F)}, prefix5 {len(P)}, abroad {len(X)}\n")
