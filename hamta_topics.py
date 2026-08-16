#!/usr/bin/env python3
"""Hämtar OWID:s topic-sidor och plockar ut vilka diagram som hör till vilket
ämne. Ger kopplingen som gränssnittet ska grupperas efter."""
import json, os, re, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

HER = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HER, "cache", "topic")
UA = "klimatglober/1.0 (hedin.it; bjornh@kth.se)"
# footer-/servicesidor som råkade följa med när kategorierna lästes ur startsidan
EJ_TOPIC = {"about", "cookie-notice", "donate", "faqs", "feedback", "funding",
            "jobs", "latest", "organization", "privacy-policy", "search",
            "subscribe", "teaching", "team", "data", "books", "sdgs"}


def hamta(topic):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, topic + ".html")
    if os.path.exists(p):
        return open(p, encoding="utf-8").read()
    req = urllib.request.Request("https://ourworldindata.org/" + topic,
                                 headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            h = r.read().decode("utf-8", "replace")
    except Exception as e:
        print(f"  {topic}: {e}")
        return ""
    open(p, "w", encoding="utf-8").write(h)
    return h


if __name__ == "__main__":
    kat = json.load(open(os.path.join(HER, "kategorier.json")))
    topics = sorted({t for v in kat.values() for t in v} - EJ_TOPIC)
    print(f"{len(topics)} ämnessidor")
    with ThreadPoolExecutor(max_workers=6) as ex:
        sidor = dict(zip(topics, ex.map(hamta, topics)))
    ut = {}
    for t, h in sidor.items():
        slugs = sorted(set(re.findall(r'/grapher/([a-z0-9][a-z0-9_-]*)', h)))
        ut[t] = slugs
        print(f"  {t:42s} {len(slugs):4d} diagram")
    json.dump(ut, open(os.path.join(HER, "topic_slugs.json"), "w"), indent=1)
    alla = {s for v in ut.values() for s in v}
    print(f"\ntotalt {len(alla)} unika diagram nämnda på ämnessidorna")
