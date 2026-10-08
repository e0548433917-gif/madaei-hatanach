"""מיקודי חו"ל לפי ריכוז קהילה, עם שמות הרחובות שבכל מיקוד.
אותו מיקוד יכול להופיע בכמה ארצות (למשל 2018 באנטוורפן ובסידני) — לכן נשמר בנפרד לכל אזור.
פלט: PC_PUT({"y": {"קוד": [[lat, lon, "אזור", ["רחוב", ...]], ...]}}). נתונים: © OpenStreetMap contributors, ODbL."""
import json, re, time, urllib.parse, urllib.request, datetime, collections, subprocess

SERVERS = ["https://overpass-api.de/api/interpreter",
           "https://overpass.kumi.systems/api/interpreter",
           "https://overpass.private.coffee/api/interpreter"]
C = json.load(open("kivun/centers.json", encoding="utf-8"))
Y = collections.defaultdict(list)
T0 = [time.time()]


def fetch(q):
    last = None
    for rnd in range(2):
        for s in SERVERS:
            try:
                req = urllib.request.Request(s, data=urllib.parse.urlencode({"data": q}).encode(),
                                             headers={"User-Agent": "kivun-tefila-otzaria-plugin/1.5 (build)"})
                with urllib.request.urlopen(req, timeout=200) as r:
                    return json.load(r)
            except Exception as e:
                last = e
                print("  retry", s, e, flush=True)
                time.sleep(10)
        time.sleep(30)
    raise last


def save(final=False):
    open("kivun/postcodes-abroad2.js", "w", encoding="utf-8").write(
        "/* מיקודי חו\"ל: © OpenStreetMap contributors, ODbL. */\nPC_PUT(" + json.dumps({"d": datetime.date.today().isoformat(), "y": Y}, ensure_ascii=False, separators=(",", ":")) + ");\n")
    if final or time.time() - T0[0] > 300:
        T0[0] = time.time()
        subprocess.run("git config user.name Claude && git config user.email noreply@anthropic.com && git add kivun/postcodes-abroad2.js && "
                       "git commit -qm 'kivun: postcodes-abroad2.js' && git push -q", shell=True)


for name, lat, lon in C:
    if 29 < lat < 34 and 34 < lon < 36:
        continue
    q = (f'[out:json][timeout:180];nwr["addr:postcode"](around:6000,{lat},{lon});'
         'convert pc ::id=id(),::geom=center(geom()),p=t["addr:postcode"],s=t["addr:street"];out geom;')
    try:
        res = fetch(q).get("elements", [])
    except Exception as e:
        print("FAILED", name, e, flush=True)
        continue
    by = collections.defaultdict(lambda: [[], collections.Counter()])
    for e in res:
        c = (e.get("geometry") or {}).get("coordinates")
        t = e.get("tags") or {}
        raw = (t.get("p") or "").upper().strip()
        if not c or not raw or len(raw) > 10:
            continue
        keys = [re.sub(r"[^0-9A-Z]", "", raw)]
        if " " in raw and re.match(r"^[A-Z]{1,2}[0-9]", raw):
            keys.append(raw.split()[0])
        for k in keys:
            if not k:
                continue
            by[k][0].append((c[1], c[0]))
            if t.get("s"):
                by[k][1][t["s"]] += 1
    for k, (pts, st) in by.items():
        Y[k].append([round(sum(p[0] for p in pts) / len(pts), 4), round(sum(p[1] for p in pts) / len(pts), 4), name, [s for s, _ in st.most_common(4)]])
    print(f"{name}: {len(by)} codes", flush=True)
    save()
    time.sleep(3)
save(True)
