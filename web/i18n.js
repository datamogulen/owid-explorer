/* i18n för OWID-utforskaren.
   Motorn (motor.js) kräver LANG, T(), lokal() och ENHETTEXT() — inget mer.
   Seriernas titlar och enheter kommer från OWID och står på engelska; att
   översätta 1 300 av dem för hand vore att låtsas om en precision vi inte har.
   Gränssnittet finns däremot på svenska, engelska och japanska. */
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
    fyllkont: "fyll luckor med världsdelen", uppskattat: "uppskattat",
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
    delaTitelKn: "Dela vy", omTitelKn: "Om & källor",
    fyllkontTitel: "Länder utan egen siffra får sin världsdels värde, räknat ur de länder som faktiskt har data. Ifyllda länder märks med (uppskattat) i avläsningen och får skrovlig yta i STL-exporten. Utan detta ritas ett land utan data som hav — kartan säger då ”här finns ingenting” när den borde säga ”här vet vi inte”.",
    N: "N", S: "S", O: "Ö", V: "V",
    linTxt: "linjär", logTxt: "log",
    tusenTonKm2: "tusen ton/km²", tonKm2: "ton/km²", kgKm2: "kg/km²", gKm2: "g/km²",
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
    fyllkont: "fill gaps with the continent", uppskattat: "estimated",
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
    delaTitelKn: "Share view", omTitelKn: "About & sources",
    fyllkontTitel: "Countries without their own figure get their continent's value, computed from the countries that actually have data. Filled-in countries are marked (estimated) in the readout and get a rough surface in the STL export. Without this, a country without data is drawn as sea — the map then says “nothing here” when it should say “we don't know here”.",
    N: "N", S: "S", O: "E", V: "W",
    linTxt: "linear", logTxt: "log",
    tusenTonKm2: "thousand t/km²", tonKm2: "t/km²", kgKm2: "kg/km²", gKm2: "g/km²",
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
  },  ja: {
    rubrik: "OWIDエクスプローラー — 世界のデータを地球儀で",
    ingress: "高さと色＝各国の値。系列を選び、ドラッグで回転、" +
             "スクロールやピンチでズーム。国をタップ（ポイント）すると値が表示されます。",
    spela: "▶ 再生", paus: "⏸ 一時停止",
    hastighet: "速さ", arPerS: "年/秒", arKort: "年", av: "オフ",
    relief: "起伏", autorotation: "自動回転", vyval: "表示",
    instTitel: "設定", merTitel: "この地球儀の設定",
    maximera: "拡大", atergaVy: "閉じる", stang: "閉じる",
    valjSerie: "系列を選ぶ", byt: "系列を変更", laggTill: "＋ 地球儀",
    sok: "すべての系列を検索（英語）…", inga: "該当なし",
    alla: "すべてのテーマ", serier: "系列", lander: "か国",
    favoriter: "お気に入り", favorit: "お気に入りに保存",
    logflagga: "対数スケール", logflaggaTitel: "高さと色は対数です。"
      + "1から10までの幅と10から100までの幅が同じになります。クリックすると線形スケールになります。",
    bakgrund: "背景", temaBeige: "ベージュ", temaLjus: "明るい", temaMork: "暗い",
    owidOm: "OWIDによるこの指標の説明：",
    vadArMedel: "平均値とは？",
    vadArMedelText: "「世界平均」はOWIDのWorldの行で、人口で重み付けされています。"
      + "平均的な国の値ではなく、平均的な人の値です。中国やインドの比重は大きく、アイスランドはほとんど影響しません。"
      + "一方、地球儀は国を描くので、ほとんどの国が平均より低くても、ある国が平均を下回ることがあります。"
      + "高さは開始年の平均を基準に測り、時間がたっても動かないので、増加はそのまま増加に見えます。"
      + "色はその年の平均を基準にするので、世界が追いついていく様子が見えます。",
    undersok: "詳しく見る", undersokTitel: "この系列は何を測っているのか、どこで詳しく読めるのか",
    lasAmne: "OWIDでテーマについて読む", lasDiagram: "グラフ、データ、すべての出典",
    undersokFot: "意外に見えるときは、たいてい指標の定義に答えがあります。"
      + "たとえば「と畜された陸上動物の数」は鶏が大半を占めます。鶏は軽いので、肉1 kgあたりの頭数が多くなるのです。",
    matt: "指標", nollniva: "ゼロ水準", skala: "スケール",
    norm: { abs: "総量", capita: "1人あたり", km2: "km²あたり",
            andel: "国土面積に対する割合" },
    nollAr: "表示中の年", nollStart: "開始年 {ar}", nollSlut: "終了年 {ar}", nollNoll: "0",
    nollEtikett: "ゼロ水準", fargMot: "色はその年の平均との比較",
    kvot: "比", avlasVila: "国をタップ", perOrd: "per", vand: "入れ替え", vandTitel: "地球儀を入れ替える（比が逆になります）", globalKvot: "世界全体の比", kvotVarlden: "世界", kvotTypiskt: "典型的な国",
    hallKonstant: "豊かさを一定にすると", valstandKonst: "1人あたりGDPを除いたr",
    minO: "最小の島", minOAv: "すべて含める",
    fyllkont: "欠けている国を大陸の値で補う", uppskattat: "推定",
    stlrubrik: "3Dプリント専用",
    storlek: "印刷時の直径（mm）",
    storlekTitel: "ファイルはこの大きさで書き出されるので、スライサーでの拡大縮小は不要です。244 mmは、Bambuの256 mmプレートから両側6 mmの余白を引いた値です。穴の直径と島のフィルターも同じミリ単位です。",
    lockLager: "上限で切った面に層を追加",
    lockTitel: "上限で切り取られた国の上に薄い層（1.2 mm）を追加し、警告色で印刷できるよう別ファイルにします。そうしないと、切り取られた台地と本当に高い面が手に取ったときに区別できません。",
    dela: "赤道で分割", halPa: "STLに軸穴", halDiam: "穴の直径（mm）",
    halTitel: "STL書き出しで極軸に沿って貫通穴をあけ、印刷した地球儀を棒に通せるようにします。画面上の地球儀には影響しません。",
    delaTitel: "地球儀を赤道で切り、各パーツを切断面が下になる2つの半球として出力します。ファイル数は2倍になり、印刷後に半球を貼り合わせます。",
    halDiamTitel: "印刷した地球儀での直径。穴は南極から南半球を通り、北半球には及びません。",
    minOTitel: "これより細い島はSTLから除外されます。細い突起はサポート除去のときに折れるためです。印刷した地球儀での寸法です。",
    tolkForsvinner: "関係の大部分は豊かさによるものでした",
    tolkForsvagas: "一部は豊かさ、一部は別の要因",
    tolkStarKvar: "残ります — 豊かさでは説明できません",
    tolkVander: "豊かさを一定にすると符号が逆転します",
    korrRubrik: "関係", korrLander: "か国", korrRang: "順位相関",
    korrVarning: "相関は因果ではありません。", korrMer: "この数値が語らないこと",
    korrMerText: "<p><b>相関は因果ではありません。</b>2つの系列が連動していても、一方が他方の原因とは限りません。"
      + "逆かもしれないし、どちらでもないかもしれません。</p>"
      + "<p><b>ほとんどすべてが豊かさと相関します。</b>国どうしを比べると、教育、健康、エネルギー消費、"
      + "インターネットの普及など何百もの指標が連動します。どれもその国がどれだけ豊かかを反映しているからです。"
      + "そうした2つの指標の間の強いrは、両者の関係よりも共通の背景について多くを語っていることがよくあります。</p>"
      + "<p><b>国は人ではありません。</b>国どうしの関係が個人の間でも成り立つとは限りません。"
      + "Xが多い国ほどYが多いからといって、Xが多い人ほどYが多いわけではありません。これを生態学的誤謬といいます。</p>"
      + "<p><b>1か国が1つの観測値です。</b>ここでは中国もツバルも同じ重みで、数値はある1年の国どうしの比較です。"
      + "指標が時間とともにどう変わったかではありません。</p>"
      + "<p><b>豊かさを一定にする。</b>発展を測るものは、ほとんどが1人あたりGDPに沿って動きます。"
      + "この行は、その共通の豊かさを取り除いたあとに関係がどれだけ残るかを示します（偏相関、1人あたりGDPは対数）。"
      + "関係が消えれば、見えていたのは主に豊かさでした。残るなら、何か別のものがあります。"
      + "ただし、これは原因を特定するものではありません。1つの変数を線形に調整しているだけで、ほかにも変数はあります。"
      + "答えではなく、問いを立てるためのよりよい出発点です。</p>"
      + "<p><b>2つの世界全体の比、2つの問い。</b>「世界」は分子の合計を分母の合計で割ったもので、地球を1つの国とみなした値です。"
      + "本当の世界全体の強度ですが、中国、インド、米国に大きく左右されます。それは欠点ではなく性質です。"
      + "「典型的な国」は各国の比の中央値で、1か国1票です。両者が大きく違うなら大国が一方に偏っているということで、"
      + "その差自体が情報になります。1人あたりの系列は人口で、km²あたりの系列は国土面積で重み付けし、"
      + "どちらも当てはまらない場合は中央値だけを表示します。</p>"
      + "<p>順位相関は国の並び順だけを見ます。rと大きく違う場合は、少数の極端な値が関係を引っ張っています。</p>",
    korrUtanfor: "その年のデータなし", korrStark: "強い", korrMedel: "中程度の", korrSvagt: "弱い", korrInget: "相関なし",
    korrPos: "正の相関", korrNeg: "負の相関", korrFa: "共通する国が少なすぎます",
    nollAret: "その年の平均", nollFast: "{ar}年の平均",
    nollAuto: "再生中は、世界平均が低いほうの端でゼロ水準を固定するので、増加は増加として見えます。"
      + "止まっているときは、ゼロ水準は表示中の年に置かれ、その時点で誰が平均より上か下かが分かります。"
      + "⋯ で自分で選ぶこともできます。",
    log: "対数", linjar: "線形", reliefKort: "起伏", tak: "上限",
    reliefTitel: "この地球儀だけ起伏を低くする",
    takTitel: "山が最大の高さに達する値",
    stlKnapp: "⬇ STL", stlKlar: "✓ STLファイル{n}個をダウンロードしました",
    stlTitel: "3Dプリント用に書き出す（コア＋上＋海＋下を別ファイルで）",
    laddar: "読み込み中…", ingenData: "データなし", ingenData2: "データなし",
    fKr: "紀元前", nara0: "≈ 0", havText: "海", uppskattat: "推定",
    barMin: "最小", barMax: "最大", barMedel: "平均",
    omKnapp: "ⓘ 概要と出典", delaKnapp: "🔗 表示を共有", kopierad: "✓ リンクをコピーしました",
    delaTitelKn: "表示を共有", omTitelKn: "概要と出典",
    fyllkontTitel: "独自の数値がない国には、実際にデータがある国から計算した大陸の値を使います。補った国は読み取り表示で（推定）と示され、STL書き出しでは表面がざらざらになります。これを使わないと、データのない国は海として描かれ、地図は「ここはわからない」と言うべきところで「ここには何もない」と言ってしまいます。",
    N: "N", S: "S", O: "E", V: "W",
    linTxt: "線形", logTxt: "対数",
    tusenTonKm2: "千トン/km²", tonKm2: "トン/km²", kgKm2: "kg/km²", gKm2: "g/km²",
    arketyp: { tungsvans: "裾の重い分布", intervall: "区間",
               andel: "割合", signerad: "符号付き" },
    vyer: { varlden: "地球全体", europa: "ヨーロッパ", afrika: "アフリカ", asien: "アジア",
            nordam: "北アメリカ", sydam: "南アメリカ", oceanien: "オセアニア", arktis: "北極" },
    kategori: {
      "Health": "健康",
      "Energy and Environment": "エネルギーと環境",
      "Food and Agriculture": "食料と農業",
      "Poverty and Economic Development": "貧困と経済開発",
      "Population and Demographic Change": "人口と人口動態",
      "Human Rights and Democracy": "人権と民主主義",
      "Innovation and Technological Change": "イノベーションと技術",
      "Education and Knowledge": "教育と知識",
      "Living Conditions, Community and Wellbeing": "生活環境と幸福",
      "Violence and War": "暴力と戦争",
      "(otaggad)": "その他",
    },
    omHtml: `<p>各地球儀は<a href="https://ourworldindata.org">Our World in Data</a>の1つの系列です。
      国ごと・年ごとに1つの値があります。高さと色は同じ数値で、ゼロ水準（通常はその年の世界平均）に対する国の水準を表します。
      系列の名前と単位はOWIDのもの（英語）です。</p>
      <p>OWIDのカタログ全体を見直し、地球儀で示せるものに絞り込みました。単一の測定系列で、10年以上、30か国以上あり、
      測定可能な量であることが条件です。表現方法（対数か線形の高さ、ゼロ水準の位置、色のスケール）はデータ自体の形から選ばれ、
      適用されたルールは各地球儀の下に表示されます。この選択は技術的な真実ではなく判断なので、見えるようにし、変更もできます。</p>
      <p>どの地球儀も3Dプリント用のSTLとしてダウンロードできます。コア、海、ゼロ水準より上の国、下の国の4ファイルで1つの球になります。</p>
      <p>データ：Our World in Data（CC BY）。国境：Natural Earth。
      姉妹プロジェクト：<a href="/climate-globes/">気候の地球儀</a>。</p>`,
  },
};

// Startspråk: ?lang= i URL:en, annars sparat val, annars webbläsarens språk
let LANG = (() => {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (q && SPRAK[q]) return q;
  } catch (e) { /* ingen URL */ }
  try {
    const sparat = localStorage.getItem("owidx_sprak");
    if (sparat && SPRAK[sparat]) return sparat;
  } catch (e) { /* privat läge */ }
  const n = (navigator.language || "").toLowerCase();
  if (n.startsWith("ja")) return "ja";
  if (/^(sv|nb|nn|no|da)/.test(n)) return "sv";
  return "en";
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

function lokal() { return LANG === "sv" ? "sv-SE" : LANG === "ja" ? "ja-JP" : "en-US"; }

/* Enheterna kommer ordagrant från OWID och är redan begripliga; det enda som
   behöver hända är att svenska decimaltecken inte krockar med engelska ord. */
function ENHETTEXT(e) { return e || ""; }

function KATEGORI(k) { return (T("kategori") || {})[k] || k; }
function ARKETYP(a) { return (T("arketyp") || {})[a] || a; }

/* Regel- och medelvärdestexterna i seriefilerna skrivs av exporten på svenska.
   För en/ja översätts de fras för fras vid visning (talen står kvar). */
const DATAFRASER = [
  [/linjärt drunknar mittfältet \(halva världen ryms i ([\d.,]+) % av skalan\)/g,
    "a linear scale drowns the middle (half the world fits in $1 % of the scale)",
    "線形では中間層が埋もれる（世界の半分がスケールの$1 %に収まる）"],
  [/lång svans \((p\d+\/p\d+ = [^)]*)\) men linjärt räcker/g,
    "long tail ($1) but linear is enough", "裾が長い（$1）が線形で十分"],
  [/stor spännvidd \(([^)]*)\)/g, "wide range ($1)", "値の幅が大きい（$1）"],
  [/jämn spännvidd \(([^)]*)\)/g, "even range ($1)", "値の幅が小さい（$1）"],
  [/noll förekommer inte i datan \(min ([^)]*)\)/g, "zero does not occur in the data (min $1)", "データに0がない（最小 $1）"],
  [/världssnittet hamnar i skalans kant \(([^)]*)\)/g, "the world mean falls at the edge of the scale ($1)", "世界平均がスケールの端にくる（$1）"],
  [/andel som spänner hela skalan/g, "share spanning the whole scale", "割合が全範囲にわたる"],
  [/negativa värden förekommer/g, "negative values occur", "負の値がある"],
  [/logaritmisk höjd och färg/g, "logarithmic height and colour", "高さと色を対数に"],
  [/linjär skala/g, "linear scale", "線形スケール"],
  [/fast 0–100 %/g, "fixed 0–100 %", "0〜100 %に固定"],
  [/höjd från 0/g, "height from 0", "高さは0から"],
  [/färg mot årets världssnitt/g, "colour vs the year's world mean", "色はその年の世界平均との比較"],
  [/färg mot årets världsandel/g, "colour vs the year's world share", "色はその年の世界の割合との比較"],
  [/divergerande färg kring noll/g, "diverging colour around zero", "0を中心とする発散型の色"],
  [/inget tak/g, "no cap", "上限なし"],
  [/nollnivå = världssnittet/g, "zero level = world mean", "ゼロ水準＝世界平均"],
  [/nollnivå (-?[\d.,]+)/g, "zero level $1", "ゼロ水準 $1"],
  [/\(OWID:s världsrad är summan, inte snittet\)/g, "(OWID's World row is the sum, not the mean)", "（OWIDのWorld行は平均ではなく合計）"],
  [/OWID:s världsvärde/g, "OWID's world value", "OWIDの世界の値"],
  [/räknat snitt (\d+) av (\d+) år/g, "computed mean in $1 of $2 years", "$2年中$1年は計算した平均"],
  [/befolkningsviktat snitt över länderna/g, "population-weighted mean over countries", "各国の人口加重平均"],
  [/ytviktat snitt över länderna/g, "area-weighted mean over countries", "各国の面積加重平均"],
  [/snitt över länderna/g, "mean over countries", "各国の平均"],
];
function DATATEXT(t) {
  if (!t || LANG === "sv") return t || "";
  const i = LANG === "ja" ? 2 : 1;
  for (const f of DATAFRASER) t = t.replace(f[0], f[i]);
  return LANG === "ja" ? t.replace(/, /g, "、") : t;
}
