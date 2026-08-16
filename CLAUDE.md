# OWID-utforskaren — hedin.it/owid-explorer/

**Vad:** hela Our World in Data-katalogen som jordglober. 884 landvisa serier i
104 ämnen; en serie = ett värde per land och år, visat som höjd och färg.
Systerprojekt till Klimatgloberna (hedin.it/climate-globes), som gör samma sak
för griddad klimat- och utsläppsdata.

## Var saker ligger
- `web/` = sidan. `index.html`, `explorer.js` (appen), `i18n.js` (sv/en),
  `motor.js` (globmotorn — **kopia**, se nedan).
- `web/data/` = katalog + serier + landgrid. `serier/` och `*.bin` är
  gitignorerade: de byggs av exporten.
- **CSV-cachen ligger utanför projektet:** `~/Development/Data/OWID_explorer/csv`
  (221 MB). Aldrig i git, aldrig i OneDrive.

## Motorn delas med Klimatgloberna
`motor.js` (Glob-klassen, STL-export, färgramper, färgskalan) är **utbruten ur
Klimatglobernas globes.js** och bor där. Den kopieras hit; ändra den ALLTID i
`~/Development/Claude_Development/Klimatglober/web/motor.js` och kopiera hit,
aldrig tvärtom — annars glider de isär. `explorer.js` innehåller bara det som är
utforskarens eget.

Motorn kräver att `i18n.js` laddats först: `LANG`, `T()`, `lokal()`, `ENHETTEXT()`.

## Pipelinen
1. `hamta_katalog.py` — OWID:s sitemap → config.json + metadata.json per diagram.
   `hasMapTab` är OWID:s egen markering att entiteterna är länder.
2. `hamta_topics.py` — ämnessidorna → vilket diagram som hör till vilket ämne.
3. `analysera.py` — filtrerar till `kandidater.json` (en mätserie, ≥10 år, enhet).
4. `hamta_alla.py` — hämtar full CSV för alla kandidater.
5. `export_explorer.py --grid 0.1` — mäter, väljer arketyp ur datans form,
   skriver `web/data/serier/<slug>.bin|json` + `katalog.json` + landgrid.

**Kör med `/Library/Frameworks/Python.framework/Versions/Current/bin/python3`** —
systemets python3 och pyenv saknar pandas/geopandas.

## Licens: 250 serier går inte att ta med
OWID svarar **403 “non-redistributable data”** på ~19 % av kandidaterna, mest
IHME:s sjukdomsbördedata (causes-of-death 98, burden-of-disease 44). De står i
`ej_omdelbara.txt` och ska inte kringgås — det är en licensgräns, inte ett fel.

## Att göra
- Deploy till hedin.it (`public_html/owid-explorer/`), .htaccess med no-cache
  på HTML — samma mönster som climate-globes.
- preview.jpg + Open Graph-bild.
- Synkroniserad hovermarkör mellan de två globerna (finns i Klimatgloberna).
- Ämnesnamnen visas som OWID:s slugs (“co2 and greenhouse gas emissions”);
  kunde snyggas till.
