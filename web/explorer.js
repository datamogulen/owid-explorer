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

  let arNu = 2020, spelar = false, yaw = 0.6, pitch = 0.25, senast = 0, dras = null;

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
      nollpunkt: 0, medel: false, relieffaktor: 0.9, landdata: true,
      linjarGain: tung.skala === "log10" ? 1.0 : 0,
      standardSkala: tung.skala === "log10" ? "log" : "lin",   // "lin" här = identitet
    });
    cache[id] = meta;
    return meta;
  }

  /* ── panelerna ── */
  const paneler = [];
  function skapaPanel(plats) {
    const p = { plats, id: null, glob: null, nollLage: null, skala: null };
    const el = document.createElement("div");
    el.className = "panel";
    el.innerHTML = `
      <h2><button class="serieknapp" type="button"><span class="titel"></span>
        <span class="pil">▾</span></button></h2>
      <div class="saknas"></div>
      <canvas class="glob" width="1120" height="1120" style="display:none"></canvas>
      <canvas class="bar" width="1120" height="102" style="display:none"></canvas>
      <div class="regel"></div>
      <div class="globPop pop">
        <label class="skalval"><span>${T("skala")}</span>
          <select><option value="log">${T("log")}</option>
                  <option value="lin">${T("linjar")}</option></select></label>
        <label class="nollval"><span>${T("nollniva")}</span>
          <select><option value="noll">0</option>
                  <option value="medel">${T("nollAret")}</option>
                  <option value="fast">${T("nollFast")}</option></select></label>
      </div>`;
    el.querySelector(".titel").textContent = T("valjSerie");
    el.querySelector(".saknas").textContent = T("valjSerie");
    behallare.append(el);
    p.el = el;
    el.querySelector(".serieknapp").onclick = () => oppnaValjare(p);
    el.querySelector(".skalval select").onchange = e => {
      p.skala = e.target.value;
      p.glob.lin = p.glob.meta.skala === "log10" && p.skala === "lin";
      ritaBarFor(p);
    };
    el.querySelector(".nollval select").onchange = e => { p.nollLage = e.target.value; visa(p); };
    paneler.push(p);
    return p;
  }

  async function visa(p, nyttId) {
    if (nyttId) p.id = nyttId;
    if (!p.id) return;
    const meta = await laddaSerie(p.id);
    if (!meta) return;
    if (p.nollLage === null) p.nollLage = meta.nollLage || "medel";
    if (p.skala === null) p.skala = meta.standardSkala;
    const el = p.el;
    const canvas = el.querySelector("canvas.glob"), bar = el.querySelector("canvas.bar");
    const gammalZoom = p.glob ? p.glob.zoom : null;
    if (p.glob) { p.glob.dispose(); p.glob = null; }
    el.querySelector(".titel").textContent = meta.titel;
    // divergerande ramp så fort det finns en nollnivå att divergera KRING
    const ramp = p.nollLage === "noll" ? "energi" : "energi_div";
    p.glob = new Glob(canvas, meta, ramp, kust, true);
    p.glob.sattLandmask({ nx: lander.mesh.nx, ny: lander.mesh.ny, data: lander.mesh.andel });
    p.glob.nollMedel =
      p.nollLage === "medel" ? meta.globalmedel
      : p.nollLage === "fast" ? meta.globalmedel.map(() => meta.globalmedel[0])
      : null;
    // Skalväljaren gäller bara data som LAGRATS logaritmiskt. Shaderns lin-läge
    // är 10^((v−1)·SPAN), alltså av-logaritmering — kör man den på redan linjär
    // data med SPAN 54 (t.ex. medellivslängd 30–84 år) blir varje höjd 10⁻²⁷ och
    // globen alldeles platt fast färgen ser rätt ut.
    p.glob.lin = meta.skala === "log10" && p.skala === "lin";
    if (gammalZoom) p.glob.zoom = gammalZoom; else p.glob.zoom = VYER[vyval.value].zoom;
    el.querySelector(".saknas").style.display = "none";
    canvas.style.display = ""; bar.style.display = "";
    const sk = el.querySelector(".skalval");
    sk.style.display = meta.skala === "log10" ? "" : "none";
    sk.querySelector("select").value = p.skala;
    const nv = el.querySelector(".nollval").querySelector("select");
    nv.options[2].text = T("nollFast").replace("{ar}", meta.ar[0]);
    nv.value = p.nollLage;
    el.querySelector(".regel").innerHTML =
      `${meta.enhet ? `<b>${meta.enhet}</b> · ` : ""}${meta.kalla || ""}` +
      `<br>${meta.regel} · ${meta.medelMetod}`;
    byggReglage(p);
    byggKnappar(p);
    ritaBarFor(p);
    uppdateraTid();
    laggTillDelning();
  }

  function ritaBarFor(p, ar = arNu) {
    if (!p.glob) return;
    const g = p.glob;
    ritaBar(p.el.querySelector("canvas.bar"), g.meta,
            p.nollLage === "noll" ? "energi" : "energi_div", !!g.lin,
            g.nollMedel ? g.pivotNu(ar).f : null, g.statistik(ar), g);
    p._barLager = Math.round(g.arTillLager(ar));
  }

  function byggReglage(p) {
    const pop = p.el.querySelector(".globPop");
    pop.querySelectorAll(".perGlob").forEach(e => e.remove());
    const d = document.createElement("div");
    d.className = "perGlob";
    d.innerHTML = `<label title="${T("reliefTitel")}"><span>${T("reliefKort")}</span>
      <input type="range" class="pRelief" min="0" max="2" step="0.02"
             value="${p.glob.reliefMul.toFixed(2)}"></label>
      <div class="stlRad"><button class="stlBtn" title="${T("stlTitel")}">${T("stlKnapp")}</button></div>`;
    pop.append(d);
    d.querySelector(".pRelief").oninput = e => { p.glob.reliefMul = +e.target.value; };
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
      const max = document.createElement("button");
      max.className = "maxKnapp";
      max.innerHTML = `⛶ <span class="txt">${T("maximera")}</span>`;
      max.onclick = () => {
        const stor = p.el.classList.toggle("stor");
        max.firstChild.nodeValue = stor ? "✕ " : "⛶ ";
        max.querySelector(".txt").textContent = T(stor ? "atergaVy" : "maximera");
        document.body.style.overflow = stor ? "hidden" : "";
      };
      rad.append(mer, max); wrap.append(rad, pop);
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
    alla.innerHTML = `<span>${T("alla")}</span><b>${katalog.indikatorer.length}</b>`;
    alla.onclick = () => { aktivtAmne = null; ritaAmnen(); ritaSerier(); };
    amneslista.append(alla);
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

  function ritaSerier() {
    let lista;
    if (sokstrang) {
      lista = katalog.indikatorer.filter(p =>
        (p.t + " " + (p.e || "")).toLowerCase().includes(sokstrang)).slice(0, 300);
    } else if (aktivtAmne) {
      const ids = new Set();
      for (const kat of katalog.trad)
        for (const a of kat.amnen)
          if (a.topic === aktivtAmne) a.serier.forEach(s => ids.add(s));
      lista = katalog.indikatorer.filter(p => ids.has(p.id));
    } else {
      lista = katalog.indikatorer.slice().sort((a, b) => b.n - a.n).slice(0, 300);
    }
    serielista.innerHTML = "";
    if (!lista.length) { serielista.innerHTML = `<p class="inga">${T("inga")}</p>`; return; }
    for (const p of lista) {
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
      serielista.append(b);
    }
  }

  /* ── tid ── */
  function uppdateraTid() {
    const g = paneler.filter(p => p.glob);
    if (!g.length) return;
    tidslinje.min = Math.min(...g.map(p => p.glob.meta.ar[0]));
    tidslinje.max = Math.max(...g.map(p => p.glob.meta.ar.at(-1)));
    tidslinje.step = 0.02;
    arNu = Math.min(Math.max(arNu, +tidslinje.min), +tidslinje.max);
    tidslinje.value = arNu;
  }
  spela.onclick = () => {
    spelar = !spelar;
    if (spelar && arNu >= parseFloat(tidslinje.max) - 0.01) arNu = parseFloat(tidslinje.min);
    spela.textContent = spelar ? T("paus") : T("spela");
  };
  tidslinje.oninput = () => { arNu = parseFloat(tidslinje.value); };
  vyval.onchange = e => {
    const v = VYER[e.target.value]; if (!v) return;
    yaw = -v.lon * Math.PI / 180;
    pitch = Math.max(-1.4, Math.min(1.4, v.lat * Math.PI / 180));
    paneler.forEach(p => { if (p.glob) p.glob.zoom = v.zoom; });
  };
  $("#instknapp").onclick = e => {
    e.stopPropagation();
    const o = $("#instpanel").classList.toggle("open");
    if (o) stangPop(null);
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
    history.replaceState(null, "", "#s=" + encodeURIComponent(bit) + "&ar=" + Math.round(arNu));
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
  const hash = new URLSearchParams(location.hash.slice(1));
  let start = [["life-expectancy", null, null], ["gdp-per-capita-worldbank", null, null]];
  if (hash.get("s")) {
    const bitar = decodeURIComponent(hash.get("s")).split(",").filter(Boolean)
      .map(b => b.split("~"));
    if (bitar.length) start = bitar;
  }
  if (hash.get("ar")) arNu = +hash.get("ar");
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
      if (arNu >= max) { arNu = max; spelar = false; spela.textContent = T("spela"); }
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
    const b = synliga <= 1 ? "62vw" : "46vw";
    if (b !== bredd) { bredd = b; document.documentElement.style.setProperty("--globbredd", b); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
