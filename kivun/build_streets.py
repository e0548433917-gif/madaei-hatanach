"""בונה את streets-data.js: רחובות ריכוזי הקהילה מ-OpenStreetMap, להטמעה בתוסף כיוון תפילה."""
import json, math, os, re, time, urllib.parse, urllib.request, datetime

SERVERS = ["https://overpass-api.de/api/interpreter",
           "https://overpass.kumi.systems/api/interpreter",
           "https://overpass.private.coffee/api/interpreter",
           "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
LOG = []
HW_ALL = "^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian|road|service|track|path|footway|steps|cycleway)(_link)?$"
HW = "^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian|road)(_link)?$"
C = json.load(open("kivun/centers.json", encoding="utf-8"))


def radius(name):
    a = next(c for c in C if c[0] == name)
    if not (29 < a[1] < 34 and 34 < a[2] < 36):
        return 3500
    return 1200  # יישובים קטנים: רדיוס קטן, כולל מבנים ושבילים


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
        w.append([t.get("name:he") or t.get("name") or "", t.get("highway") or ("building" if "building" in t else ""),
                  [v for p in g for v in (round(p["lat"], 5), round(p["lon"], 5))]])
    return w


def get_area(lat, lon, r):
    """יישובים קטנים: כל הדרכים והשבילים (גם בלי שם) וקווי המתאר של המבנים."""
    q = lambda A: f'[out:json][timeout:120];(way["highway"~"{HW_ALL}"]({A});way["building"]({A}););out tags geom;'
    try:
        return ways_of(fetch(q(f"around:{r},{lat},{lon}")).get("elements", []), lat, lon, r, set())
    except Exception as e:
        LOG.append(f"whole area failed, trying tiles: {e}")
    dla, dlo = r / 110540, r / (111320 * math.cos(math.radians(lat)))
    seen, w = set(), []
    for i in range(3):
        for j in range(3):
            s_, w_ = lat - dla + 2 * dla * i / 3, lon - dlo + 2 * dlo * j / 3
            bb = f"{s_:.5f},{w_:.5f},{s_ + 2 * dla / 3:.5f},{w_ + 2 * dlo / 3:.5f}"
            w += ways_of(fetch(q(bb)).get("elements", []), lat, lon, r, seen)
            time.sleep(3)
    return w


# מיקום יישוב שלא ידוע מראש (למשל בית חלקיה): לפי צומת place ב-OpenStreetMap
for c in C:
    if c[1] is None:
        try:
            el = fetch(f'[out:json][timeout:60];node["place"]["name"="{c[0]}"](29,34,34,36);out;').get("elements", [])
            c[1], c[2] = round(el[0]["lat"], 4), round(el[0]["lon"], 4)
            LOG.append(f"geocoded {c[0]}: {c[1]},{c[2]}")
        except Exception as e:
            LOG.append(f"geocode failed {c[0]}: {e}")
C = [c for c in C if c[1] is not None]


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
