#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Befolkning per land och år till webben.

Behövs för att räkna en GLOBAL kvot. Serierna är per person, så världens
kvot är Σ(x·folk) / Σ(y·folk) — utan befolkningen går det inte att summera
per-capita-tal över länder alls. Landytan finns redan i lander.json.

Filen är liten: 240 länder × ~230 år × 4 byte ≈ 220 kB.

Kör med samma python som export_explorer.py (behöver pandas).
"""
import json, os, sys
import numpy as np

HER = os.path.dirname(os.path.abspath(__file__))
WEB_DATA = os.path.join(HER, "web", "data")
sys.path.insert(0, os.path.expanduser("~/Development/Claude_Development/Klimatglober"))
from export_energi import bygg_landkod
from export_owid import vikt_tabeller

AR0, AR1 = 1800, 2030


def main():
    kod, iso, namn, yta, kont, andel = bygg_landkod()
    ix = {a: k for k, a in enumerate(iso)}
    folk, _bnp = vikt_tabeller()
    ar = list(range(AR0, AR1 + 1))
    ut = np.zeros((len(ar), len(iso)), np.float32)
    for (s, a), v in folk.items():
        if s in ix and AR0 <= a <= AR1:
            ut[a - AR0, ix[s]] = v
    ut.tofile(os.path.join(WEB_DATA, "befolkning.bin"))
    json.dump({"ar0": AR0, "ar1": AR1, "nland": len(iso)},
              open(os.path.join(WEB_DATA, "befolkning.json"), "w"))
    tackta = int((ut > 0).any(axis=0).sum())
    print(f"befolkning.bin: {len(ar)} år × {len(iso)} länder "
          f"({os.path.getsize(os.path.join(WEB_DATA, 'befolkning.bin'))/1024:.0f} kB), "
          f"{tackta} länder har data")


if __name__ == "__main__":
    main()
