"""בונה את streets-data.js: רחובות ריכוזי הקהילה מ-OpenStreetMap, להטמעה בתוסף כיוון תפילה."""
import json, math, os, re, time, urllib.parse, urllib.request, datetime

SERVERS = ["https://overpass-api.de/api/interpreter",
           "https://overpass.kumi.systems/api/interpreter",
           "https://overpass.private.coffee/api/interpreter",
           "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
LOG = []
HW = "^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian|road)(_link)?$"
C = json.load(open("kivun/centers.json", encoding="utf-8"))


def radius(name):
    return 1500 if name.startswith("ירושלים") else 2000


def fetch(q):
    last = None
    for rnd in range(3):
        for s in SERVERS:
            try:
                req = urllib.request.Request(
                    s, data=urllib.parse.urlencode({"data": q}).encode(),
                    headers={"User-Agent": "kivun-tefila-otzaria-plugin/1.2 (build; github.com/e0548433917-gif/otzaria)",
                         "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"})
                with urllib.request.urlopen(req, timeout=180) as r:
                    return json.load(r)
            except Exception as e:
                last = e
                body = ""
                try: body = e.read()[:300].decode("utf-8", "replace")
                except Exception: pass
                LOG.append(f"{s}: {e} {body}")
                print("  retry", s, e, flush=True)
                time.sleep(5)
        time.sleep(30 * (rnd + 1))
    raise last


# מצב השלמה: אם קיים קובץ נתונים, מורידים רק אזורים חסרים ושומרים את הקיימים.
today = datetime.date.today().isoformat()
have = {}
if os.path.exists("kivun/streets-data.js"):
    txt = open("kivun/streets-data.js", encoding="utf-8").read()
    for a in json.loads(re.search(r"EMB_STREETS=(\[.*\]);", txt, re.S).group(1)):
        have[a["name"]] = a
LOG.append(f"existing areas: {len(have)}")


def ways_of(els, lat, lon, r, seen):
    w = []
    for e in els:
        g = e.get("geometry") or []
        if e.get("type") != "way" or len(g) < 2 or e.get("id") in seen:
            continue
        if not any(math.hypot((p["lat"] - lat) * 110540, (p["lon"] - lon) * 111320 * math.cos(math.radians(lat))) <= r for p in g):
            continue
        seen.add(e.get("id"))
        t = e.get("tags", {})
        w.append([t.get("name:he") or t.get("name") or "", t.get("highway", ""),
                  [v for p in g for v in (round(p["lat"], 5), round(p["lon"], 5))]])
    return w


def get_area(lat, lon, r):
    sel = f'way["highway"~"{HW}"]["name"]'
    try:
        return ways_of(fetch(f'[out:json][timeout:120];{sel}(around:{r},{lat},{lon});out tags geom;').get("elements", []), lat, lon, r, set())
    except Exception as e:
        LOG.append(f"whole area failed, trying tiles: {e}")
    dla, dlo = r / 110540, r / (111320 * math.cos(math.radians(lat)))
    seen, w = set(), []
    for i in range(3):
        for j in range(3):
            s_, w_ = lat - dla + 2 * dla * i / 3, lon - dlo + 2 * dlo * j / 3
            bb = f"{s_:.5f},{w_:.5f},{s_ + 2 * dla / 3:.5f},{w_ + 2 * dlo / 3:.5f}"
            w += ways_of(fetch(f'[out:json][timeout:90];{sel}({bb});out tags geom;').get("elements", []), lat, lon, r, seen)
            time.sleep(3)
    return w


areas = []
for name, lat, lon in C:
    if name in have:
        areas.append(have[name])
        continue
    r = radius(name)
    try:
        w = get_area(lat, lon, r)
    except Exception as e:
        LOG.append(f"FAILED {name}: {e}")
        continue
    areas.append({"v": 1, "k": f"emb_{lat:.3f}_{lon:.3f}_{r}", "lat": lat, "lon": lon, "r": r,
                  "d": today, "name": name, "emb": 1, "w": w})
    LOG.append(f"{name}: {len(w)} ways")
    print(f"{name}: {len(w)} ways", flush=True)
    time.sleep(5)

# בתי כנסת לכל אזור (שאילתה קטנה, נקודת מרכז בלבד)
for a in areas:
    if "s" in a:
        continue
    q = f'[out:json][timeout:90];nwr["amenity"="place_of_worship"]["religion"="jewish"](around:{a["r"]},{a["lat"]},{a["lon"]});out center tags;'
    try:
        els = fetch(q).get("elements", [])
    except Exception as e:
        LOG.append(f"SYN FAILED {a['name']}: {e}")
        continue
    sy = []
    for e in els:
        la, lo = (e.get("lat"), e.get("lon")) if "lat" in e else ((e.get("center") or {}).get("lat"), (e.get("center") or {}).get("lon"))
        if la is None:
            continue
        t = e.get("tags", {})
        sy.append([t.get("name:he") or t.get("name") or "", round(la, 5), round(lo, 5)])
    a["s"] = sy
    LOG.append(f"syn {a['name']}: {len(sy)}")
    print(f"syn {a['name']}: {len(sy)}", flush=True)
    time.sleep(2)

out = ("/* רחובות מובנים: © OpenStreetMap contributors, ODbL. נבנה ב-" + today + " */\nconst EMB_STREETS="
       + json.dumps(areas, ensure_ascii=False, separators=(",", ":")) + ";\n")
open("kivun/streets-data.js", "w", encoding="utf-8").write(out)
LOG.append(f"areas ok: {len(areas)}/{len(C)}, bytes: {len(out.encode())}")
open("kivun/build-log.txt", "w", encoding="utf-8").write("\n".join(LOG) + "\n")
print("\n".join(LOG[-5:]))
