"""בונה את streets-data.js: רחובות ריכוזי הקהילה מ-OpenStreetMap, להטמעה בתוסף כיוון תפילה."""
import json, time, urllib.parse, urllib.request, datetime

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
    for _ in range(2):
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
    raise last


today = datetime.date.today().isoformat()
areas = []
for name, lat, lon in C:
    r = radius(name)
    q = f'[out:json][timeout:120];way["highway"~"{HW}"]["name"](around:{r},{lat},{lon});out tags geom;'
    w = []
    try:
        els = fetch(q).get("elements", [])
    except Exception as e:
        LOG.append(f"FAILED {name}: {e}")
        continue
    for e in els:
        g = e.get("geometry") or []
        if e.get("type") != "way" or len(g) < 2:
            continue
        t = e.get("tags", {})
        w.append([t.get("name:he") or t.get("name") or "", t.get("highway", ""),
                  [v for p in g for v in (round(p["lat"], 5), round(p["lon"], 5))]])
    areas.append({"v": 1, "k": f"emb_{lat:.3f}_{lon:.3f}_{r}", "lat": lat, "lon": lon, "r": r,
                  "d": today, "name": name, "emb": 1, "w": w})
    print(f"{name}: {len(w)} ways", flush=True)
    time.sleep(3)

out = ("/* רחובות מובנים: © OpenStreetMap contributors, ODbL. נבנה ב-" + today + " */\nconst EMB_STREETS="
       + json.dumps(areas, ensure_ascii=False, separators=(",", ":")) + ";\n")
open("kivun/streets-data.js", "w", encoding="utf-8").write(out)
LOG.append(f"areas ok: {len(areas)}/{len(C)}, bytes: {len(out.encode())}")
open("kivun/build-log.txt", "w", encoding="utf-8").write("\n".join(LOG) + "\n")
print("\n".join(LOG[-5:]))
