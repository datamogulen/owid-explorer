/* i18n för OWID-utforskaren.
   Motorn (motor.js) kräver LANG, T(), lokal() och ENHETTEXT() — inget mer.
   Seriernas titlar och enheter kommer från OWID och står på engelska; att
   översätta 1 300 av dem för hand vore att låtsas om en precision vi inte har.
   Gränssnittet finns däremot på svenska och engelska. */
"use strict";

const SPRAK = {
  sv: {
    rubrik: "OWID-utforskaren — världens data som jordglober",
    ingress: "Höjd och färg = värdet i varje land. Välj en serie, dra för att rotera, " +
             "skrolla för att zooma. Peka på ett land för att läsa av värdet.",
    spela: "▶ Spela", paus: "⏸ Paus",
    hastighet: "Hastighet", arPerS: "år/s", arKort: "år", av: "av",
    relief: "Relief", autorotation: "autorotation", vyval: "Vy",
    instTitel: "Inställningar", merTitel: "inställningar för den här globen",
    maximera: "förstora", atergaVy: "stäng", stang: "Stäng",
    valjSerie: "Välj serie", byt: "Byt serie", laggTill: "+ glob",
    sok: "Sök bland alla serier …", inga: "Inga träffar",
    alla: "Alla ämnen", serier: "serier", lander: "länder",
    favoriter: "Favoriter", favorit: "spara som favorit",
    matt: "mått", nollniva: "nollnivå", skala: "skala",
    norm: { abs: "totalt", capita: "per person", km2: "per km²",
            andel: "andel av landytan" },
    nollAret: "snitt det året", nollFast: "snitt {ar}",
    log: "log", linjar: "linjär", reliefKort: "relief", tak: "tak",
    reliefTitel: "sänk reliefen för just denna glob",
    takTitel: "värdet där topparna når full höjd",
    stlKnapp: "⬇ STL", stlKlar: "✓ STL-filer nedladdade",
    stlTitel: "Exportera 3D-utskrift (kärna + över + hav + under som separata filer)",
    laddar: "laddar …", ingenData: "ingen data", ingenData2: "ingen data",
    fKr: "f.Kr.", nara0: "≈ 0", havText: "hav", uppskattat: "uppskattat",
    barMin: "min", barMax: "max", barMedel: "snitt",
    omKnapp: "ⓘ Om & källor", delaKnapp: "🔗 Dela vy", kopierad: "✓ Länk kopierad",
    N: "N", S: "S", O: "Ö", V: "V",
    arketyp: { tungsvans: "Tungsvans", intervall: "Intervall",
               andel: "Andel", signerad: "Signerad" },
    vyer: { varlden: "hela jorden", europa: "Europa", afrika: "Afrika", asien: "Asien",
            nordam: "Nordamerika", sydam: "Sydamerika", oceanien: "Oceanien", arktis: "Arktis" },
    kategori: {
      "Health": "Hälsa",
      "Energy and Environment": "Energi och miljö",
      "Food and Agriculture": "Mat och jordbruk",
      "Poverty and Economic Development": "Fattigdom och ekonomi",
      "Population and Demographic Change": "Befolkning och demografi",
      "Human Rights and Democracy": "Rättigheter och demokrati",
      "Innovation and Technological Change": "Innovation och teknik",
      "Education and Knowledge": "Utbildning och kunskap",
      "Living Conditions, Community and Wellbeing": "Levnadsvillkor",
      "Violence and War": "Våld och krig",
      "(otaggad)": "Övrigt",
    },
    omHtml: `<p>Varje glob är en serie ur <a href="https://ourworldindata.org">Our World in
      Data</a>: ett värde per land och år. Höjden och färgen är samma tal — landets nivå
      jämfört med nollnivån, som normalt är världssnittet det året.</p>
      <p>Hela OWID-katalogen är genomgången och filtrerad mot vad en glob kan visa: en
      enda mätserie, minst tio år, minst trettio länder, en mätbar storhet. Representationen
      — logaritmisk eller linjär höjd, var nollnivån ligger, vilken färgskala — väljs ur
      datans egen form, och regeln som gick igång står under varje glob. Valet är ett
      omdöme, inte en teknisk sanning, så det ska synas och gå att ändra.</p>
      <p>Varje glob kan laddas ner som STL för 3D-utskrift: fyra filer som tillsammans
      blir ett klot — kärna, hav, länder över nollnivån och länder under.</p>
      <p>Data: Our World in Data (CC BY). Landgränser: Natural Earth.
      Systerprojekt: <a href="/climate-globes/">Klimatgloberna</a>.</p>`,
  },
  en: {
    rubrik: "The OWID explorer — the world's data as globes",
    ingress: "Height and colour = the value in each country. Pick a series, drag to rotate, " +
             "scroll to zoom. Point at a country to read its value.",
    spela: "▶ Play", paus: "⏸ Pause",
    hastighet: "Speed", arPerS: "yr/s", arKort: "yr", av: "off",
    relief: "Relief", autorotation: "auto-rotate", vyval: "View",
    instTitel: "Settings", merTitel: "settings for this globe",
    maximera: "enlarge", atergaVy: "close", stang: "Close",
    valjSerie: "Choose a series", byt: "Change series", laggTill: "+ globe",
    sok: "Search all series …", inga: "No matches",
    alla: "All topics", serier: "series", lander: "countries",
    favoriter: "Favourites", favorit: "save as favourite",
    matt: "measure", nollniva: "zero level", skala: "scale",
    norm: { abs: "total", capita: "per person", km2: "per km²",
            andel: "share of land area" },
    nollAret: "mean that year", nollFast: "mean {ar}",
    log: "log", linjar: "linear", reliefKort: "relief", tak: "cap",
    reliefTitel: "lower the relief for this globe only",
    takTitel: "the value at which peaks reach full height",
    stlKnapp: "⬇ STL", stlKlar: "✓ STL files downloaded",
    stlTitel: "Export for 3D printing (core + above + sea + below as separate files)",
    laddar: "loading …", ingenData: "no data", ingenData2: "no data",
    fKr: "BCE", nara0: "≈ 0", havText: "sea", uppskattat: "estimated",
    barMin: "min", barMax: "max", barMedel: "mean",
    omKnapp: "ⓘ About & sources", delaKnapp: "🔗 Share view", kopierad: "✓ Link copied",
    N: "N", S: "S", O: "E", V: "W",
    arketyp: { tungsvans: "Heavy tail", intervall: "Interval",
               andel: "Share", signerad: "Signed" },
    vyer: { varlden: "whole Earth", europa: "Europe", afrika: "Africa", asien: "Asia",
            nordam: "North America", sydam: "South America", oceanien: "Oceania",
            arktis: "the Arctic" },
    kategori: {},
    omHtml: `<p>Each globe is one series from <a href="https://ourworldindata.org">Our World
      in Data</a>: one value per country and year. Height and colour are the same number —
      the country's level against the zero line, normally that year's world mean.</p>
      <p>The whole OWID catalogue was reviewed and filtered against what a globe can show:
      a single measured series, at least ten years, at least thirty countries, a measurable
      quantity. The representation — logarithmic or linear height, where the zero line sits,
      which colour scale — is chosen from the shape of the data itself, and the rule that
      fired is printed under each globe. That choice is a judgement, not a technical truth,
      so it is shown and can be changed.</p>
      <p>Every globe can be downloaded as STL for 3D printing: four files that together make
      one sphere — core, sea, countries above the zero line and countries below.</p>
      <p>Data: Our World in Data (CC BY). Borders: Natural Earth.
      Sister project: <a href="/climate-globes/">Climate globes</a>.</p>`,
  },
};

let LANG = (() => {
  try {
    const sparat = localStorage.getItem("owidx_sprak");
    if (sparat && SPRAK[sparat]) return sparat;
  } catch (e) { /* privat läge */ }
  return (navigator.language || "en").toLowerCase().startsWith("sv") ? "sv" : "en";
})();

function sattSprak(s) {
  if (!SPRAK[s]) return;
  LANG = s;
  try { localStorage.setItem("owidx_sprak", s); } catch (e) { /* privat läge */ }
}

function T(nyckel) {
  const d = SPRAK[LANG] || SPRAK.en;
  return (nyckel in d) ? d[nyckel] : (SPRAK.en[nyckel] ?? nyckel);
}

function lokal() { return LANG === "sv" ? "sv-SE" : "en-US"; }

/* Enheterna kommer ordagrant från OWID och är redan begripliga; det enda som
   behöver hända är att svenska decimaltecken inte krockar med engelska ord. */
function ENHETTEXT(e) { return e || ""; }

function KATEGORI(k) { return (T("kategori") || {})[k] || k; }
function ARKETYP(a) { return (T("arketyp") || {})[a] || a; }
