// Laboratorio web — Tema 1 — Animación de PET: aniquilaciones, coincidencias,
// sinograma y reconstrucción por retroproyección (simple o filtrada).
// Depende de ../assets/comun.js.
//
// Simplificaciones: sin rango del positrón, sin no-colinealidad, sin atenuación ni
// coincidencias aleatorias/dispersas. Lo esencial (LOR, sinograma, ruido de Poisson) sí está.
(function () {
  const RR = 0.92;          // radio del anillo de detectores (unidades normalizadas)
  const ND = 72;            // nº de detectores dibujados en el anillo
  const NTH = 120, NS = 121; // bins del sinograma (ángulo × distancia)
  const NR = 128, EXT = 0.8; // imagen reconstruida: NR × NR en [-EXT, EXT]
  const NA = 200;           // rejilla de la distribución de actividad

  /* ---------------- maniquí (distribución del radiofármaco) ---------------- */
  function actividad(x, y) {
    if ((x / 0.72) ** 2 + (y / 0.52) ** 2 > 1) return 0;
    if ((x - 0.42) ** 2 + (y - 0.18) ** 2 <= 0.065 ** 2) return 10;   // tumor
    if ((x + 0.12) ** 2 + (y + 0.30) ** 2 <= 0.035 ** 2) return 7;    // lesión pequeña
    const rc = Math.hypot(x - 0.12, y + 0.12);
    if (rc <= 0.14 && rc >= 0.09) return 6;                           // miocardio
    if (((x + 0.32) / 0.26) ** 2 + ((y - 0.12) / 0.20) ** 2 <= 1) return 2.5; // hígado
    return 1;
  }
  const actGrid = new Float32Array(NA * NA);
  const cdf = new Float64Array(NA * NA);
  let acum = 0;
  for (let j = 0; j < NA; j++)
    for (let i = 0; i < NA; i++) {
      const a = actividad((i + 0.5) / NA * 2 - 1, (j + 0.5) / NA * 2 - 1);
      actGrid[j * NA + i] = a;
      acum += a;
      cdf[j * NA + i] = acum;
    }

  let rng = crearRng(511);
  function muestrearOrigen() {
    const u = rng() * acum;
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < u) lo = m + 1; else hi = m; }
    const i = lo % NA, j = Math.floor(lo / NA);
    return { x: (i + rng()) / NA * 2 - 1, y: (j + rng()) / NA * 2 - 1 };
  }

  /* ---------------- elementos ---------------- */
  const cvEsc = document.getElementById('pet-escaner');
  const cvReal = document.getElementById('pet-real');
  const cvSino = document.getElementById('pet-sino');
  const cvRec = document.getElementById('pet-rec');
  const W = 340;
  cvEsc.width = W; cvEsc.height = W;
  const px = v => (v + 1) / 2 * W;

  // Distribución real (referencia)
  const maxAct = 10;
  pintarColor(cvReal, Float32Array.from(actGrid, a => a / maxAct), NA, NA, colorHot);

  // Capa donde se acumulan las LOR dibujadas
  const capaLOR = document.createElement('canvas');
  capaLOR.width = W; capaLOR.height = W;
  const ctxLOR = capaLOR.getContext('2d');

  /* ---------------- estado ---------------- */
  let sino, nEventos, lorDibujadas, vuelos, destellos, pendientes, corriendo, ultimoT, ultimaRec, sucio;
  const VELOCIDADES = [2, 10, 50, 250, 1000, 5000, 20000];
  const slVel = enlazarSlider('pet-vel', () => {}, v => `${VELOCIDADES[v].toLocaleString('es-ES')} eventos/s`);

  function reiniciar() {
    rng = crearRng(511 + Math.floor(Math.random() * 1e6));
    sino = new Float32Array(NTH * NS);
    nEventos = 0; lorDibujadas = 0; vuelos = []; destellos = new Float32Array(ND); pendientes = 0;
    ctxLOR.clearRect(0, 0, W, W);
    sucio = true;
    actualizarRec();
    dibujarEscaner(performance.now());
  }

  // Genera un evento: origen, dirección, LOR, bin del sinograma y detectores alcanzados.
  function evento() {
    const o = muestrearOrigen();
    const phi = rng() * Math.PI;
    let th = phi + Math.PI / 2;
    if (th >= Math.PI) th -= Math.PI;
    const s = o.x * Math.cos(th) + o.y * Math.sin(th);
    const it = Math.min(NTH - 1, Math.floor(th / Math.PI * NTH));
    const is = Math.round((s + RR) / (2 * RR) * (NS - 1));
    if (is >= 0 && is < NS) sino[it * NS + is]++;
    nEventos++;
    const h = Math.sqrt(Math.max(0, RR * RR - s * s));
    const fx = s * Math.cos(th), fy = s * Math.sin(th), dx = -Math.sin(th), dy = Math.cos(th);
    const p1 = { x: fx + h * dx, y: fy + h * dy }, p2 = { x: fx - h * dx, y: fy - h * dy };
    const det = p => ((Math.round(Math.atan2(p.y, p.x) / (2 * Math.PI) * ND) % ND) + ND) % ND;
    return { o, p1, p2, d1: det(p1), d2: det(p2) };
  }

  function dibujarLOR(e) {
    if (lorDibujadas > 4000) return;
    ctxLOR.strokeStyle = 'rgba(255,214,0,0.07)';
    ctxLOR.lineWidth = 1;
    ctxLOR.beginPath();
    ctxLOR.moveTo(px(e.p1.x), px(e.p1.y));
    ctxLOR.lineTo(px(e.p2.x), px(e.p2.y));
    ctxLOR.stroke();
    lorDibujadas++;
  }

  /* ---------------- reconstrucción ---------------- */
  // Núcleo rampa de Ram-Lak en el dominio espacial (bins de distancia).
  const rampa = (() => {
    const k = new Float32Array(2 * NS - 1);
    for (let n = -(NS - 1); n <= NS - 1; n++)
      k[n + NS - 1] = n === 0 ? 0.25 : (n % 2 ? -1 / (Math.PI * Math.PI * n * n) : 0);
    return k;
  })();

  function reconstruir(filtrada) {
    let proy = sino;
    if (filtrada) {
      proy = new Float32Array(NTH * NS);
      for (let t = 0; t < NTH; t++)
        for (let i = 0; i < NS; i++) {
          let acc = 0;
          for (let j = 0; j < NS; j++) acc += sino[t * NS + j] * rampa[i - j + NS - 1];
          proy[t * NS + i] = acc;
        }
      // Apodización (suavizado [1 4 6 4 1]/16, parecido a una ventana de Hann): sin ella,
      // el filtro rampa amplifica tanto el ruido de alta frecuencia que la imagen es puro grano.
      const tmp = new Float32Array(NS), w = [1, 4, 6, 4, 1];
      for (let t = 0; t < NTH; t++) {
        for (let i = 0; i < NS; i++) {
          let acc = 0, ws = 0;
          for (let d = -2; d <= 2; d++) {
            const j = i + d;
            if (j >= 0 && j < NS) { acc += w[d + 2] * proy[t * NS + j]; ws += w[d + 2]; }
          }
          tmp[i] = acc / ws;
        }
        proy.set(tmp, t * NS);
      }
    }
    const img = new Float32Array(NR * NR);
    for (let t = 0; t < NTH; t++) {
      const th = (t + 0.5) / NTH * Math.PI, c = Math.cos(th), sn = Math.sin(th);
      for (let j = 0; j < NR; j++) {
        const y = (j + 0.5) / NR * 2 * EXT - EXT;
        for (let i = 0; i < NR; i++) {
          const x = (i + 0.5) / NR * 2 * EXT - EXT;
          const pos = ((x * c + y * sn) + RR) / (2 * RR) * (NS - 1);
          const i0 = Math.floor(pos), f = pos - i0;
          if (i0 >= 0 && i0 < NS - 1) img[j * NR + i] += (1 - f) * proy[t * NS + i0] + f * proy[t * NS + i0 + 1];
        }
      }
    }
    return img;
  }

  function actualizarRec() {
    const filtrada = document.querySelector('input[name="pet-rec"]:checked').value === 'fbp';
    // Sinograma
    let maxS = 0;
    for (const v of sino) maxS = Math.max(maxS, v);
    const sv = new Float32Array(NS * NTH);
    for (let t = 0; t < NTH; t++) for (let i = 0; i < NS; i++) sv[t * NS + i] = maxS ? sino[t * NS + i] / maxS : 0;
    pintarColor(cvSino, sv, NS, NTH, colorHot);
    // Imagen
    const img = reconstruir(filtrada);
    const dentro = [];
    for (let j = 0; j < NR; j++)
      for (let i = 0; i < NR; i++) {
        const x = (i + 0.5) / NR * 2 * EXT - EXT, y = (j + 0.5) / NR * 2 * EXT - EXT;
        if ((x / 0.72) ** 2 + (y / 0.52) ** 2 <= 1) dentro.push(img[j * NR + i]);
      }
    dentro.sort((a, b) => a - b);
    const ref = dentro.length ? dentro[Math.floor(0.995 * (dentro.length - 1))] : 1;
    pintarColor(cvRec, Float32Array.from(img, v => (ref > 0 ? v / ref : 0)), NR, NR, colorHot);
    // Ruido relativo en una ROI homogénea del hígado
    const roi = [];
    for (let j = 0; j < NR; j++)
      for (let i = 0; i < NR; i++) {
        const x = (i + 0.5) / NR * 2 * EXT - EXT, y = (j + 0.5) / NR * 2 * EXT - EXT;
        if ((x + 0.34) ** 2 + (y - 0.14) ** 2 <= 0.09 ** 2) roi.push(img[j * NR + i]);
      }
    const { mu, sigma } = mediaDesv(roi);
    document.getElementById('pet-n').textContent = nEventos.toLocaleString('es-ES');
    document.getElementById('pet-ruido').textContent =
      nEventos > 50 && mu > 0 ? `${(100 * sigma / mu).toFixed(1)} %` : '—';
    sucio = false;
    ultimaRec = performance.now();
  }

  /* ---------------- dibujo del escáner ---------------- */
  function dibujarEscaner(ahora) {
    const ctx = cvEsc.getContext('2d');
    ctx.fillStyle = '#101418';
    ctx.fillRect(0, 0, W, W);
    ctx.drawImage(capaLOR, 0, 0);
    // contorno del paciente
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(px(0), px(0), 0.72 * W / 2, 0.52 * W / 2, 0, 0, 2 * Math.PI);
    ctx.stroke();
    // anillo de detectores
    for (let d = 0; d < ND; d++) {
      const a = d / ND * 2 * Math.PI;
      const brillo = destellos[d];
      ctx.fillStyle = brillo > 0.02 ? `rgba(80,190,255,${0.35 + 0.65 * brillo})` : '#3a444c';
      ctx.save();
      ctx.translate(px(RR * Math.cos(a)), px(RR * Math.sin(a)));
      ctx.rotate(a);
      ctx.fillRect(0, -4, 10, 8);
      ctx.restore();
    }
    // fotones en vuelo
    const T_VUELO = 450;
    vuelos = vuelos.filter(v => {
      const f = (ahora - v.t0) / T_VUELO;
      if (f >= 1) {
        destellos[v.e.d1] = 1; destellos[v.e.d2] = 1;
        dibujarLOR(v.e);
        return false;
      }
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath(); ctx.arc(px(v.e.o.x), px(v.e.o.y), 3, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = '#7fd4ff';
      for (const p of [v.e.p1, v.e.p2]) {
        ctx.beginPath();
        ctx.arc(px(v.e.o.x + f * (p.x - v.e.o.x)), px(v.e.o.y + f * (p.y - v.e.o.y)), 2.5, 0, 2 * Math.PI);
        ctx.fill();
      }
      return true;
    });
    for (let d = 0; d < ND; d++) destellos[d] *= 0.9;
  }

  /* ---------------- bucle ---------------- */
  function bucle(ahora) {
    if (!corriendo) return;
    const dt = Math.min(0.1, (ahora - ultimoT) / 1000);
    ultimoT = ahora;
    pendientes += dt * VELOCIDADES[+slVel.value];
    let n = Math.floor(pendientes);
    pendientes -= n;
    const animables = VELOCIDADES[+slVel.value] <= 50 ? n : Math.min(n, 2);
    for (let k = 0; k < n; k++) {
      const e = evento();
      if (k < animables && vuelos.length < 60) vuelos.push({ e, t0: ahora });
      else dibujarLOR(e);
    }
    if (n > 0) sucio = true;
    dibujarEscaner(ahora);
    if (sucio && ahora - ultimaRec > 400) actualizarRec();
    requestAnimationFrame(bucle);
  }

  const btnPlay = document.getElementById('pet-play');
  function arrancar() {
    if (corriendo) return;
    corriendo = true;
    ultimoT = performance.now();
    btnPlay.textContent = '⏸ Pausa';
    requestAnimationFrame(bucle);
  }
  function pausar() {
    corriendo = false;
    btnPlay.textContent = '▶ Adquirir';
  }
  btnPlay.addEventListener('click', () => (corriendo ? pausar() : arrancar()));
  document.getElementById('pet-mas').addEventListener('click', () => {
    for (let k = 0; k < 50000; k++) dibujarLOR(evento());
    actualizarRec();
    dibujarEscaner(performance.now());
  });
  document.getElementById('pet-reset').addEventListener('click', () => { pausar(); reiniciar(); });
  document.querySelectorAll('input[name="pet-rec"]').forEach(r => r.addEventListener('change', actualizarRec));
  window.addEventListener('pestana', ev => { if (ev.detail !== 'pet') pausar(); });

  reiniciar();
})();
