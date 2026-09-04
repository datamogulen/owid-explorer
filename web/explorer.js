/* explorer.js — OWID-utforskarens app.
   Globmotorn (Glob, STL-export, färgramper, färgskalan) ligger i motor.js och
   delas med klimatgloberna. Här bor bara det som är utforskarens eget: att
   bläddra i 1 300 serier, och att visa två av dem sida vid sida.

   Grundidén är densamma som i klimatgloberna: gränserna är statisk geometri som
   alla serier delar, och en serie är bara en liten tabell [år][land]. Därför
   kostar det nästan ingenting att byta serie — och därför går det att ha hela
   katalogen tillgänglig utan att ladda den. */
"use strict";

(async function () {
  const $ = s => document.querySelector(s);
  const arEl = $("#ar"), spela = $("#spela"), tidslinje = $("#tidslinje");
  const fart = $("#fart"), reliefEl = $("#relief"), rotera = $("#rotera"), vyval = $("#vyval");
  const behallare = $("#glober");

  const VYER = {
    varlden:  { lat: 20, lon: 10, zoom: 4.8 },
    europa:   { lat: 54, lon: 15, zoom: 2.9 },
    afrika:   { lat: 2, lon: 20, zoom: 3.2 },
    asien:    { lat: 35, lon: 95, zoom: 3.0 },
    nordam:   { lat: 45, lon: -100, zoom: 3.1 },
    sydam:    { lat: -18, lon: -60, zoom: 3.2 },
    oceanien: { lat: -25, lon: 140, zoom: 3.3 },
    arktis:   { lat: 78, lon: 10, zoom: 3.4 },
  };

  let arNu = 2020, arValt = false, spelar = false, yaw = 0.6, pitch = 0.25, senast = 0, dras = null;

  /* ── grunddata: gränsgrid + katalog. Laddas en gång, delas av alla serier ── */
  let lander = null, katalog = null, kust = null, folkmangd = null;
  const status = t => { const e = $("#status"); if (e) e.textContent = t; };
  try {
    status(T("laddar"));
    const lj = await hamta(`data/lander.json${CB}`, "json");
    const lb = await hamta(`data/lander.bin${CB}`, "arraybuffer");
    lander = Object.assign({}, lj, { kod: new Uint16Array(lb) });
    const fb = await hamta(`data/lander_fin.bin${CB}`, "arraybuffer");
    const fa = await hamta(`data/landandel_fin.bin${CB}`, "arraybuffer");
    const nc = fb.byteLength / 2, fnx = Math.round(Math.sqrt(2 * nc));
    lander.fin = { nx: fnx, ny: Math.round(nc / fnx),
                   kod: new Uint16Array(fb), andel: new Uint8Array(fa) };
    lander.mesh = lander.fin;
    try {   // separat, grövre grid för GEOMETRIN — färgen följer det fina
      const mb = await hamta(`data/lander_mesh.bin${CB}`, "arraybuffer");
      const ma = await hamta(`data/landandel_mesh.bin${CB}`, "arraybuffer");
      const mc = mb.byteLength / 2, mnx = Math.round(Math.sqrt(2 * mc));
      lander.mesh = { nx: mnx, ny: Math.round(mc / mnx),
                      kod: new Uint16Array(mb), andel: new Uint8Array(ma) };
    } catch (e) { /* samma grid för geometri och färg */ }
    katalog = await hamta(`data/katalog.json${CB}`, "json");
    try {   // behövs för den GLOBALA kvoten: per-capita-tal går inte att summera
      const bj = await hamta(`data/befolkning.json${CB}`, "json");
      const bb = await hamta(`data/befolkning.bin${CB}`, "arraybuffer");
      folkmangd = Object.assign({}, bj, { v: new Float32Array(bb) });
    } catch (e) { folkmangd = null; }
    try { kust = await hamta(`data/kust.bin${CB}`, "arraybuffer"); } catch (e) { kust = null; }
  } catch (e) {
    status("Kunde inte ladda grunddata: " + e.message);
    return;
  }
  const serieAv = {};
  for (const p of katalog.indikatorer) serieAv[p.id] = p;

  /* ── en serie: metadata + värdetabell. Cachas, så att bläddra fram och
        tillbaka mellan två serier inte kostar nätverk ── */
  const cache = {};
  async function laddaSerie(id) {
    if (cache[id]) return cache[id];
    const lat = serieAv[id];
    if (!lat) return null;
    const [tung, buf] = await Promise.all([
      hamta(`data/serier/${id}.json${CB}`, "json"),
      hamta(`data/serier/${id}.bin${CB}`, "arraybuffer"),
    ]);
    const raw = new Uint16Array(buf);
    const varden = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      const v = raw[i];
      varden[i] = v ? 1 + Math.round((v - 1) / 65534 * 254) : 0;
    }
    const G = lander.fin, M = lander.mesh || G;
    const meta = Object.assign({}, tung, {
      titel: lat.t, enhet: lat.e, nland: tung.nland,
      // Vilken normalisering serien är, och om grundstorheten alls är
      // extensiv (bara extensiva fick capita/km²-varianter i exporten).
      // Avgör om en global kvot går att summera fram — se globalKvot().
      norm: ((lat.v || []).find(x => x.id === id) || {}).n || "abs",
      extensiv: (lat.v || []).some(x => x.n === "capita" || x.n === "km2"),
      varden, landvarden: raw, kodGrid: G, meshGrid: M, ra: null,
      ny: M.ny, nx: M.nx, lat0: -89.5, lon0: -179.5, platta: true,
      nollpunkt: 0, medel: false, landdata: true,
      // Havet och kustlinjen på en ljus sida. Skickas som parameter till
      // motorn, som annars ritar klimatglobernas mörka.
      // Havet måste vara tydligt SVALARE och mörkare än landramperna, annars
      // flyter land och hav ihop till en urtvättad gröt på den ljusa sidan.
      havFarg: TEMAN[tema].hav, kustFarg: TEMAN[tema].kust, ljusMin: TEMAN[tema].ljus,
      // Reliefen är normaliserad per serie i exporten: p5–p95 siktar på ~12 mm.
      relieffaktor: tung.relieffaktor ?? 0.9,
      linjarGain: tung.skala === "log10" ? 1.0 : 0,
      standardSkala: tung.skala === "log10" ? "log" : "lin",   // "lin" här = identitet
    });
    cache[id] = meta;
    return meta;
  }

  /* ── Bakgrund ────────────────────────────────────────────────────────────
     Havet och kustlinjen på globen är shaderkonstanter, så ett temabyte måste
     bygga om globerna — det är därför visa() körs om, inte bara CSS byts. */
  const TEMAN = {
    beige: { hav: [0.60, 0.60, 0.585], kust: [0.26, 0.24, 0.20], ljus: 0.56,
             bar: { text: "#3c352a", dim: "#8d8371", etikett: "#2a251d",
                    markering: "#2a251d", markeringKant: "#fbf8f1" } },
    ljus:  { hav: [0.66, 0.68, 0.70], kust: [0.24, 0.25, 0.27], ljus: 0.58,
             bar: { text: "#31363c", dim: "#7c848d", etikett: "#1d2126",
                    markering: "#1d2126", markeringKant: "#ffffff" } },
    mork:  { hav: [0.13, 0.15, 0.19], kust: [0.42, 0.44, 0.48], ljus: 0.38,
             bar: { text: "#c9cdd3", dim: "#7f8894", etikett: "#dfe3e8",
                    markering: "#f2f4f7", markeringKant: "#0d0f13" } },
  };
  let tema = (() => {
    try { return localStorage.getItem("owidx_tema") || "beige"; } catch (e) { return "beige"; }
  })();
  function sattTema(namn, byggOm = true) {
    if (!TEMAN[namn]) namn = "beige";
    tema = namn;
    try { localStorage.setItem("owidx_tema", namn); } catch (e) { /* privat läge */ }
    document.documentElement.dataset.tema = namn;
    Object.assign(BAR_STIL, TEMAN[namn].bar);
    for (const id in cache) {           // metan bär färgerna → töm och bygg om
      cache[id].havFarg = TEMAN[namn].hav;
      cache[id].kustFarg = TEMAN[namn].kust;
      cache[id].ljusMin = TEMAN[namn].ljus;
    }
    if (byggOm) paneler.forEach(p => { if (p.id) visa(p); });
  }
  sattTema(tema, false);

  /* ── panelerna ── */
  const paneler = [];
  function skapaPanel(plats) {
    const p = { plats, id: null, glob: null, nollLage: null, skala: null };
    const el = document.createElement("div");
    el.className = "panel";
    el.innerHTML = `
      <div class="bytrad"></div>
      <h2><button class="serieknapp" type="button" title="${T("byt")}"><span class="titel"></span>
        <span class="pil">▾</span></button><button class="logflagga" type="button"></button><span class="nollflagga"></span></h2>
      <div class="saknas"></div>
      <canvas class="glob" width="1120" height="1120" style="display:none"></canvas>
      <canvas class="bar" width="1120" height="102" style="display:none"></canvas>
      <div class="regel"></div>
      <div class="undPop pop"></div>
      <div class="globPop pop">
        <label class="normval"><span>${T("matt")}</span><select></select></label>
        <label class="skalval"><span>${T("skala")}</span>
          <select><option value="log">${T("log")}</option>
                  <option value="lin">${T("linjar")}</option></select></label>
        <label class="nollval"><span>${T("nollniva")}</span>
          <select><option value="ar">${T("nollAr")}</option>
                  <option value="start"></option>
                  <option value="slut"></option>
                  <option value="noll">0</option></select></label>
      </div>`;
    el.querySelector(".titel").textContent = T("valjSerie");
    el.querySelector(".saknas").textContent = T("valjSerie");
    el.querySelector(".bytrad").textContent = T("byt");
    behallare.append(el);
    p.el = el;
    el.querySelector(".serieknapp").onclick = () => oppnaValjare(p);
    el.querySelector(".skalval select").onchange = e => {
      p.skala = e.target.value;
      p.glob.lin = p.glob.meta.skala === "log10" && p.skala === "lin";
      sattLogflagga(p); ritaBarFor(p);
    };
    el.querySelector(".nollval select").onchange = e => {
      p.nollLage = e.target.value;
      p.nollManuell = true;      // eget val vinner över automatiken vid Play
      visa(p);
    };
    // Att skalan är logaritmisk måste synas i BILDEN. Björn läste avskogningen
    // som "är det inte mer i Indonesien?" — för att log klämmer ihop toppen och
    // ingenting sa att den gjorde det. Klick byter till linjärt.
    el.querySelector(".logflagga").onclick = () => {
      if (!p.glob || p.glob.meta.skala !== "log10") return;
      p.skala = p.skala === "log" ? "lin" : "log";
      p.glob.lin = p.skala === "lin";
      p.el.querySelector(".skalval select").value = p.skala;
      sattLogflagga(p); ritaBarFor(p);
    };
    // Normaliseringen är ett MÅTTVAL, inte en ny serie: samma sak mätt per
    // person, per km² eller i absoluta tal. Därför byts den här och inte i
    // väljaren, som annars skulle lista samma serie tre gånger.
    el.querySelector(".normval select").onchange = e => {
      p.skala = null; p.nollLage = null;
      visa(p, e.target.value);
    };
    paneler.push(p);
    return p;
  }

  async function visa(p, nyttId) {
    if (nyttId) p.id = nyttId;
    if (!p.id) return;
    const meta = await laddaSerie(p.id);
    if (!meta) return;
    // Signerade mått (negativa värden förekommer) har 0 som enda vettiga
    // nollnivå. Övriga börjar statiskt vid aktuellt år.
    const arkTyp = (serieAv[p.id] || {}).k;
    if (p.nollLage === null) p.nollLage = arkTyp === "signerad" ? "noll" : "ar";
    if (p.skala === null) p.skala = meta.standardSkala;
    const el = p.el;
    const canvas = el.querySelector("canvas.glob"), bar = el.querySelector("canvas.bar");
    const gammalZoom = p.glob ? p.glob.zoom : null;
    if (p.glob) { p.glob.dispose(); p.glob = null; }
    el.querySelector(".titel").textContent = meta.titel;
    // Färgen har ALLTID en nollnivå att divergera kring — årets världssnitt —
    // även när höjden mäts från noll. Rampen valdes förr på höjdens nollnivå
    // och slog över till den sekventiella så fort höjden nollställdes.
    const ramp = "energi_div";
    p.glob = new Glob(canvas, meta, ramp, kust, true);
    // Fyllningen gäller den serie som just laddats också, inte bara dem som
    // låg framme när kryssrutan slogs på.
    if (fyllPa() && meta.platta) {
      if (!meta._fyllt && !meta._fyllForsokt) { meta._fyllForsokt = true; byggFyllning(meta); }
      if (meta._fyllt) {
        meta.landvarden = meta._fyllt.landvarden;
        meta.varden = meta._fyllt.varden;
        meta.est = meta._fyllt.est;
      }
    }
    p.glob.sattLandmask({ nx: lander.mesh.nx, ny: lander.mesh.ny, data: lander.mesh.andel });
    p.glob.nollMedel = nollSerie(meta, p.nollLage);
    // FÄRGEN mäts alltid mot årets världssnitt, oavsett var höjden har sin
    // nollnivå. Höjden svarar "hur mycket", färgen "hur ligger det till nu".
    p.glob.nollMedelF = meta.globalmedel;
    // Skalväljaren gäller bara data som LAGRATS logaritmiskt. Shaderns lin-läge
    // är 10^((v−1)·SPAN), alltså av-logaritmering — kör man den på redan linjär
    // data med SPAN 54 (t.ex. medellivslängd 30–84 år) blir varje höjd 10⁻²⁷ och
    // globen alldeles platt fast färgen ser rätt ut.
    p.glob.lin = meta.skala === "log10" && p.skala === "lin";
    if (gammalZoom) p.glob.zoom = gammalZoom; else p.glob.zoom = VYER[vyval.value].zoom;
    el.querySelector(".saknas").style.display = "none";
    canvas.style.display = ""; bar.style.display = "";
    const nvv = el.querySelector(".normval"), nsel = nvv.querySelector("select");
    const varianter = (serieAv[p.id] || {}).v || [];
    if (varianter.length > 1) {
      nvv.style.display = "";
      const NORM = T("norm") || {};
      nsel.innerHTML = varianter.map(v =>
        `<option value="${v.id}"${v.id === p.id ? " selected" : ""}>${NORM[v.n] || v.n}</option>`).join("");
    } else nvv.style.display = "none";
    const sk = el.querySelector(".skalval");
    sk.style.display = meta.skala === "log10" ? "" : "none";
    sk.querySelector("select").value = p.skala;
    const nv = el.querySelector(".nollval").querySelector("select");
    nv.options[1].text = T("nollStart").replace("{ar}", meta.ar[0]);
    nv.options[2].text = T("nollSlut").replace("{ar}", meta.ar.at(-1));
    nv.value = p.nollLage;
    const esc = t => String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    el.querySelector(".undPop").innerHTML =
      `<h3>${esc(meta.titel)}</h3>` +
      // OWID:s egen text om den underliggande kolumnen. Den är ibland svårtolkad
      // i globens sammanhang ("Population by country" för slaktade landdjur
      // betyder djurpopulation), så den märks upp i stället för att presenteras
      // som en bildtext till globen.
      (meta.beskr ? `<p class="und-beskr"><span class="und-etikett">${T("owidOm")}</span>
        ${esc(meta.beskr)}</p>` : "") +
      `<p class="und-meta"><b>${esc(meta.enhet || "–")}</b><br>${esc(meta.kalla || "")}</p>` +
      `<p class="und-meta">${esc(meta.regel)}<br>${esc(meta.medelMetod)}</p>` +
      `<p class="und-meta"><span class="und-etikett">${T("vadArMedel")}</span>
        ${esc(T("vadArMedelText"))}</p>` +
      `<p class="und-lank">` +
      (meta.amnesUrl ? `<a href="${esc(meta.amnesUrl)}" target="_blank" rel="noopener">${T("lasAmne")} ↗</a>` : "") +
      (meta.owidUrl ? `<a href="${esc(meta.owidUrl)}" target="_blank" rel="noopener">${T("lasDiagram")} ↗</a>` : "") +
      `</p><p class="und-fot">${T("undersokFot")}</p>`;
    el.querySelector(".regel").innerHTML =
      `${meta.enhet ? `<b>${meta.enhet}</b> · ` : ""}${meta.kalla || ""}` +
      `<br>${meta.regel.replace(/, höjd från 0[^·]*/, "")}` +
      `<br>${T("nollEtikett")} = ${nollText(p)} · ${T("fargMot")} · ${meta.medelMetod}`;
    byggReglage(p);
    byggKnappar(p);
    sattLogflagga(p);
    sattNollflagga(p);
    ritaBarFor(p);
    uppdateraTid();
    laggTillDelning();
  }

  /* ── Nollnivån ─────────────────────────────────────────────────────────────
     Fyra lägen, och LÄGET avgör vilket som är förvalt:

       ar     aktuellt år  — vem ligger över och under snittet just nu
       start  startårets snitt   } fasta, så att en ökning syns som en ökning
       slut   slutårets snitt    } när man spelar upp
       noll   0

     Statiskt är "aktuellt år" rimligt. Under uppspelning är det inte det: då
     stiger planet under fötterna på länderna och en förbättring kan se ut som
     en försämring. Därför låses nollnivån vid den ände där världssnittet är
     LÄGST — startåret för medellivslängd, slutåret för barnadödlighet — så att
     utvecklingen växer uppåt ur havet i båda fallen. */
  function nollSerie(meta, lage) {
    const gm = meta.globalmedel;
    if (lage === "noll") return null;
    if (lage === "ar") return gm;
    const i = lage === "start" ? 0 : gm.length - 1;
    return gm.map(() => gm[i]);
  }
  function fastAnde(meta) {          // den ände som har LÄGST världssnitt
    const gm = meta.globalmedel;
    return gm[0] <= gm[gm.length - 1] ? "start" : "slut";
  }
  function nollText(p) {
    const m = p.glob && p.glob.meta; if (!m) return "";
    const gm = m.globalmedel;
    if (p.nollLage === "noll") return T("nollNoll");
    if (p.nollLage === "ar") return T("nollAr");
    return T(p.nollLage === "start" ? "nollStart" : "nollSlut")
      .replace("{ar}", p.nollLage === "start" ? m.ar[0] : m.ar.at(-1));
  }
  function sattNollflagga(p) {
    const f = p.el.querySelector(".nollflagga");
    if (!f || !p.glob) return;
    f.textContent = `${T("nollEtikett")}: ${nollText(p)}`;
    f.title = T("nollAuto");
    f.classList.toggle("last", p.nollLage !== "ar");
  }

  function sattLogflagga(p) {
    const f = p.el.querySelector(".logflagga");
    const log = p.glob && p.glob.meta.skala === "log10" && !p.glob.lin;
    f.style.display = log ? "" : "none";
    f.textContent = T("logflagga");
    f.title = T("logflaggaTitel");
  }

  function ritaBarFor(p, ar = arNu) {
    if (!p.glob) return;
    const g = p.glob;
    ritaBar(p.el.querySelector("canvas.bar"), g.meta, "energi_div", !!g.lin,
            g.nollMedel ? g.pivotNu(ar).f : null, g.statistik(ar), g);
    p._barLager = Math.round(g.arTillLager(ar));
  }

  function byggReglage(p) {
    const pop = p.el.querySelector(".globPop");
    pop.querySelectorAll(".perGlob").forEach(e => e.remove());
    const d = document.createElement("div");
    d.className = "perGlob";
    // Taket kapar HÖJDEN på de få extremvärdena (stadsstater i täthetsmått) —
    // färgen behåller hela skalan, så de syns fortfarande, de tar bara inte
    // över hela reliefen.
    // Taket ska finnas för ALLA serier, inte bara log-lagrade. Energi per
    // person lagras linjärt, och just där behövs det som mest: Island och
    // Qatar ligger så högt att övriga världen plattas till en matta. Extra
    // viktigt för utskrifter, där reliefen är hela poängen.
    const m = p.glob.meta;
    const SPAN = m.vmax - m.vmin;
    d.innerHTML = `<label title="${T("reliefTitel")}"><span>${T("reliefKort")}</span>
      <input type="range" class="pRelief" min="0" max="2" step="0.02"
             value="${p.glob.reliefMul.toFixed(2)}"></label>` +
      `<label title="${T("takTitel")}"><span class="takTxt">${T("tak")}</span>
      <input type="range" class="pTak" min="0.05" max="1" step="0.01"
             value="${(p.glob.takNorm ?? 1).toFixed(2)}"></label>` +
      // Relief och tak gäller det man SER; hålet och ö-filtret bara STL:en.
      // Utan avdelaren läses de som visningsinställningar, och de allra flesta
      // som öppnar panelen kommer aldrig att skriva ut någonting.
      `<hr class="stlDel"><div class="avdrub">${T("stlrubrik")}</div>` +
      `<label title="${T("storlekTitel")}"><span>${T("storlek")}</span>
      <input type="number" class="pStorlek" min="20" max="600" step="1"
             value="${p.storlekMm ?? 244}" style="width:52px"></label>` +
      `<label title="${T("delaTitel")}"><span>${T("dela")}</span>
      <input type="checkbox" class="pDela"${p.delaEkv ? " checked" : ""}></label>` +
      `<label title="${T("lockTitel")}"><span>${T("lockLager")}</span>
      <input type="checkbox" class="pLock"${p.lockLager ? " checked" : ""}></label>` +
      `<label title="${T("halTitel")}"><span>${T("halPa")}</span>
      <input type="checkbox" class="pHalPa"${p.halPa ? " checked" : ""}></label>` +
      // Måttet anges för den FÄRDIGA globen, inte för STL:ens egen skala.
      // STL:en är 100 mm i diameter men skrivs ut kring 250 — "2 mm" i
      // exportfilen hade betytt 5 mm på bordet, och det säger ingen något.
      `<label class="halRad${p.halPa ? "" : " avstangd"}" title="${T("halDiamTitel")}">
      <span>${T("halDiam")}</span>
      <input type="number" class="pHal" min="1" max="60" step="1"
             value="${p.halMm ?? 20}" style="width:52px"${p.halPa ? "" : " disabled"}></label>` +
      `<label title="${T("minOTitel")}"><span>${T("minO")}</span>
      <select class="pMinO">${[0, 2, 4, 8].map(v =>
        `<option value="${v}"${v === (p.minOMm ?? 2) ? " selected" : ""}>` +
        `${v ? v + " mm" : T("minOAv")}</option>`).join("")}
      </select></label>` +
      `<div class="stlRad"><button class="stlBtn" title="${T("stlTitel")}">${T("stlKnapp")}</button></div>`;
    pop.append(d);
    d.querySelector(".pRelief").oninput = e => { p.glob.reliefMul = +e.target.value; };
    d.querySelector(".pMinO").onchange = e => { p.minOMm = +e.target.value; };
    d.querySelector(".pHal").onchange = e => { p.halMm = +e.target.value; };
    d.querySelector(".pDela").onchange = e => { p.delaEkv = e.target.checked; };
    d.querySelector(".pLock").onchange = e => { p.lockLager = e.target.checked; };
    d.querySelector(".pStorlek").onchange = e => { p.storlekMm = +e.target.value; };
    d.querySelector(".pHalPa").onchange = e => {
      p.halPa = e.target.checked;
      const fal = d.querySelector(".pHal"), rad = d.querySelector(".halRad");
      fal.disabled = !p.halPa;
      rad.classList.toggle("avstangd", !p.halPa);
    };
    {
      const takTxt = d.querySelector(".takTxt");
      const settTak = sl => {
        const c = Math.max(0.02, Math.min(1, sl));
        p.glob.takNorm = c;
        // Etiketten visar var taket ligger i seriens EGEN enhet, inte som en
        // andel — "tak 120 000 kWh" säger något, "tak 0,58" ingenting.
        takTxt.textContent = T("tak") + (c >= 0.999 ? " –" : " " + p.glob.fysisktVarde(c));
        ritaBarFor(p);
      };
      settTak(p.glob.takNorm ?? 1);
      d.querySelector(".pTak").oninput = e => settTak(+e.target.value);
    }
    const sb = d.querySelector(".stlBtn");
    sb.onclick = () => {
      sb.disabled = true; const gam = sb.textContent; sb.textContent = "…";
      setTimeout(() => {
        try { const n = exporteraSTL(p) || 0;
              sb.textContent = T("stlKlar").replace("{n}", n); }
        catch (e) { sb.textContent = "✗ " + e.message; }
        finally { setTimeout(() => { sb.textContent = gam; sb.disabled = false; }, 2500); }
      }, 20);
    };
  }

  /* ⋯ och ⛶ i globens egen ram — inte ovanför bilden, där de äter höjd */
  function byggKnappar(p) {
    const cv = p.el.querySelector("canvas.glob");
    let wrap = cv.parentElement;
    if (!wrap.classList.contains("globwrap")) {
      wrap = document.createElement("div");
      wrap.className = "globwrap";
      cv.before(wrap); wrap.append(cv);
      const rad = document.createElement("div");
      rad.className = "globknappar";
      const mer = document.createElement("button");
      mer.className = "merKnapp";
      mer.innerHTML = `⋯ <span class="txt">${T("instTitel")}</span>`;
      mer.title = T("merTitel");
      const pop = p.el.querySelector(".globPop");
      mer.onclick = e => {
        e.stopPropagation();
        const opp = pop.classList.toggle("open");
        mer.classList.toggle("pa", opp);
        if (opp) stangPop(pop);
      };
      const und = document.createElement("button");
      und.className = "merKnapp undKnapp";
      und.innerHTML = `? <span class="txt">${T("undersok")}</span>`;
      und.title = T("undersokTitel");
      const undPop = p.el.querySelector(".undPop");
      und.onclick = e => {
        e.stopPropagation();
        const o = undPop.classList.toggle("open");
        und.classList.toggle("pa", o);
        if (o) stangPop(undPop);
      };
      const max = document.createElement("button");
      max.className = "maxKnapp";
      max.innerHTML = `⛶ <span class="txt">${T("maximera")}</span>`;
      max.onclick = () => {
        const stor = p.el.classList.toggle("stor");
        max.firstChild.nodeValue = stor ? "✕ " : "⛶ ";
        max.querySelector(".txt").textContent = T(stor ? "atergaVy" : "maximera");
        document.body.style.overflow = stor ? "hidden" : "";
      };
      rad.append(und, mer, max); wrap.append(rad, pop, undPop);
      bindInteraktion(p, cv);
    }
  }
  function stangPop(utom) {
    document.querySelectorAll(".pop.open").forEach(x => {
      if (x === utom) return;
      x.classList.remove("open");
      const k = x.parentElement && x.parentElement.querySelector(".merKnapp");
      if (k) k.classList.remove("pa");
    });
  }
  document.addEventListener("click", e => {
    if (e.target.closest(".pop") || e.target.closest(".merKnapp") ||
        e.target.closest("#instknapp")) return;
    stangPop(null);
    $("#instpanel").classList.remove("open");
  });

  /* ── rotera, zooma, läsa av ── */
  // Avläsningen låg förut som en tooltip vid muspekaren och skymde nästan
  // alltid sambandskortet — man pekar ju på länder mitt emellan globerna. Den
  // har nu en egen fast plats i mittkolumnen, under kortet: den hör till BÅDA
  // globerna, och muspekaren är aldrig där. Krysshåren följer fortfarande
  // musen, så kopplingen mellan pekare och siffra går inte förlorad.
  const ruta = document.createElement("div");
  ruta.id = "avlas";
  // Ett kryss per glob: pekar man på Sverige i den ena ska man se Sverige i den
  // andra också. Det är hela poängen med att visa två samtidigt.
  const markorer = [];
  function markor(i) {
    if (!markorer[i]) {
      const d = document.createElement("div");
      d.className = "markor";
      d.innerHTML = `<svg width="26" height="26" viewBox="0 0 26 26"><g fill="none"
        stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85">
        <path d="M13 3v6M13 17v6M3 13h6M17 13h6"/></g>
        <g fill="none" stroke="#1d2126" stroke-width="1.2" stroke-linecap="round">
        <path d="M13 3v6M13 17v6M3 13h6M17 13h6"/></g>
        <circle cx="13" cy="13" r="4.5" fill="none" stroke="#1d2126" stroke-width="1.2"/>
        <circle cx="13" cy="13" r="4.5" fill="none" stroke="#fff" stroke-width="2.4" opacity=".85"/></svg>`;
      document.body.append(d);
      markorer[i] = d;
    }
    return markorer[i];
  }
  function doljMarkorer() { markorer.forEach(m => { if (m) m.style.display = "none"; }); }
  // Tom ruta skulle få kortet ovanför att hoppa. Den står kvar och uppmanar
  // i stället till det man faktiskt kan göra.
  function vila() {
    if (ruta.classList.contains("vilar")) return;
    ruta.classList.add("vilar");
    ruta.innerHTML = `<div class="uppmaning">${T("avlasVila")}</div>`;
    placeraAvlas();
  }
  const esc2 = t => String(t == null ? "" : t).replace(/[&<>"]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // Låg skärm: rutan får inte plats under kortet och hänger ovanför i stället.
  // Det beslutet måste vara stabilt — annars byter rutan sida så fort musen
  // passerar en kust, för "hav" är kortare än ett land med långa enheter.
  // Därför låses höjden till det högsta rutan varit för det aktuella seriepar
  // (viloläget undantaget: då pekar man inte på någon glob ändå).
  let avlasPar = "", avlasMax = 0;
  function placeraAvlas() {
    if (getComputedStyle(ruta).position !== "absolute") { ruta.style.minHeight = ""; return; }
    const par = paneler.map(q => q.id || "").join("|");
    if (par !== avlasPar) { avlasPar = par; avlasMax = 0; }
    ruta.style.minHeight = "";
    if (!ruta.classList.contains("vilar")) avlasMax = Math.max(avlasMax, ruta.offsetHeight);
    // Även viloläget håller höjden, annars hoppar rutan när musen lämnar globen.
    if (avlasMax) ruta.style.minHeight = avlasMax + "px";
    ruta.classList.remove("over");
    if (ruta.getBoundingClientRect().bottom > innerHeight - 8) ruta.classList.add("over");
  }

  /* Kvoten mellan de två serierna. Delar de samma nämnare — båda "per person"
     eller båda "per km²" — tar den ut sig och kvarstår som en meningsfull
     intensitet: CO₂ per person delat med BNP per person är CO₂ per krona. */
  /* ── Kvoten, uttryckt så att den går att läsa ──────────────────────────────
     6,10e−5 ton CO₂ per international dollar säger ingenting. Samma tal är
     6,1 kg per 100 int-$, och det säger något. Sökningen provar två saker:
     att byta täljarens enhet uppåt eller nedåt i sin trappa (ton → kg → g), och
     att räkna per 10, 100, 1 000 … av nämnaren. Den kombination som lägger
     talet närmast intervallet 1–1 000 vinner, med rabatt för att låta enheten
     och nämnaren vara som de är. */
  const TRAPPOR = [
    { test: /\btonn?e?s?\b|\bton\b/i, steg: [["t", 1], ["kg", 1e3], ["g", 1e6]] },
    { test: /\bkilograms?\b|\bkg\b/i, steg: [["t", 1e-3], ["kg", 1], ["g", 1e3]] },
    { test: /\bgrams?\b/i,             steg: [["kg", 1e-3], ["g", 1], ["mg", 1e3]] },
    { test: /\bTWh\b/i, steg: [["TWh", 1], ["GWh", 1e3], ["MWh", 1e6], ["kWh", 1e9]] },
    { test: /\bGWh\b/i, steg: [["TWh", 1e-3], ["GWh", 1], ["MWh", 1e3], ["kWh", 1e6]] },
    { test: /\bkWh\b/i, steg: [["TWh", 1e-9], ["GWh", 1e-6], ["MWh", 1e-3], ["kWh", 1]] },
  ];
  const NAMNARE = [1, 10, 100, 1e3, 1e4, 1e5, 1e6];

  function kvotEnhet(ea, eb) {            // → { taljare, namnare } eller null
    let a = (ea || "").trim(), b = (eb || "").trim();
    const l = a.toLowerCase(), r = b.toLowerCase();
    if (l === r) return { taljare: "×", namnare: "" };
    const per = /^(.*?)\s+per\s+(.+)$/;
    const ma = l.match(per), mb = r.match(per);
    if (mb && mb[1] === l) return { taljare: "", namnare: b.slice(-mb[2].length) };
    if (ma && ma[1] === r) return { taljare: "1", namnare: a.slice(-ma[2].length) };
    if (ma && mb && ma[2] === mb[2]) {    // samma nämnare tar ut sig
      a = a.slice(0, a.length - ma[2].length).replace(/\s+per\s*$/i, "").trim();
      b = b.slice(0, b.length - mb[2].length).replace(/\s+per\s*$/i, "").trim();
    }
    return { taljare: a || "?", namnare: b || "?" };
  }

  /* Talet och enheten var för sig, så att två kvoter kan visas under samma
     enhetsrad — och, viktigare, TVINGAS till samma skala. Väljer de var sitt
     steg blir "244,8 g per $" och "0,2 kg per $" omöjliga att jämföra med
     ögat, fast de står bredvid varandra. `fast` är valet från den första. */
  function kvotDelar(q, ea, eb, fast) {
    const e = kvotEnhet(ea, eb);
    if (e.taljare === "×") {
      const v = Math.abs(q);
      return { tal: v >= 100 ? Math.round(q).toLocaleString(lokal())
                              : dec(q, v >= 1 ? 2 : 3), enhet: "×", val: null };
    }
    if (!e.taljare) return { tal: fmtTal(q), enhet: e.namnare, val: null };
    if (!e.namnare) return { tal: fmtTal(q), enhet: e.taljare, val: null };
    let bast = fast;
    if (!bast) {
      const trappa = TRAPPOR.find(t => t.test.test(e.taljare));
      const steg = trappa ? trappa.steg : [[e.taljare, 1]];
      for (const [namn, f] of steg) for (const n of NAMNARE) {
        const v = Math.abs(q * f * n);
        if (!(v > 0) || !isFinite(v)) continue;
        const straff = (v >= 1 && v < 1000 ? 0 : Math.abs(Math.log10(v) - 1.2) * 2)
                     + (f === 1 ? 0 : 0.35) + (n === 1 ? 0 : 0.5);
        if (!bast || straff < bast.straff) bast = { straff, namn, f, n };
      }
    }
    if (!bast) return { tal: q.toExponential(2), enhet: e.taljare + " / " + e.namnare, val: null };
    const namnTxt = bast.n === 1 ? ental(e.namnare)
      : `${bast.n.toLocaleString(lokal())} ${e.namnare}`;
    return { tal: fmtTal(q * bast.f * bast.n),
             enhet: `${bast.namn} ${T("perOrd")} ${namnTxt}`, val: bast };
  }
  // "per people" är inte engelska. Nämnaren står i ental när n = 1.
  const ENTAL = { people: "person", personer: "person", deaths: "death",
                  dödsfall: "dödsfall", cases: "case", fall: "fall",
                  animals: "animal", djur: "djur", births: "birth" };
  const ental = e => ENTAL[(e || "").toLowerCase()] || e;

  function kvotText(q, ea, eb) {
    const d = kvotDelar(q, ea, eb);
    return d.tal + " " + d.enhet;
  }
  // Decimaltecknet är komma på svenska och punkt på engelska. Ett hårdkodat
  // komma gav "136,6" mitt i en engelsk sida.
  function dec(v, d) {
    return v.toLocaleString(lokal(), { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function fmtTal(v) {
    const a = Math.abs(v);
    if (a >= 1000) return Math.round(v).toLocaleString(lokal());
    if (a >= 10) return dec(v, 1);
    if (a >= 1) return dec(v, 2);
    if (a >= 0.001) return dec(v, 4);
    return v.toExponential(2);
  }

  function landvarde(m, k, ar) {          // → {n, fys} eller null
    let t = -1, d = 1e9;
    m.ar.forEach((a, i) => { const q = Math.abs(a - ar); if (q < d) { d = q; t = i; } });
    if (t < 0 || d > 3) return null;
    const ra = m.landvarden[t * m.nland + k];
    if (!ra) return null;
    const n = (ra - 1) / 65534;
    const lv = m.vmin + n * (m.vmax - m.vmin);
    return { n, tal: m.skala === "log10" ? Math.pow(10, lv) : lv, txt: null };
  }
  function bindInteraktion(p, canvas) {
    canvas.addEventListener("pointerdown", e => {
      canvas.setPointerCapture(e.pointerId);
      dras = { x: e.clientX, y: e.clientY, y0: yaw, p0: pitch, flyttad: false };
    });
    canvas.addEventListener("pointermove", e => {
      if (dras) {
        const dx = e.clientX - dras.x, dy = e.clientY - dras.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) dras.flyttad = true;
        yaw = dras.y0 + dx * 0.006;
        pitch = Math.max(-1.4, Math.min(1.4, dras.p0 + dy * 0.006));
        vila();
        return;
      }
      if (!p.glob) return;
      const r = canvas.getBoundingClientRect();
      const uv = p.glob.plockaUV((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      if (!uv) { vila(); doljMarkorer(); return; }
      const G = lander.fin;
      const j = Math.max(0, Math.min(G.ny - 1, Math.floor(uv.v * G.ny)));
      const i = (((Math.floor(uv.u * G.nx) % G.nx) + G.nx) % G.nx);
      const k = G.kod[j * G.nx + i];
      const arLand = k !== 65535 && lander.namn[k];
      const aktiva = paneler.filter(q => q.glob);
      let html = `<div class="land">${arLand ? lander.namn[k] : T("havText")}</div>`;
      // Serienamnen står redan i stort ovanför varje glob — att upprepa dem
      // här gjorde rutan tre gånger så hög som den behövde vara. Rutan hänger
      // mellan globerna, så en pil åt vardera hållet räcker för att säga vilket
      // värde som hör till vilken. Raderna ritas ALLTID, även över hav: annars
      // ändrar rutan höjd när musen passerar en kust, och då hoppar den.
      const pilar = aktiva.length === 2 ? ["◀", "▶"] : [""];
      const varden = aktiva.map((q, ix) => {
        const mt = q.glob.meta, v = arLand ? landvarde(mt, k, arNu) : null;
        const namn = esc2(mt.titel.replace(/\s*\(\d{4}\)\s*$/, ""));
        // Ett ifyllt värde MÅSTE synas som ifyllt, annars påstår rutan att
        // siffran är landets egen.
        const gissat = v && arLand && arUppskattat(mt, k, arNu);
        html += `<div class="post p${ix}" title="${namn}"><span class="pil">${pilar[ix] || ""}</span>` +
                `<span class="tal">${v ? q.glob.fysisktVarde(v.n) + (gissat ? ` <i class="gissat">${T("uppskattat")}</i>` : "")
                  : (arLand ? T("ingenData2") : "–")}</span></div>`;
        return v;
      });
      // Kvoten: bara när båda finns och nämnaren inte är noll. Enheten skrivs
      // ut här också — kortets enhetsrad hör synligt till kortets egna två tal,
      // och ett ensamt "256,7" utan enhet går inte att tolka.
      if (aktiva.length === 2) {
        const gar = varden[0] && varden[1] && Math.abs(varden[1].tal) > 1e-12;
        const d = gar ? kvotDelar(varden[0].tal / varden[1].tal,
                                  aktiva[0].glob.meta.enhet, aktiva[1].glob.meta.enhet,
                                  kvotSkala) : null;
        html += `<div class="post kvot"><span class="serie">${T("kvot")}</span>` +
                `<span class="tal">${d ? d.tal : "–"}</span>` +
                `<span class="enhet">${d ? d.enhet : ""}</span></div>`;
      }
      ruta.innerHTML = html;
      ruta.classList.remove("vilar");
      placeraAvlas();
      // samma lat/lon på ALLA glober
      aktiva.forEach((q, ix) => {
        const mk = markor(ix);
        const pr = q.glob.projektUV ? q.glob.projektUV(uv.u, uv.v) : null;
        if (!pr || !pr.framsida) { mk.style.display = "none"; return; }
        mk.style.display = "block";
        mk.style.left = pr.sx + "px";
        mk.style.top = pr.sy + "px";
      });
    });
    canvas.addEventListener("pointerleave", () => { vila(); doljMarkorer(); });
    const slapp = () => { dras = null; };
    canvas.addEventListener("pointerup", slapp);
    canvas.addEventListener("pointercancel", slapp);
    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      if (p.glob) p.glob.zoom = Math.min(9, Math.max(1.6, p.glob.zoom * (1 + e.deltaY * 0.001)));
    }, { passive: false });
  }

  /* ── Samband mellan de två globerna ────────────────────────────────────────
     Två landdataglober sida vid sida ÄR en jämförelse, så sambandet mellan dem
     hör hemma i bilden. Det räknas om för varje år, så siffran vandrar när man
     spelar upp — sambandet mellan t.ex. barnadödlighet och medellivslängd är
     inte detsamma 1950 som 2023.

     r räknas i SAMMA rymd som globen visar (logaritmisk där skalan är log), så
     siffran hör ihop med det man ser. Rangkorrelationen följer med som kontroll:
     den bryr sig bara om ordningen mellan länderna och påverkas därför inte av
     skalvalet — skiljer de sig mycket är det extremvärden som driver r. */
  const korrEl = document.createElement("div");
  korrEl.id = "korr"; korrEl.className = "tom";
  // Varningen om kausalitet får inte bli en rad man skummar förbi: den korta
  // meningen står på kortet, resonemanget bakom öppnas här.
  const korrPop = document.createElement("div");
  korrPop.className = "korrPop pop";
  korrEl.append(korrPop);

  function lagerVid(m, ar) {
    let b = 0, d = Infinity;
    for (let i = 0; i < m.ar.length; i++) {
      const q = Math.abs(m.ar[i] - ar);
      if (q < d) { d = q; b = i; }
    }
    return { t: b, avstand: d };
  }
  function pearson(x, y) {
    const n = x.length;
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
    const mx = sx / n, my = sy / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      const a = x[i] - mx, b = y[i] - my;
      sxy += a * b; sxx += a * a; syy += b * b;
    }
    return (sxx > 0 && syy > 0) ? sxy / Math.sqrt(sxx * syy) : NaN;
  }
  function rangera(v) {                     // medelrang vid lika värden
    const idx = v.map((x, i) => i).sort((a, b) => v[a] - v[b]);
    const r = new Array(v.length);
    for (let i = 0; i < idx.length; ) {
      let j = i;
      while (j + 1 < idx.length && v[idx[j + 1]] === v[idx[i]]) j++;
      const medel = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k]] = medel;
      i = j + 1;
    }
    return r;
  }
  /* Kvoten är alltid vänster ÷ höger, så att byta plats på serierna är samma
     sak som att vända kvoten. Då hör knappen hemma på sambandskortet. */
  async function vandGlober() {
    const p = paneler.filter(q => q.glob);
    if (p.length < 2) return;
    const [A, B] = p;
    const a = { id: A.id, skala: A.skala, noll: A.nollLage, man: A.nollManuell };
    const b = { id: B.id, skala: B.skala, noll: B.nollLage, man: B.nollManuell };
    A.skala = b.skala; A.nollLage = b.noll; A.nollManuell = b.man;
    B.skala = a.skala; B.nollLage = a.noll; B.nollManuell = a.man;
    korrEl.dataset.nyckel = "";
    await visa(A, b.id);
    await visa(B, a.id);
  }

  /* ── Global kvot ───────────────────────────────────────────────────────────
     Två sätt att summera, och de svarar på olika frågor:

       VÄRLDEN   Σ(täljare) / Σ(nämnare). Behandlar jorden som ett land. Det är
                 den sanna globala intensiteten — men den domineras av de stora
                 länderna, vilket är en egenskap och inte ett fel.
       TYPISKT   medianen av ländernas kvoter. Ett land en röst, Tuvalu lika
                 mycket som Kina. Säger något om det typiska LANDET, inte om
                 världen.

     Skiljer de sig mycket ligger de stora länderna åt ena hållet — och den
     skillnaden är i sig en upplysning.

     Serierna är PER PERSON, så att summera dem rakt av vore meningslöst; de
     vägs med befolkningen. Är båda per km² vägs de med landytan. Går ingetdera
     visas bara medianen. */
  /* Vad ska en summa vägas med? OWID:s egna per-capita-serier ligger hos oss
     som "abs" (de var redan intensiva och fick därför inga egna varianter), så
     normaliseringen räcker inte — enheten avslöjar de flesta, och för sådana
     som "GDP per capita", vars enhet bara är "international-$", får titeln
     avgöra. Hellre nekas en världssiffra än summera fel storheter. */
  const PER_PERSON = /\bper\s+(\d[\d\s,.]*)?(capita|person|people|personer|inhabitant|invånare)\b/i;
  const PER_YTA = /\bper\s+(\d[\d\s,.]*)?(km²|square kilomet|hectare|hektar)\b/i;
  function sortAv(m) {
    if (m.norm === "capita") return "person";
    if (m.norm === "km2" || m.norm === "andel") return "yta";
    const s = (m.enhet || "") + " · " + (m.titel || "");
    if (PER_PERSON.test(s)) return "person";
    if (PER_YTA.test(s)) return "yta";
    if (m.norm === "abs" && m.extensiv) return "sum";   // ton, dödsfall, dollar
    return null;                                        // index, betyg, °C, %
  }
  /* ── Världsdelsfyllning ─────────────────────────────────────────────────
     Konsumtionsbaserade utsläpp saknas för större delen av Afrika, och ett
     land utan värde ritas som hav. Kartan säger då "här finns ingenting"
     när den borde säga "här vet vi inte" — två helt olika påståenden, och
     det är det senare som gäller.

     Luckan fylls med världsdelens värde, räknat ur de länder som FAKTISKT
     har data. Vikten väljs av sortAv, samma funktion som avgör hur den
     globala kvoten summeras:

       per person / per km²  →  storleksvägt medel; landet ärver intensiteten
       summa (ton, dollar)   →  intensiteten × landets EGEN storlek, annars
                                hade Lesotho fått hela Afrikas utsläpp
       index, betyg, °C      →  oviktat medel; det finns ingen storhet att
                                väga med

     Ifyllda länder listas i m.est och märks överallt de syns: "(uppskattat)"
     i avläsningen och skrovlig yta i STL:en. Att gissa är i sin ordning så
     länge gissningen är utmärkt som gissning. ── */
  function viktFor(m, ar) {
    const s = sortAv(m);
    if (!s) return null;                                // index, betyg, °C
    if (s === "yta") return lander.yta ? (k => lander.yta[k] || 0) : null;
    if (!folkmangd) return null;                        // person och summa
    const t = Math.round(ar) - folkmangd.ar0;
    if (t < 0 || t > folkmangd.ar1 - folkmangd.ar0) return null;
    return k => folkmangd.v[t * folkmangd.nland + k] || 0;
  }
  const MIN_KALLOR = 3;          // under tre länder är "världsdelens värde" en gissning om en gissning
  function byggFyllning(m) {
    if (!lander.kont || !m.landvarden || !m.nland) return false;
    const NL = m.nland, NA = m.ar.length, SPAN = m.vmax - m.vmin;
    const log = m.skala === "log10", NK = lander.kontNamn.length;
    if (!(SPAN > 0)) return false;
    const fys = ra => { const lv = m.vmin + (ra - 1) / 65534 * SPAN;
                        return log ? Math.pow(10, lv) : lv; };
    const till = tal => {
      const lv = log ? Math.log10(Math.max(tal, 1e-300)) : tal;
      const n = Math.max(0, Math.min(1, (lv - m.vmin) / SPAN));
      return 1 + Math.round(n * 65534);
    };
    const sort = sortAv(m), summa = sort === "sum";
    const raw = new Uint16Array(m.landvarden);
    const est = new Uint8Array(NL * NA);
    let antalEst = 0;
    const sV = new Float64Array(NK), sW = new Float64Array(NK), sN = new Int32Array(NK);
    for (let t2 = 0; t2 < NA; t2++) {
      sV.fill(0); sW.fill(0); sN.fill(0);
      const vikt = viktFor(m, m.ar[t2]);
      const bas = t2 * NL;
      for (let k = 0; k < NL; k++) {
        const c = lander.kont[k];
        if (c < 0) continue;
        const ra = m.landvarden[bas + k];
        if (!ra) continue;
        const v = fys(ra), w = vikt ? vikt(k) : 1;
        if (!(w > 0)) continue;
        sV[c] += summa ? v : v * w;
        sW[c] += w; sN[c]++;
      }
      for (let k = 0; k < NL; k++) {
        const c = lander.kont[k];
        if (c < 0 || m.landvarden[bas + k]) continue;
        if (sN[c] < MIN_KALLOR || !(sW[c] > 0)) continue;
        const w = vikt ? vikt(k) : 1;
        const v = summa ? (sV[c] / sW[c]) * w : sV[c] / sW[c];
        if (!isFinite(v)) continue;
        raw[bas + k] = till(v);
        est[bas + k] = 1; antalEst++;
      }
    }
    if (!antalEst) return false;
    const varden = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++)
      varden[i] = raw[i] ? 1 + Math.round((raw[i] - 1) / 65534 * 254) : 0;
    m._akta = { landvarden: m.landvarden, varden: m.varden };
    m._fyllt = { landvarden: raw, varden, est };
    return true;
  }
  const fyllPa = () => !!(document.getElementById("fyllkont") || {}).checked;
  /* Byter värdetabell på ALLA laddade serier och laddar om texturen. */
  function sattFyllning() {
    const pa = fyllPa();
    for (const p of paneler) {
      const m = p.glob && p.glob.meta;
      if (!m || !m.platta) continue;
      if (pa && !m._fyllt && !m._fyllForsokt) { m._fyllForsokt = true; byggFyllning(m); }
      const kalla = (pa && m._fyllt) ? m._fyllt : (m._akta || m);
      m.landvarden = kalla.landvarden; m.varden = kalla.varden;
      m.est = (pa && m._fyllt) ? m._fyllt.est : null;
      p.glob.laddaOmVarden();
    }
  }
  function arUppskattat(m, k, ar) {
    if (!m.est) return false;
    let t = -1, d = 1e9;
    m.ar.forEach((a, i) => { const q = Math.abs(a - ar); if (q < d) { d = q; t = i; } });
    return t >= 0 && d <= 3 && !!m.est[t * m.nland + k];
  }
  function vikterFor(ma, mb, ar) {
    const sa = sortAv(ma);
    if (!sa || sa !== sortAv(mb)) return null;          // äpplen och päron
    if (sa === "sum") return () => 1;                   // ren summa
    if (sa === "person") {                              // Σ(x·folk)/Σ(y·folk)
      if (!folkmangd) return null;
      const t = Math.round(ar) - folkmangd.ar0;
      if (t < 0 || t > folkmangd.ar1 - folkmangd.ar0) return null;
      return k => folkmangd.v[t * folkmangd.nland + k] || 0;
    }
    if (!lander.yta) return null;
    return k => lander.yta[k] || 0;
  }
  function globalKvot(ma, mb, ta, tb, ar) {
    const fysA = n => { const v = ma.vmin + n * (ma.vmax - ma.vmin);
                        return ma.skala === "log10" ? Math.pow(10, v) : v; };
    const fysB = n => { const v = mb.vmin + n * (mb.vmax - mb.vmin);
                        return mb.skala === "log10" ? Math.pow(10, v) : v; };
    const vikt = vikterFor(ma, mb, ar);
    let sx = 0, sy = 0;
    const kvoter = [];
    for (let k = 0; k < ma.nland; k++) {
      const a = ma.landvarden[ta * ma.nland + k], b = mb.landvarden[tb * mb.nland + k];
      if (!a || !b) continue;
      const x = fysA((a - 1) / 65534), y = fysB((b - 1) / 65534);
      if (Math.abs(y) > 1e-12) kvoter.push(x / y);
      if (vikt) { const w = vikt(k); if (w > 0) { sx += x * w; sy += y * w; } }
    }
    if (!kvoter.length) return null;
    kvoter.sort((p, q) => p - q);
    const m = kvoter.length % 2 ? kvoter[(kvoter.length - 1) / 2]
            : (kvoter[kvoter.length / 2 - 1] + kvoter[kvoter.length / 2]) / 2;
    const varldenTal = (vikt && Math.abs(sy) > 1e-12) ? sx / sy : null;
    // Skalan väljs på världssiffran och tvingas på medianen — annars blir de
    // två talen uttryckta i olika enheter och går inte att jämföra med ögat.
    const d1 = kvotDelar(varldenTal ?? m, ma.enhet, mb.enhet);
    const d2 = kvotDelar(m, ma.enhet, mb.enhet, d1.val);
    return {
      varlden: varldenTal === null ? null : d1.tal,
      median: varldenTal === null ? d1.tal : d2.tal,
      enhet: d1.enhet, val: d1.val,
    };
  }

  // Kortets val av enhet och tiopotens, delat med avläsningsrutan: står samma
  // kvot i samma skala går Frankrikes 131,2 att jämföra med världens 244,8
  // direkt, och enheten behöver bara skrivas ut en gång — i kortet.
  let kvotSkala = null;
  /* ── Håll välståndet konstant ───────────────────────────────────────────────
     "Korrelation är inte kausalitet" är en slogan man kan rabbla utan att kunna
     något. Det här gör den till en handling: nästan allt som mäter utveckling
     följer BNP/person, så frågan är inte OM två mått samvarierar utan om något
     blir kvar när man rensar bort det gemensamma välståndet.

     Partiell korrelation, textboksformeln:  r_xy·z = (r_xy − r_xz·r_yz)
                                                      / √((1−r_xz²)(1−r_yz²))
     Den kontrollerar LINJÄRT för EN variabel och identifierar inga orsaker.
     Den visar hur mycket av sambandet som överlever en bestämd kontroll — och
     just den nyansen är hela poängen med att visa den. */
  const BNP_SERIE = "gdp-per-capita-penn-world-table";
  let bnpSerie = null, bnpLaddas = false;
  async function bnp() {
    if (bnpSerie || bnpLaddas) return bnpSerie;
    bnpLaddas = true;
    try { bnpSerie = await laddaSerie(BNP_SERIE); } catch (e) { bnpSerie = null; }
    return bnpSerie;
  }
  // Serien får inte kontrollera bort sig själv: att hålla välståndet konstant
  // när ena axeln ÄR välståndet lämnar bara brus kvar.
  const arValstand = m => /gdp|gni|gross (domestic|national)|bnp|income per|välstånd/i
                            .test(m.titel || "");

  function partiellKorr(ma, mb, ta, tb, ar) {
    const mz = bnpSerie;
    if (!mz || arValstand(ma) || arValstand(mb)) return null;
    const lz = lagerVid(mz, ar);
    if (!lz || ar < mz.ar[0] - 0.5 || ar > mz.ar.at(-1) + 0.5 || lz.avstand > 3) return null;
    const fys = (m, raw) => {
      const v = m.vmin + ((raw - 1) / 65534) * (m.vmax - m.vmin);
      return m.skala === "log10" ? v : v;      // log-rymd duger: monotont och linjärare
    };
    const x = [], y = [], z = [];
    for (let k = 0; k < ma.nland; k++) {
      const a = ma.landvarden[ta * ma.nland + k],
            b = mb.landvarden[tb * mb.nland + k],
            c = mz.landvarden[lz.t * mz.nland + k];
      if (!a || !b || !c) continue;
      x.push(fys(ma, a)); y.push(fys(mb, b));
      // BNP/person i LOG-rymd: inkomsteffekter är multiplikativa, inte additiva
      z.push(mz.skala === "log10" ? fys(mz, c) : Math.log10(Math.max(1e-9, fys(mz, c))));
    }
    if (x.length < 25) return null;            // för få länder för att kontrollera på
    const rxy = pearson(x, y), rxz = pearson(x, z), ryz = pearson(y, z);
    const n = (1 - rxz * rxz) * (1 - ryz * ryz);
    if (!(n > 1e-6)) return null;
    const rp = (rxy - rxz * ryz) / Math.sqrt(n);
    if (!isFinite(rp)) return null;
    return { r: rxy, rp, n: x.length, rxz, ryz };
  }

  // Kort, ärlig tolkning. Inte "alltså finns inget samband" — bara vad som
  // hände med siffran när en bestämd sak hölls konstant.
  function tolkPartiell(r, rp) {
    const kvar = Math.abs(r) > 1e-9 ? Math.abs(rp) / Math.abs(r) : 0;
    if (r * rp < 0 && Math.abs(rp) >= 0.2) return T("tolkVander");
    if (kvar <= 0.30) return T("tolkForsvinner");
    if (kvar <= 0.70) return T("tolkForsvagas");
    return T("tolkStarKvar");
  }

  function uppdateraKorr(ar) {
    const p = paneler.filter(q => q.glob);
    if (p.length < 2) { korrEl.className = "tom"; kvotSkala = null; return; }
    const [A, B] = p, ma = A.glob.meta, mb = B.glob.meta;
    const la = lagerVid(ma, ar), lb = lagerVid(mb, ar);
    // Ligger året UTANFÖR en series spann tar närmaste-år-sökningen seriens
    // första (eller sista) år. Då jämförs 1900 med 1921 och kallas 1900 —
    // extrapolation maskerad som mätning. Hellre streck än en siffra som inte
    // betyder vad den utger sig för.
    const inom = (m, l) => ar >= m.ar[0] - 0.5 && ar <= m.ar.at(-1) + 0.5 && l.avstand <= 3;
    const okA = inom(ma, la), okB = inom(mb, lb);
    const nyckel = `${A.id}|${B.id}|${la.t}|${lb.t}|${okA}${okB}`;
    if (nyckel === korrEl.dataset.nyckel) return;
    korrEl.dataset.nyckel = nyckel;
    if (!okA || !okB) {
      kvotSkala = null;
      const saknas = !okA && !okB ? `${ma.titel} · ${mb.titel}` : (!okA ? ma.titel : mb.titel);
      korrEl.className = "";
      korrEl.innerHTML =
        `<div class="rubrik">${T("korrRubrik")}</div>
         <div class="varde tomt">–</div>
         <div class="styrka">${T("korrUtanfor")}</div>
         <div class="rad2">${saknas.length > 60 ? saknas.slice(0, 59) + "…" : saknas}<br>
           <b>${Math.round(ar)}</b></div>`;
      korrEl.append(korrPop);
      return;
    }
    const fysA = n => ma.vmin + n * (ma.vmax - ma.vmin);   // log-rymd när skalan är log
    const fysB = n => mb.vmin + n * (mb.vmax - mb.vmin);
    const x = [], y = [];
    for (let k = 0; k < ma.nland; k++) {
      const a = ma.landvarden[la.t * ma.nland + k], b = mb.landvarden[lb.t * mb.nland + k];
      if (!a || !b) continue;
      x.push(fysA((a - 1) / 65534)); y.push(fysB((b - 1) / 65534));
    }
    korrEl.className = "";
    if (x.length < 15) {
      korrEl.innerHTML = `<div class="rubrik">${T("korrRubrik")}</div>
        <div class="styrka">${T("korrFa")}</div>`;
      return;
    }
    const r = pearson(x, y);
    const rho = pearson(rangera(x), rangera(y));
    const glob = globalKvot(ma, mb, la.t, lb.t, ma.ar[la.t]);
    kvotSkala = glob ? glob.val : null;
    const pk = partiellKorr(ma, mb, la.t, lb.t, ma.ar[la.t]);
    if (!bnpSerie) bnp().then(() => { korrEl.dataset.nyckel = ""; });
    const abs = Math.abs(r);
    const styrka = abs >= 0.7 ? T("korrStark") : abs >= 0.4 ? T("korrMedel")
                 : abs >= 0.2 ? T("korrSvagt") : T("korrInget");
    const tecken = abs < 0.2 ? "" : " " + (r > 0 ? T("korrPos") : T("korrNeg"));
    const fmt = v => (v >= 0 ? "+" : "−") + dec(Math.abs(v), 2);
    const arA = ma.ar[la.t], arB = mb.ar[lb.t];
    const arNot = (la.avstand > 0 || lb.avstand > 0) ? `<br>${arA} / ${arB}` : "";
    korrEl.innerHTML =
      `<div class="rubrik">${T("korrRubrik")}</div>
       <div class="varde">r = ${fmt(r)}</div>
       <div class="styrka">${styrka}${tecken}</div>
       <div class="rad2">${T("korrRang")} <b>${fmt(rho)}</b><br>
         <b>${x.length}</b> ${T("korrLander")}${arNot}</div>
       ${pk ? `<div class="rad2 partiell${Math.abs(pk.rp) < 0.2 ? " dott" : ""}">
         <span class="und-etikett">${T("hallKonstant")}</span>
         <span class="kvotrad"><i>${T("valstandKonst")}</i><b>${fmt(pk.rp)}</b></span>
         <span class="kvottolk">${tolkPartiell(r, pk.rp)}</span></div>` : ""}
       ${glob ? `<div class="rad2 globkvot">
         <span class="und-etikett">${T("globalKvot")}</span>
         ${glob.varlden ? `<span class="kvotrad"><i>${T("kvotVarlden")}</i><b>${glob.varlden}</b></span>` : ""}
         <span class="kvotrad"><i>${T("kvotTypiskt")}</i><b>${glob.median}</b></span>
         <span class="kvotenhet">${glob.enhet}</span></div>` : ""}
       <div class="varn">${T("korrVarning")}
         <button class="korrMer" type="button">${T("korrMer")} ›</button></div>
       <button class="vand" type="button" title="${T("vandTitel")}">⇄ ${T("vand")}</button>`;
    korrEl.append(korrPop);          // innerHTML ovan slänger den annars
    korrEl.querySelector(".vand").onclick = () => vandGlober();
    korrEl.querySelector(".korrMer").onclick = e => {
      e.stopPropagation();
      korrPop.innerHTML = `<h3>${T("korrMer")}</h3>${T("korrMerText")}`;
      const o = korrPop.classList.toggle("open");
      if (o) stangPop(korrPop);
    };
  }

  /* ── Favoriter ───────────────────────────────────────────────────────────
     Ligger i webbläsaren (localStorage) och kräver inget konto. Vill man ta
     dem med sig till en annan dator följer de med i delningslänken. */
  const FAVNYCKEL = "owidx_favoriter";
  let favoriter = (() => {
    try { return new Set(JSON.parse(localStorage.getItem(FAVNYCKEL) || "[]")); }
    catch (e) { return new Set(); }
  })();
  function sparaFav() {
    try { localStorage.setItem(FAVNYCKEL, JSON.stringify([...favoriter])); }
    catch (e) { /* privat läge: favoriterna gäller sessionen */ }
  }
  function vaxlaFav(id) {
    if (favoriter.has(id)) favoriter.delete(id); else favoriter.add(id);
    sparaFav(); ritaAmnen(); ritaSerier(); laggTillDelning();
  }

  /* ── seriväljaren: kategori → ämne → serie, plus fritextsök ──
        1 300 serier ryms inte i en rullgardin, men de ryms i OWID:s egen
        indelning — som besökaren troligen redan känner igen. */
  let aktivPanel = null, aktivtAmne = null, sokstrang = "";
  const overlay = $("#valjare"), amneslista = $("#amnen"), serielista = $("#serier");

  function oppnaValjare(p) {
    aktivPanel = p;
    overlay.classList.add("open");
    $("#sok").value = ""; sokstrang = "";
    ritaAmnen(); ritaSerier();
    $("#sok").focus();
  }
  $("#valjareStang").onclick = () => overlay.classList.remove("open");
  overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove("open"); };
  $("#sok").oninput = e => {
    sokstrang = e.target.value.trim().toLowerCase();
    if (sokstrang) aktivtAmne = null;
    ritaAmnen(); ritaSerier();
  };

  function ritaAmnen() {
    amneslista.innerHTML = "";
    const alla = document.createElement("button");
    alla.className = "amne" + (aktivtAmne ? "" : " pa");
    alla.innerHTML = `<span>${T("alla")}</span><b>${baslista().length}</b>`;
    alla.onclick = () => { aktivtAmne = null; ritaAmnen(); ritaSerier(); };
    amneslista.append(alla);
    if (favoriter.size) {
      const f = document.createElement("button");
      f.className = "amne" + (aktivtAmne === "★" ? " pa" : "");
      f.innerHTML = `<span>★ ${T("favoriter")}</span><b>${favoriter.size}</b>`;
      f.onclick = () => { aktivtAmne = "★"; sokstrang = ""; $("#sok").value = "";
                          ritaAmnen(); ritaSerier(); };
      amneslista.append(f);
    }
    for (const kat of katalog.trad) {
      const rub = document.createElement("h4");
      rub.textContent = KATEGORI(kat.kategori);
      amneslista.append(rub);
      for (const a of kat.amnen) {
        const b = document.createElement("button");
        b.className = "amne" + (aktivtAmne === a.topic ? " pa" : "");
        b.innerHTML = `<span>${a.topic.replace(/-/g, " ")}</span><b>${a.serier.length}</b>`;
        b.onclick = () => { aktivtAmne = a.topic; sokstrang = ""; $("#sok").value = "";
                            ritaAmnen(); ritaSerier(); };
        amneslista.append(b);
      }
    }
  }

  let _baser = null;
  function baslista() {          // väljaren visar grundserier, inte varianter
    if (_baser) return _baser;
    const ids = new Set();
    for (const kat of katalog.trad)
      for (const a of kat.amnen) a.serier.forEach(s => ids.add(s));
    _baser = katalog.indikatorer.filter(p => ids.has(p.id));
    return _baser;
  }

  function ritaSerier() {
    let lista;
    if (aktivtAmne === "★") {
      lista = katalog.indikatorer.filter(p => favoriter.has(p.id));
    } else if (sokstrang) {
      lista = baslista().filter(p =>
        (p.t + " " + (p.e || "")).toLowerCase().includes(sokstrang)).slice(0, 300);
    } else if (aktivtAmne) {
      const ids = new Set();
      for (const kat of katalog.trad)
        for (const a of kat.amnen)
          if (a.topic === aktivtAmne) a.serier.forEach(s => ids.add(s));
      lista = katalog.indikatorer.filter(p => ids.has(p.id));
    } else {
      lista = baslista().slice().sort((a, b) => b.n - a.n).slice(0, 300);
    }
    serielista.innerHTML = "";
    if (!lista.length) { serielista.innerHTML = `<p class="inga">${T("inga")}</p>`; return; }
    for (const p of lista) {
      const rad = document.createElement("div");
      rad.className = "serierad";
      const stj = document.createElement("button");
      stj.className = "stjarna" + (favoriter.has(p.id) ? " pa" : "");
      stj.textContent = favoriter.has(p.id) ? "★" : "☆";
      stj.title = T("favorit");
      stj.onclick = e => { e.stopPropagation(); vaxlaFav(p.id); };
      const b = document.createElement("button");
      b.className = "serie" + (aktivPanel && aktivPanel.id === p.id ? " pa" : "");
      b.innerHTML = `<span class="st">${p.t}</span>
        <span class="sm"><em>${p.e || "–"}</em>
        <i>${p.a0}–${p.a1}</i><i>${p.n} ${T("lander")}</i>
        <span class="ark" data-a="${p.k}">${ARKETYP(p.k)}</span></span>`;
      b.onclick = () => {
        overlay.classList.remove("open");
        aktivPanel.skala = null; aktivPanel.nollLage = null;
        visa(aktivPanel, p.id);
      };
      rad.append(stj, b);
      serielista.append(rad);
    }
  }

  /* ── tid ── */
  function uppdateraTid() {
    const g = paneler.filter(p => p.glob);
    if (!g.length) return;
    tidslinje.min = Math.min(...g.map(p => p.glob.meta.ar[0]));
    tidslinje.max = Math.max(...g.map(p => p.glob.meta.ar.at(-1)));
    tidslinje.step = 0.02;
    // Öppna på seriens startår: senaste året med i stort sett full landtäckning.
    // Det allra sista året är ofta glest rapporterat, och det är dessutom det
    // här året reliefen är kalibrerad på.
    if (!arValt) {
      const s = g.map(p => p.glob.meta.startAr).filter(x => typeof x === "number");
      arNu = s.length ? Math.max(...s) : +tidslinje.max;
      arValt = true;
    }
    arNu = Math.min(Math.max(arNu, +tidslinje.min), +tidslinje.max);
    tidslinje.value = arNu;
  }
  spela.onclick = () => {
    spelar = !spelar;
    if (spelar && arNu >= parseFloat(tidslinje.max) - 0.01) arNu = parseFloat(tidslinje.min);
    spela.textContent = spelar ? T("paus") : T("spela");
    vaxlaNollForLage();
  };
  /* LÄGET avgör nollnivån. Statiskt är "aktuellt år" rimligt — då ser man vem
     som ligger över och under snittet just då. Under uppspelning är det inte
     rimligt: planet stiger under fötterna på länderna och en förbättring kan se
     ut som en försämring. Då låses nollnivån vid den ände där världssnittet är
     lägst, så utvecklingen växer uppåt ur havet. Har man valt själv i ⋯ rör vi
     inte valet. */
  function vaxlaNollForLage() {
    for (const p of paneler) {
      if (!p.glob || p.nollManuell || p.nollLage === "noll") continue;
      const onskad = spelar ? fastAnde(p.glob.meta) : "ar";
      if (p.nollLage !== onskad) { p.nollLage = onskad; visa(p); }
    }
  }
  tidslinje.oninput = () => { arNu = parseFloat(tidslinje.value); };
  vyval.onchange = e => sattVy(e.target.value);
  function sattVy(namn) {
    const v = VYER[namn]; if (!v) return;
    yaw = -v.lon * Math.PI / 180;
    pitch = Math.max(-1.4, Math.min(1.4, v.lat * Math.PI / 180));
    paneler.forEach(p => { if (p.glob) p.glob.zoom = v.zoom; });
    // annars snurrar globen bort från världsdelen man just valde
    if (namn !== "varlden" && rotera.checked) rotera.checked = false;
  }
  const temaval = $("#temaval");
  if (temaval) { temaval.value = tema; temaval.onchange = e => sattTema(e.target.value); }
  $("#instknapp").onclick = e => {
    e.stopPropagation();
    const panel = $("#instpanel");
    const o = panel.classList.toggle("open");
    // stangPop(null) stängde ALLA popovers — och #instpanel är själv en .pop,
    // så panelen slog igen i samma klick som öppnade den.
    if (o) stangPop(panel);
  };
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    overlay.classList.remove("open");
    stangPop(null); $("#instpanel").classList.remove("open");
    paneler.forEach(p => {
      if (!p.el.classList.contains("stor")) return;
      p.el.classList.remove("stor");
      const b = p.el.querySelector(".maxKnapp");
      if (b) { b.firstChild.nodeValue = "⛶ "; b.querySelector(".txt").textContent = T("maximera"); }
      document.body.style.overflow = "";
    });
  });

  /* ── delbar vy ── */
  function laggTillDelning() {
    const bit = paneler.filter(p => p.id).map(p =>
      [p.id, p.skala, p.nollLage].join("~")).join(",");
    const f = favoriter.size ? "&fav=" + encodeURIComponent([...favoriter].join(",")) : "";
    history.replaceState(null, "", "#s=" + encodeURIComponent(bit) + "&ar=" + Math.round(arNu) + f);
  }
  $("#delaknapp").onclick = async () => {
    laggTillDelning();
    const b = $("#delaknapp");
    try { await navigator.clipboard.writeText(location.href); } catch (e) { /* nekad */ }
    b.textContent = T("kopierad");
    setTimeout(() => { b.textContent = "🔗"; }, 1600);
  };
  $("#fyllkont").onchange = () => sattFyllning();
  $("#omknapp").onclick = () => $("#om").classList.add("open");
  $("#omStang").onclick = () => $("#om").classList.remove("open");
  $("#om").onclick = e => { if (e.target === $("#om")) $("#om").classList.remove("open"); };
  $("#omKropp").innerHTML = T("omHtml");

  /* ── STL: samma motor som klimatgloberna, samma fyra filer ── */
  function exporteraSTL(p) {
    if (!p.glob) throw new Error("ingen glob");
    // Alla mått i millimeter på den FÄRDIGA globen; motorn räknar själv om
    // dem till byggskala med utskriftsstorleken som enda referens.
    // Uppskattade länder får skrovlig yta i utskriften — man ska kunna känna
    // med fingret att siffran inte är landets egen.
    const m0 = p.glob.meta;
    let skrov = null;
    if (m0.est) {
      let t0 = -1, d0 = 1e9;
      m0.ar.forEach((a, i) => { const q = Math.abs(a - arNu); if (q < d0) { d0 = q; t0 = i; } });
      if (t0 >= 0) {
        skrov = new Set();
        for (let k = 0; k < m0.nland; k++) if (m0.est[t0 * m0.nland + k]) skrov.add(k);
      }
    }
    return exporteraPlatoSTL(p.glob, lander, arNu, parseFloat(reliefEl.value), p.id,
                      skrov, p.minOMm ?? 2,
                      p.halPa ? (p.halMm ?? 20) : 0,       // båda av som förval
                      !!p.delaEkv, p.storlekMm ?? 244, !!p.lockLager);
  }

  /* ── start ── */
  const A = skapaPanel(0), B = skapaPanel(1);
  const mitt = document.createElement("div");
  mitt.id = "mitt";
  mitt.append(korrEl, ruta);                 // sambandet överst, avläsningen under
  behallare.insertBefore(mitt, B.el);        // mitt emellan globerna
  vila();
  const hash = new URLSearchParams(location.hash.slice(1));
  let start = [["life-expectancy", null, null], ["gdp-per-capita-worldbank", null, null]];
  if (hash.get("s")) {
    const bitar = decodeURIComponent(hash.get("s")).split(",").filter(Boolean)
      .map(b => b.split("~"));
    if (bitar.length) start = bitar;
  }
  if (hash.get("ar")) { arNu = +hash.get("ar"); arValt = true; }
  if (hash.get("fav")) {          // favoriter från en delad länk läggs till
    decodeURIComponent(hash.get("fav")).split(",").filter(Boolean).forEach(x => favoriter.add(x));
    sparaFav();
  }
  for (let i = 0; i < Math.min(2, start.length); i++) {
    const [id, sk, no] = start[i];
    const p = paneler[i];
    if (!serieAv[id]) continue;
    p.skala = sk && sk !== "null" ? sk : null;
    p.nollLage = no && no !== "null" ? no : null;
    await visa(p, id);
  }
  if (!paneler.some(p => p.glob)) {
    // fallback: de två bäst täckta serierna, vad de än råkar vara
    const b = katalog.indikatorer.slice().sort((x, y) => y.n - x.n);
    if (b[0]) await visa(A, b[0].id);
    if (b[1]) await visa(B, b[1].id);
  }
  status("");
  oversattStatiskt();

  function oversattStatiskt() {
    document.documentElement.lang = LANG;
    document.title = T("rubrik");
    document.querySelectorAll("[data-i18n]").forEach(e => { e.textContent = T(e.dataset.i18n); });
    spela.textContent = spelar ? T("paus") : T("spela");
    [...fart.options].forEach(o => { o.text = o.value + " " + T("arPerS"); });
    const vt = T("vyer") || {};
    [...vyval.options].forEach(o => { if (vt[o.value]) o.text = vt[o.value]; });
    $("#sok").placeholder = T("sok");
    for (const fl of document.querySelectorAll(".flagga")) {
      const p = fl.dataset.sprak === LANG;
      fl.style.opacity = p ? "1" : ".45";
      fl.style.borderColor = p ? "#7aa7ff" : "";
    }
  }
  for (const fl of document.querySelectorAll(".flagga"))
    fl.onclick = () => { sattSprak(fl.dataset.sprak); location.reload(); };

  /* ── loop ── */
  let bredd = "";
  function loop(t) {
    const dt = Math.min(0.1, (t - senast) / 1000); senast = t;
    if (spelar) {
      arNu += dt * parseFloat(fart.value);
      const max = parseFloat(tidslinje.max);
      if (arNu >= max) { arNu = max; spelar = false; spela.textContent = T("spela");
                         vaxlaNollForLage(); }
      tidslinje.value = arNu;
    }
    if (rotera.checked && !dras) yaw += dt * 0.06;
    const hel = Math.floor(arNu);
    arEl.textContent = hel < 0 ? `${-hel} ${T("fKr")}` : hel;
    let synliga = 0;
    for (const p of paneler) {
      if (!p.glob) continue;
      synliga++;
      const m = p.glob.meta;
      const ar = Math.min(Math.max(arNu, m.ar[0]), m.ar.at(-1));
      p.glob.rita(ar, yaw, pitch, parseFloat(reliefEl.value));
      const lag = Math.round(p.glob.arTillLager(ar));
      if (lag !== p._barLager) ritaBarFor(p, ar);
      const iTid = arNu >= m.ar[0] - 0.5 && arNu <= m.ar.at(-1) + 0.5;
      const tit = p.el.querySelector(".titel");
      const txt = iTid ? m.titel : `${m.titel} (${Math.round(ar)})`;
      if (tit.textContent !== txt) tit.textContent = txt;
    }
    uppdateraKorr(arNu);
    // Mittkolumnen tar 168 px plus luft. Utan avdraget summerade två 46vw-glober
    // plus kolumnen till mer än fönstret på en vanlig 1440-skärm, och den högra
    // globen wrappade ner under den vänstra.
    // Mittkolumnen (168 px) plus gap och padding tar ~250 px. Utan avdraget
    // summerade två 46vw-glober plus kolumnen till mer än fönstret på en vanlig
    // 1440-skärm, och den högra globen wrappade ner under den vänstra. Golvet
    // på 40vw håller de små skärmarna oförändrade — där lägger sig kolumnen
    // ändå på egen rad.
    const b = synliga <= 1 ? "62vw"
            : "max(40vw, min(46vw, calc((100vw - 250px) / 2)))";
    if (b !== bredd) { bredd = b; document.documentElement.style.setProperty("--globbredd", b); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
