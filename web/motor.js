/* motor.js — globmotorn: hämtning, STL-export, färgramper, Glob-klassen och
   färgskalan. Delas av klimatgloberna (hedin.it/climate-globes) och
   OWID-utforskaren (hedin.it/owid-explorer), som annars skulle bli två kopior
   som glider isär. Allt som är SPECIFIKT för en av dem — vilka dataset som
   finns, hur gränssnittet ser ut — bor i respektive sidas egen app-fil.

   Kräver att i18n.js laddats först: T(), lokal(), ENHETTEXT() och LANG. */
const VERSION = "42";
/* Cache-bust bara över http(s) (webben). I appen laddas allt via file://
   där ?v= skulle bryta fil-URL:erna → tom sträng där. */
const CB = (typeof location !== "undefined" && location.protocol === "file:") ? "" : "?v=" + VERSION;

/* Publik bas för delningslänkar. Appen kör file:// men delade länkar ska
   peka på den publika webben. */
const DELA_BAS = (typeof location !== "undefined" && location.protocol === "file:")
  ? "https://hedin.it/climate-globes/"
  : location.origin + location.pathname;

/* Hämtar en lokal fil via XHR. Android-WebView blockerar fetch() över file://
   men tillåter XHR (status 0 = ok där). typ: "json" | "arraybuffer". */
function hamta(url, typ) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    x.open("GET", url);
    x.responseType = typ;
    x.onload = () => (x.status === 0 || (x.status >= 200 && x.status < 300))
      ? res(x.response) : rej(new Error("HTTP " + x.status + " " + url));
    x.onerror = () => rej(new Error("nätverksfel " + url));
    x.send();
  });
}

/* ── STL-export (3D-utskrift) ── */
function stlDir(latR, lonR) {   // enhetsriktning för STL: polaxel = Z → nordpol +Z (upp),
  const cl = Math.cos(latR);    // sydpol −Z (nedåt i slicern). Ren rotation → bevarad vridning.
  return [cl * Math.cos(lonR), cl * Math.sin(lonR), Math.sin(latR)];
}
function stlBlob(tris) {   // tris: PLATT array, 9 tal (x,y,z ×3) per triangel → binär STL
  const n = (tris.length / 9) | 0;
  const buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
  dv.setUint32(80, n, true);
  let o = 84;
  for (let t = 0; t < tris.length; t += 9) {
    const ax=tris[t],ay=tris[t+1],az=tris[t+2], bx=tris[t+3],by=tris[t+4],bz=tris[t+5], cx=tris[t+6],cy=tris[t+7],cz=tris[t+8];
    const ux=bx-ax, uy=by-ay, uz=bz-az, vx=cx-ax, vy=cy-ay, vz=cz-az;
    const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx, L=Math.hypot(nx,ny,nz)||1;
    dv.setFloat32(o, nx/L, true); dv.setFloat32(o+4, ny/L, true); dv.setFloat32(o+8, nz/L, true);
    for (let k = 0; k < 9; k++) dv.setFloat32(o + 12 + k*4, tris[t+k], true);
    o += 50;
  }
  return new Blob([buf], { type: "model/stl" });
}
/* Bygger ETT slutet skal (topp = reliefytan, botten = kärnradien, väggar där grannen
   inte hör till skalet) som PLATT Float-array (9 tal/triangel → låg minnesåtgång).
   nodeUnit(j,i)=enhetsriktning för noden, topR(j,i)=toppradie, inSolid(j,i)=hör cellen
   till skalet (ska returnera false för j utanför [0,ny) och wrappa i i longitud, så
   vägg-granntesten funkar vid kanterna). Används för både grovt inland och fin kustremsa. */
function byggSkal(ny, nx, nodeUnit, topR, rCore, S, inSolid) {
  const tris = [];
  const P = (j, i, r) => { const d = nodeUnit(j, i); return [d[0]*r*S, d[1]*r*S, d[2]*r*S]; };
  const tri = (a, b, c) => tris.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]);
  const kvad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!inSolid(j, i)) continue;
    const t00=P(j,i,topR(j,i)), t01=P(j,i+1,topR(j,i+1)), t11=P(j+1,i+1,topR(j+1,i+1)), t10=P(j+1,i,topR(j+1,i));
    const b00=P(j,i,rCore), b01=P(j,i+1,rCore), b11=P(j+1,i+1,rCore), b10=P(j+1,i,rCore);
    kvad(t00, t01, t11, t10);        // topp (utåt)
    kvad(b00, b10, b11, b01);        // botten vid kärnradien (inåt)
    // Väggarna lindas MOT topp- och bottenytan (t00→t10 där toppen går
    // t10→t00), annars pekar deras normaler inåt och kanterna blir obalanserade.
    if (!inSolid(j, i-1)) kvad(t00, t10, b10, b00);   // väst-vägg
    if (!inSolid(j, i+1)) kvad(t11, t01, b01, b11);   // öst-vägg
    if (!inSolid(j-1, i)) kvad(t01, t00, b00, b01);   // syd-vägg (lägre j = lägre lat)
    if (!inSolid(j+1, i)) kvad(t10, t11, b11, b10);   // nord-vägg
  }
  return tris;
}
/* PLATÅBYGGARE för landdata. Varje land är en jämn platå, så geometrin behöver
   bara följa GRÄNSERNA — inte varje cell. Rutnätet delas i fasta block om B×B
   celler: ett block där alla celler har samma nyckel blir EN solfjäder med
   fyra hörn, medan block som innehåller en gräns tesselleras cellvis.

   Blocken ligger i ETT globalt rutnät som alla block delar, och det är hela
   poängen: två grannar möts alltid längs exakt samma punkter. Ett tidigare
   försök slog i stället ihop celler greedy till rektanglar — men två rektanglar
   som möttes längs en delad kant hade valts olika av sökningen, fick olika
   brytpunkter, och skalet läckte (mätt: 89 343 öppna kanter i "över", 114 723
   i havet). Slicern lagade hålen med plana lock — det var bandet över södra
   halvklotet. Att sampla varje rand i varje nod täppte hålen men gav 356 MB.

   Blocken slås dessutom ihop 2×2 uppåt så länge fyra grannar är lika stora och
   har samma nyckel — så Stilla havet blir några få stora rutor medan kusterna
   får finaste storleken. En sida samplas i varje nod utom när grannen är ett
   block av SAMMA storlek med SAMMA nyckel; då räcker hörnet. Regeln är
   symmetrisk, så båda sidor gör alltid samma val. Sagittan för ett block på
   3,2° är 0,02 mm på en 50 mm-glob, alltså under lagerhöjden. */
function byggPlatoer(ny, nx, dirF, nyckel, radieAv, rCore, S, B = 2) {
  // Största block ≈ 3,2°: sagittan blir 0,02 mm på en 50 mm-glob, långt under
  // lagerhöjden. Härleds ur griddet så ett grövre grid inte ger klumpiga rutor.
  const NIVAER = 1 + Math.max(0, Math.floor(Math.log2(Math.max(1, 3.2 * nx / 360) / B)));
  const tris = [];
  const P = (j, i, r) => { const d = dirF(j, i); return [d[0]*r*S, d[1]*r*S, d[2]*r*S]; };
  const tri = (a, b, c) => tris.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]);
  const kvad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  const nyk = (j, i) => (j < 0 || j >= ny) ? -1 : nyckel(j, ((i % nx) + nx) % nx);
  const BLANDAT = -2;
  const BJ = Math.ceil(ny / B), BI = Math.ceil(nx / B);
  const bk = new Int32Array(BJ * BI);          // blockets nyckel (BLANDAT = gräns inuti)
  const bs = new Int32Array(BJ * BI);          // blockets storlek, i antal småblock
  for (let J = 0; J < BJ; J++) for (let I = 0; I < BI; I++) {
    const j0 = J*B, i0 = I*B, j1 = Math.min(ny, j0+B), i1 = Math.min(nx, i0+B);
    const k = nyk(j0, i0); let lika = true;
    for (let j = j0; j < j1 && lika; j++)
      for (let i = i0; i < i1; i++) if (nyk(j, i) !== k) { lika = false; break; }
    bk[J*BI + I] = lika ? k : BLANDAT; bs[J*BI + I] = 1;
  }
  for (let n = 1; n < NIVAER; n++) {           // 2×2-hopslagning nivå för nivå
    const s = 1 << (n - 1);
    for (let J = 0; J + 2*s <= BJ; J += 2*s) for (let I = 0; I + 2*s <= BI; I += 2*s) {
      const a = J*BI + I, k = bk[a];
      if (k === BLANDAT || bs[a] !== s) continue;
      if (bk[a+s] !== k || bs[a+s] !== s) continue;
      if (bk[a+s*BI] !== k || bs[a+s*BI] !== s) continue;
      if (bk[a+s*BI+s] !== k || bs[a+s*BI+s] !== s) continue;
      for (let y = 0; y < 2*s; y++) for (let x = 0; x < 2*s; x++) bs[(J+y)*BI + I+x] = 2*s;
    }
  }
  const qAt = (J, I) => (J < 0 || J >= BJ) ? -1 : J*BI + (((I % BI) + BI) % BI);
  for (let J = 0; J < BJ; J++) for (let I = 0; I < BI; I++) {
    const s = bs[J*BI + I], k = bk[J*BI + I];
    if (J % s || I % s) continue;              // bara blockets hörnruta ritar det
    const j0 = J*B, i0 = I*B, j1 = Math.min(ny, j0 + s*B), i1 = Math.min(nx, i0 + s*B);
    if (k === BLANDAT) {                       // gränsen går genom blocket: cellvis
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
        const kk = nyk(j, i);
        if (kk < 0) continue;
        const r = radieAv(kk);
        kvad(P(j,i,r), P(j,i+1,r), P(j+1,i+1,r), P(j+1,i,r));                   // topp utåt
        kvad(P(j,i,rCore), P(j+1,i,rCore), P(j+1,i+1,rCore), P(j,i+1,rCore));   // botten inåt
      }
      continue;
    }
    if (k < 0) continue;                       // hela blocket utanför skalet
    const r = radieAv(k);
    const rand = [];
    const sida = (fran, till, tatt, nod) => {   // tätt = varje nod, annars bara hörnet
      if (!tatt) { rand.push(nod(fran)); return; }
      const steg = till > fran ? 1 : -1;
      for (let x = fran; x !== till; x += steg) rand.push(nod(x));
    };
    const olik = (J2, I2) => { const q = qAt(J2, I2); return q < 0 || bs[q] !== s || bk[q] !== k; };
    sida(i0, i1, olik(J-1, I),   x => [j0, x]);   // låg-lat-kanten, väst→öst
    sida(j0, j1, olik(J, I+s),   y => [y, i1]);   // öst-kanten
    sida(i1, i0, olik(J+s, I),   x => [j1, x]);   // hög-lat-kanten, öst→väst
    sida(j1, j0, olik(J, I-1),   y => [y, i0]);   // väst-kanten
    const mt = P((j0+j1)/2, (i0+i1)/2, r), mb = P((j0+j1)/2, (i0+i1)/2, rCore);
    for (let n = 0; n < rand.length; n++) {
      const a = rand[n], b = rand[(n + 1) % rand.length];
      tri(mt, P(a[0], a[1], r), P(b[0], b[1], r));               // topp utåt
      tri(mb, P(b[0], b[1], rCore), P(a[0], a[1], rCore));       // botten inåt
    }
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {    // väggar vid gränser
    const k = nyk(j, i);
    if (k < 0) continue;
    const v = nyk(j, i-1) !== k, o = nyk(j, i+1) !== k,
          nn = nyk(j-1, i) !== k, sy = nyk(j+1, i) !== k;
    if (!v && !o && !nn && !sy) continue;      // inne i platån: inga punkter behövs
    const r = radieAv(k);
    const t00=P(j,i,r), t01=P(j,i+1,r), t11=P(j+1,i+1,r), t10=P(j+1,i,r);
    const b00=P(j,i,rCore), b01=P(j,i+1,rCore), b11=P(j+1,i+1,rCore), b10=P(j+1,i,rCore);
    // Väggarna lindas MOT ytorna ovanför/nedanför, annars pekar normalerna inåt
    // och varje väggkant blir obalanserad (mätt: 126 260 kanter i "över").
    if (v)  kvad(t00, t10, b10, b00);
    if (o)  kvad(t11, t01, b01, b11);
    if (nn) kvad(t01, t00, b00, b01);
    if (sy) kvad(t10, t11, b11, b10);
  }
  return tris;
}
function byggKarna(ny, nx, rCore, S) {   // solid kärnsfär (grovt rutnät), platt array
  const tris = [];
  const P = (j, i) => { const latR=(j/ny*180-90)*Math.PI/180, lonR=(i/nx*360-180)*Math.PI/180;
    const d = stlDir(latR, lonR); return [d[0]*rCore*S, d[1]*rCore*S, d[2]*rCore*S]; };
  const tri = (a, b, c) => tris.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a=P(j,i), b=P(j,i+1), c=P(j+1,i+1), e=P(j+1,i); tri(a,b,c); tri(a,c,e);
  }
  return tris;
}

/* ── Färgskalor (samma ramper i GLSL och JS-färgstaplar).
   Divergerande ramper indexeras i enheter av "nollpunkt": 1.0 = noll. ── */
const RAMPER = {
  // energi: mörkt (lite) → glödande (mycket). Divergerande varianten används när
  // nollnivån är det globala snittet (1.0 = snittet).
  energi:     [ [0.00, [ 16, 18, 26]], [0.22, [ 46, 40, 92]], [0.48, [150, 62, 92]],
                [0.74, [238,148, 54]], [1.00, [255,248,214]] ],
  energi_div: [ [0.00, [ 20, 52,104]], [0.55, [ 92,142,196]], [1.00, [238,238,232]],
                [1.45, [240,170, 74]], [2.10, [196, 66, 34]], [3.00, [104, 16, 14]] ],
  so2:  [ [0.00, [242,239,233]], [0.30, [232,212, 77]], [0.60, [208,120, 24]],
          [0.85, [138, 43, 30]], [1.00, [ 58, 15, 20]] ],
  kol:  [ [0.00, [245,243,238]], [0.35, [180,168,150]], [0.70, [105, 92, 80]],
          [1.00, [ 36, 29, 25]] ],
  temp: [ [0.00, [ 28, 47,107]], [0.50, [120,155,214]], [1.00, [245,245,240]],
          [1.55, [255,204,102]], [2.20, [192, 57, 43]], [3.00, [ 94, 11, 11]] ],
  // absolut temperatur: blå (kallt) → vit (0 °C, pivot) → röd (varmt)
  temp_abs: [ [0.00, [ 30, 45,120]], [0.55, [ 78,130,196]], [1.00, [245,245,240]],
              [1.35, [242,165, 92]], [1.60, [206, 78, 43]], [1.875, [150, 24, 24]] ],
  moln: [ [0.00, [ 26, 52,102]], [0.50, [125,143,163]], [1.00, [246,248,251]] ],
  moln_anom: [ [0.00, [141, 88, 28]], [0.85, [235,230,219]], [1.00, [246,246,244]],
               [1.15, [216,226,236]], [2.00, [ 38, 79,148]] ],
  regn: [ [0.00, [250,248,235]], [0.30, [168,209,141]], [0.60, [ 58,148,120]],
          [1.00, [ 14, 59,118]] ],
  regn_anom: [ [0.00, [150, 90, 30]], [0.90, [240,236,226]], [1.00, [246,246,242]],
               [1.10, [224,237,231]], [2.00, [ 18,108, 88]] ],
  sol:  [ [0.00, [ 18, 22, 52]], [0.35, [ 90,115,165]], [0.65, [235,200,110]],
          [1.00, [255,250,235]] ],
  sol_anom: [ [0.00, [ 92, 82, 66]], [0.88, [232,229,222]], [1.00, [246,246,242]],
              [1.12, [248,238,200]], [2.00, [255,196, 40]] ],
  ozon: [ [0.00, [ 84,  8,130]], [0.55, [176,120,200]], [0.90, [235,228,238]],
          [1.00, [244,244,242]], [1.60, [186,214,196]], [2.35, [ 92,150,112]] ],
  natt: [ [0.00, [  7,  7, 10]], [0.10, [ 55, 38, 20]], [0.30, [150, 95, 30]],
          [0.60, [235,185, 80]], [1.00, [255,252,230]] ],
  folk: [ [0.00, [ 12, 14, 22]], [0.30, [ 42, 60,100]], [0.60, [150, 92, 52]],
          [0.85, [238,160, 62]], [1.00, [255,240,200]] ],
  vind: [ [0.00, [ 26, 40, 70]], [0.35, [ 60,130,140]], [0.65, [180,205,120]],
          [1.00, [250,240,140]] ],
  is:   [ [0.00, [ 20, 44, 82]], [0.45, [ 70,110,160]], [0.75, [180,205,225]],
          [1.00, [250,252,255]] ],
  mark: [ [0.00, [150,110, 60]], [0.35, [200,180,120]], [0.70, [110,170,120]],
          [1.00, [ 30,100,140]] ],
  sno:  [ [0.00, [ 30, 45, 70]], [0.40, [110,130,165]], [0.75, [205,215,232]],
          [1.00, [252,253,255]] ],
  fukt: [ [0.00, [210,195,160]], [0.40, [130,180,175]], [0.75, [ 60,130,175]],
          [1.00, [ 20, 60,130]] ],
  avd:  [ [0.00, [245,244,235]], [0.40, [170,205,150]], [0.72, [ 70,155,140]],
          [1.00, [ 20, 90,130]] ],
  tryck: [ [0.00, [ 60, 80,150]], [0.70, [150,175,210]], [1.00, [246,246,244]],
           [1.30, [235,180,140]], [1.607, [190, 70, 50]] ],
  // divergerande anomali-ramper (symmetriska kring 1.0 = ingen ändring)
  vind_anom: [ [0.00, [ 70, 90,150]], [0.85, [220,225,232]], [1.00, [246,246,244]],
               [1.15, [238,214,168]], [2.00, [205,120, 35]] ],
  is_anom:   [ [0.00, [190, 55, 45]], [0.85, [238,222,216]], [1.00, [246,246,244]],
               [1.15, [198,214,230]], [2.00, [ 40, 95,168]] ],
  sno_anom:  [ [0.00, [150, 95, 45]], [0.85, [234,226,216]], [1.00, [246,246,244]],
               [1.15, [204,216,232]], [2.00, [ 70,115,178]] ],
  ozon_anom: [ [0.00, [ 95, 20,130]], [0.85, [224,214,232]], [1.00, [246,246,244]],
               [1.15, [212,228,206]], [2.00, [ 55,140, 80]] ],
  fukt_anom: [ [0.00, [150, 95, 40]], [0.85, [234,226,216]], [1.00, [246,246,244]],
               [1.15, [200,214,230]], [2.00, [ 35, 95,165]] ],
  tryck_anom:[ [0.00, [ 70, 90,155]], [0.85, [222,226,232]], [1.00, [246,246,244]],
               [1.15, [236,196,175]], [2.00, [190, 75, 55]] ],
  // utsläppsförändring: minskning (grön/blå) → 0 (vit) → ökning (röd)
  so2_anom:  [ [0.00, [ 35,125,120]], [0.85, [216,232,229]], [1.00, [246,246,244]],
               [1.15, [238,210,180]], [2.00, [200, 70, 42]] ],
  kol_anom:  [ [0.00, [ 45, 95,168]], [0.85, [216,224,234]], [1.00, [246,246,244]],
               [1.15, [238,205,180]], [2.00, [188, 55, 44]] ],
  // nattljus-förändring: mörkare (0.00) → 0 (vit) → ljusare/varmare (2.00)
  natt_anom: [ [0.00, [ 40, 70,140]], [0.85, [210,216,230]], [1.00, [246,246,244]],
               [1.15, [242,226,170]], [2.00, [232,170, 40]] ],
  // befolkningsförändring: minskning (blå/turkos) → 0 (vit) → ökning (röd/magenta)
  folk_anom: [ [0.00, [ 40,110,150]], [0.85, [214,228,232]], [1.00, [246,246,244]],
               [1.15, [236,206,206]], [2.00, [190, 50, 90]] ],
};

function rampFarg(ramp, t) {
  const st = RAMPER[ramp];
  if (t <= st[0][0]) return st[0][1];
  for (let i = 1; i < st.length; i++) {
    if (t <= st[i][0]) {
      const f = (t - st[i-1][0]) / (st[i][0] - st[i-1][0]);
      return st[i-1][1].map((c, k) => c + f * (st[i][1][k] - c));
    }
  }
  return st[st.length - 1][1];
}

function rampGLSL(ramp) {
  const st = RAMPER[ramp];
  const v = c => `vec3(${(c[0]/255).toFixed(3)},${(c[1]/255).toFixed(3)},${(c[2]/255).toFixed(3)})`;
  let s = `vec3 farg(float t){\n`;
  s += `  t = clamp(t, ${st[0][0].toFixed(3)}, ${st[st.length-1][0].toFixed(3)});\n`;
  for (let i = 1; i < st.length; i++) {
    const [p0, c0] = st[i-1], [p1, c1] = st[i];
    s += `  if (t <= ${p1.toFixed(3)}) return mix(${v(c0)}, ${v(c1)}, (t - ${p0.toFixed(3)}) / ${(p1-p0).toFixed(3)});\n`;
  }
  s += `  return ${v(st.at(-1)[1])};\n}\n`;
  return s;
}

/* ── Minimal matrislåda ── */
function persp(fov, aspekt, nara, fjarr) {
  const f = 1 / Math.tan(fov / 2), m = new Float32Array(16);
  m[0] = f / aspekt; m[5] = f;
  m[10] = (fjarr + nara) / (nara - fjarr); m[11] = -1;
  m[14] = 2 * fjarr * nara / (nara - fjarr);
  return m;
}
function rotXY(yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw),
        cp = Math.cos(pitch), sp = Math.sin(pitch);
  return new Float32Array([          // R = Rx(pitch)·Ry(yaw), kolumnmajor
    cy, sp*sy, -cp*sy, 0,
    0,  cp,     sp,    0,
    sy, -sp*cy, cp*cy, 0,
    0, 0, 0, 1]);
}

/* ── Enhetshjälp ── */
const R_JORD = 6371000, SEK_PER_AR = 31556952;      // m, s/år
function lokal() { return LANG === "sv" ? "sv-SE" : "en-US"; }
function cellArea1grad(latDeg) {                     // m² för en 1°×1°-cell vid latituden
  const rad = Math.PI / 180;
  return R_JORD * R_JORD * rad *
    (Math.sin((latDeg + 0.5) * rad) - Math.sin((latDeg - 0.5) * rad));
}
function formateraUtslappKm2(kg) {                   // kg/km²/år → begriplig enhet (densitet)
  const ton = kg / 1000;
  if (ton >= 1e3) return Math.round(ton / 1e3).toLocaleString(lokal()) + " " + T("tusenTonKm2");
  if (ton >= 1)   return ton.toLocaleString(lokal(), { maximumSignificantDigits: 2 }) + " " + T("tonKm2");
  if (kg >= 1)    return Math.round(kg).toLocaleString(lokal()) + " " + T("kgKm2");
  return Math.round(kg * 1000).toLocaleString(lokal()) + " " + T("gKm2");
}

/* ── Glob ── */
class Glob {
  constructor(canvas, meta, rampNamn, kust, kustLjus = false) {
    this.meta = meta;
    this.ramp = rampNamn;
    this.kustLjus = kustLjus;   // ljusa kustlinjer för mörka ramper
    // Hav och kustlinje är sidans, inte motorns: klimatgloberna står på mörk
    // botten, utforskaren på ljus. Utan detta blir havet en svart fläck mitt
    // på en beige sida.
    const f3 = (v, d) => (Array.isArray(v) && v.length === 3) ? v : d;
    this.havFarg = f3(meta.havFarg, [0.13, 0.15, 0.19]);
    // Grundljuset: på mörk botten får skuggsidan gärna gå ned i 0,38, men på
    // ljus botten blir samma siffra en grå klump mitt i bilden.
    this.ljusMin = typeof meta.ljusMin === "number" ? meta.ljusMin : 0.38;
    this.kustFarg = f3(meta.kustFarg, kustLjus ? [0.42, 0.44, 0.48] : [0.10, 0.10, 0.12]);
    this.kanaler = meta.kanaler || 1;   // 1 = R8, 2 = RG8 (bivariat)
    this.reliefMul = 1;                  // per-glob relief-multiplikator (befolkning-reglage)
    this.gainHojd = meta.linjarGainHojd || meta.linjarGain || 1;   // höjdtak (befolkning-reglage)
    // preserveDrawingBuffer: utan den rensas bufferten efter varje bildruta och
    // canvasen går inte att läsa ut — previewbilden blev tom. Kostar en aning
    // prestanda, men gör att globen alltid går att fånga som bild.
    this.gl = canvas.getContext("webgl2", { antialias: true, preserveDrawingBuffer: true });
    if (!this.gl) throw new Error("WebGL2 saknas i webbläsaren");
    // Kamerans avstånd. 5,2 lämnade en bred svart ram runt klotet; 4,8 fyller
    // rutan bättre och håller ändå högsta reliefen (r≈1,4) innanför bildvinkeln.
    this.zoom = 4.8;
    this._byggProgram();
    // Meshen kapas vid 0,25°: finare mesh ger bara trögare rendering, medan
    // FÄRGEN läses per pixel och därför följer gränsgriddet hur fint det än är.
    const mNy = Math.min(meta.ny, 720), mNx = Math.min(meta.nx, 1440);
    this._byggMesh(mNy, mNx);
    if (meta.platta) this._byggPlatta(); else this._byggTextur();
    this._byggKust(kust);
    this.sattMedel(5);
  }

  dispose() {   // frigör GL-resurser (vid växling abs↔anomali)
    const gl = this.gl;
    gl.deleteProgram(this.prog); gl.deleteVertexArray(this.vao);
    if (this.tex) gl.deleteTexture(this.tex);
    gl.deleteTexture(this.kustTex);
    if (this.kodTex) gl.deleteTexture(this.kodTex);
    if (this.kodTexFin && this.kodTexFin !== this.kodTex) gl.deleteTexture(this.kodTexFin);
    if (this.vardeTex) gl.deleteTexture(this.vardeTex);
    if (this.landTex) gl.deleteTexture(this.landTex);
    gl.deleteTexture(this.pickTex); gl.deleteFramebuffer(this.pickFB);
  }

  _byggKust(kust) {
    const gl = this.gl;
    this.kustTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.kustTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (kust) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, kust.nx, kust.ny, 0,
                    gl.RED, gl.UNSIGNED_BYTE, kust.data);
      this.harKust = true;
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0,
                    gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0]));
      this.harKust = false;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  _byggProgram() {
    const gl = this.gl;
    const biv = this.meta.kanaler === 2;             // bivariat: R = höjd, G = färg
    // Kapade log-fält (befolkning): FÄRGEN stannar i log-rymd (färgglad, syns) och
    // bara HÖJDEN blir linjär (proportionell) i linjärläget → taggigt men ljust.
    const logFarg = !biv && !!this.meta.linjarGain;
    const pivotF = biv ? this.meta.nollpunktF : this.meta.nollpunkt;  // färgens pivot
    // Landdata (energiglober): havet ligger ALLTID i pivotplanet ("havsytan") och
    // länder under snittet sjunker under det. Landmasken samplas mjukt → jämn kust.
    const landdata = !!this.meta.landdata;
    // Platådata: gränserna är EN statisk textur (landindex per cell) och höjden
    // slås upp i en liten tabell [år][land]. Upplösningen kostar därför inget
    // per år — och NEAREST ger jämna platåer med lodräta gränser.
    const platta = !!this.meta.platta;
    const vs = `#version 300 es
    precision highp float; precision highp sampler2DArray;
    uniform sampler2DArray uData;
    uniform mat4 uProj, uRot;
    uniform float uAr, uMaxLager, uRelief, uZoom, uLin, uLinGain, uLinGainH, uNollp;
    ${landdata ? "uniform sampler2D uLandTex;" : ""}
    ${platta ? "uniform sampler2D uKodTex, uVardeTex; uniform float uNland, uNar;" : ""}
    const float SPAN = ${(this.meta.vmax - this.meta.vmin).toFixed(3)};
    in vec2 aUV;
    out float vVal; out vec3 vN; out vec3 vPos; out vec2 vUV; out float vLand;
    ${platta ? `float samplaRaw(vec2 uv, float lager) {   // land → värde ur tabellen
      vec2 c = texture(uKodTex, uv).rg * 255.0;
      float k = c.r * 256.0 + c.g;                      // 65535 = hav / ingen data
      if (k > 65000.0) return 0.0;
      float l0 = floor(lager), l1 = min(l0 + 1.0, uMaxLager);
      float x = (k + 0.5) / uNland;
      float a = texture(uVardeTex, vec2(x, (l0 + 0.5) / uNar)).r;
      float b = texture(uVardeTex, vec2(x, (l1 + 0.5) / uNar)).r;
      if (a < 0.002 || b < 0.002) return max(a, b);     // saknas ett år: tween inte
      return mix(a, b, lager - l0);
    }` : `float samplaRaw(vec2 uv, float lager) {   // R-kanal (höjd / värde)
      float l0 = floor(lager);
      float a = texture(uData, vec3(uv, l0)).r;
      float b = texture(uData, vec3(uv, min(l0 + 1.0, uMaxLager))).r;
      return mix(a, b, lager - l0);
    }`}
    ${biv ? `float samplaFarg(vec2 uv, float lager) {   // G-kanal (färg)
      float l0 = floor(lager);
      float a = texture(uData, vec3(uv, l0)).g;
      float b = texture(uData, vec3(uv, min(l0 + 1.0, uMaxLager))).g;
      return mix(a, b, lager - l0);
    }` : `float sampla(vec2 uv, float lager) {   // FÄRG: uLinGain (högt tak → bebott lyser)
      float v = samplaRaw(uv, lager);
      return mix(v, min(pow(10.0, (v - 1.0) * SPAN) * uLinGain, 1.0), uLin);
    }
    float samplaHojd(vec2 uv, float lager) {   // HÖJD: tak (uLinGainH) i BÅDA lägena
      float v = samplaRaw(uv, lager);
      float logCap = min(v, 1.0 - log(uLinGainH) / (2.302585 * SPAN));   // logläge: kapa i log-rymd
      float linCap = min(pow(10.0, (v - 1.0) * SPAN) * uLinGainH, 1.0);  // linjärläge: proportionellt
      return mix(logCap, linCap, uLin);
    }`}
    vec3 riktning(vec2 uv) {
      float lat = radians(uv.y * 180.0 - 90.0);
      float lon = radians(uv.x * 360.0 - 180.0);
      return vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
    }
    float hojd(vec2 uv) {
      float rv = ${biv ? "samplaRaw(uv, uAr)" : "samplaHojd(uv, uAr)"};
      float h = (rv - uNollp) * uRelief;
      ${platta ? "if (rv < 0.002) h = 0.0;   // ingen data → havsplanet, inte botten" : ""}
      ${landdata && !platta ? "h *= pow(texture(uLandTex, uv).r, 0.6);   // andel land i cellen → mjuk kust"
        : platta ? "// platåer ska ha LODRÄT kust: dämpa inte höjden med landandelen, då\n      // blir kustcellerna en platt, landfärgad förgård ut i havet" : ""}
      return h;
    }
    void main() {
      vUV = aUV;
      vLand = ${landdata ? "texture(uLandTex, aUV).r" : "1.0"};
      ${biv ? "vVal = samplaFarg(aUV, uAr);"
            : logFarg ? "vVal = samplaRaw(aUV, uAr);"   // befolkning: färg alltid i log-rymd
                      : "float vr = samplaRaw(aUV, uAr); vVal = mix(vr, pow(10.0, (vr - 1.0) * SPAN) * uLinGain, uLin);"}
      float h = hojd(aUV);
      vec3 dir = riktning(aUV);
      vec3 p = dir * (1.0 + h);
      ${platta ? `vec3 n = dir;   // platåytan är radiell; väggarna skuggas av kanten` : `
      vec2 du = vec2(1.0 / 360.0, 0.0), dv = vec2(0.0, 1.0 / 180.0);
      vec3 pe = riktning(aUV + du) * (1.0 + hojd(aUV + du));
      vec3 pw = riktning(aUV - du) * (1.0 + hojd(aUV - du));
      vec3 pn = riktning(aUV + dv) * (1.0 + hojd(aUV + dv));
      vec3 ps = riktning(aUV - dv) * (1.0 + hojd(aUV - dv));
      vec3 n = normalize(cross(pe - pw, pn - ps));
      if (dot(n, dir) < 0.0) n = -n;`}
      vN = mat3(uRot) * n;
      vec4 world = uRot * vec4(p, 1.0);
      world.z -= uZoom;
      vPos = world.xyz;
      gl_Position = uProj * world;
    }`;
    const v3 = a => `vec3(${a.map(x => (+x).toFixed(4)).join(", ")})`;
    const fs = `#version 300 es
    precision highp float;
    const vec3 HAVFARG = ${v3(this.havFarg)};
    const vec3 KUSTFARG = ${v3(this.kustFarg)};
    const float LJUSMIN = ${this.ljusMin.toFixed(3)};
    in float vVal; in vec3 vN; in vec3 vPos; in vec2 vUV; in float vLand;
    uniform sampler2D uKustTex;
    uniform float uKust, uPick, uNollpF;
    ${platta ? `uniform sampler2D uKodTexF, uVardeTex, uLandTex;
    uniform float uNland, uNar, uAr, uMaxLager;
    float slaUppF(vec2 uv) {          // samma landuppslag som i vertexsteget
      vec2 c = texture(uKodTexF, uv).rg * 255.0;
      float k = c.r * 256.0 + c.g;
      if (k > 65000.0) return 0.0;
      float l0 = floor(uAr), l1 = min(l0 + 1.0, uMaxLager);
      float x = (k + 0.5) / uNland;
      float a = texture(uVardeTex, vec2(x, (l0 + 0.5) / uNar)).r;
      float b = texture(uVardeTex, vec2(x, (l1 + 0.5) / uNar)).r;
      if (a < 0.002 || b < 0.002) return max(a, b);
      return mix(a, b, uAr - l0);
    }` : ""}
    out vec4 utfarg;
    ${rampGLSL(this.ramp)}
    void main() {
      // pick-pass: koda UV (lon,lat) i 16 bitar per axel (RG = u, BA = v)
      if (uPick > 0.5) {
        float X = floor(clamp(vUV.x, 0.0, 1.0) * 65535.0 + 0.5);
        float Y = floor(clamp(vUV.y, 0.0, 1.0) * 65535.0 + 0.5);
        float xhi = floor(X / 256.0), yhi = floor(Y / 256.0);
        utfarg = vec4(xhi/255.0, (X-xhi*256.0)/255.0, yhi/255.0, (Y-yhi*256.0)/255.0);
        return;
      }
      // Platådata: läs landet PER PIXEL. Som varying interpoleras värdet över
      // meshcellen och gränserna blir dimmiga fast höjden är en ren platå.
      float vv = ${platta ? "slaUppF(vUV)" : "vVal"};
      float t = uNollpF > 0.0001 ? vv / uNollpF : vv;
      vec3 c = farg(t);
      // havet i färgen avgörs av det FINA landuppslaget (0 = hav/ingen data),
      // inte av höjdmasken — då blir kusten lika skarp som gränsgriddet
      ${platta ? `c = mix(HAVFARG, c, step(0.002, vv));`
        : landdata ? `c = mix(HAVFARG, c, smoothstep(0.10, 0.55, vLand));` : ""}
      float k = texture(uKustTex, vUV).r * uKust;
      c = mix(c, KUSTFARG, min(k * 1.4, ${this.kustLjus ? "0.6" : "0.85"}));
      // Platådata är fasetterad geometri: platta tak och lodräta väggar. En
      // radiell normal får väggarna att lysa som om de låg ned — det var
      // "trådarna" längs kusterna. Skärmderivatan ger exakt fasettnormal utan
      // en enda extra texturhämtning.
      ${platta ? `vec3 N = normalize(cross(dFdx(vPos), dFdy(vPos)));
      if (dot(N, normalize(-vPos)) < 0.0) N = -N;` : "vec3 N = normalize(vN);"}
      vec3 L = normalize(vec3(0.45, 0.5, 0.75));
      float ljus = LJUSMIN + (1.0 - LJUSMIN) * max(dot(N, L), 0.0);
      float spegl = pow(max(dot(reflect(-L, N), normalize(-vPos)), 0.0), 24.0) * 0.12;
      utfarg = vec4(c * ljus + spegl, 1.0);
    }`;
    const mk = (typ, src) => {
      const s = gl.createShader(typ);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p));
    this.prog = p;
    this.u = {};
    for (const n of ["uProj","uRot","uAr","uMaxLager","uRelief","uZoom",
                     "uData","uKustTex","uKust","uLin","uLinGain","uLinGainH","uPick",
                     "uNollp","uNollpF","uLandTex","uKodTex","uKodTexF","uVardeTex","uNland","uNar"])
      this.u[n] = gl.getUniformLocation(p, n);
    this._byggPick(512);
  }

  _byggPick(storlek) {
    /* Dold buffert som pick-passet renderar råvärdet till, för avläsning. */
    const gl = this.gl;
    this.pickW = this.pickH = storlek;
    this.pickTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.pickTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, storlek, storlek, 0,
                  gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const dep = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, dep);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, storlek, storlek);
    this.pickFB = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickFB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                            gl.TEXTURE_2D, this.pickTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
                               gl.RENDERBUFFER, dep);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  sattLandmask(lm) {
    /* land=255/hav=0 på 1°-rutnätet → havsplan och neutral havsfärg i shadern */
    if (!lm || !this.meta.landdata) return;
    const gl = this.gl;
    this.landTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.landTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, lm.nx, lm.ny, 0, gl.RED, gl.UNSIGNED_BYTE, lm.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  _byggPlatta() {
    /* Landdata: EN statisk gränstextur (landindex per cell, RG8) + en liten
       värdetabell (R8, land × år). Året kostar inget i upplösning. */
    const gl = this.gl, m = this.meta;
    const gorTex = (G) => {
      const kod = new Uint8Array(G.ny * G.nx * 2);
      for (let i = 0; i < G.ny * G.nx; i++) {
        const k = G.kod[i];
        kod[i * 2] = (k >> 8) & 255; kod[i * 2 + 1] = k & 255;
      }
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, G.nx, G.ny, 0, gl.RG, gl.UNSIGNED_BYTE, kod);
      for (const q of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
        gl.texParameteri(gl.TEXTURE_2D, q, gl.NEAREST);        // platåer, inga mellanvärden
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    // GEOMETRIN läser meshgriddet (samma upplösning som meshen → inga trådar),
    // FÄRGEN det fina griddet (per pixel → skarpa gränser).
    this.kodTex = gorTex(m.meshGrid || m.kodGrid);
    this.kodTexFin = (m.kodGrid !== (m.meshGrid || m.kodGrid)) ? gorTex(m.kodGrid) : this.kodTex;
    this.vardeTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.vardeTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, m.nland, m.ar.length, 0,
                  gl.RED, gl.UNSIGNED_BYTE, m.varden);
    for (const q of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
      gl.texParameteri(gl.TEXTURE_2D, q, gl.NEAREST);
    for (const q of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T])
      gl.texParameteri(gl.TEXTURE_2D, q, gl.CLAMP_TO_EDGE);
  }

  _byggMesh(ny, nx) {
    const gl = this.gl;
    const uv = [], idx = [];
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++)
        uv.push(i / nx, j / ny);
    const rad = nx + 1;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * rad + i, b = a + 1, c = a + rad, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    this.vao = vao; this.nIdx = idx.length;
  }

  _byggTextur() {
    const gl = this.gl, m = this.meta;
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, this.kanaler === 2 ? gl.RG8 : gl.R8,
                    m.nx, m.ny, m.ar.length);
    // Landdata är EN siffra per land: NEAREST ger platåer med lodräta gränser
    // i stället för en interpolerad sluttning som inte hör till något land.
    const filt = m.platta ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, filt);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, filt);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }

  sattMedel(fonster) {
    if (this.meta.platta) return;      // landdata medlas inte (en siffra per land)
    this._stat = null;                 // statistiken gäller de gamla lagren
    /* glidande medel över år (centrerat) → laddar om texturstacken.
       Deterministiska data (medel: false, t.ex. utsläpp) medlas aldrig. */
    const m = this.meta, N = m.ar.length, per = m.ny * m.nx;
    if (m.medel === false) fonster = 1;
    let data;
    if (fonster <= 1) data = m.ra;
    else {
      data = new Uint8Array(m.ra.length);
      const halv = Math.floor(fonster / 2), sum = new Float32Array(per);
      for (let y = 0; y < N; y++) {
        sum.fill(0);
        const y0 = Math.max(0, y - halv), y1 = Math.min(N - 1, y + halv);
        for (let k = y0; k <= y1; k++) {
          const off = k * per;
          for (let i = 0; i < per; i++) sum[i] += m.ra[off + i];
        }
        const inv = 1 / (y1 - y0 + 1), off = y * per;
        for (let i = 0; i < per; i++) data[off + i] = sum[i] * inv;
      }
    }
    this.cpuData = data;   // samma data som texturen → CPU-avläsning vid punkt
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0,
                     this.meta.nx, this.meta.ny, N,
                     this.kanaler === 2 ? gl.RG : gl.RED, gl.UNSIGNED_BYTE, data);
  }

  arTillLager(v) {
    /* år → bråkindex i ar-listan; klarar oregelbundna tidssnitt (HYDE) */
    const ar = this.meta.ar;
    if (v <= ar[0]) return 0;
    if (v >= ar[ar.length - 1]) return ar.length - 1;
    let lo = 0, hi = ar.length - 1;
    while (hi - lo > 1) {
      const mitt = (lo + hi) >> 1;
      if (ar[mitt] <= v) lo = mitt; else hi = mitt;
    }
    return lo + (v - ar[lo]) / (ar[hi] - ar[lo]);
  }

  /* Pivot ("nollnivå") för höjd och färg. Fast ur metadatan, eller — när
     nollMedel är satt — det globala snittet för året, som ändras med tiden. */
  /* Höjdens och färgens nollnivå behöver INTE vara samma. Låser man höjden vid
     ett fast år läser man tillväxt rätt (ett land som förbättras stiger), och
     låter man färgen följa året ser man världssnittet vandra genom länderna
     under uppspelningen. nollMedelF sätter färgens serie separat; utan den
     används samma som höjden, precis som förut. */
  pivotNu(arVarde) {
    const m = this.meta;
    const bas = { h: m.nollpunkt, f: (this.kanaler === 2 ? m.nollpunktF : m.nollpunkt) };
    if (!this.nollMedel && !this.nollMedelF) return bas;
    const ar = arVarde ?? (this._param ? this._param.arVarde : m.ar[0]);
    const lag = this.arTillLager(ar);
    const l0 = Math.floor(lag), l1 = Math.min(l0 + 1, m.ar.length - 1);
    const vid = s => s[l0] + (s[l1] - s[l0]) * (lag - l0);
    // Höjden och färgen får ha var sin serie — och var sin FRÅNVARO av serie.
    // Utan detta gick färgen inte att låta följa året när höjden mäts från noll.
    const mv = this.nollMedel ? vid(this.nollMedel) : 0;
    const mvF = this.nollMedelF ? vid(this.nollMedelF) : mv;
    if (!(mv > 0) && !(mvF > 0)) return bas;
    const SPAN = m.vmax - m.vmin;
    const klam = x => Math.max(0, Math.min(1, x));
    let h, f;
    if (m.skala === "log10") {
      const logP = mv > 0 ? Math.min((Math.log10(mv) - m.vmin) / SPAN,
                            1 - Math.log10(this.gainHojd) / SPAN) : m.nollpunkt;   // samma tak som höjden
      h = (mv > 0) ? klam(this.lin ? mv / Math.pow(10, m.vmax) * this.gainHojd : logP)
                   : m.nollpunkt;
      // FÄRGEN stannar i log-rymd på kapade fält (linjarGain) — pivoten måste
      // räknas i SAMMA rymd, annars hamnar snittet fel när höjden är linjär
      const logF = mvF > 0 ? Math.min((Math.log10(mvF) - m.vmin) / SPAN,
                                      1 - Math.log10(this.gainHojd) / SPAN) : logP;
      f = klam(m.linjarGain ? logF
                            : (this.lin ? mvF / Math.pow(10, m.vmax) * (m.linjarGain || 1) : logF));
    } else {
      h = this.nollMedel ? klam((mv - m.vmin) / SPAN) : m.nollpunkt;
      f = this.nollMedelF || this.nollMedel ? klam((mvF - m.vmin) / SPAN) : m.nollpunkt;
    }
    return { h, f };
  }

  rita(arVarde, yaw, pitch, relief) {
    this._param = { arVarde, yaw, pitch, relief };   // sparas för picking
    this._teckna(null, 0.0);
  }

  _teckna(fb, pick) {
    const gl = this.gl, m = this.meta, p = this._param;
    const lager = this.arTillLager(p.arVarde);
    const W = fb ? this.pickW : gl.canvas.width;
    const H = fb ? this.pickH : gl.canvas.height;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, W, H);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    if (m.platta) {
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, this.kodTex);
      gl.uniform1i(this.u.uKodTex, 3);
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, this.kodTexFin);
      gl.uniform1i(this.u.uKodTexF, 5);
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, this.vardeTex);
      gl.uniform1i(this.u.uVardeTex, 4);
      gl.uniform1f(this.u.uNland, m.nland);
      gl.uniform1f(this.u.uNar, m.ar.length);
    } else {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
      gl.uniform1i(this.u.uData, 0);
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.kustTex);
    gl.uniform1i(this.u.uKustTex, 1);
    gl.uniform1f(this.u.uKust, this.harKust ? 1.0 : 0.0);
    gl.uniform1f(this.u.uLin, this.lin ? 1.0 : 0.0);
    gl.uniform1f(this.u.uLinGain, m.linjarGain || 1.0);      // färgtak
    gl.uniform1f(this.u.uLinGainH, this.gainHojd);           // höjdtak (justerbart per glob)
    gl.uniform1f(this.u.uPick, pick);
    const piv = this.pivotNu();
    gl.uniform1f(this.u.uNollp, piv.h);
    gl.uniform1f(this.u.uNollpF, piv.f);
    if (this.landTex) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.landTex);
      gl.uniform1i(this.u.uLandTex, 2);
    }
    gl.uniformMatrix4fv(this.u.uProj, false, persp(0.6, W / H, 0.1, 30));
    gl.uniformMatrix4fv(this.u.uRot, false, rotXY(p.yaw, p.pitch));
    gl.uniform1f(this.u.uAr, lager);
    gl.uniform1f(this.u.uMaxLager, m.ar.length - 1);
    gl.uniform1f(this.u.uRelief, p.relief * (m.relieffaktor ?? 1.0) * this.reliefMul);   // reliefMul = per-glob-reglage
    gl.uniform1f(this.u.uZoom, this.zoom);
    gl.drawElements(gl.TRIANGLES, this.nIdx, gl.UNSIGNED_INT, 0);
  }

  plockaUV(fx, fy) {
    /* fx,fy ∈ [0,1] över canvas → {u,v} (lon/lat-UV) i punkten, eller null. */
    if (!this._param) return null;
    const gl = this.gl;
    this._teckna(this.pickFB, 1.0);
    const x = Math.max(0, Math.min(this.pickW - 1, Math.round(fx * this.pickW)));
    const y = Math.max(0, Math.min(this.pickH - 1, Math.round((1 - fy) * this.pickH)));
    const b = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (b[0] === 0 && b[1] === 0 && b[2] === 0 && b[3] === 0) return null;  // bakgrund
    return { u: (b[0] * 256 + b[1]) / 65535, v: (b[2] * 256 + b[3]) / 65535 };
  }

  samplaNorm(u, v, arVarde, kanal = 0) {
    if (this.meta.platta) {                 // landdata: slå upp landets värde
      const m = this.meta, G = m.kodGrid;
      const j = Math.max(0, Math.min(G.ny - 1, Math.floor(v * G.ny)));
      const i = (((Math.floor(u * G.nx) % G.nx) + G.nx) % G.nx);
      const k = G.kod[j * G.nx + i];
      if (k === 65535) return 0;
      const lager = this.arTillLager(arVarde);
      const l0 = Math.floor(lager), l1 = Math.min(l0 + 1, m.ar.length - 1);
      const a = m.varden[l0 * m.nland + k], b = m.varden[l1 * m.nland + k];
      if (!a || !b) return Math.max(a, b) / 255;
      return (a + (b - a) * (lager - l0)) / 255;
    }
    /* bilinjärt normvärde [0,1] vid (u,v) för året, matchar shaderns sampling
       (lon: wrap, lat: clamp, år: linjär tween). kanal 0=R, 1=G (bivariat). */
    const m = this.meta, nx = m.nx, ny = m.ny, N = m.ar.length, d = this.cpuData, kn = this.kanaler;
    const lager = this.arTillLager(arVarde);
    const l0 = Math.floor(lager), l1 = Math.min(l0 + 1, N - 1), fl = lager - l0;
    const px = u * nx - 0.5, py = v * ny - 0.5;
    const x0 = Math.floor(px), y0 = Math.floor(py), tx = px - x0, ty = py - y0;
    const xa = ((x0 % nx) + nx) % nx, xb = ((x0 + 1) % nx + nx) % nx;
    const ya = Math.max(0, Math.min(ny - 1, y0)), yb = Math.max(0, Math.min(ny - 1, y0 + 1));
    const at = (L, xx, yy) => d[((L * ny + yy) * nx + xx) * kn + kanal] / 255;
    const bilin = L => (at(L, xa, ya) * (1 - tx) + at(L, xb, ya) * tx) * (1 - ty)
                     + (at(L, xa, yb) * (1 - tx) + at(L, xb, yb) * tx) * ty;
    const a = bilin(l0), b = bilin(l1);
    return a + (b - a) * fl;
  }

  vardeVidUV(u, v, arVarde) {
    const m = this.meta;
    if (this.kanaler === 2) {   // bivariat: visa båda variablerna
      const dt = m.vmin + this.samplaNorm(u, v, arVarde, 0) * (m.vmax - m.vmin);
      const ds = m.vminF + this.samplaNorm(u, v, arVarde, 1) * (m.vmaxF - m.vminF);
      const tkn = (x, e) => (x >= 0 ? "+" : "") + x.toFixed(1) + " " + e;
      return "ΔT " + tkn(dt, "°C") + " · Δsol " + tkn(ds, "W/m²");
    }
    if (m.kategorier) {   // klassglob: visa kategorinamnet
      const k = Math.min(m.kategorier.length - 1, Math.floor(this.samplaNorm(u, v, arVarde) * m.kategorier.length));
      return m.kategorier[k].namn;
    }
    const norm = this.samplaNorm(u, v, arVarde);
    if (m.flode) {   // so2/co2: flöde kg/m²/s → utsläpp per km² och år (densitet, latitudoberoende)
      if (norm < 0.02) return T("nara0") + " " + T("tonKm2");
      const flux = Math.pow(10, m.vmin + norm * (m.vmax - m.vmin));   // kg/m²/s
      return formateraUtslappKm2(flux * 1e6 * SEK_PER_AR);            // × m²/km² × s/år
    }
    if (m.flodeAnom) {   // so2/co2-förändring mot 1961–1990: signerat per km² och år
      if (Math.abs(norm - 0.5) < 0.01) return T("nara0") + " " + T("tonKm2");
      const dflux = (norm * 2 - 1) * m.vmax;                         // vmax = halvspann (kg/m²/s)
      return (dflux >= 0 ? "+" : "−") + formateraUtslappKm2(Math.abs(dflux) * 1e6 * SEK_PER_AR);
    }
    if (m.ratioAnom) {   // förändring som log-kvot mot baslinjen: ×N (ökat) / ÷N (minskat)
      if (Math.abs(norm - 0.5) < 0.01) return "≈ ×1";
      const kvot = Math.pow(10, (norm * 2 - 1) * m.vmax);
      return kvot >= 1 ? "×" + (kvot < 9.95 ? kvot.toFixed(1) : Math.round(kvot))
                       : "÷" + ((1 / kvot) < 9.95 ? (1 / kvot).toFixed(1) : Math.round(1 / kvot));
    }
    return this.fysisktVarde(norm);
  }

  projektUV(u, v) {
    /* (u,v) → skärmkoordinater (CSS-px) på denna glob + om punkten är på framsidan */
    const p = this._param;
    if (!p) return null;
    const m = this.meta;
    const norm = this.samplaNorm(u, v, p.arVarde);
    const gH = this.gainHojd, SPAN = m.vmax - m.vmin;
    const dispH = this.lin ? Math.min(Math.pow(10, (norm - 1) * SPAN) * gH, 1)
                           : Math.min(norm, 1 - Math.log10(gH) / SPAN);
    const h = (dispH - m.nollpunkt) * p.relief * (m.relieffaktor ?? 1.0) * this.reliefMul;   // matchar samplaHojd
    const lat = (v * 180 - 90) * Math.PI / 180, lon = (u * 360 - 180) * Math.PI / 180;
    const cl = Math.cos(lat);
    const dx = cl * Math.sin(lon), dy = Math.sin(lat), dz = cl * Math.cos(lon);
    const r = 1 + h, ax = dx * r, ay = dy * r, az = dz * r;
    const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw), cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
    const wx = cy * ax + sy * az;
    const wy = sp * sy * ax + cp * ay - sp * cy * az;
    let wz = -cp * sy * ax + sp * ay + cp * cy * az;
    const framsida = (-cp * sy * dx + sp * dy + cp * cy * dz) > 0;   // utåtnormalens z mot kameran
    wz -= this.zoom;
    const c = this.gl.canvas, f = 1 / Math.tan(0.6 / 2), aspekt = c.width / c.height;
    const ndcx = (f / aspekt * wx) / -wz, ndcy = (f * wy) / -wz;
    const rr = c.getBoundingClientRect();
    return { sx: rr.left + (ndcx * 0.5 + 0.5) * rr.width,
             sy: rr.top + (1 - (ndcy * 0.5 + 0.5)) * rr.height, framsida };
  }

  /* Lägsta, högsta och medelvärdet i det år som VISAS, normaliserat [0,1].
     Cachas per lager: utforskaren är 240 tal, ett griddat 1°-lager 65 000 —
     billigt nog att svepa om när året byter, men inte varje bildruta. */
  statistik(arVarde) {
    const m = this.meta;
    const L = Math.round(this.arTillLager(arVarde));
    this._stat = this._stat || {};
    if (this._stat[L] !== undefined) return this._stat[L];
    // BARA landdata: där betyder 0 "ingen data". I de griddade kuberna är 0 ett
    // giltigt värde (skalans botten), så ett svep som hoppar över nollor skulle
    // rapportera ett för högt minimum — hellre ingen siffra än en felaktig.
    if (!m.landvarden) return (this._stat[L] = null);
    let lo = Infinity, hi = -Infinity, summa = 0, n = 0;
    {                                         // utforskaren: en siffra per land
      const NL = m.nland;
      for (let k = 0; k < NL; k++) {
        const v = m.landvarden[L * NL + k];
        if (!v) continue;
        const x = (v - 1) / 65534;
        if (x < lo) lo = x;
        if (x > hi) hi = x;
        summa += x; n++;
      }
    }
    return (this._stat[L] = n ? { min: lo, max: hi, medel: summa / n, antal: n } : null);
  }

  fysisktVarde(norm) {
    const m = this.meta;
    const enhet = ENHETTEXT(m.enhet.replace(/ *\(log-skala\)/, ""));
    const overTak = norm > 0.999 && m.oppetTak;   // mättad mot öppet tak → "≥"
    if (m.skala === "log10") {
      if (norm < 0.02) return T("nara0") + " " + enhet;
      const f = Math.pow(10, m.vmin + norm * (m.vmax - m.vmin));
      const s = f < 1 ? f.toFixed(2) : f < 10 ? f.toFixed(1) : Math.round(f).toLocaleString(lokal());
      return (overTak ? "≥ " : "") + s + " " + enhet;
    }
    const v = m.vmin + norm * (m.vmax - m.vmin);
    const spann = m.vmax - m.vmin;
    const dec = spann >= 100 ? 0 : spann >= 10 ? 1 : 2;
    const tecken = (m.vmin < 0 && v > 0) ? "+" : "";
    return (overTak ? "≥ " : tecken) + v.toFixed(dec) + " " + enhet;
  }
}

/* ── Färgstapel ── */
/* Färgskalans text: ljus på mörk botten som standard, men sidan får ändra —
   samma etiketter i #c9cdd3 försvinner spårlöst på en beige sida. */
const BAR_STIL = { text: "#c9cdd3", dim: "#7f8894",
                   markering: "#f2f4f7", markeringKant: "#0d0f13", etikett: "#dfe3e8" };
function ritaBar(canvas, meta, ramp, lin = false, pivotNorm = null, stat = null, glob = null) {
  const ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
  const STRIP = stat ? 44 : H * 0.55;       // plats för en extra etikettrad
  ctx.clearRect(0, 0, W, H);
  for (let x = 0; x < W; x++) {
    const p = x / (W - 1);
    const nollp = pivotNorm ?? meta.nollpunkt;
    const t = nollp > 0 ? p / nollp : p;
    const c = rampFarg(ramp, t);
    ctx.fillStyle = `rgb(${c[0]|0},${c[1]|0},${c[2]|0})`;
    ctx.fillRect(x, 0, 1, STRIP);
  }
  ctx.fillStyle = BAR_STIL.text; ctx.font = "22px sans-serif";
  const [v0, v1] = [meta.vmin, meta.vmax];
  const bas = ENHETTEXT(meta.enhet.replace(/ *\(log-skala\)/, ""));
  const nollp = pivotNorm ?? meta.nollpunkt;
  const pivot = meta.vmin + nollp * (meta.vmax - meta.vmin);
  const rund = v => { const a = Math.abs(v); return +v.toFixed(a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3); };
  const tecken = v => (nollp > 0 && pivot === 0 && v > 0 ? "+" : "") + rund(v);
  let e0, e1;
  if (meta.ratioAnom) {   // förändring som log-kvot: ÷N … ×1 … ×N (decimal för små kvoter)
    const fmt = r => r < 9.95 ? r.toFixed(1) : String(Math.round(r));
    e0 = "÷" + fmt(Math.pow(10, Math.abs(v0)));
    e1 = "×" + fmt(Math.pow(10, v1));
  }
  else if (meta.flodeAnom) {   // so2/co2-förändring: ±halvspann per km²/år, pivot 0
    const km2 = f => formateraUtslappKm2(Math.abs(f) * 1e6 * SEK_PER_AR);
    e0 = "−" + km2(v0); e1 = "+" + km2(v1);
  }
  else if (meta.flode) {   // so2/co2: utsläpp per km² och år (densitet)
    const km2 = lv => Math.pow(10, lv) * 1e6 * SEK_PER_AR;   // kg/km²/år
    e0 = lin ? "0" : formateraUtslappKm2(km2(v0)); e1 = formateraUtslappKm2(km2(v1));
  }
  // befolkning (linjarGain): färgen är alltid log → visa alltid log-etiketterna,
  // linjär-valet påverkar bara HÖJDEN. Bara so2/co2 har linjär FÄRG.
  else if (meta.skala === "log10" && lin && !meta.linjarGain) {
    e0 = "0"; e1 = `10^${v1} ${bas} (${T("linTxt")})`;
  }
  else if (meta.skala === "log10" && meta.linjarGain) {   // befolkning/snö: visa avlogaritmerade ändvärden
    const f = x => x >= 1 ? Math.round(x).toLocaleString(lokal()) : x.toFixed(1);
    e0 = f(Math.pow(10, v0)); e1 = f(Math.pow(10, v1)) + " " + bas;
  }
  else if (meta.skala === "log10")   { e0 = `10^${v0}`; e1 = `10^${v1} ${bas} (${T("logTxt")})`; }
  else { e0 = tecken(v0); e1 = tecken(v1) + " " + bas; }
  // skalans ändpunkter: vad färgrampen som HELHET täcker
  const skalRad = stat ? H - 4 : H - 4;
  ctx.font = stat ? "19px sans-serif" : "22px sans-serif";
  ctx.fillStyle = stat ? BAR_STIL.dim : BAR_STIL.text;
  ctx.textAlign = "left";   ctx.fillText(e0, 2, skalRad);
  ctx.textAlign = "right";  ctx.fillText(e1, W - 2, skalRad);
  ctx.font = "22px sans-serif"; ctx.fillStyle = BAR_STIL.text;
  const pivotX = nollp > 0 ? nollp * W : null;
  if (pivotX !== null) {
    ctx.fillRect(pivotX - 1, 0, 2, STRIP + (stat ? 12 : H * 0.17));
    const txt = meta.ratioAnom ? "×1"
      : (pivotNorm !== null && meta.skala === "log10")
        ? Math.round(Math.pow(10, pivot)).toLocaleString(lokal())
        : String(rund(pivot));
    if (!stat) { ctx.textAlign = "center"; ctx.fillText(txt, pivotX, H - 4); }
  }
  if (!stat) return;
  /* Skalan säger vad rampen täcker; den säger inget om var datan FAKTISKT
     ligger just det året. Markera lägst, snitt och högst med utskrivna
     värden — snittet är samma nollnivå som globen använder när den finns. */
  const rad = H - 26;
  const fysV = n => {
    const lv = meta.vmin + n * (meta.vmax - meta.vmin);
    if (meta.ratioAnom) { const r = Math.pow(10, Math.abs(lv));
      return (lv < 0 ? "÷" : "×") + (r < 9.95 ? r.toFixed(1) : String(Math.round(r))); }
    if (meta.flodeAnom) return (lv < 0 ? "−" : "+") + formateraUtslappKm2(Math.abs(lv) * 1e6 * SEK_PER_AR);
    if (meta.flode) return formateraUtslappKm2(Math.pow(10, lv) * 1e6 * SEK_PER_AR);
    return glob.fysisktVarde(n);
  };
  const punkter = [
    { n: stat.min,   e: T("barMin"),   v: fysV(stat.min) },
    { n: pivotNorm ?? stat.medel, e: T("barMedel"),
      v: pivotNorm !== null && meta.skala === "log10"
         ? Math.round(Math.pow(10, pivot)).toLocaleString(lokal()) + " " +
           ENHETTEXT(meta.enhet.replace(/ *\(log-skala\)/, ""))
         : fysV(stat.medel) },
    { n: stat.max,   e: T("barMax"),   v: fysV(stat.max) },
  ];
  for (const p of punkter) {
    const x = Math.max(0, Math.min(1, p.n)) * W;
    if (pivotX === null || Math.abs(x - pivotX) > 3) {   // rita inte två streck i samma spår
      ctx.fillStyle = BAR_STIL.markeringKant; ctx.fillRect(x - 2, 0, 4, STRIP + 12);
      ctx.fillStyle = BAR_STIL.markering; ctx.fillRect(x - 1, 0, 2, STRIP + 12);
    }
  }
  ctx.fillStyle = BAR_STIL.etikett; ctx.textAlign = "left";
  // Enheten skrivs ut EN gång, på max — tre gånger blev bara brus.
  const utanEnhet = t => (bas && t.endsWith(" " + bas)) ? t.slice(0, -(bas.length + 1)) : t;
  punkter[0].v = utanEnhet(punkter[0].v);
  punkter[1].v = utanEnhet(punkter[1].v);
  // etiketterna centreras under sitt streck, men knuffas isär om de krockar
  const lbl = punkter.map(p => {
    const txt = `${p.e} ${p.v}`, b = ctx.measureText(txt).width;
    return { txt, b, x: Math.max(0, Math.min(1, p.n)) * W - b / 2 };
  }).sort((a, c) => a.x - c.x);
  let grans = 2;
  for (const l of lbl) {
    l.x = Math.max(grans, Math.min(W - l.b - 2, l.x));
    grans = l.x + l.b + 16;
    ctx.fillText(l.txt, l.x, rad);
  }
}

/* ── Nedladdning + platå-STL ──────────────────────────────────────────────
   Landdataglober (utforskaren, OWID-globerna) bygger alltid samma fyra delar:
   kärna, hav, länder över nollnivån och länder under. Geometrin är den som
   verifierats vattentät — noll obalanserade riktade kanter i alla fyra skalen
   — så den ska finnas på EN plats, inte kopieras per sida. */
function laddaNerBlob(blob, filnamn) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filnamn;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function exporteraPlatoSTL(g, lander, arVarde, relief, basnamn, skrovliga = null) {
  const m = g.meta, G = lander.fin;
  if (!m.platta || !G) throw new Error("inte en platåglob");
  const S = 50, SPAN = m.vmax - m.vmin, gH = g.gainHojd;   // S: enhetsradie → 50 mm
  const relf = relief * (m.relieffaktor ?? 1.0) * g.reliefMul;
  const nollp = g.pivotNu(arVarde).h;
  const SKROV = 0.9 / S;                                   // ±0,45 mm för uppskattade värden
  const hash = (a, b) => { const t = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return t - Math.floor(t); };
  const fnx2 = G.nx, fny2 = G.ny;
  // trig en gång per nod: utan cache blir det miljontals sin/cos och exporten hänger
  const dTab = new Float32Array((fny2 + 1) * (fnx2 + 1) * 3);
  for (let jj = 0; jj <= fny2; jj++) {
    const latR = (jj / fny2 * 180 - 90) * Math.PI / 180;
    for (let ii = 0; ii <= fnx2; ii++) {
      const d = stlDir(latR, (ii / fnx2 * 360 - 180) * Math.PI / 180);
      const o = (jj * (fnx2 + 1) + ii) * 3;
      dTab[o] = d[0]; dTab[o+1] = d[1]; dTab[o+2] = d[2];
    }
  }
  const dirF2 = (jf, iff) => {
    if (Number.isInteger(jf) && Number.isInteger(iff) &&
        jf >= 0 && jf <= fny2 && iff >= 0 && iff <= fnx2) {
      const o = (jf * (fnx2 + 1) + iff) * 3;
      return [dTab[o], dTab[o+1], dTab[o+2]];
    }
    return stlDir((jf / fny2 * 180 - 90) * Math.PI / 180,
                  (iff / fnx2 * 360 - 180) * Math.PI / 180);
  };
  // radie per LAND för aktuellt år — exakt samma formel som skärmens höjd
  const arVis = Math.min(Math.max(arVarde, m.ar[0]), m.ar.at(-1));
  const lag = g.arTillLager(arVis);
  const l0 = Math.floor(lag), l1 = Math.min(l0 + 1, m.ar.length - 1), fl = lag - l0;
  const rLand = new Float64Array(m.nland), harData = new Uint8Array(m.nland);
  let minR = Infinity;
  for (let k = 0; k < m.nland; k++) {
    const a = m.varden[l0 * m.nland + k], b = m.varden[l1 * m.nland + k];
    if (!a && !b) continue;
    harData[k] = 1;
    const n = ((!a || !b) ? Math.max(a, b) : a + (b - a) * fl) / 255;
    const dispH = g.lin ? Math.min(Math.pow(10, (n - 1) * SPAN) * gH, 1)
                        : Math.min(n, 1 - Math.log10(gH) / SPAN);
    let rr = 1 + (dispH - nollp) * relf;
    if (skrovliga && skrovliga.has(k)) rr += (hash(k, k * 7) - 0.5) * SKROV;
    rLand[k] = rr;
    if (rr < minR) minR = rr;
  }
  const HAVSYTA = 1.0;
  const rCore = Math.max(0.2, Math.min(minR, HAVSYTA) - 4 / S);   // tunnaste vägg ≥ 4 mm
  const kodAt = (j, i) => {
    const kk = G.kod[j * fnx2 + i];
    return (kk !== 65535 && harData[kk]) ? kk : -1;
  };
  const HAV = 65534;                       // egen nyckel; negativa tal = hoppa över
  const skal = villkor => byggPlatoer(fny2, fnx2, dirF2,
    (j, i) => { const kk = kodAt(j, i); return kk >= 0 && villkor(rLand[kk]) ? kk : -1; },
    k => rLand[k], rCore, S);
  const overT = skal(r => r >= HAVSYTA);
  const underT = skal(r => r < HAVSYTA);
  const havT = byggPlatoer(fny2, fnx2, dirF2,
    (j, i) => kodAt(j, i) >= 0 ? -1 : HAV, () => HAVSYTA, rCore, S);
  const karna = byggKarna(90, 180, rCore, S);
  const bas = `${basnamn}_${Math.round(arVarde)}`;
  laddaNerBlob(stlBlob(karna), `${bas}_karna.stl`);
  setTimeout(() => laddaNerBlob(stlBlob(overT), `${bas}_over.stl`), 200);
  setTimeout(() => laddaNerBlob(stlBlob(havT), `${bas}_hav.stl`), 400);
  if (underT.length) setTimeout(() => laddaNerBlob(stlBlob(underT), `${bas}_under.stl`), 600);
  console.log(`platå-STL ${bas}: över ${overT.length/9|0}, under ${underT.length/9|0}, ` +
              `hav ${havT.length/9|0} trianglar vid ${(360/fnx2).toFixed(3)}°`);
  return true;
}
