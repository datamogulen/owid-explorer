#!/usr/bin/env python3
"""Hämtar den fulla CSV:n för ALLA kandidatserier ur inventeringen.

CSV-cachen ligger i ~/Development/Data/OWID_explorer/csv — utanför projektet,
utanför git och utanför OneDrive (stora filer hör inte hemma i någon av dem).

Körs om utan kostnad: redan hämtade filer hoppas över. Går det sönder mitt i
är det bara att starta igen.
"""
import json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

HER = os.path.dirname(os.path.abspath(__file__))
CSV = os.path.expanduser("~/Development/Data/OWID_explorer/csv")
UA = "klimatglober/1.0 (hedin.it; bjornh@kth.se)"
GRAPHER = "https://ourworldindata.org/grapher/{}.csv?csvType=full&useColumnShortNames=true"


def hamta(slug):
    p = os.path.join(CSV, slug + ".csv")
    if os.path.exists(p) and os.path.getsize(p) > 40:
        return "cache"
    req = urllib.request.Request(GRAPHER.format(slug), headers={"User-Agent": UA})
    for forsok in range(3):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                t = r.read().decode("utf-8", "replace")
            if not t.strip():
                return "tom"
            with open(p, "w", encoding="utf-8") as f:
                f.write(t)
            return "ny"
        except urllib.error.HTTPError as e:
            if e.code in (404, 500):
                return "saknas"
            time.sleep(2 + forsok * 3)
        except Exception:
            time.sleep(2 + forsok * 3)
    return "fel"


if __name__ == "__main__":
    os.makedirs(CSV, exist_ok=True)
    kand = json.load(open(os.path.join(HER, "kandidater.json")))
    slugs = [r["slug"] for r in kand]
    print(f"{len(slugs)} kandidatserier", flush=True)
    n = {}
    with ThreadPoolExecutor(max_workers=6) as ex:
        for i, r in enumerate(ex.map(hamta, slugs), 1):
            n[r] = n.get(r, 0) + 1
            if i % 100 == 0:
                mb = sum(os.path.getsize(os.path.join(CSV, f)) for f in os.listdir(CSV)) / 1e6
                print(f"  {i}/{len(slugs)}  {n}  {mb:.0f} MB", flush=True)
    print(f"KLART: {n}", flush=True)
