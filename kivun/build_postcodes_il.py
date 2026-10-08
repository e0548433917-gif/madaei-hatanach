"""מיקודי ישראל באריחים קטנים (0.15°): כל אריח שאילתה קצרה, והקובץ נשמר אחרי כל אריח,
כך שגם עצירה באמצע משאירה את מה שירד. נתונים: © OpenStreetMap contributors, ODbL."""
import json, time, urllib.parse, urllib.request, datetime, collections, os, subprocess

SERVERS = ["https://overpass-api.de/api/interpreter",
           "https://overpass.kumi.systems/api/interpreter",
           "https://overpass.private.coffee/api/interpreter"]
OUT = "kivun/postcodes-il.js"
full, pre = collections.defaultdict(list), collections.defaultdict(list)
done = set()
if os.path.exists("kivun/postcodes-il-state.json"):
    st = json.load(open("kivun/postcodes-il-state.json"))
    done = set(map(tuple, st["done"]))
    for k, v in st["full"].items(): full[k] = [tuple(x) for x in v]


def fetch(q):
    last = None
    for rnd in range(2):
        for s in SERVERS:
            try:
                req = urllib.request.Request(s, data=urllib.parse.urlencode({"data": q}).encode(),
                                             headers={"User-Agent": "kivun-tefila-otzaria-plugin/1.3 (build)"})
                with urllib.request.urlopen(req, timeout=200) as r:
                    return json.load(r)
            except Exception as e:
                last = e
                print("  retry", s, e, flush=True)
                time.sleep(10)
        time.sleep(30)
    raise last


def mean(v):
    return [round(sum(x[0] for x in v) / len(v), 4), round(sum(x[1] for x in v) / len(v), 4)]


LAST_PUSH = [time.time()]


def push(force=False):
    """דוחף את מה שירד עד עכשיו, כל 3 דקות, כדי שאפשר יהיה להשתמש בו גם לפני סוף הריצה."""
    if not force and time.time() - LAST_PUSH[0] < 180:
        return
    LAST_PUSH[0] = time.time()
    subprocess.run("git config user.name Claude && git config user.email noreply@anthropic.com && "
                   "git add kivun/postcodes-il.js kivun/postcodes-il-state.json && "
                   "git commit -qm 'kivun: postcodes-il.js (חלקי)' && git push -q", shell=True)


def save():
    pre.clear()
    for k, v in full.items():
        pre[k[:5]].extend(v)
    d = {"d": datetime.date.today().isoformat(), "f": {k: mean(v) for k, v in full.items()}, "p": {k: mean(v) for k, v in pre.items()}}
    open(OUT, "w", encoding="utf-8").write("/* מיקודי ישראל: © OpenStreetMap contributors, ODbL. */\nPC_PUT(" + json.dumps(d, separators=(",", ":")) + ");\n")
    json.dump({"done": sorted(done), "full": full}, open("kivun/postcodes-il-state.json", "w"))


S = 0.15
lat = 29.45
tiles = []
while lat < 33.35:
    lon = 34.2
    while lon < 35.9:
        tiles.append((round(lat, 2), round(lon, 2)))
        lon += S
    lat += S
# קודם האזורים המיושבים (מרכז, ירושלים, צפון), אחר כך הנגב
tiles.sort(key=lambda t: (t[0] < 31.2, abs(t[0] - 32.0) + abs(t[1] - 34.9)))
fails = 0
for i, (la, lo) in enumerate(tiles):
    if (la, lo) in done:
        continue
    q = (f'[out:json][timeout:180];nwr["addr:postcode"~"^[0-9]{{7}}$"]({la},{lo},{la + S},{lo + S});'
         'convert pc ::id=id(),::geom=center(geom()),p=t["addr:postcode"];out geom;')
    try:
        els = fetch(q).get("elements", [])
    except Exception as e:
        fails += 1
        print(f"tile {la},{lo} FAILED {e}", flush=True)
        continue
    for e in els:
        c = (e.get("geometry") or {}).get("coordinates")
        p = (e.get("tags") or {}).get("p", "")
        if c and len(p) == 7:
            full[p].append((c[1], c[0]))
    done.add((la, lo))
    print(f"[{i + 1}/{len(tiles)}] {la},{lo}: {len(els)} → total {len(full)} codes", flush=True)
    save()
    push()
    time.sleep(2)
save()
push(True)
open("kivun/build-log.txt", "a", encoding="utf-8").write(f"postcodes-il: tiles {len(done)}/{len(tiles)}, failed {fails}, codes {len(full)}\n")
