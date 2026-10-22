// Laboratorio web — Tema 1. Depende de ../assets/comun.js.

const css = nombre => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
const fmt1 = x => (isFinite(x) ? x.toFixed(1) : '—');

/* =====================================================================
   1. TC de tórax sintético (unidades Hounsfield)
   ===================================================================== */
const N_TC = 256;
const NODULO = { u: 0.48, v: -0.18, r: 0.035 };
const LESION = { u: 0.03, v: -0.28, r: 0.035 };

function crearTC() {
  const rng = crearRng(2026);
  const gauss = crearGauss(crearRng(7));
  const hu = new Float32Array(N_TC * N_TC);
  const elip = (u, v, cx, cy, rx, ry) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1;
  const disco = (u, v, cx, cy, r) => (u - cx) ** 2 + (v - cy) ** 2 <= r * r;

  // Vasos pulmonares: discos pequeños dentro de cada pulmón.
  const vasos = [];
  for (const cx of [-0.40, 0.40]) {
    for (let i = 0; i < 30; i++) {
      const a = 2 * Math.PI * rng(), s = 0.85 * Math.sqrt(rng());
      vasos.push({ u: cx + 0.30 * s * Math.cos(a), v: -0.02 + 0.40 * s * Math.sin(a), r: 0.008 + 0.014 * rng() });
    }
  }
  // Costillas sobre el contorno del cuerpo.
  const costillas = [0, 15, 35, 145, 165, 180, 195, 215, 325, 345].map(g => {
    const a = g * Math.PI / 180;
    return { u: 0.80 * Math.cos(a), v: 0.05 + 0.52 * Math.sin(a) };
  });

  for (let y = 0; y < N_TC; y++) {
    for (let x = 0; x < N_TC; x++) {
      const u = (x + 0.5) / N_TC * 2 - 1, v = (y + 0.5) / N_TC * 2 - 1;
      let h = -1000;                                                   // aire
      if (elip(u, v, 0, 0.05, 0.90, 0.62)) h = -100;                   // grasa subcutánea
      if (elip(u, v, 0, 0.05, 0.84, 0.56)) h = 40;                     // músculo / tejido blando
      const enPulmon = elip(u, v, -0.40, -0.02, 0.30, 0.40) || elip(u, v, 0.40, -0.02, 0.30, 0.40);
      if (enPulmon) {
        h = -850;
        for (const c of vasos) if (disco(u, v, c.u, c.v, c.r)) { h = 40; break; }
        if (disco(u, v, NODULO.u, NODULO.v, NODULO.r)) h = 30;         // nódulo pulmonar
      }
      if (elip(u, v, 0.06, 0.18, 0.22, 0.20)) h = 45;                  // corazón
      if (disco(u, v, -0.05, -0.08, 0.06)) h = 50;                     // aorta
      if (disco(u, v, LESION.u, LESION.v, LESION.r)) h = 60;           // lesión de +20 HU
      if (disco(u, v, 0, -0.47, 0.035)) h = 700;                       // esternón
      for (const c of costillas) if (disco(u, v, c.u, c.v, 0.025)) h = 900;
      if (disco(u, v, 0, 0.42, 0.09)) h = disco(u, v, 0, 0.42, 0.075) ? 300 : 1100; // vértebra
      if (disco(u, v, -0.06, 0.56, 0.025) || disco(u, v, 0.06, 0.56, 0.025)) h = 900;
      if (disco(u, v, 0, 0.55, 0.035)) h = 15;                         // canal medular
      hu[y * N_TC + x] = h + 10 * gauss();                             // ruido de 10 HU
    }
  }
  return hu;
}

const tc = crearTC();
const ctCanvas = document.getElementById('ct-canvas');
const ctHist = document.getElementById('ct-hist');
let ctSolucion = false;

function aplicarVentana(valoresHU, wl, ww) {
  const out = new Float32Array(valoresHU.length);
  const lo = wl - ww / 2;
  for (let i = 0; i < valoresHU.length; i++) out[i] = (valoresHU[i] - lo) / ww;
  return out;
}

function dibujarCirculo(ctx, c, n, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc((c.u + 1) / 2 * n, (c.v + 1) / 2 * n, c.r / 2 * n + 4, 0, 2 * Math.PI);
  ctx.stroke();
}

// Histograma (log) calculado una sola vez.
const HIST_MIN = -1100, HIST_MAX = 1600, HIST_BIN = 10;
const histCuentas = (() => {
  const nb = (HIST_MAX - HIST_MIN) / HIST_BIN;
  const c = new Float64Array(nb);
  for (const h of tc) {
    const b = Math.floor((h - HIST_MIN) / HIST_BIN);
    if (b >= 0 && b < nb) c[b]++;
  }
  return c;
})();

function dibujarHistograma(wl, ww) {
  const ctx = ctHist.getContext('2d');
  const W = ctHist.width, H = ctHist.height, pad = 18;
  const xDe = h => (h - HIST_MIN) / (HIST_MAX - HIST_MIN) * W;
  ctx.clearRect(0, 0, W, H);
  // ventana
  ctx.fillStyle = 'rgba(235,129,27,0.18)';
  ctx.fillRect(xDe(wl - ww / 2), 0, xDe(wl + ww / 2) - xDe(wl - ww / 2), H - pad);
  // barras
  const maxLog = Math.log10(Math.max(...histCuentas) + 1);
  ctx.fillStyle = css('--muted');
  const bw = W / histCuentas.length;
  histCuentas.forEach((c, i) => {
    const h = Math.log10(c + 1) / maxLog * (H - pad - 4);
    ctx.fillRect(i * bw, H - pad - h, Math.max(1, bw - 0.5), h);
  });
  // rampa de la ventana (gris de salida)
  ctx.strokeStyle = css('--accent-2');
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H - pad);
  ctx.lineTo(xDe(wl - ww / 2), H - pad);
  ctx.lineTo(xDe(wl + ww / 2), 2);
  ctx.lineTo(W, 2);
  ctx.stroke();
  // eje
  ctx.fillStyle = css('--text');
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const t of [-1000, -500, 0, 500, 1000, 1500]) ctx.fillText(t, xDe(t), H - 4);
}

const ctWL = enlazarSlider('ct-wl', dibujarTC);
const ctWW = enlazarSlider('ct-ww', dibujarTC);

function dibujarTC() {
  const wl = +ctWL.value, ww = +ctWW.value;
  const ctx = pintarGrises(ctCanvas, aplicarVentana(tc, wl, ww), N_TC, N_TC);
  if (ctSolucion) {
    dibujarCirculo(ctx, NODULO, N_TC, '#ffd400');
    dibujarCirculo(ctx, LESION, N_TC, '#ffd400');
  }
  dibujarHistograma(wl, ww);
}

document.querySelectorAll('#ventana button[data-wl]').forEach(b => b.addEventListener('click', () => {
  ctWL.value = b.dataset.wl;
  ctWW.value = b.dataset.ww;
  ctWL.dispatchEvent(new Event('input'));
  ctWW.dispatchEvent(new Event('input'));
}));
document.getElementById('ct-solucion').addEventListener('click', () => {
  ctSolucion = !ctSolucion;
  document.getElementById('ct-solucion-txt').hidden = !ctSolucion;
  dibujarTC();
});
const ctReadout = document.getElementById('ct-readout');
ctCanvas.addEventListener('mousemove', ev => {
  const p = pixelDeEvento(ctCanvas, ev);
  if (p.x < 0 || p.y < 0 || p.x >= N_TC || p.y >= N_TC) return;
  ctReadout.textContent = `Píxel (${p.x}, ${p.y}): ${Math.round(tc[p.y * N_TC + p.x])} HU`;
});

/* =====================================================================
   2. Profundidad de bit
   ===================================================================== */
const bitsCanvas = document.getElementById('bits-canvas');
const bitsK = enlazarSlider('bits-k', dibujarBits);
document.querySelectorAll('input[name="bits-ventana"]').forEach(r => r.addEventListener('change', dibujarBits));

function dibujarBits() {
  const k = +bitsK.value, niveles = 2 ** k, salto = 4096 / niveles;
  const q = new Float32Array(tc.length);
  for (let i = 0; i < tc.length; i++) {
    const n = Math.min(niveles - 1, Math.max(0, Math.floor((tc[i] + 1024) / salto)));
    q[i] = -1024 + (n + 0.5) * salto;
  }
  const medi = document.querySelector('input[name="bits-ventana"]:checked').value === 'medi';
  const wl = medi ? 40 : 1023.5, ww = medi ? 400 : 4096;
  pintarGrises(bitsCanvas, aplicarVentana(q, wl, ww), N_TC, N_TC);
  document.getElementById('bits-niveles').textContent = niveles.toLocaleString('es-ES');
  document.getElementById('bits-salto').textContent = `${salto.toLocaleString('es-ES')} HU`;
  const enVentana = Math.min(niveles, Math.round(ww / salto));
  document.getElementById('bits-enventana').textContent = enVentana < 1 ? '< 1' : enVentana.toLocaleString('es-ES');
  document.getElementById('bits-tam').textContent = `${(512 * 512 * k / 8 / 1024).toLocaleString('es-ES')} KB`;
}

/* =====================================================================
   3. SNR y CNR sobre un fantoma
   ===================================================================== */
const N_F = 160, R_OBJ = 50, MEDIO_ROI = 10;
const snrCanvas = document.getElementById('snr-canvas');
const ruidoBase = (() => {
  const g = crearGauss(crearRng(42));
  return Float32Array.from({ length: N_F * N_F }, () => g());
})();
const enObjeto = (x, y) => (x - N_F / 2) ** 2 + (y - N_F / 2) ** 2 <= R_OBJ * R_OBJ;
const rois = { obj: { x: 80, y: 80 }, fondo: { x: 20, y: 20 } };

const snrMo = enlazarSlider('snr-mo', dibujarSNR);
const snrMf = enlazarSlider('snr-mf', dibujarSNR);
const snrS = enlazarSlider('snr-s', dibujarSNR);
document.getElementById('snr-filtro').addEventListener('change', dibujarSNR);

function fantoma() {
  const mo = +snrMo.value, mf = +snrMf.value, s = +snrS.value;
  let img = new Float32Array(N_F * N_F);
  for (let y = 0; y < N_F; y++)
    for (let x = 0; x < N_F; x++)
      img[y * N_F + x] = (enObjeto(x, y) ? mo : mf) + s * ruidoBase[y * N_F + x];
  if (document.getElementById('snr-filtro').checked) {
    const f = new Float32Array(N_F * N_F);
    const cl = i => Math.min(N_F - 1, Math.max(0, i));
    for (let y = 0; y < N_F; y++)
      for (let x = 0; x < N_F; x++) {
        let acc = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) acc += img[cl(y + dy) * N_F + cl(x + dx)];
        f[y * N_F + x] = acc / 9;
      }
    img = f;
  }
  return img;
}

function statsROI(img, c) {
  const vals = [];
  for (let y = c.y - MEDIO_ROI; y <= c.y + MEDIO_ROI; y++)
    for (let x = c.x - MEDIO_ROI; x <= c.x + MEDIO_ROI; x++) vals.push(img[y * N_F + x]);
  return mediaDesv(vals);
}

function dibujarSNR() {
  const img = fantoma();
  const vis = Float32Array.from(img, v => (v + 100) / 1200);
  const ctx = pintarGrises(snrCanvas, vis, N_F, N_F);
  for (const [k, color] of [['obj', '#eb811b'], ['fondo', '#2f9fd8']]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rois[k].x - MEDIO_ROI - 0.5, rois[k].y - MEDIO_ROI - 0.5, 2 * MEDIO_ROI + 2, 2 * MEDIO_ROI + 2);
  }
  const o = statsROI(img, rois.obj), f = statsROI(img, rois.fondo);
  const set = (id, v) => { document.getElementById(id).textContent = fmt1(v); };
  set('snr-muo', o.mu); set('snr-so', o.sigma); set('snr-muf', f.mu); set('snr-sf', f.sigma);
  set('snr-1', o.mu / o.sigma);
  set('snr-2', (o.mu - f.mu) / o.sigma);
  set('snr-3', o.mu / f.sigma);
  set('snr-4', (o.mu - f.mu) / f.sigma);
  set('snr-5', Math.abs(o.mu - f.mu) / Math.hypot(o.sigma, f.sigma));
}

function colocarROI(ev) {
  ev.preventDefault();
  const p = pixelDeEvento(snrCanvas, ev);
  const cual = document.querySelector('input[name="snr-roi"]:checked').value;
  const cl = v => Math.min(N_F - 1 - MEDIO_ROI, Math.max(MEDIO_ROI, v));
  rois[cual] = { x: cl(p.x), y: cl(p.y) };
  dibujarSNR();
}
snrCanvas.addEventListener('click', colocarROI);
snrCanvas.addEventListener('touchstart', colocarROI, { passive: false });

/* ---- Generador de problemas tipo examen ---- */
let problema = null;
const ent = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function nuevoProblema() {
  const tipo = ent(0, 3);
  if (tipo === 3) {
    const mA = ent(6, 40) * 5, sA = ent(3, 15), mB = ent(2, mA / 5 - 1) * 5, sB = ent(2, 12);
    problema = {
      texto: `En una imagen ecográfica se analizan dos zonas: <b>Zona A (lesión)</b>: μ<sub>A</sub> = ${mA}, σ<sub>A</sub> = ${sA}. <b>Zona B (tejido sano)</b>: μ<sub>B</sub> = ${mB}, σ<sub>B</sub> = ${sB}.<br>
        a) La SNR de la zona A usando su propia desviación típica.<br>
        b) La CNR definida como |μ<sub>A</sub> − μ<sub>B</sub>| / √(σ<sub>A</sub>² + σ<sub>B</sub>²).`,
      r1: mA / sA, s1: `SNR = ${mA} / ${sA}`,
      r2: Math.abs(mA - mB) / Math.hypot(sA, sB), s2: `CNR = |${mA} − ${mB}| / √(${sA}² + ${sB}²) = ${Math.abs(mA - mB)} / ${fmt1(Math.hypot(sA, sB))}`,
    };
  } else {
    const mo = ent(10, 200) * 10, so = ent(5, 60), mf = ent(1, Math.floor(mo / 30)) * 10, sf = ent(3, 30);
    const variantes = [
      ['usando la media del objeto y la desviación del <b>objeto</b>', mo / so, `SNR = ${mo} / ${so}`],
      ['usando la media del objeto y la desviación del <b>fondo</b>', mo / sf, `SNR = ${mo} / ${sf}`],
      ['restando el fondo: (μ<sub>obj</sub> − μ<sub>fondo</sub>) / σ<sub>obj</sub>', (mo - mf) / so, `SNR = (${mo} − ${mf}) / ${so}`],
    ];
    const [txt, r1, s1] = variantes[tipo];
    problema = {
      texto: `En una imagen de resonancia magnética se miden: <b>Tejido (objeto)</b>: μ<sub>obj</sub> = ${mo}, σ<sub>obj</sub> = ${so}. <b>Fondo</b>: μ<sub>fondo</sub> = ${mf}, σ<sub>fondo</sub> = ${sf}.<br>
        a) La SNR ${txt}.<br>
        b) La CNR entre el tejido y el fondo, tomando como ruido la desviación del fondo.`,
      r1, s1, r2: (mo - mf) / sf, s2: `CNR = (${mo} − ${mf}) / ${sf}`,
    };
  }
  document.getElementById('ex-enunciado').innerHTML = `<p>${problema.texto}</p>`;
  document.getElementById('ex-r1').value = '';
  document.getElementById('ex-r2').value = '';
  document.getElementById('ex-resultado').innerHTML = '';
}

function comprobar() {
  const bien = (v, r) => v !== '' && Math.abs(+v - r) <= Math.max(0.15, 0.01 * Math.abs(r));
  const a = document.getElementById('ex-r1').value, b = document.getElementById('ex-r2').value;
  const linea = (letra, ok, sol, r) =>
    `<div>${letra}) <span class="${ok ? 'ok' : 'bad'}">${ok ? '✓ Correcto' : '✗ Revisa'}</span> — ${sol} ≈ <b>${fmt1(r)}</b></div>`;
  document.getElementById('ex-resultado').innerHTML =
    linea('a', bien(a, problema.r1), problema.s1, problema.r1) + linea('b', bien(b, problema.r2), problema.s2, problema.r2);
}
document.getElementById('ex-nuevo').addEventListener('click', nuevoProblema);
document.getElementById('ex-comprobar').addEventListener('click', comprobar);

/* =====================================================================
   4. Volumen parcial (vista lateral x–z, 60 mm × 60 mm)
   ===================================================================== */
const N_VP = 240, MM = 60 / N_VP, FONDO_VP = 0.25, LES_VP = 1.0;
const LESIONES = [
  { nombre: '3 mm', x: 10, z: 30, d: 3 },
  { nombre: '6 mm', x: 28, z: 22, d: 6 },
  { nombre: '15 mm', x: 47, z: 36, d: 15 },
];
const real = new Float32Array(N_VP * N_VP);
for (let j = 0; j < N_VP; j++)
  for (let i = 0; i < N_VP; i++) {
    const x = (i + 0.5) * MM, z = (j + 0.5) * MM;
    real[j * N_VP + i] = LESIONES.some(l => (x - l.x) ** 2 + (z - l.z) ** 2 <= (l.d / 2) ** 2) ? LES_VP : FONDO_VP;
  }
pintarGrises(document.getElementById('vp-real'), real, N_VP, N_VP);

const vpE = enlazarSlider('vp-e', dibujarVP, v => `${v} mm`);
const vpOff = enlazarSlider('vp-off', dibujarVP, v => `${Math.round(v * 100)} %`);

function dibujarVP() {
  const e = +vpE.value, desfase = +vpOff.value * e;
  const scan = new Float32Array(N_VP * N_VP);
  const visto = LESIONES.map(() => 0);
  const bordes = [];
  for (let z0 = desfase - e; z0 < 60; z0 += e) {
    const j0 = Math.max(0, Math.round(z0 / MM)), j1 = Math.min(N_VP, Math.round((z0 + e) / MM));
    if (j1 <= j0) continue;
    bordes.push(j0);
    for (let i = 0; i < N_VP; i++) {
      let s = 0;
      for (let j = j0; j < j1; j++) s += real[j * N_VP + i];
      const m = s / (j1 - j0);
      for (let j = j0; j < j1; j++) scan[j * N_VP + i] = m;
    }
    LESIONES.forEach((l, k) => {
      const i = Math.floor(l.x / MM);
      visto[k] = Math.max(visto[k], (scan[j0 * N_VP + i] - FONDO_VP) / (LES_VP - FONDO_VP));
    });
  }
  const ctx = pintarGrises(document.getElementById('vp-scan'), scan, N_VP, N_VP);
  ctx.strokeStyle = 'rgba(235,129,27,0.7)';
  ctx.lineWidth = 1;
  for (const j of bordes) { ctx.beginPath(); ctx.moveTo(0, j + 0.5); ctx.lineTo(N_VP, j + 0.5); ctx.stroke(); }
  document.getElementById('vp-tabla').innerHTML = LESIONES.map((l, k) =>
    `<tr><td>${l.nombre}</td><td>100 %</td><td class="${visto[k] < 0.25 ? 'bad' : ''}">${Math.round(visto[k] * 100)} %</td></tr>`).join('');
}

/* =====================================================================
   5. Ecografía: impedancia y Doppler
   ===================================================================== */
const MEDIOS = [
  ['Aire', 0.0004], ['Pulmón (aireado)', 0.26], ['Grasa', 1.38], ['Agua', 1.48], ['Gel ecográfico', 1.6],
  ['Tejido blando', 1.63], ['Hígado', 1.65], ['Piel', 1.7], ['Músculo', 1.70], ['Hueso', 7.8],
];
const m1 = document.getElementById('eco-m1'), m2 = document.getElementById('eco-m2');
for (const sel of [m1, m2])
  MEDIOS.forEach(([n, z], i) => sel.add(new Option(`${n} (${z} MRayl)`, i)));
m1.value = 7; m2.value = 0;
m1.addEventListener('change', dibujarEco);
m2.addEventListener('change', dibujarEco);

function dibujarEco() {
  const z1 = MEDIOS[m1.value][1], z2 = MEDIOS[m2.value][1];
  const R = ((z2 - z1) / (z2 + z1)) ** 2;
  const cv = document.getElementById('eco-barra'), ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#eb811b'; ctx.fillRect(0, 10, W * R, 34);
  ctx.fillStyle = '#2f9fd8'; ctx.fillRect(W * R, 10, W * (1 - R), 34);
  ctx.fillStyle = css('--text'); ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left'; ctx.fillText('reflejado', 2, 60);
  ctx.textAlign = 'right'; ctx.fillText('transmitido', W - 2, 60);
  document.getElementById('eco-r').innerHTML =
    `R = <b>${(100 * R).toFixed(R < 0.001 ? 3 : 1)} %</b> reflejado · T = <b>${(100 * (1 - R)).toFixed(1)} %</b> transmitido`;
}

const dopF0 = enlazarSlider('dop-f0', dibujarDoppler, v => `${v} MHz`);
const dopV = enlazarSlider('dop-v', dibujarDoppler, v => `${v.toFixed(2)} m/s`);
const dopTh = enlazarSlider('dop-th', dibujarDoppler, v => `${v}°`);
const deltaF = () => 2 * (+dopF0.value * 1e6) * (+dopV.value) * Math.cos(+dopTh.value * Math.PI / 180) / 1540;

function dibujarDoppler() {
  const df = deltaF();
  const audible = df >= 20 && df <= 20000;
  document.getElementById('dop-df').innerHTML =
    `Δf ≈ <b>${Math.round(df).toLocaleString('es-ES')} Hz</b> ${audible ? '— audible' : '— <span class="bad">no audible</span>'}`;
}

let audioCtx = null;
document.getElementById('dop-play').addEventListener('click', () => {
  const df = deltaF();
  if (df < 20) return;
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  const t0 = audioCtx.currentTime, dur = 3;
  // Flujo pulsátil: 3 latidos; la frecuencia sigue a la velocidad de la sangre.
  const curva = new Float32Array(300);
  for (let i = 0; i < curva.length; i++) {
    const t = i / curva.length * dur;
    const pulso = Math.max(0, Math.sin(2 * Math.PI * t)) ** 2;
    curva[i] = Math.min(20000, Math.max(20, df * (0.4 + 0.6 * pulso)));
  }
  const osc = audioCtx.createOscillator(), gan = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueCurveAtTime(curva, t0, dur);
  gan.gain.setValueAtTime(0, t0);
  gan.gain.linearRampToValueAtTime(0.25, t0 + 0.05);
  gan.gain.setValueAtTime(0.25, t0 + dur - 0.1);
  gan.gain.linearRampToValueAtTime(0, t0 + dur);
  osc.connect(gan).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
});

/* ===================================================================== */
dibujarTC();
dibujarBits();
dibujarSNR();
nuevoProblema();
dibujarVP();
dibujarEco();
dibujarDoppler();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { dibujarTC(); dibujarEco(); });
