#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Granskar defaultinställningarna för ALLA exporterade varianter.

Frågan är inte om reglerna är rimliga i teorin utan vad de faktiskt gör med
1 600 verkliga dataserier. Det syns bara genom att räkna ut vad globen skulle
se ut som — höjden per land i millimeter — och leta efter de tre sätt en
default kan gå fel på:

  PLATT     nästan alla länder inom en halv millimeter → ingen relief att se
  ENSIDIG   nollnivån ligger i kanten av skalan → allt extruderas åt ett håll
  STAVAR    några få i taket medan medianen ligger vid noll → tunna spröt

Kör:  python granska_default.py            sammanfattning
      python granska_default.py --lista    varje trasig serie
"""
import json, os, sys
import numpy as np

HER = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HER, "web", "data")
SERIER = os.path.join(WEB, "serier")
S_MM = 50.0            # globens radie i millimeter
RELIEF = 0.9 * 0.9     # globalt reliefreglage × relieffaktor


def las(vid):
    with open(os.path.join(SERIER, vid + ".json"), encoding="utf-8") as f:
        d = json.load(f)
    raw = np.fromfile(os.path.join(SERIER, vid + ".bin"), dtype=np.uint16)
    d["kub"] = raw.reshape(len(d["ar"]), d["nland"])
    return d


def matt(d, relief=None):
    """→ höjder i mm för det MITTERSTA året, plus pivotens läge på skalan."""
    t = len(d["ar"]) // 2
    v = d["kub"][t]
    v = v[v > 0]
    if not len(v):
        return None
    if relief is None:            # per-serie-normaliserad relief × reglagets standardläge
        relief = d.get("relieffaktor", 0.9) * 0.9
    n = (v - 1) / 65534.0
    tak = d.get("linjarGainHojd", 1.0)
    if tak > 1.0:                 # samma tak som shadern lägger på höjden
        n = np.minimum(n, 1.0 - np.log10(tak) / (d["vmax"] - d["vmin"]))
    gm = d["globalmedel"][t]
    span = d["vmax"] - d["vmin"]
    if d["skala"] == "log10":
        p = (np.log10(gm) - d["vmin"]) / span if gm > 0 else 0.0
    else:
        p = (gm - d["vmin"]) / span
    nollp = p if d["nollLage"] != "noll" else 0.0
    h = (n - nollp) * relief * S_MM
    return dict(h=h, n=n, pivot=p, nollp=nollp)


def diagnos(d):
    m = matt(d)
    if not m:
        return ["tom"]
    h, n, p = m["h"], m["n"], m["pivot"]
    fel = []
    if np.percentile(np.abs(h), 90) < 0.6:
        fel.append("platt")                       # 90 % ryms i 0,6 mm
    if d["nollLage"] != "noll" and not (0.06 < p < 0.94):
        fel.append("ensidig")
    # "Stavar" är inte att medianen ligger vid noll — det GÖR den, nollnivån är
    # ju satt där. Pathologin är att de allra högsta sticker upp långt över
    # resten: det är de som blir tunna spröt i utskriften.
    if len(h) > 20 and float(h.max()) > float(np.percentile(h, 99)) + 8.0:
        fel.append("stavar")
    return fel


def main():
    kat = json.load(open(os.path.join(WEB, "katalog.json"), encoding="utf-8"))
    ind = kat["indikatorer"]
    lista = "--lista" in sys.argv
    rad, trasiga = [], []
    for i, p in enumerate(ind, 1):
        try:
            d = las(p["id"])
        except Exception:
            continue
        m = matt(d)
        if not m:
            continue
        fel = diagnos(d)
        r = dict(id=p["id"], titel=p["t"], skala=d["skala"], ark=p["k"],
                 noll=d["nollLage"], norm=d.get("norm", "abs"),
                 pivot=round(m["pivot"], 3),
                 p10=round(float(np.percentile(m["h"], 10)), 2),
                 p90=round(float(np.percentile(m["h"], 90)), 2),
                 spann=round(float(np.percentile(m["h"], 95) - np.percentile(m["h"], 5)), 2),
                 hmax=round(float(m["h"].max()), 1), hmin=round(float(m["h"].min()), 1),
                 fel=fel)
        rad.append(r)
        if fel:
            trasiga.append(r)
        if i % 400 == 0:
            print(f"  {i}/{len(ind)} …", flush=True)
    json.dump(rad, open(os.path.join(HER, "default_granskning.json"), "w"), ensure_ascii=False)

    from collections import Counter
    print(f"\n{len(rad)} varianter granskade\n")
    c = Counter(f for r in rad for f in r["fel"])
    print(f"  {len(trasiga)} har minst ett problem:")
    for k, v in c.most_common():
        print(f"    {v:5d}  {k}")
    print("\nreliefspann (p5–p95) i mm, som globen ser ut idag:")
    sp = np.array([r["spann"] for r in rad])
    for q in (5, 25, 50, 75, 95):
        print(f"   p{q:<3d} {np.percentile(sp, q):7.2f} mm")
    print(f"   under 1 mm: {(sp < 1).sum()}   över 20 mm: {(sp > 20).sum()}")
    print("\npivotens läge på skalan (0 = botten, 1 = toppen):")
    pv = np.array([r["pivot"] for r in rad if r["noll"] != "noll"])
    for q in (5, 25, 50, 75, 95):
        print(f"   p{q:<3d} {np.percentile(pv, q):7.3f}")
    print("\nskala per arketyp:")
    for (a, s), v in sorted(Counter((r["ark"], r["skala"]) for r in rad).items()):
        print(f"   {a:11s} {s:8s} {v}")
    if lista:
        print("\n── de värsta ──")
        for r in sorted(trasiga, key=lambda r: r["spann"])[:40]:
            print(f"  {','.join(r['fel']):16s} spann {r['spann']:6.2f} mm  "
                  f"pivot {r['pivot']:.2f}  {r['titel'][:56]}")


if __name__ == "__main__":
    main()
