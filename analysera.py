#!/usr/bin/env python3
"""Vad i OWID:s katalog går att visa som jordglob?

Kriterier — en indikator duger om den är
  LANDVIS      OWID har kartflik (finns bara när entiteterna är länder)
  EN SIFFRA    exakt en y-kolumn; staplade/andelsdiagram med många serier blir
               inte en höjd per land
  HISTORISK    minst 10 år, annars finns inget att spela upp
  MÄTBAR       har enhet ELLER är ett index; rena kategorier duger inte
"""
import json, os, re, sys
from collections import defaultdict, Counter

HER = os.path.dirname(os.path.abspath(__file__))
CFG = os.path.join(HER, "cache", "config.json")
MET = os.path.join(HER, "cache", "metadata.json")

kategorier = json.load(open(os.path.join(HER, "kategorier.json")))
topic_slugs = json.load(open(os.path.join(HER, "topic_slugs.json")))
EJ = {"about","cookie-notice","donate","faqs","feedback","funding","jobs","latest",
      "organization","privacy-policy","search","subscribe","teaching","team","data","books","sdgs"}
topic_kat = {}
for k, ts in kategorier.items():
    for t in ts:
        if t not in EJ:
            topic_kat.setdefault(t, k)
slug_topics = defaultdict(list)
for t, ss in topic_slugs.items():
    for s in ss:
        slug_topics[s].append(t)


def las(mapp, slug):
    try:
        return json.load(open(os.path.join(mapp, slug + ".json")))
    except Exception:
        return None


def arspann(ts):
    m = re.match(r"^(-?\d+)-(-?\d+)$", (ts or "").strip())
    return (int(m.group(1)), int(m.group(2))) if m else None


rader, skal = [], Counter()
for slug in open(os.path.join(HER, "kartslugs.txt")).read().split():
    cfg, met = las(CFG, slug), las(MET, slug)
    if not cfg or not met:
        skal["saknar metadata"] += 1; continue
    ykol = [d for d in cfg.get("dimensions", []) if d.get("property") == "y"]
    if len(ykol) != 1:
        skal[f"{'flera' if len(ykol) > 1 else 'ingen'} y-serie"] += 1; continue
    kol = met.get("columns") or {}
    if len(kol) != 1:
        skal["flera datakolumner"] += 1; continue
    namn, k = next(iter(kol.items()))
    sp = arspann(k.get("timespan"))
    if not sp:
        skal["okänt tidsspann"] += 1; continue
    ar = sp[1] - sp[0] + 1
    if ar < 10:
        skal["under 10 år"] += 1; continue
    enhet = (k.get("unit") or "").strip()
    titel = cfg.get("title") or k.get("titleShort") or slug
    if not enhet and not re.search(r"index|score|rank|ratio|per |rate", titel, re.I):
        skal["ingen enhet"] += 1; continue
    ts = slug_topics.get(slug) or []
    rader.append(dict(slug=slug, titel=titel, enhet=enhet, fran=sp[0], till=sp[1], ar=ar,
                      kalla=(met.get("chart") or {}).get("citation", ""),
                      beskr=(k.get("descriptionShort") or "")[:220],
                      topics=ts,
                      kategori=next((topic_kat[t] for t in ts if t in topic_kat), "(otaggad)")))
    skal["GODKÄND"] += 1

print(f"{len(open(os.path.join(HER,'kartslugs.txt')).read().split())} landvisa diagram granskade\n")
for k, v in skal.most_common():
    print(f"  {v:5d}  {k}")

json.dump(rader, open(os.path.join(HER, "kandidater.json"), "w"), ensure_ascii=False, indent=1)

print(f"\n── {len(rader)} kandidater per kategori/ämne ──")
per_kat = defaultdict(lambda: defaultdict(list))
for r in rader:
    for t in (r["topics"] or ["(otaggad)"]):
        per_kat[topic_kat.get(t, "(otaggad)")][t].append(r)
for kat in sorted(per_kat, key=lambda k: -sum(len(v) for v in per_kat[k].values())):
    tot = sum(len(v) for v in per_kat[kat].values())
    print(f"\n{kat}  —  {tot}")
    for t, rs in sorted(per_kat[kat].items(), key=lambda kv: -len(kv[1])):
        aldst = min(r["fran"] for r in rs)
        print(f"    {t:42s} {len(rs):4d}   äldsta år {aldst}")
