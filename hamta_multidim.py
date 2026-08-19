#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Hämtar OWID:s flerdimensionella diagram, som hela pipelinen hittills missat.

OWID har börjat slå ihop familjer av diagram till EN sida med rullgardiner:
"Energy mix" är inte längre trettio separata grafer utan en graf med valen
metric = total | per person | andel och source = totalt | fossilt | kol | sol …
Den gamla adressen /grapher/per-capita-energy-use 301:ar numera till
/grapher/energy-mix?metric=per_capita&source=total.

För oss blev de osynliga. hamta_katalog.py frågar efter <slug>.config.json,
och för de här sidorna finns ingen sådan fil — servern svarar 404, skriptet
skrev "null" i cachen och gick vidare. Fyrtio diagram försvann på det viset,
och det är inte vilka fyrtio som helst: energimixen, elmixen, Gini, Palma,
förmögenhetsandelar, läskunnighet, skolgång, plast i haven, naturkatastrofer.
Alltså stora delar av både den ekonomiska och den sociala hållbarheten.

Konfigurationen finns ändå — inbäddad i sidans HTML som
window._OWID_MULTI_DIM_PROPS. Varje "view" där är ett eget landvist diagram
med egen titel, egen enhet och egna frågeparametrar till CSV-endpointen.
Skriptet plockar ut dem och skriver dem som vanliga poster som resten av
pipelinen kan läsa.

    python3 hamta_multidim.py              # config + CSV för alla vyer med kartflik
    python3 hamta_multidim.py --bara-lista # räkna vyer, hämta inga CSV:er
"""
import json, os, re, sys, time, urllib.parse, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

HER = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HER, "cache")
CSV_CACHE = os.path.expanduser("~/Development/Data/OWID_explorer/csv")
UT = os.path.join(HER, "multidim.json")
UA = "klimatglober/1.0 (hedin.it; bjornh@kth.se)"


def hamta(url, binart=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for forsok in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(1 + forsok * 2)
        except Exception:
            time.sleep(1 + forsok * 2)
    return None


def nullslugs():
    """De slugs som hamta_katalog.py markerade som 404 — kandidaterna."""
    mapp = os.path.join(CACHE, "config.json")
    ut = []
    for f in sorted(os.listdir(mapp)):
        if not f.endswith(".json"):
            continue
        try:
            if json.load(open(os.path.join(mapp, f))) is None:
                ut.append(f[:-5])
        except Exception:
            pass
    return ut


def multidim(slug):
    """→ configObj ur sidans HTML, eller None om det inte är ett flerdim-diagram."""
    h = hamta(f"https://ourworldindata.org/grapher/{slug}")
    if not h:
        return None
    h = h.decode("utf-8", "replace")
    m = h.find("window._OWID_MULTI_DIM_PROPS")
    if m < 0:
        return None
    try:
        obj, _ = json.JSONDecoder().raw_decode(h[h.index("{", m):])
    except ValueError:
        return None
    return obj.get("configObj")


def dimnamn(cfg):
    """slug → läsbart namn, för både dimension och val."""
    dn, vn = {}, {}
    for d in cfg.get("dimensions") or []:
        dn[d["slug"]] = d.get("name", d["slug"])
        for c in d.get("choices") or []:
            vn[(d["slug"], c["slug"])] = c.get("name", c["slug"])
    return dn, vn


def vyer(slug, cfg):
    """Alla landvisa vyer som egna poster."""
    dn, vn = dimnamn(cfg)
    bastitel = (cfg.get("title") or {}).get("title") or slug
    ut = []
    for v in cfg.get("views") or []:
        c = v.get("config") or {}
        if not c.get("hasMapTab"):
            continue                       # OWID:s egen markering: datan är landvis
        dims = v.get("dimensions") or {}
        # id måste vara filnamnssäkert och stabilt mellan körningar
        svans = "_".join(f"{k}-{dims[k]}" for k in sorted(dims))
        vid = re.sub(r"[^a-z0-9_\-]", "-", f"{slug}__{svans}".lower())
        # titeln ska gå att skilja från syskonen i en lista på tusen serier
        etiketter = [vn.get((k, dims[k]), dims[k]) for k in sorted(dims)]
        titel = c.get("title") or bastitel
        # indikator-id:t leder till enhet och källa via OWID:s metadata-API —
        # de finns inte i vy-configen, bara i indikatorn bakom den
        ind = ((v.get("indicators") or {}).get("y") or [{}])[0]
        ut.append({
            "id": vid, "slug": slug, "dims": dims,
            "indikator": ind.get("id"), "catalogPath": ind.get("catalogPath"),
            "topicTags": cfg.get("topicTags") or [],
            "titel": titel, "etiketter": etiketter,
            "fulltitel": f"{titel} — {' · '.join(etiketter)}",
            "underrubrik": c.get("subtitle") or "",
            "note": c.get("note") or "",
            "originUrl": c.get("originUrl") or f"https://ourworldindata.org/grapher/{slug}",
            "csv": f"https://ourworldindata.org/grapher/{slug}.csv?"
                   + urllib.parse.urlencode({**dims, "csvType": "full",
                                             "useColumnShortNames": "true"}),
        })
    return ut


def hamta_csv(post):
    p = os.path.join(CSV_CACHE, post["id"] + ".csv")
    if os.path.exists(p) and os.path.getsize(p) > 200:
        return "cache"
    d = hamta(post["csv"])
    if not d:
        return "fel"
    os.makedirs(CSV_CACHE, exist_ok=True)
    with open(p, "wb") as f:
        f.write(d)
    return "ny"


def main():
    bara_lista = "--bara-lista" in sys.argv
    kand = nullslugs()
    print(f"{len(kand)} slugs utan config — kandidater för flerdim", flush=True)
    alla, flerdim = [], 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        for slug, cfg in zip(kand, ex.map(multidim, kand)):
            if not cfg:
                print(f"  {slug}: inte flerdim", flush=True)
                continue
            v = vyer(slug, cfg)
            flerdim += 1
            print(f"  {slug}: {len(cfg.get('views') or [])} vyer, {len(v)} landvisa", flush=True)
            alla += v
    json.dump(alla, open(UT, "w"), ensure_ascii=False, indent=1)
    print(f"\n{flerdim} flerdimensionella diagram → {len(alla)} landvisa vyer\nskrev {UT}")
    if bara_lista:
        return
    n = {"cache": 0, "ny": 0, "fel": 0}
    with ThreadPoolExecutor(max_workers=6) as ex:
        for i, r in enumerate(ex.map(hamta_csv, alla), 1):
            n[r] += 1
            if i % 100 == 0:
                print(f"  csv {i}/{len(alla)}  {n}", flush=True)
    print(f"KLART csv: {n}")


if __name__ == "__main__":
    main()
