#!/usr/bin/env python3
"""Metadata säger att datan är landvis och historisk. Den säger inget om hur
MÅNGA länder som faktiskt har värden, hur tät serien är, eller vilken arketyp
våra regler skulle välja. Det syns bara i datan — så här hämtas den för ett
stratifierat urval (de N bäst täckta per ämne) och mäts på riktigt."""
import csv, io, json, os, re, sys, urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import numpy as np

HER = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HER, "cache", "csv")
UA = "klimatglober/1.0 (hedin.it; bjornh@kth.se)"
GRAPHER = "https://ourworldindata.org/grapher/{}.csv?csvType=full&useColumnShortNames=true"
PER_TOPIC = int(sys.argv[1]) if len(sys.argv) > 1 else 2

EJ_LAND = re.compile(r"^(World|Africa|Asia|Europe|North America|South America|Oceania|"
                     r"European Union|High-income|Low-income|Lower-middle|Upper-middle|"
                     r".*\(WB\)|.*\(WHO\)|.*\(UN\)|.*\(UNAIDS\)|.*\(FAO\)|.* countries)$")


def hamta_csv(slug):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, slug + ".csv")
    if os.path.exists(p):
        return open(p, encoding="utf-8", errors="replace").read()
    req = urllib.request.Request(GRAPHER.format(slug), headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            t = r.read().decode("utf-8", "replace")
    except Exception as e:
        return ""
    open(p, "w", encoding="utf-8").write(t)
    return t


def mat(rad):
    t = hamta_csv(rad["slug"])
    if not t:
        return None
    d = list(csv.DictReader(io.StringIO(t)))
    if not d:
        return None
    # ?useColumnShortNames=true ger gemena rubriker (entity,code,year,<kort>)
    fait = {k.lower(): k for k in d[0]}
    kEnt, kKod, kAr = fait.get("entity"), fait.get("code"), fait.get("year")
    kol = [k for k in d[0] if k.lower() not in ("entity", "code", "year")]
    if not kol or not kKod:
        return None
    v = kol[0]
    lander, ar_per_land, varden = set(), defaultdict(int), []
    for r in d:
        kod, ent = (r.get(kKod) or "").strip(), (r.get(kEnt) or "").strip()
        if len(kod) != 3 or EJ_LAND.match(ent) or kod == "OWID_WRL":
            continue
        try:
            x = float(r[v])
        except (TypeError, ValueError):
            continue
        lander.add(kod); ar_per_land[kod] += 1; varden.append(x)
    if len(lander) < 20 or not varden:
        return dict(rad, lander=len(lander), duger=False, skal="under 20 länder")
    a = np.array(varden, float)
    a = a[np.isfinite(a)]
    p99, p5 = float(np.percentile(np.abs(a), 99)), float(np.percentile(np.abs(a), 5))
    med = float(np.median(np.abs(a))) or 1.0
    svans = p99 / p5 if p5 > 0 else p99 / med
    if (a < 0).any():
        ark = "signerad"
    elif "%" in (rad["enhet"] or "") and float(np.percentile(a, 95)) > 40:
        ark = "andel"
    elif svans > 25:
        ark = "tungsvans"
    else:
        ark = "intervall"
    return dict(rad, lander=len(lander), duger=True,
                ar_median=int(np.median(list(ar_per_land.values()))),
                arketyp=ark, svans=round(svans, 1),
                lag=round(float(np.min(a)), 4), hog=round(float(np.max(a)), 4))


if __name__ == "__main__":
    kand = json.load(open(os.path.join(HER, "kandidater.json")))
    per = defaultdict(list)
    for r in kand:
        for t in (r["topics"] or ["(otaggad)"]):
            per[t].append(r)
    urval, sedda = [], set()
    for t, rs in per.items():
        for r in sorted(rs, key=lambda r: (-r["ar"], -r["till"]))[:PER_TOPIC]:
            if r["slug"] not in sedda:
                sedda.add(r["slug"]); urval.append(r)
    print(f"{len(urval)} diagram i urvalet ({PER_TOPIC} per ämne)", flush=True)
    ut = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        for i, r in enumerate(ex.map(mat, urval), 1):
            if r: ut.append(r)
            if i % 25 == 0: print(f"  {i}/{len(urval)}", flush=True)
    json.dump(ut, open(os.path.join(HER, "verifierade.json"), "w"), ensure_ascii=False, indent=1)
    ok = [r for r in ut if r.get("duger")]
    print(f"\n{len(ok)} av {len(ut)} klarar ≥20 länder")
    import collections
    print("arketyper:", collections.Counter(r["arketyp"] for r in ok).most_common())
    print("länder (median):", int(np.median([r["lander"] for r in ok])))
    print("år per land (median):", int(np.median([r["ar_median"] for r in ok])))
