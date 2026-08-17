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


"""── Normalisering ────────────────────────────────────────────────────────
Ett absolut tal på en glob mäter mest hur STORT landet är: Ryssland brinner
mest hektar för att Ryssland är störst. Allt som skalar med befolkning eller
landyta ska därför normaliseras, och den normaliserade varianten är förvald.

Ytmått (hektar, km²) blir en ANDEL av landytan — samma sort delad med samma
sort, alltså rena promille eller ppm. Övriga extensiva mått blir per person
och per km², och storleksordningen väljs så att siffran går att läsa: 0,000012
fall per person säger ingenting, 12 fall per miljon säger något.
"""
YTENHET = re.compile(r"\b(hectares?|ha|km²|km2|square kilometres?|sq\.? ?km|acres?)\b", re.I)

# VITLISTA, inte svartlista. Ett index, en poäng eller ett årtal är inte
# additivt, och att dela det med landytan ger nonsens: "Political Polarization
# Score — per km²" toppade med 270 mm för att Monaco är litet. En felaktig
# normalisering är värre än en uteblíven, så bara enheter som verkligen mäter
# en MÄNGD får normaliseras.
EXTENSIV_ENHET = re.compile(
    r"\b(people|persons?|inhabitants|population|immigrants?|emigrants?|refugees?|"
    r"migrants?|births?|deaths?|cases?|patients?|children|students?|workers?|"
    r"employees?|tonnes?|tons?|kg|kilograms?|grams?|pounds?|"
    r"kwh|mwh|gwh|twh|joules?|barrels?|litres?|liters?|m³|cubic|"
    r"dollars?|int-\$|us\$|\$|euros?|"
    r"hectares?|km²|km2|acres?|square kilometres?|sq\.? ?km|"
    r"units?|animals?|head|vehicles?|aircraft|ships?|number)\b", re.I)
# Enheter som ALDRIG ska normaliseras, hur de än ser ut i övrigt
EJ_NORMALISERA = re.compile(r"index|score|rank|rating|\bper\b|%|percent|\brate\b|"
                            r"ratio|years?|age|°c|kelvin|scale|share", re.I)


def ytfaktor_km2(enhet):
    """→ hur många km² en enhet av måttet är, eller None om det inte är en yta."""
    e = (enhet or "").lower()
    if re.search(r"\bhectares?\b|\bha\b", e):   return 0.01
    if re.search(r"\bacres?\b", e):             return 0.00404686
    if re.search(r"km²|km2|square kilometres?|sq\.? ?km", e): return 1.0
    return None


def lasbar_skala(median, basenhet):
    """Väljer tiopotens så att typvärdet hamnar i läsbart intervall."""
    if median <= 0 or not np.isfinite(median):
        return 1.0, basenhet
    if median < 1e-4:  return 1e6, basenhet.replace("person", "miljon personer") \
                                            .replace("km²", "miljon km²")
    if median < 0.1:   return 1e3, basenhet.replace("person", "1 000 personer") \
                                            .replace("km²", "1 000 km²")
    return 1.0, basenhet


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
    # Log är svårt att läsa och ska bara användas när linjärt VERKLIGEN inte går.
    # Gamla regeln (p99/p5 > 25) satte barnadödlighet på log fast dess linjära
    # kvartilavstånd är 0,59 — enorm spridning. Frågan är inte hur lång svansen
    # är utan om mittfältet drunknar: ryms halva världen inom 4 % av skalan,
    # eller ligger nio av tio i skalans nedersta tjugondel, syns ingenting alls.
    lo, hi = float(np.percentile(v, 0.5)), float(np.percentile(v, 99.5))
    if hi - lo > 1e-12 and len(v[v > 0]):
        linj = np.clip((v - lo) / (hi - lo), 0, 1)
        iqr = float(np.percentile(linj, 75) - np.percentile(linj, 25))
        i_botten = float((linj < 0.05).mean())
        if iqr < 0.04 or i_botten > 0.90:
            return dict(arketyp="tungsvans", skala="log10", nollLage="medel", ramp="div",
                        regel=f"linjärt drunknar mittfältet (halva världen ryms i "
                              f"{iqr*100:.1f} % av skalan) → logaritmisk höjd och färg, "
                              f"nollnivå = världssnittet")
    if svans > 25 and len(v[v > 0]):
        return dict(arketyp="tungsvans", skala="linjar", nollLage="medel", ramp="div",
                    regel=f"lång svans (p99/p5 = {svans:.0f}) men linjärt räcker "
                          f"— nollnivå = världssnittet")
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


def varianter_av(per_ar, ar_lista, post, ix, yta, folk):
    """→ [(kod, enhet, titelsuffix, {år: {iso: värde}})] — absolut plus de
    normaliseringar som är meningsfulla för måttet."""
    e, tit = (post["enhet"] or ""), (post["titel"] or "")
    ut = [("abs", post["enhet"], "", per_ar)]
    # Normalisera BARA det som är en additiv mängd, och bara när varken enhet
    # eller titel avslöjar att måttet redan är relativt.
    if (not e or "/" in e or EJ_NORMALISERA.search(e) or EJ_NORMALISERA.search(tit)
            or not EXTENSIV_ENHET.search(e)):
        return ut
    yf = ytfaktor_km2(post["enhet"])
    if yf:
        # yta delad med yta → ren andel. Promille eller ppm, men ändå jämförbar
        # mellan Ryssland och Portugal, vilket hektaren aldrig är.
        d = {}
        for a in ar_lista:
            d[a] = {s: v * yf / yta[ix[s]] * 100
                    for s, v in per_ar[a].items() if yta[ix[s]] > 0}
        ut.append(("andel", "% av landytan", " — andel av landytan", d))
        return ut
    # Befolkningen delad med befolkningen är 1 i varje land. Täthet är däremot
    # meningsfullt, så bara per-capita faller bort.
    ar_folk = re.search(r"\b(population|people|inhabitants)\b", tit, re.I) is not None
    val = [("km2", "per km²", " — per km²")] if ar_folk else [
        ("capita", "per person", " — per person"), ("km2", "per km²", " — per km²")]
    for kod, namn, suffix in val:
        d, allt = {}, []
        for a in ar_lista:
            rad = {}
            for s, v in per_ar[a].items():
                n = folk.get((s, a)) if kod == "capita" else (yta[ix[s]] or 0)
                if n and n > 0:
                    rad[s] = v / n
            if len(rad) >= MIN_LANDER:
                d[a] = rad; allt.extend(rad.values())
        if len(d) < MIN_AR or not allt:
            continue
        faktor, enhet = lasbar_skala(float(np.median(allt)), namn)
        if faktor != 1.0:
            d = {a: {s: v * faktor for s, v in rad.items()} for a, rad in d.items()}
        ut.append((kod, (post["enhet"] or "") + " " + enhet, suffix, d))
    return ut


def mat_variant(per_ar, ar_lista, varld, enhet, titel, kod, ix, yta, folk, NL):
    """En variant → (kub, arketyp, skala, nollnivåserie). Samma kvarn oavsett
    om det är absoluta hektar eller andel av landytan."""
    alla = np.array([v for a in ar_lista for v in per_ar[a].values()], float)
    alla = alla[np.isfinite(alla)]
    if not len(alla):
        return None
    rep = valj_representation(alla, enhet)
    if rep["skala"] == "log10":
        pos = alla[alla > 0]
        if not len(pos):
            return None
        vmin = float(np.log10(np.percentile(pos, 0.5)))
        vmax = float(np.log10(np.percentile(pos, 99.5)))
    else:
        vmin = rep.get("vmin", float(np.percentile(alla, 0.5)))
        vmax = rep.get("vmax", float(np.percentile(alla, 99.5)))
    if not np.isfinite([vmin, vmax]).all() or vmax - vmin < 1e-9:
        return None
    kub = np.zeros((len(ar_lista), NL), np.uint16)
    gmedel = []
    e = (enhet or "").lower()
    # Normaliserade varianter ÄR intensiva, oavsett vad grundmåttet var.
    extensiv = kod == "abs" and not ("per " in e or "%" in e or "/" in e
                                     or "rate" in (titel or "").lower())
    vikt = "yta" if kod in ("km2", "andel") or "km²" in e else "folk"
    berak = totalrader = 0
    for t, a in enumerate(ar_lista):
        for s, v in per_ar[a].items():
            if rep["skala"] == "log10":
                if v <= 0:
                    continue
                n = (np.log10(v) - vmin) / (vmax - vmin)
            else:
                n = (v - vmin) / (vmax - vmin)
            kub[t, ix[s]] = 1 + int(np.clip(n, 0, 1) * 65534)
        varden_ar = list(per_ar[a].values())
        hogst = max(varden_ar)
        # World-raden gäller bara den absoluta varianten; delar man med
        # befolkningen är den inte längre jämförbar med länderna.
        gv = varld.get(a) if kod == "abs" else None
        # För ett extensivt mått är OWID:s World-rad SUMMAN, inte snittet.
        if gv is not None and hogst > 0 and gv > 1.5 * hogst:
            gv = None; totalrader += 1
        if gv is None:
            gv = (float(np.mean(varden_ar)) if extensiv
                  else viktat_varldssnitt(per_ar[a], a, folk, yta, ix, vikt))
            berak += 1
        if gv is None or not np.isfinite(gv):
            gv = float(np.median(varden_ar))
        gmedel.append(round(float(gv), 8))
    # ── Reliefen normaliseras per serie ────────────────────────────────────
    # En fast relieffaktor gav 24 mm spann på medianglobem och över 20 mm på
    # 1 203 av 1 632 varianter — på en glob med 50 mm radie. Samtidigt blev 63
    # helt platta. Skillnaden är att spännvidden i normaliserade enheter varierar
    # tio gånger mellan serier. Nu siktar varje serie på samma SYNLIGA amplitud:
    # p5–p95 ska bli ~12 mm med reliefreglaget i standardläge.
    n_alla = kub[kub > 0].astype(np.float64)
    spann_n = 0.0
    if len(n_alla):
        n_alla = (n_alla - 1) / 65534.0
        spann_n = float(np.percentile(n_alla, 95) - np.percentile(n_alla, 5))
    MAL_MM, S_MM, REGLAGE = 12.0, 50.0, 0.9
    relieffaktor = (MAL_MM / (spann_n * REGLAGE * S_MM)) if spann_n > 1e-6 else 0.9
    relieffaktor = float(np.clip(relieffaktor, 0.15, 6.0))

    # Ett ensamt land långt över alla andra blir ett tunt spröt i utskriften och
    # tar all uppmärksamhet på skärmen. Taket läggs vid p99,5 när toppen sticker
    # upp mer än så — resten av globen behåller sin relief, och tooltipen visar
    # ändå det sanna värdet.
    # Taket måste ligga UNDER p99,5, för vmax ÄR p99,5 av datan — därför var
    # p99,5 alltid exakt 1,000 och taket alltid 1,0, alltså dött. p98 flackar
    # ut de få stadsstaterna (Monaco, Singapore, Malta, Maldiverna) och låter
    # resten behålla sin relief. Färgen behåller hela skalan, och tooltipen
    # visar alltid det sanna värdet.
    tak = 1.0
    if len(n_alla) > 20:
        c = float(np.percentile(n_alla, 98))
        if float(n_alla.max()) - c > 0.05 and c > 0.05:
            # Klipp EXPONENTEN, inte resultatet: spänner skalan många
            # tiopotenser blir 10**exponent större än en float och Python
            # kastar OverflowError — det tappade 29 serier tyst.
            tak = float(10.0 ** min((1.0 - c) * (vmax - vmin), 9.0))

    # Ligger världssnittet i skalans kant blir "medel" en nollnivå som allt
    # extruderas åt ett håll ifrån. Då är 0 en ärligare utgångspunkt.
    pivot = ((np.log10(gmedel[len(gmedel)//2]) if rep["skala"] == "log10"
              else gmedel[len(gmedel)//2]) - vmin) / (vmax - vmin) \
            if (rep["skala"] != "log10" or gmedel[len(gmedel)//2] > 0) else 0.0
    if rep["nollLage"] == "medel" and not (0.08 < pivot < 0.92):
        rep = dict(rep, nollLage="noll",
                   regel=rep["regel"].replace("nollnivå = världssnittet",
                       f"världssnittet hamnar i skalans kant ({pivot:.2f}) → nollnivå 0")
                     .replace("nollnivå = världsandelen",
                       f"världsandelen hamnar i skalans kant ({pivot:.2f}) → nollnivå 0"))

    if berak >= len(ar_lista):
        metod = ("snitt över länderna" if extensiv
                 else f"{'ytviktat' if vikt=='yta' else 'befolkningsviktat'} snitt över länderna")
        if totalrader:
            metod += " (OWID:s världsrad är summan, inte snittet)"
    else:
        metod = "OWID:s världsvärde"
        if berak:
            metod += f", räknat snitt {berak} av {len(ar_lista)} år"
    return (kub, rep, round(vmin, 8), round(vmax, 8), gmedel, metod,
            round(relieffaktor, 3), round(tak, 4))


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
    ar_lista = sorted(a for a, v in per_ar.items() if len(v) >= MIN_LANDER and a >= -10000)
    if len(ar_lista) < MIN_AR:
        return None, f"bara {len(ar_lista)} år med ≥{MIN_LANDER} länder"

    ut = []
    for kod, enhet, suffix, data in varianter_av(per_ar, ar_lista, post, ix, yta, folk):
        ar_v = sorted(a for a in ar_lista if a in data and len(data[a]) >= MIN_LANDER)
        if len(ar_v) < MIN_AR:
            continue
        m = mat_variant({a: data[a] for a in ar_v}, ar_v, varld, enhet,
                        post["titel"], kod, ix, yta, folk, NL)
        if not m:
            continue
        kub, rep, vmin, vmax, gmedel, metod, relieffaktor, tak = m
        lander = sorted({s for a in ar_v for s in data[a]})
        ut.append((kod, kub, dict(
            id=post["slug"] + ("" if kod == "abs" else "__" + kod),
            bas=post["slug"], norm=kod, suffix=suffix,
            titel=post["titel"] + suffix, enhet=enhet,
            kalla=post.get("kalla", ""), beskr=post.get("beskr", ""),
            topics=post.get("topics", []), kategori=post.get("kategori", ""),
            ar=[int(a) for a in ar_v], nland=NL, nlander=len(lander),
            vmin=vmin, vmax=vmax, linjarGainHojd=tak, relieffaktor=relieffaktor,
            globalmedel=gmedel, medelMetod=metod,
            **{k: rep[k] for k in ("arketyp", "skala", "nollLage", "ramp", "regel")})))
    if not ut:
        return None, "ingen variant dög"
    return ut, None

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
    baser = []                       # en post per GRUNDSERIE, med sina varianter
    for i, post in enumerate(kand, 1):
        try:
            res, skal = bearbeta(post, ix, yta, folk, NL)
        except Exception as e:
            res, skal = None, f"fel: {type(e).__name__}"
        if not res:
            avvisade[skal] += 1
            continue
        varianter = []
        for kod, kub, ut in res:
            fil = os.path.join(SERIER, ut["id"] + ".bin")
            kub.tofile(fil)
            ut["kb"] = round(os.path.getsize(fil) / 1024, 1)
            katalog.append(ut)
            varianter.append(ut)
        # Den normaliserade varianten är FÖRVALD: ett absolut tal på en glob
        # mäter mest hur stort landet är.
        std = next((v for v in varianter if v["norm"] != "abs"), varianter[0])
        baser.append(dict(bas=post["slug"], std=std["id"], varianter=varianter))
        if i % 100 == 0:
            print(f"  {i}/{len(kand)}  {len(baser)} serier, {len(katalog)} varianter", flush=True)

    # ämnesträd: katalogen bär sin egen navigering
    kategorier = json.load(open(os.path.join(HER, "kategorier.json")))
    EJ = {"about","cookie-notice","donate","faqs","feedback","funding","jobs","latest",
          "organization","privacy-policy","search","subscribe","teaching","team","data","books","sdgs"}
    topic_kat = {}
    for k, ts in kategorier.items():
        for t in ts:
            if t not in EJ:
                topic_kat.setdefault(t, k)
    # Ämnesträdet pekar på GRUNDSERIER, inte varianter — annars står samma sak
    # tre gånger i väljaren. Varianten byts i globens egen ⋯-panel.
    trad = defaultdict(lambda: defaultdict(list))
    for b in baser:
        p = b["varianter"][0]
        for t in (p["topics"] or ["(otaggad)"]):
            trad[topic_kat.get(t, "(otaggad)")][t].append(b["std"])
    ut_trad = [dict(kategori=k, amnen=[dict(topic=t, serier=sorted(set(v)))
                                       for t, v in sorted(a.items())])
               for k, a in sorted(trad.items(), key=lambda kv: -sum(len(x) for x in kv[1].values()))]

    # Katalogen är till för att BLÄDDRA i: bara det som syns i väljaren. Regeltext,
    # källa, årslista och världssnitt följer med serien när den faktiskt öppnas.
    # Med allt i katalogen blev den 2 MB för 1 301 serier — det får ingen betala
    # för att titta på en enda glob.
    lat = []
    varianter_av_id = {}
    for b in baser:
        for v in b["varianter"]:
            varianter_av_id[v["id"]] = [dict(id=x["id"], n=x["norm"], e=x["enhet"])
                                        for x in b["varianter"]]
    for p in katalog:
        lat.append(dict(id=p["id"], t=p["titel"], e=p["enhet"], k=p["arketyp"],
                        a0=p["ar"][0], a1=p["ar"][-1], n=p["nlander"], kb=p["kb"],
                        v=varianter_av_id.get(p["id"], [])))
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

    from collections import Counter
    normer = Counter(p["norm"] for p in katalog)
    kb = sum(p["kb"] for p in katalog)
    print(f"\n{len(baser)} serier av {len(kand)} kandidater, "
          f"{len(katalog)} varianter ({dict(normer)})")
    print(f"  {kb/1024:.1f} MB serier + {os.path.getsize(os.path.join(WEB_DATA,'katalog.json'))/1024:.0f} kB katalog")
    print(f"  gränsgrid {kodF.shape[1]}×{kodF.shape[0]} ({grad}°)")
    print("\navvisade:")
    for k, v in sorted(avvisade.items(), key=lambda kv: -kv[1]):
        print(f"  {v:5d}  {k}")


if __name__ == "__main__":
    main()
