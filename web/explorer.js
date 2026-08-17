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
  let lander = null, katalog = null, kust = null;
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
    const m = p.glob.meta, harTak = m.skala === "log10";
    const CAPSPAN = 2.5, SPAN = m.vmax - m.vmin;
    const gainTillSlider = g => 1 - Math.log10(g) / CAPSPAN;
    d.innerHTML = `<label title="${T("reliefTitel")}"><span>${T("reliefKort")}</span>
      <input type="range" class="pRelief" min="0" max="2" step="0.02"
             value="${p.glob.reliefMul.toFixed(2)}"></label>` +
      (harTak ? `<label title="${T("takTitel")}"><span class="takTxt">${T("tak")}</span>
      <input type="range" class="pTak" min="0" max="1" step="0.02"
             value="${gainTillSlider(p.glob.gainHojd).toFixed(2)}"></label>` : "") +
      `<div class="stlRad"><button class="stlBtn" title="${T("stlTitel")}">${T("stlKnapp")}</button></div>`;
    pop.append(d);
    d.querySelector(".pRelief").oninput = e => { p.glob.reliefMul = +e.target.value; };
    if (harTak) {
      const takTxt = d.querySelector(".takTxt");
      const settTak = sl => {
        const c = 1 - (1 - sl) * CAPSPAN / SPAN;          // takets läge på skalan
        p.glob.gainHojd = Math.pow(10, (1 - Math.max(0, Math.min(1, c))) * SPAN);
        takTxt.textContent = T("tak") + " " + p.glob.fysisktVarde(Math.max(0, Math.min(1, c)));
        ritaBarFor(p);
      };
      settTak(gainTillSlider(p.glob.gainHojd));
      d.querySelector(".pTak").oninput = e => settTak(+e.target.value);
    }
    const sb = d.querySelector(".stlBtn");
    sb.onclick = () => {
      sb.disabled = true; const gam = sb.textContent; sb.textContent = "…";
      setTimeout(() => {
        try { exporteraSTL(p); sb.textContent = T("stlKlar"); }
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
  const ruta = document.createElement("div");
  ruta.id = "tips";
  document.body.append(ruta);
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
        ruta.style.display = "none";
        return;
      }
      if (!p.glob) return;
      const r = canvas.getBoundingClientRect();
      const uv = p.glob.plockaUV((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      if (!uv) { ruta.style.display = "none"; return; }
      const G = lander.fin;
      const j = Math.max(0, Math.min(G.ny - 1, Math.floor(uv.v * G.ny)));
      const i = (((Math.floor(uv.u * G.nx) % G.nx) + G.nx) % G.nx);
      const k = G.kod[j * G.nx + i];
      const namn = (k !== 65535 && lander.namn[k]) ? lander.namn[k] : T("havText");
      let txt = namn;
      if (k !== 65535 && lander.namn[k]) {
        const m = p.glob.meta;
        let t = m.ar.indexOf(Math.round(arNu));
        if (t < 0) {
          let b = 0, d = 1e9;
          m.ar.forEach((a, ii) => { const q = Math.abs(a - arNu); if (q < d) { d = q; b = ii; } });
          t = b;
        }
        const ra = m.landvarden[t * m.nland + k];
        txt += " · " + (ra ? p.glob.fysisktVarde((ra - 1) / 65534) : T("ingenData2"));
      }
      ruta.textContent = txt;
      ruta.style.display = "block";
      ruta.style.left = (e.clientX + 14) + "px";
      ruta.style.top = (e.clientY + 14) + "px";
    });
    canvas.addEventListener("pointerleave", () => { ruta.style.display = "none"; });
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
  function uppdateraKorr(ar) {
    const p = paneler.filter(q => q.glob);
    if (p.length < 2) { korrEl.className = "tom"; return; }
    const [A, B] = p, ma = A.glob.meta, mb = B.glob.meta;
    const la = lagerVid(ma, ar), lb = lagerVid(mb, ar);
    const nyckel = `${A.id}|${B.id}|${la.t}|${lb.t}`;
    if (nyckel === korrEl.dataset.nyckel) return;
    korrEl.dataset.nyckel = nyckel;
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
    const abs = Math.abs(r);
    const styrka = abs >= 0.7 ? T("korrStark") : abs >= 0.4 ? T("korrMedel")
                 : abs >= 0.2 ? T("korrSvagt") : T("korrInget");
    const tecken = abs < 0.2 ? "" : " " + (r > 0 ? T("korrPos") : T("korrNeg"));
    const fmt = v => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2).replace(".", ",");
    const arA = ma.ar[la.t], arB = mb.ar[lb.t];
    const arNot = (la.avstand > 0 || lb.avstand > 0) ? `<br>${arA} / ${arB}` : "";
    korrEl.innerHTML =
      `<div class="rubrik">${T("korrRubrik")}</div>
       <div class="varde">r = ${fmt(r)}</div>
       <div class="styrka">${styrka}${tecken}</div>
       <div class="rad2">${T("korrRang")} <b>${fmt(rho)}</b><br>
         <b>${x.length}</b> ${T("korrLander")}${arNot}</div>
       <div class="varn">${T("korrVarning")}
         <button class="korrMer" type="button">${T("korrMer")} ›</button></div>`;
    korrEl.append(korrPop);          // innerHTML ovan slänger den annars
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
  $("#omknapp").onclick = () => $("#om").classList.add("open");
  $("#omStang").onclick = () => $("#om").classList.remove("open");
  $("#om").onclick = e => { if (e.target === $("#om")) $("#om").classList.remove("open"); };
  $("#omKropp").innerHTML = T("omHtml");

  /* ── STL: samma motor som klimatgloberna, samma fyra filer ── */
  function exporteraSTL(p) {
    if (!p.glob) throw new Error("ingen glob");
    exporteraPlatoSTL(p.glob, lander, arNu, parseFloat(reliefEl.value), p.id);
  }

  /* ── start ── */
  const A = skapaPanel(0), B = skapaPanel(1);
  behallare.insertBefore(korrEl, B.el);      // mitt emellan globerna
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
    const b = synliga <= 1 ? "62vw" : "46vw";
    if (b !== bredd) { bredd = b; document.documentElement.style.setProperty("--globbredd", b); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
