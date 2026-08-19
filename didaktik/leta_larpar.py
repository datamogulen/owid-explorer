#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Letar upp de seriepar som FAKTISKT lär ut något om korrelation och kausalitet.

Bakgrunden: nästan allt korrelerar med välstånd. Utbildning, hälsa, energi,
internet, sanitet — hundratals mått följs åt tvärs över länder därför att de
alla mäter samma bakomliggande sak, hur rikt landet är. En elev som hittar
"r = 0,85 mellan internet och förväntad livslängd!" har inte upptäckt ett
samband; hen har återupptäckt BNP.

Poängen med skriptet är att inte GISSA fram undervisningsexempel utan mäta
fram dem. För varje par räknas

    r          vanlig korrelation mellan länderna ett givet år
    r_partiell samma korrelation när log(BNP/person) hålls konstant

och paren sorteras i tre pedagogiskt olika högar:

    KOLLAPS    starkt r som nästan försvinner när välståndet hålls konstant.
               Skolexempel på skenbart samband. Det här är guldet.
    ROBUST     starkt r som står kvar. Kontrastfallet — utan det lär sig
               eleven bara "allt är BNP", vilket är lika fel som motsatsen.
    VÄNDNING   r byter tecken när välståndet hålls konstant. Sällsynt och
               omtumlande: sambandet pekade åt fel håll.

Partiell korrelation kontrollerar LINJÄRT för EN variabel. Den identifierar
inte orsaker — den visar hur mycket av sambandet som överlever en bestämd
kontroll. Det är precis den nyansen eleven ska öva på, så skriptet ska inte
låtsas vara mer än så.

    python3 leta_larpar.py            # skriver larpar.json + en läsbar rapport
"""
import json, os, re, sys, itertools
import numpy as np

HER = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HER, "..", "web", "data")

AR = 2019            # nyaste året med bred täckning i de flesta serier
MIN_LAND = 45        # färre än så och r blir för skakigt för att undervisa på
# Två störfaktorer, inte en. Den berömda är välståndet — nästan allt som mäter
# utveckling följer BNP/person. Den ännu mer triviala är LANDETS STORLEK: två
# absoluta tal (totala utsläpp, antal sålda elbilar) korrelerar starkt bara för
# att Kina är stort och Island litet. Vilken av dem man ska misstänka avgörs av
# om måtten är intensiva eller extensiva — och det är precis den matematiken
# eleven ska lära sig.
# Två störfaktorer — men de ska hanteras på HELT olika sätt, och det är den
# viktigaste didaktiska poängen i hela materialet:
#
#   STORLEKEN   två absoluta tal korrelerar för att Kina är stort och Island
#               litet. Det botas inte med statistik utan med ARITMETIK: byt
#               nämnare, räkna per person. Verktyget har redan den knappen, så
#               eleven kan se sambandet dö i realtid när måttet blir rättvist.
#   VÄLSTÅNDET  när måtten väl är per person följer de flesta ändå BNP/person.
#               Det går inte att dividera bort — det måste HÅLLAS KONSTANT.
#
# Skillnaden är själva lärdomen: en störfaktor du kan normalisera bort, och en
# du bara kan kontrollera för.
KONTROLL_VALSTAND = "gdp-per-capita-penn-world-table"


def las_katalog():
    k = json.load(open(os.path.join(DATA, "katalog.json")))
    return k["indikatorer"], k["trad"], k["iso"], k["namn"]


def las_serie(sid):
    m = json.load(open(os.path.join(DATA, "serier", sid + ".json")))
    v = np.fromfile(os.path.join(DATA, "serier", sid + ".bin"), np.uint16)
    v = v.reshape(len(m["ar"]), m["nland"])
    n = (v.astype(np.float64) - 1) / 65534
    fys = m["vmin"] + n * (m["vmax"] - m["vmin"])
    if m["skala"] == "log10":
        fys = 10.0 ** fys
    fys[v == 0] = np.nan
    return m, fys


def rad_for(m, ar):
    return m["ar"].index(ar) if ar in m["ar"] else None


def valj_variant(rad):
    """En serie per indikator. Per-capita först: det är det jämförbara måttet
    mellan länder, och det är i det måttet frågorna ställs."""
    v = rad.get("v") or [{"id": rad["id"], "n": "abs"}]
    for pref in ("capita", "andel", "km2", "abs"):
        for x in v:
            if x["n"] == pref:
                return x["id"]
    return rad["id"]


def residual(y, X):
    """y renset från allt X kan förklara linjärt (minsta kvadrat, med intercept)."""
    A = np.column_stack([np.ones(len(y))] + list(X))
    koef, *_ = np.linalg.lstsq(A, y, rcond=None)
    return y - A @ koef


def r_hallet_konstant(x, y, kontroller):
    """Korrelation mellan x och y när allt i `kontroller` hålls konstant.
    Residualmetoden i stället för den slutna partiella formeln: den skalar till
    flera kontroller utan att bli en formelhög."""
    if not kontroller:
        rx, ry = x, y
    else:
        rx, ry = residual(x, kontroller), residual(y, kontroller)
    if rx.std() < 1e-12 or ry.std() < 1e-12:
        return None
    r = float(np.corrcoef(rx, ry)[0, 1])
    return r if np.isfinite(r) else None


def main():
    ind, trad, iso, namn = las_katalog()
    per_id = {r["id"]: r for r in ind}

    # ämne + kategori per serie, för att kunna märka upp de tre hållbarhets-
    # dimensionerna längre fram
    amne, kategori = {}, {}
    for kat in trad:
        for a in kat["amnen"]:
            for s in a["serier"]:
                amne[s] = a["topic"]
                kategori[s] = kat["kategori"]

    # kontrollvariablerna, båda i log-rymd: både inkomst- och storlekseffekter
    # är multiplikativa, inte additiva
    def kontrollserie(sid):
        m, F = las_serie(sid)
        t = rad_for(m, AR)
        if t is None:
            sys.exit(f"kontrollserien {sid} saknar {AR}")
        v = np.log10(F[t])
        v[~np.isfinite(v)] = np.nan
        return v
    valstand = kontrollserie(KONTROLL_VALSTAND)

    # kandidater: en variant per indikator, tillräcklig täckning det året
    sedda, kand = set(), []
    for r in ind:
        gid = tuple(sorted(x["id"] for x in (r.get("v") or [{"id": r["id"]}])))
        if gid in sedda:
            continue
        sedda.add(gid)
        sid = valj_variant(r)
        if sid == KONTROLL_VALSTAND or sid not in per_id:
            continue
        try:
            m, F = las_serie(sid)
        except FileNotFoundError:
            continue
        t = rad_for(m, AR)
        if t is None:
            continue
        rad = F[t]
        ok = np.isfinite(rad) & np.isfinite(valstand)
        if ok.sum() < MIN_LAND:
            continue
        # den absoluta syskonvarianten, om den finns: utan den går storleks-
        # fällan inte att demonstrera
        absid, absrad = None, None
        for x in (r.get("v") or []):
            if x["n"] == "abs" and x["id"] != sid:
                try:
                    ma, FA = las_serie(x["id"])
                except FileNotFoundError:
                    break
                ta = rad_for(ma, AR)
                if ta is not None:
                    absid, absrad = x["id"], FA[ta]
                break
        kand.append({"id": sid, "titel": per_id[sid]["t"], "enhet": per_id[sid].get("e", ""),
                     "amne": amne.get(sid, amne.get(r["id"], "")),
                     "kategori": kategori.get(sid, kategori.get(r["id"], "")),
                     "v": rad, "absid": absid, "absv": absrad})
    print(f"{len(kand)} serier med ≥{MIN_LAND} länder {AR} och känd BNP/person")

    # r mot kontrollvariablerna, en gång per serie
    for c in kand:
        ok = np.isfinite(c["v"]) & np.isfinite(valstand)
        c["ok"] = ok
        c["rz"] = float(np.corrcoef(c["v"][ok], valstand[ok])[0, 1])

    # Serier som i praktiken ÄR kontrollvariabeln (BNP/person, BNI/person,
    # produktion per arbetad timme) måste bort. Att hålla välståndet konstant
    # när ena axeln är välståndet lämnar nästan ingen varians kvar, och den
    # partiella korrelationen blir en kvot mellan två brusrester — det var
    # därför de fyllde vändningslistan med r som växte över sitt eget tak.
    fore = len(kand)
    kand = [c for c in kand if abs(c["rz"]) < 0.90]
    print(f"{fore - len(kand)} serier utesluts: för nära BNP/person (|r| ≥ 0,90) "
          f"för att kunna partialiseras bort")

    def korr(x, y):
        if x.std() < 1e-12 or y.std() < 1e-12:
            return None
        r = float(np.corrcoef(x, y)[0, 1])
        return r if np.isfinite(r) else None

    par = []
    for a, b in itertools.combinations(kand, 2):
        ok = a["ok"] & b["ok"]
        n = int(ok.sum())
        if n < MIN_LAND:
            continue
        x, y = a["v"][ok], b["v"][ok]
        r = korr(x, y)
        if r is None or abs(r) >= 0.95:      # dubbletter: samma mått två gånger
            continue
        rv = r_hallet_konstant(x, y, [valstand[ok]])
        if rv is None:
            continue
        # samma par i ABSOLUT form: hur mycket av sambandet var bara storlek?
        rabs = None
        if a["absv"] is not None and b["absv"] is not None:
            oa = np.isfinite(a["absv"]) & np.isfinite(b["absv"])
            if oa.sum() >= MIN_LAND:
                rabs = korr(a["absv"][oa], b["absv"][oa])
        par.append({"r": r, "rv": rv, "rabs": rabs, "n": n, "a": a["id"], "b": b["id"],
                    "aAbs": a["absid"], "bAbs": b["absid"]})
    print(f"{len(par)} par utvärderade")

    def post(p):
        A, B = per_id[p["a"]], per_id[p["b"]]
        kvar = lambda x: round(abs(x) / abs(p["r"]), 3) if abs(p["r"]) > 1e-9 else None
        return {"a": p["a"], "b": p["b"], "ta": A["t"], "tb": B["t"],
                "ea": A.get("e", ""), "eb": B.get("e", ""),
                "aAbs": p["aAbs"], "bAbs": p["bAbs"],
                "r": round(p["r"], 3), "rValstand": round(p["rv"], 3),
                "rAbsolut": None if p["rabs"] is None else round(p["rabs"], 3),
                "kvarValstand": kvar(p["rv"]), "n": p["n"],
                "amneA": amne.get(p["a"], ""), "amneB": amne.get(p["b"], ""),
                "katA": kategori.get(p["a"], ""), "katB": kategori.get(p["b"], "")}

    # Fattigdoms- och inkomstmått ÄR välstånd mätt på ett annat sätt. Att hålla
    # välståndet konstant i ett sådant samband är cirkulärt: det försvinner per
    # konstruktion, och eleven lär sig ingenting om skenbara samband.
    CIRKULART = {"poverty", "economic-growth", "economic-inequality",
                 "economic-inequality-by", "income-inequality"}
    def duger(d):
        return (d["amneA"] != d["amneB"]
                and d["amneA"] not in CIRKULART and d["amneB"] not in CIRKULART)

    dugliga = [d for d in (post(p) for p in par) if duger(d)]
    STARK = 0.70

    # 1. Storleksfällan: starkt i absolut form, borta när måtten blir per person.
    #    Botas med aritmetik — byt nämnare.
    storlek = [d for d in dugliga if d["rAbsolut"] is not None
               and abs(d["rAbsolut"]) >= STARK and abs(d["r"]) <= 0.25]
    # 2. Välståndsfällan: starkt även per person, men dör när BNP/person hålls
    #    konstant. Går inte att dividera bort — måste kontrolleras för.
    valstand_f = [d for d in dugliga if abs(d["r"]) >= STARK
                  and abs(d["rValstand"]) <= 0.20]
    # 3. Överlever kontrollen. Kontrastfallet: utan det lär sig eleven bara
    #    "allt är BNP", vilket är lika fel som motsatsen.
    overlever = [d for d in dugliga if abs(d["r"]) >= STARK
                 and abs(d["rValstand"]) >= 0.60]
    # 4. Vändning: sambandet byter tecken.
    vandning = [d for d in dugliga if abs(d["r"]) >= 0.35
                and abs(d["rValstand"]) >= 0.30 and d["r"] * d["rValstand"] < 0]

    storlek.sort(key=lambda d: (-abs(d["rAbsolut"]), abs(d["r"])))
    valstand_f.sort(key=lambda d: (-abs(d["r"]), abs(d["rValstand"])))
    overlever.sort(key=lambda d: -abs(d["rValstand"]))
    vandning.sort(key=lambda d: -(abs(d["r"]) + abs(d["rValstand"])))

    ut = {"ar": AR, "minLand": MIN_LAND, "antalSerier": len(kand), "antalPar": len(par),
          "kontroll": KONTROLL_VALSTAND,
          "storleksfallan": storlek[:300], "valstandsfallan": valstand_f[:300],
          "overlever": overlever[:300], "vandning": vandning[:150]}
    json.dump(ut, open(os.path.join(HER, "larpar.json"), "w"), ensure_ascii=False, indent=1)

    def visa(rubrik, rader, k=16, absolut=False):
        print(f"\n{'='*104}\n{rubrik}  ({len(rader)} par)\n{'='*104}")
        for d in rader[:k]:
            if absolut:
                print(f"  absolut r={d['rAbsolut']:+.2f}  →  per person r={d['r']:+.2f}   n={d['n']}")
            else:
                print(f"  r={d['r']:+.2f}  →  välstånd konstant r={d['rValstand']:+.2f}   n={d['n']}")
            print(f"      {d['ta'][:50]:<50} [{d['amneA'][:20]}]")
            print(f"      {d['tb'][:50]:<50} [{d['amneB'][:20]}]")

    visa("1. STORLEKSFÄLLAN — starkt i absoluta tal, borta när måttet blir per person",
         storlek, absolut=True)
    visa("2. VÄLSTÅNDSFÄLLAN — starkt även per person, dör när BNP/person hålls konstant",
         valstand_f)
    visa("3. ÖVERLEVER — sambandet står kvar när välståndet hålls konstant", overlever)
    visa("4. VÄNDNING — sambandet byter tecken", vandning)
    print(f"\nskrev {os.path.join(HER, 'larpar.json')}")


if __name__ == "__main__":
    main()
