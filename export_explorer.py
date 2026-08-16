#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OWID-utforskaren: hela katalogen som jordglober.

Skillnaden mot klimatglobernas export_owid.py är skalan. Där handplockades
fjorton mått; här går alla kandidatserier ur inventeringen igenom samma kvarn:

  läs CSV → filtrera bort aggregat → mät → välj representation ur datans form
  → skriv en Uint16-tabell [år][land] + en post i katalogen

Ingenting laddas i onödan. Katalogen (en fil, ämnesträd + metadata) hämtas vid
sidstart; en serie hämtas först när någon väljer den. En serie är ~30 kB, så
även hela katalogen påslagen är billigare än en enda griddad glob.

Kör:  python export_explorer.py                 alla som klarar kraven
      python export_explorer.py --max 50        de 50 bäst täckta (för test)
      python export_explorer.py --grid 0.1      gränsgriddets upplösning
"""
import csv, io, json, os, re, sys
from collections import defaultdict
import numpy as np

HER = os.path.dirname(os.path.abspath(__file__))
CSV_CACHE = os.path.expanduser("~/Development/Data/OWID_explorer/csv")
WEB_DATA = os.path.join(HER, "web", "data")
SERIER = os.path.join(WEB_DATA, "serier")

# Klimatglobernas landkodsgrid är samma sak här — ett land är ett land.
sys.path.insert(0, os.path.expanduser("~/Development/Claude_Development/Klimatglober"))
from export_energi import bygg_landkod, bygg_landkod_fin

MIN_LANDER = 30          # under det blir globen mest hål
MIN_AR = 10
# Rader som inte är länder. OWID blandar in världen, världsdelar, inkomstgrupper
# och organisationers egna regionindelningar i samma kolumn som länderna.
EJ_LAND = re.compile(
    r"^(World|Africa|Asia|Europe|North America|South America|Oceania|Antarctica|"
    r"European Union.*|.*income countries|High-income.*|Low-income.*|"
    r"Lower-middle.*|Upper-middle.*|.*\((WB|WHO|UN|UNAIDS|FAO|UNICEF|IHME|OWID|EI|Ember)\)|"
    r".*\(former\)|Africa \(.*|Asia \(.*|Europe \(.*|America \(.*|.* countries|"
    r"OECD.*|G20|G7|Least developed.*|Small island.*|Land-locked.*|Sub-Saharan.*)$")
VARLD = {"World", "OWID_WRL"}


def las_csv(slug):
    p = os.path.join(CSV_CACHE, slug + ".csv")
    if not os.path.exists(p):
        return None
    with open(p, encoding="utf-8", errors="replace") as f:
        d = list(csv.DictReader(f))
    if not d:
        return None
    faltnamn = {k.lower(): k for k in d[0]}
    kEnt, kKod, kAr = faltnamn.get("entity"), faltnamn.get("code"), faltnamn.get("year")
    varden = [k for k in d[0] if k.lower() not in ("entity", "code", "year")]
    if not (kEnt and kKod and kAr and varden):
        return None
    return d, kEnt, kKod, kAr, varden[0]


def valj_representation(v, enhet):
    """Arketyp ur datans egen form (artikelns D1–D5). Regeln som gick igång
    skrivs ut i gränssnittet — valet är ett omdöme, inte en teknisk sanning."""
    v = v[np.isfinite(v)]
    har_neg = bool((v < 0).any())
    median = float(np.median(np.abs(v))) or 1.0
    p99 = float(np.percentile(np.abs(v), 99))
    p5 = float(np.percentile(np.abs(v), 5))
    svans = p99 / p5 if p5 > 0 else p99 / median
    if har_neg:
        return dict(arketyp="signerad", skala="linjar", nollLage="noll", ramp="div",
                    regel=f"negativa värden förekommer → linjär skala, nollnivå 0, "
                          f"divergerande färg kring noll")
    if "%" in (enhet or "") and float(np.percentile(v, 95)) > 40:
        return dict(arketyp="andel", skala="linjar", nollLage="medel", ramp="div",
                    vmin=0.0, vmax=100.0,
                    regel="andel som spänner hela skalan → fast 0–100 %, "
                          "nollnivå = världsandelen")
    if svans > 25 and len(v[v > 0]):
        return dict(arketyp="tungsvans", skala="log10", nollLage="medel", ramp="div",
                    regel=f"stor spännvidd (p99/p5 = {svans:.0f}) → logaritmisk höjd och "
                          f"färg, inget tak, nollnivå = världssnittet")
    mn = float(v.min())
    varfor = (f"noll förekommer inte i datan (min {mn:.4g})" if mn > 0
              else f"jämn spännvidd (p99/p5 = {svans:.1f})")
    return dict(arketyp="intervall", skala="linjar", nollLage="medel", ramp="div",
                regel=f"{varfor} → linjär skala, nollnivå = världssnittet")


def viktat_varldssnitt(per_land, ar, folk, yta, ix, vikt):
    """Världssnittet vägt med det måttet är PER. Ett ovägt medel över länder
    ger ett land en röst — Tuvalu lika tungt som Kina — vilket är en helt
    annan storhet än världssnittet."""
    tal = namn = 0.0
    for s, v in per_land.items():
        w = (float(yta[ix[s]]) if vikt == "yta" else folk.get((s, ar)))
        if not w:
            continue
        tal += v * w
        namn += w
    return tal / namn if namn > 0 else None


def bearbeta(post, ix, yta, folk, NL):
    d = las_csv(post["slug"])
    if not d:
        return None, "ingen csv"
    rader, kEnt, kKod, kAr, kV = d
    per_ar, varld = defaultdict(dict), {}
    for r in rader:
        ent, kod = (r.get(kEnt) or "").strip(), (r.get(kKod) or "").strip()
        try:
            a, v = int(r[kAr]), float(r[kV])
        except (TypeError, ValueError):
            continue
        if not np.isfinite(v):
            continue
        if ent in VARLD or kod in VARLD:
            varld[a] = v
            continue
        if len(kod) != 3 or EJ_LAND.match(ent) or kod not in ix:
            continue
        per_ar[a][kod] = v
    if not per_ar:
        return None, "inga länder"
    # år med rimlig täckning; enstaka länder ett enskilt år ger en tom glob
    ar_lista = sorted(a for a, v in per_ar.items() if len(v) >= MIN_LANDER and a >= -10000)
    if len(ar_lista) < MIN_AR:
        return None, f"bara {len(ar_lista)} år med ≥{MIN_LANDER} länder"
    alla = np.array([v for a in ar_lista for v in per_ar[a].values()], float)
    rep = valj_representation(alla, post["enhet"])
    if rep["skala"] == "log10":
        pos = alla[alla > 0]
        if not len(pos):
            return None, "log utan positiva värden"
        vmin = float(np.log10(np.percentile(pos, 0.5)))
        vmax = float(np.log10(np.percentile(pos, 99.5)))
    else:
        vmin = rep.get("vmin", float(np.percentile(alla, 0.5)))
        vmax = rep.get("vmax", float(np.percentile(alla, 99.5)))
    if not np.isfinite([vmin, vmax]).all() or vmax - vmin < 1e-9:
        return None, "urartad skala"

    kub = np.zeros((len(ar_lista), NL), np.uint16)
    gmedel = []
    vikt = "yta" if "km²" in (post["enhet"] or "") else "folk"
    berak = 0
    for t, a in enumerate(ar_lista):
        for s, v in per_ar[a].items():
            if rep["skala"] == "log10":
                if v <= 0:
                    continue
                n = (np.log10(v) - vmin) / (vmax - vmin)
            else:
                n = (v - vmin) / (vmax - vmin)
            kub[t, ix[s]] = 1 + int(np.clip(n, 0, 1) * 65534)
        gv = varld.get(a)
        if gv is None:
            gv = viktat_varldssnitt(per_ar[a], a, folk, yta, ix, vikt)
            berak += 1
        if gv is None or not np.isfinite(gv):
            gv = float(np.median(list(per_ar[a].values())))
        gmedel.append(round(float(gv), 6))

    lander = sorted({s for a in ar_lista for s in per_ar[a]})
    metod = "OWID:s världsvärde"
    if berak:
        metod += (f", {'ytviktat' if vikt=='yta' else 'befolkningsviktat'} snitt "
                  f"{berak} av {len(ar_lista)} år")
    post_ut = dict(
        id=post["slug"], titel=post["titel"], enhet=post["enhet"],
        kalla=post.get("kalla", ""), beskr=post.get("beskr", ""),
        topics=post.get("topics", []), kategori=post.get("kategori", ""),
        ar=[int(a) for a in ar_lista], nland=NL, nlander=len(lander),
        vmin=round(vmin, 6), vmax=round(vmax, 6), linjarGainHojd=1.0,
        globalmedel=gmedel, medelMetod=metod,
        **{k: rep[k] for k in ("arketyp", "skala", "nollLage", "ramp", "regel")})
    return (kub, post_ut), None


def main():
    arg = sys.argv[1:]
    maxantal = int(arg[arg.index("--max") + 1]) if "--max" in arg else None
    grad = float(arg[arg.index("--grid") + 1]) if "--grid" in arg else 0.1

    kod1, iso, namn, yta, kont, andel1 = bygg_landkod()
    ix = {a: k for k, a in enumerate(iso)}
    NL = len(iso)
    os.makedirs(SERIER, exist_ok=True)

    sys.path.insert(0, os.path.expanduser("~/Development/Claude_Development/Klimatglober"))
    from export_owid import vikt_tabeller
    folk, _bnp = vikt_tabeller()

    kand = json.load(open(os.path.join(HER, "kandidater.json")))
    # bäst täckta först: då blir --max ett vettigt testurval, inte ett godtyckligt
    kand.sort(key=lambda r: (-r["ar"], -r["till"]))
    if maxantal:
        kand = kand[:maxantal]

    katalog, avvisade = [], defaultdict(int)
    for i, post in enumerate(kand, 1):
        try:
            res, skal = bearbeta(post, ix, yta, folk, NL)
        except Exception as e:
            res, skal = None, f"fel: {type(e).__name__}"
        if not res:
            avvisade[skal] += 1
            continue
        kub, ut = res
        kub.tofile(os.path.join(SERIER, post["slug"] + ".bin"))
        ut["kb"] = round(os.path.getsize(os.path.join(SERIER, post["slug"] + ".bin")) / 1024, 1)
        katalog.append(ut)
        if i % 100 == 0:
            print(f"  {i}/{len(kand)}  {len(katalog)} exporterade", flush=True)

    # ämnesträd: katalogen bär sin egen navigering
    kategorier = json.load(open(os.path.join(HER, "kategorier.json")))
    EJ = {"about","cookie-notice","donate","faqs","feedback","funding","jobs","latest",
          "organization","privacy-policy","search","subscribe","teaching","team","data","books","sdgs"}
    topic_kat = {}
    for k, ts in kategorier.items():
        for t in ts:
            if t not in EJ:
                topic_kat.setdefault(t, k)
    trad = defaultdict(lambda: defaultdict(list))
    for p in katalog:
        for t in (p["topics"] or ["(otaggad)"]):
            trad[topic_kat.get(t, "(otaggad)")][t].append(p["id"])
    ut_trad = [dict(kategori=k, amnen=[dict(topic=t, serier=sorted(set(v)))
                                       for t, v in sorted(a.items())])
               for k, a in sorted(trad.items(), key=lambda kv: -sum(len(x) for x in kv[1].values()))]

    # Katalogen är till för att BLÄDDRA i: bara det som syns i väljaren. Regeltext,
    # källa, årslista och världssnitt följer med serien när den faktiskt öppnas.
    # Med allt i katalogen blev den 2 MB för 1 301 serier — det får ingen betala
    # för att titta på en enda glob.
    lat = []
    for p in katalog:
        lat.append(dict(id=p["id"], t=p["titel"], e=p["enhet"], k=p["arketyp"],
                        a0=p["ar"][0], a1=p["ar"][-1], n=p["nlander"], kb=p["kb"]))
        tung = {k: v for k, v in p.items()
                if k not in ("titel", "enhet", "arketyp", "nlander", "kb")}
        json.dump(tung, open(os.path.join(SERIER, p["id"] + ".json"), "w"),
                  ensure_ascii=False)
    json.dump(dict(indikatorer=lat, trad=ut_trad, iso=iso, namn=namn),
              open(os.path.join(WEB_DATA, "katalog.json"), "w"), ensure_ascii=False)

    mult = max(1, int(round(1.0 / grad)))
    kodF, andelF = bygg_landkod_fin(mult)
    kodF.astype(np.uint16).tofile(os.path.join(WEB_DATA, "lander_fin.bin"))
    (np.clip(andelF, 0, 1) * 255).astype(np.uint8).tofile(os.path.join(WEB_DATA, "landandel_fin.bin"))
    if mult != 4:
        kodM, andelM = bygg_landkod_fin(4)
        kodM.astype(np.uint16).tofile(os.path.join(WEB_DATA, "lander_mesh.bin"))
        (np.clip(andelM, 0, 1) * 255).astype(np.uint8).tofile(os.path.join(WEB_DATA, "landandel_mesh.bin"))
    kod1.astype(np.uint16).tofile(os.path.join(WEB_DATA, "lander.bin"))
    json.dump(dict(ny=180, nx=360, iso=iso, namn=namn, yta=[round(float(x), 2) for x in yta]),
              open(os.path.join(WEB_DATA, "lander.json"), "w"), ensure_ascii=False)

    kb = sum(p["kb"] for p in katalog)
    print(f"\n{len(katalog)} serier exporterade av {len(kand)} kandidater")
    print(f"  {kb/1024:.1f} MB serier + {os.path.getsize(os.path.join(WEB_DATA,'katalog.json'))/1024:.0f} kB katalog")
    print(f"  gränsgrid {kodF.shape[1]}×{kodF.shape[0]} ({grad}°)")
    print("\navvisade:")
    for k, v in sorted(avvisade.items(), key=lambda kv: -kv[1]):
        print(f"  {v:5d}  {k}")


if __name__ == "__main__":
    main()
