#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gör OWID:s flerdimensionella vyer till vanliga kandidater för exporten.

hamta_multidim.py har redan plockat ut vyerna och hämtat deras CSV:er. Här
sätts resten av det exporten behöver: enhet, källa, tidsspann, ämne — och
framför allt en TITEL som går att skilja från syskonen.

Titeln är knepigare än den ser ut. OWID:s vy-config kallar både
"Primary energy use per person / Total" och ".../ Coal" för "Primary energy
use per person". I en lista på tvåtusen serier blir det obrukbart. Regeln
här: behåll vyns egen titel när den är unik, och lägg annars bara till de
dimensionsetiketter som faktiskt skiljer syskonen åt — inte alla.

    python3 bygg_kandidater_multidim.py            # skriver kandidater.json
    python3 bygg_kandidater_multidim.py --torr     # visa bara vad som skulle läggas till
"""
import csv, json, os, re, sys, time, urllib.request, urllib.error
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

HER = os.path.dirname(os.path.abspath(__file__))
CSV_CACHE = os.path.expanduser("~/Development/Data/OWID_explorer/csv")
METACACHE = os.path.join(HER, "cache", "indikator")
UA = "klimatglober/1.0 (hedin.it; bjornh@kth.se)"

# OWID:s topicTags → samma kategorinamn som resten av katalogen använder
KATEGORI = {
    "Energy": "Energy and Environment", "Environment": "Energy and Environment",
    "Plastic Pollution": "Energy and Environment",
    "Natural Disasters": "Energy and Environment",
    "Fossil Fuels": "Energy and Environment",
    "Education": "Human Development", "Global Education": "Human Development",
    "Literacy": "Human Development", "Migration": "Human Development",
    "Vaccination": "Health", "Fertilizers": "Food and Agriculture",
    "Religion": "Human Development",
}


def indikatormeta(iid):
    """Enhet, namn och källa för en OWID-indikator. Cachas: 750 anrop annars."""
    if not iid:
        return {}
    os.makedirs(METACACHE, exist_ok=True)
    p = os.path.join(METACACHE, f"{iid}.json")
    if os.path.exists(p):
        try:
            return json.load(open(p))
        except Exception:
            pass
    url = f"https://api.ourworldindata.org/v1/indicators/{iid}.metadata.json"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for forsok in range(3):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                d = json.loads(r.read())
            json.dump(d, open(p, "w"))
            return d
        except urllib.error.HTTPError as e:
            if e.code == 404:
                json.dump({}, open(p, "w"))
                return {}
            time.sleep(1 + forsok * 2)
        except Exception:
            time.sleep(1 + forsok * 2)
    return {}


def csv_spann(vid):
    """(förstaår, sistaår, antal år med data) ur den hämtade CSV:en."""
    p = os.path.join(CSV_CACHE, vid + ".csv")
    if not os.path.exists(p):
        return None
    ar = set()
    with open(p, encoding="utf-8", errors="replace") as f:
        d = csv.DictReader(f)
        falt = {k.lower(): k for k in (d.fieldnames or [])}
        kAr, kKod = falt.get("year"), falt.get("code")
        varden = [k for k in (d.fieldnames or [])
                  if k.lower() not in ("entity", "code", "year")]
        if not (kAr and kKod and varden):
            return None
        kV = varden[0]
        for rad in d:
            kod = (rad.get(kKod) or "").strip()
            if len(kod) != 3 or not (rad.get(kV) or "").strip():
                continue
            try:
                ar.add(int(rad[kAr]))
            except ValueError:
                pass
    return (min(ar), max(ar), len(ar)) if ar else None


# OWID märker en del per-capita-vyer med enheten för TÄLJAREN bara:
# "Electricity generation per person" har enheten "kilowatt-hours", utan
# nämnare. Det syns direkt i utforskaren — kvoten mellan två sådana serier
# blev "1 per person" i stället för dimensionslös. Nämnaren står i titeln, så
# den får hämtas därifrån.
PER_I_TITEL = re.compile(
    r"\bper\s+((?:[\d\s,.]+\s*)?(?:capita|persons?|people|inhabitants?))", re.I)


def komplettera_enhet(enhet, titel):
    if re.search(r"\bper\b", enhet or "", re.I):
        return enhet
    m = PER_I_TITEL.search(titel or "")
    return f"{enhet} per {m.group(1).strip()}".strip() if m and enhet else enhet


def titlar(vyer):
    """Unika, läsbara titlar. Bara de dimensioner som skiljer syskon åt läggs till."""
    per_titel = defaultdict(list)
    for v in vyer:
        per_titel[v["titel"]].append(v)
    ut = {}
    for titel, grupp in per_titel.items():
        if len(grupp) == 1:
            ut[grupp[0]["id"]] = titel
            continue
        # vilka dimensioner varierar inom gruppen?
        nycklar = sorted({k for v in grupp for k in v["dims"]})
        varierar = [k for k in nycklar
                    if len({v["dims"].get(k) for v in grupp}) > 1]
        for v in grupp:
            ordning = sorted(v["dims"])
            etik = [e for k, e in zip(ordning, v["etiketter"]) if k in varierar]
            ut[v["id"]] = f"{titel} — {' · '.join(etik)}" if etik else titel
    return ut


def main():
    torr = "--torr" in sys.argv
    vyer = json.load(open(os.path.join(HER, "multidim.json")))
    namn = titlar(vyer)

    with ThreadPoolExecutor(max_workers=8) as ex:
        metor = list(ex.map(lambda v: indikatormeta(v.get("indikator")), vyer))

    nya, utan_csv = [], 0
    for v, meta in zip(vyer, metor):
        sp = csv_spann(v["id"])
        if not sp:
            utan_csv += 1
            continue
        fran, till, nar = sp
        disp = meta.get("display") or {}
        enhet = komplettera_enhet(disp.get("unit") or meta.get("unit") or "",
                                  namn[v["id"]])
        kallor = meta.get("origins") or []
        kalla = "; ".join(dict.fromkeys(
            (o.get("producer") or "").strip() for o in kallor if o.get("producer"))) \
            or (meta.get("datasetName") or "Our World in Data")
        taggar = v.get("topicTags") or []
        nya.append({
            "slug": v["id"],                   # = filnamnet i CSV-cachen
            "titel": namn[v["id"]],
            "enhet": enhet,
            "fran": fran, "till": till, "ar": nar,
            "kalla": kalla,
            "beskr": (meta.get("descriptionShort") or v.get("underrubrik") or ""),
            "topics": [t.lower().replace(" ", "-") for t in taggar] or [v["slug"]],
            "kategori": next((KATEGORI[t] for t in taggar if t in KATEGORI),
                             "Energy and Environment"),
            # så att "Undersök källa" pekar rätt trots att slug:en är påhittad
            "grafUrl": f"https://ourworldindata.org/grapher/{v['slug']}?"
                       + "&".join(f"{k}={x}" for k, x in sorted(v["dims"].items())),
            "amneUrl": v.get("originUrl"),
        })

    print(f"{len(nya)} vyer med data ({utan_csv} saknar CSV)")
    utan_enhet = sum(1 for n in nya if not n["enhet"])
    print(f"  {utan_enhet} utan enhet")
    for n in nya[:6]:
        print(f"    {n['fran']}–{n['till']} ({n['ar']} år)  {n['titel'][:62]}  [{n['enhet'][:20]}]")

    if torr:
        return
    p = os.path.join(HER, "kandidater.json")
    gamla = json.load(open(p))
    behall = [k for k in gamla if "__" not in k["slug"]]   # rensa ev. tidigare körning
    json.dump(behall + nya, open(p, "w"), ensure_ascii=False)
    print(f"kandidater.json: {len(behall)} + {len(nya)} = {len(behall) + len(nya)}")


if __name__ == "__main__":
    main()
