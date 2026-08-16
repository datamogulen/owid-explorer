#!/usr/bin/env python3
"""Hämtar OWID:s hela diagramkatalog (config + metadata) till ./cache.

config.json  (~1–3 kB)  → hasMapTab = OWID:s egen markering att datan är
                          LANDVIS (kartfliken finns bara då) + titel + originUrl
metadata.json (~4 kB)   → enhet, tidsspann, källa, beskrivning

Återupptagbart: filer som redan finns hämtas inte om.
"""
import json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

HER = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HER, "cache")
UA = "klimatglober/1.0 (hedin.it; bjornh@kth.se)"
BAS = "https://ourworldindata.org/grapher/{}{}"


def hamta(slug, andelse):
    mapp = os.path.join(CACHE, andelse.strip("."))
    os.makedirs(mapp, exist_ok=True)
    p = os.path.join(mapp, slug + ".json")
    if os.path.exists(p):
        return "cache"
    req = urllib.request.Request(BAS.format(slug, andelse), headers={"User-Agent": UA})
    for forsok in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            json.loads(data)                       # kasta om det inte är JSON
            with open(p, "wb") as f:
                f.write(data)
            return "ny"
        except urllib.error.HTTPError as e:
            if e.code == 404:
                open(p, "w").write("null")         # finns inte — markera och gå vidare
                return "404"
            time.sleep(1 + forsok * 2)
        except Exception:
            time.sleep(1 + forsok * 2)
    return "fel"


def kor(slugs, andelse, trad=8):
    n = {"cache": 0, "ny": 0, "404": 0, "fel": 0}
    with ThreadPoolExecutor(max_workers=trad) as ex:
        for i, r in enumerate(ex.map(lambda s: hamta(s, andelse), slugs), 1):
            n[r] += 1
            if i % 250 == 0:
                print(f"  {andelse} {i}/{len(slugs)}  {n}", flush=True)
    print(f"KLART {andelse}: {n}", flush=True)
    return n


if __name__ == "__main__":
    slugs = open(os.path.join(HER, "slugs.txt")).read().split()
    print(f"{len(slugs)} slugs", flush=True)
    kor(slugs, ".config.json")
    # metadata bara för de som har kartflik = landvis data
    kart = []
    for s in slugs:
        p = os.path.join(CACHE, "config.json", s + ".json")
        try:
            d = json.load(open(p))
        except Exception:
            continue
        if d and d.get("hasMapTab"):
            kart.append(s)
    print(f"{len(kart)} av {len(slugs)} har kartflik (landvis data)", flush=True)
    open(os.path.join(HER, "kartslugs.txt"), "w").write("\n".join(kart))
    kor(kart, ".metadata.json")
