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
    logflagga: "log-skala", logflaggaTitel: "Höjd och färg är logaritmiska — "
      + "avståndet mellan 1 och 10 är lika stort som mellan 10 och 100. Klicka för linjär skala.",
    bakgrund: "Bakgrund", temaBeige: "beige", temaLjus: "ljus", temaMork: "mörk",
    owidOm: "OWID om måttet:",
    vadArMedel: "Vad är medelvärdet?",
    vadArMedelText: "\"Världssnittet\" är OWID:s World-rad, som är BEFOLKNINGSVIKTAD: "
      + "den genomsnittliga människans värde, inte det genomsnittliga landets. "
      + "Kina och Indien väger tungt, Island knappt alls. Globen ritar däremot länder, "
      + "så ett land kan ligga under snittet fast de flesta LÄNDER ligger lägre. "
      + "Höjden mäts mot startårets snitt och står still över tid, så en ökning ser ut "
      + "som en ökning; färgen mäts mot årets snitt, så man ser världen komma ikapp.", undersok: "Undersök", undersokTitel: "Vad mäter den här serien, och var kan jag läsa mer?",
    lasAmne: "Läs om ämnet hos OWID", lasDiagram: "Diagram, data och alla källor",
    undersokFot: "Ser något oväntat ut är svaret oftast i måttets definition — "
      + "\"antal slaktade landdjur\" domineras t.ex. av kyckling, som väger lite och "
      + "därför blir många djur per kilo kött.",
    matt: "mått", nollniva: "nollnivå", skala: "skala",
    norm: { abs: "totalt", capita: "per person", km2: "per km²",
            andel: "andel av landytan" },
    nollAr: "aktuellt år", nollStart: "startåret {ar}", nollSlut: "slutåret {ar}", nollNoll: "0",
    nollEtikett: "nollnivå", fargMot: "färg mot årets snitt",
    kvot: "kvot", avlasVila: "peka på ett land", perOrd: "per", vand: "vänd", vandTitel: "byt plats på globerna — kvoten vänds", globalKvot: "Global kvot", kvotVarlden: "världen", kvotTypiskt: "typiskt land",
    hallKonstant: "Håll välståndet konstant", valstandKonst: "r utan BNP/person",
    minO: "minsta ö", minOAv: "ta med alla",
    stlrubrik: "Endast 3D-utskrift",
    storlek: "utskrift Ø (mm)",
    storlekTitel: "Filen skrivs i den här storleken — ingen skalning i slicern behövs. 244 mm är Bambus 256 mm-platta minus 6 mm marginal på varje sida. Håldiameter och ö-filter mäts i samma millimeter.",
    lockLager: "lager på kapade ytor",
    lockTitel: "Lägger ett tunt extra lager (1,2 mm) ovanpå de länder som taket kapat, som egen fil att skriva ut i varningsfärg. En avsågad platå och en genuint hög yta ser annars likadana ut i handen.",
    dela: "dela vid ekvatorn", halPa: "pinnhål i STL", halDiam: "håldiameter (mm)",
    halTitel: "Borrar ett genomgående hål längs polaxeln i STL-exporten, för att kunna trä den utskrivna globen på en pinne. Påverkar inte globen på skärmen.",
    delaTitel: "Snittar globen vid ekvatorn och levererar varje del som två halvor, båda med snittytan nedåt. Dubbelt så många filer; halvorna limmas ihop efter utskrift.",
    halDiamTitel: "Diametern på den utskrivna globen. Kanalen går genom SÖDRA halvan, in från sydpolen; norra halvklotet rörs inte.",
    minOTitel: "Öar smalare än så här utesluts ur STL:en — nålar knäcks vid rensning. Måttet gäller den utskrivna globen.",
    tolkForsvinner: "sambandet var till största delen välstånd",
    tolkForsvagas: "en del var välstånd, en del något annat",
    tolkStarKvar: "står kvar — välstånd förklarar det inte",
    tolkVander: "vänder tecken när välståndet hålls konstant",
    korrRubrik: "Samband", korrLander: "länder", korrRang: "rangkorr.",
    korrVarning: "Samvariation är inte orsak.", korrMer: "Vad siffran inte säger",
    korrMerText: "<p><b>Korrelation är inte kausalitet.</b> Att två serier följs åt betyder "
      + "inte att den ena orsakar den andra. Det kan lika gärna vara tvärtom, eller ingetdera.</p>"
      + "<p><b>Nästan allt korrelerar med välstånd.</b> Bland världens länder samvarierar "
      + "utbildning, hälsa, energianvändning, internettillgång och hundratals andra mått — "
      + "för att de alla hänger ihop med hur rikt landet är. Ett starkt r mellan två sådana "
      + "mått säger ofta mer om den gemensamma bakgrunden än om något samband dem emellan.</p>"
      + "<p><b>Länder är inte människor.</b> Ett samband mellan länder gäller inte "
      + "nödvändigtvis mellan individer. Att länder med mer av X har mer av Y betyder inte "
      + "att personer med mer av X har mer av Y — det kallas ekologiskt felslut.</p>"
      + "<p><b>Ett land är en observation.</b> Här väger Kina lika mycket som Tuvalu, och "
      + "siffran gäller ett enskilt år tvärs över länder — inte hur måtten utvecklats "
      + "över tid.</p>"
      + "<p><b>Att hålla välståndet konstant.</b> Nästan allt som mäter utveckling följer "
      + "BNP per person. Raden visar vad som blir kvar av sambandet när den gemensamma "
      + "välståndsnivån räknas bort — partiell korrelation, med BNP/person i log-rymd. "
      + "Försvinner sambandet var det till stor del välstånd som syntes. Står det kvar "
      + "finns något annat där. Men detta identifierar INGA orsaker: det kontrollerar "
      + "linjärt för EN variabel, och det finns fler. Det är ett bättre ställe att börja "
      + "fråga från, inte ett svar.</p>"
      + "<p><b>Två globala kvoter, två frågor.</b> \"Världen\" är summan av täljarna delad "
      + "med summan av nämnarna — jorden behandlad som ett land. Det är den sanna globala "
      + "intensiteten, men den domineras av Kina, Indien och USA, vilket är en egenskap och "
      + "inte ett fel. \"Typiskt land\" är medianen av ländernas kvoter: ett land en röst. "
      + "Skiljer de sig mycket ligger de stora länderna åt ena hållet — och den skillnaden "
      + "är i sig en upplysning. Per-capita-serier vägs med befolkningen, per-km²-serier med "
      + "landytan; går ingetdera visas bara medianen.</p>"
      + "<p>Rangkorrelationen bryr sig bara om ländernas ordning. Skiljer den sig mycket "
      + "från r är det några få extremvärden som driver sambandet.</p>",
    korrUtanfor: "saknar data det året", korrStark: "starkt", korrMedel: "måttligt", korrSvagt: "svagt", korrInget: "inget",
    korrPos: "positivt", korrNeg: "negativt", korrFa: "för få gemensamma länder",
    nollAret: "snitt det året", nollFast: "snitt {ar}",
    nollAuto: "Under uppspelning låses nollnivån vid den ände där världssnittet är lägst, "
      + "så att en ökning syns som en ökning. Står bilden still ligger nollnivån vid "
      + "aktuellt år, vilket visar vem som ligger över och under snittet just då. "
      + "Välj själv i ⋯ om du vill låsa den.",
    log: "log", linjar: "linjär", reliefKort: "relief", tak: "tak",
    reliefTitel: "sänk reliefen för just denna glob",
    takTitel: "värdet där topparna når full höjd",
    stlKnapp: "⬇ STL", stlKlar: "✓ {n} STL-filer nedladdade",
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
    logflagga: "log scale", logflaggaTitel: "Height and colour are logarithmic — "
      + "the step from 1 to 10 is as wide as from 10 to 100. Click for a linear scale.",
    bakgrund: "Background", temaBeige: "beige", temaLjus: "light", temaMork: "dark",
    owidOm: "OWID on the measure:",
    vadArMedel: "What is the mean?",
    vadArMedelText: "The \"world mean\" is OWID's World row, which is POPULATION-WEIGHTED: "
      + "the value for the average person, not the average country. China and India weigh "
      + "heavily, Iceland barely at all. The globe draws countries, so a country can sit "
      + "below the mean even though most COUNTRIES are lower. Height is measured against "
      + "the start year's mean and stays fixed over time, so a rise looks like a rise; "
      + "colour is measured against each year's mean, so you see the world catching up.", undersok: "Investigate", undersokTitel: "What does this series measure, and where can I read more?",
    lasAmne: "Read about the topic at OWID", lasDiagram: "Chart, data and full sources",
    undersokFot: "When something looks surprising the answer is usually in how the measure "
      + "is defined — \"land animals slaughtered\", for instance, is dominated by chickens, "
      + "which are light and so numerous per kilo of meat.",
    matt: "measure", nollniva: "zero level", skala: "scale",
    norm: { abs: "total", capita: "per person", km2: "per km²",
            andel: "share of land area" },
    nollAr: "current year", nollStart: "start year {ar}", nollSlut: "end year {ar}", nollNoll: "0",
    nollEtikett: "zero level", fargMot: "colour vs this year's mean",
    kvot: "ratio", avlasVila: "point at a country", perOrd: "per", vand: "swap", vandTitel: "swap the globes — the ratio flips", globalKvot: "Global ratio", kvotVarlden: "the world", kvotTypiskt: "typical country",
    hallKonstant: "Holding prosperity constant", valstandKonst: "r without GDP/person",
    minO: "min. island", minOAv: "keep all",
    stlrubrik: "3D printing only",
    storlek: "print Ø (mm)",
    storlekTitel: "The file is written at this size — no scaling in the slicer. 244 mm is a 256 mm Bambu plate minus 6 mm margin on each side. Hole diameter and island filter are in the same millimetres.",
    lockLager: "layer on capped areas",
    lockTitel: "Adds a thin extra layer (1.2 mm) on top of the countries the cap has cut off, as its own file to print in a warning colour. A sawn-off plateau and a genuinely tall surface otherwise look identical in the hand.",
    dela: "split at the equator", halPa: "pin hole in STL", halDiam: "hole diameter (mm)",
    halTitel: "Bores a hole through the polar axis in the STL export, so the printed globe can go on a stick. Does not affect the globe on screen.",
    delaTitel: "Cuts the globe at the equator and gives each part as two halves, both with the cut face down. Twice as many files; glue the halves together after printing.",
    halDiamTitel: "Diameter on the printed globe. The channel runs through the SOUTHERN half, in from the south pole; the northern hemisphere is untouched.",
    minOTitel: "Islands narrower than this are left out of the STL — thin spikes snap off. Measured on the printed globe.",
    tolkForsvinner: "the link was mostly prosperity",
    tolkForsvagas: "part prosperity, part something else",
    tolkStarKvar: "it holds — prosperity does not explain it",
    tolkVander: "flips sign when prosperity is held constant",
    korrRubrik: "Relationship", korrLander: "countries", korrRang: "rank corr.",
    korrVarning: "Covariation is not cause.", korrMer: "What the number does not say",
    korrMerText: "<p><b>Correlation is not causation.</b> Two series moving together does not "
      + "mean one causes the other. It may be the reverse, or neither.</p>"
      + "<p><b>Almost everything correlates with prosperity.</b> Across countries, education, "
      + "health, energy use, internet access and hundreds of other measures move together — "
      + "because they all track how rich the country is. A strong r between two such measures "
      + "often says more about that shared background than about any link between them.</p>"
      + "<p><b>Countries are not people.</b> A relationship between countries need not hold "
      + "between individuals. That countries with more X have more Y does not mean people with "
      + "more X have more Y — this is the ecological fallacy.</p>"
      + "<p><b>One country, one observation.</b> China counts as much as Tuvalu here, and the "
      + "number is for a single year across countries — not how the measures changed over time.</p>"
      + "<p><b>Holding prosperity constant.</b> Almost everything that measures development "
      + "tracks GDP per person. This row shows what survives once that shared prosperity is "
      + "removed — partial correlation, with GDP per person in log space. If the link "
      + "vanishes, what you saw was largely prosperity. If it holds, something else is "
      + "there. But this identifies NO causes: it controls linearly for ONE variable, and "
      + "there are more. It is a better place to start asking, not an answer.</p>"
      + "<p><b>Two global ratios, two questions.</b> \"The world\" is the sum of numerators "
      + "over the sum of denominators — Earth treated as one country. That is the true global "
      + "intensity, but it is dominated by China, India and the US, which is a property and not "
      + "a fault. \"Typical country\" is the median of country ratios: one country, one vote. "
      + "A large gap between them means the big countries sit to one side — and that gap is "
      + "itself informative. Per-capita series are weighted by population, per-km² series by "
      + "land area; if neither applies only the median is shown.</p>"
      + "<p>Rank correlation only cares about the order of countries. If it differs a lot from "
      + "r, a few extreme values are driving the relationship.</p>",
    korrUtanfor: "no data that year", korrStark: "strong", korrMedel: "moderate", korrSvagt: "weak", korrInget: "no",
    korrPos: "positive", korrNeg: "negative", korrFa: "too few shared countries",
    nollAret: "mean that year", nollFast: "mean {ar}",
    nollAuto: "While playing, the zero level is locked to whichever end has the lower world "
      + "mean, so a rise reads as a rise. When the view is still, the zero level sits at the "
      + "current year, showing who is above and below the mean right then. Choose it yourself in ⋯.",
    log: "log", linjar: "linear", reliefKort: "relief", tak: "cap",
    reliefTitel: "lower the relief for this globe only",
    takTitel: "the value at which peaks reach full height",
    stlKnapp: "⬇ STL", stlKlar: "✓ {n} STL files downloaded",
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
