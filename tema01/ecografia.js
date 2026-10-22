// Laboratorio web — Tema 1 — Animación de ecografía pulso-eco (modo A y modo B).
// Depende de ../assets/comun.js.
//
// Modelo físico (simplificado, pero con los ingredientes reales):
//  - Cada tejido tiene impedancia Z, atenuación α (por cm, en intensidad) y un nivel de
//    retrodispersión s (lo que genera el moteado o speckle).
//  - En cada interfaz se refleja R = ((Z2-Z1)/(Z2+Z1))^2 y se transmite 1-R.
//  - La señal recibida desde una profundidad se atenúa en la ida y en la vuelta (T^2).
//  - El speckle tiene estadística exponencial en intensidad (como en un ecógrafo real).
//  - La TGC (compensación de ganancia en el tiempo) compensa una atenuación media α0.
(function () {
  const V_S = 1540;                      // m/s
  const PROF = 12;                       // cm de profundidad máxima
  const APEX_Z = -1;                     // vértice virtual de la sonda convexa (cm)
  const R_MAX = PROF - APEX_Z;           // radio del sector
  const THETA_MAX = 32 * Math.PI / 180;
  const DR = 0.02;                       // paso de muestreo a lo largo de la línea (cm)
  const ALFA0 = 0.4;                     // atenuación media que compensa la TGC
  const KAPPA = 4e-4;                    // escala de la retrodispersión
  const DB_MAX = -5, RANGO_DB = 45;      // ventana de visualización (rango dinámico)

  const TEJIDOS = [
    { n: 'Piel', Z: 1.70, a: 0.40, s: 0.6, c: '#e3b49e' },
    { n: 'Grasa', Z: 1.38, a: 0.30, s: 0.35, c: '#f0d58a' },
    { n: 'Músculo', Z: 1.70, a: 0.50, s: 0.5, c: '#c4625a' },
    { n: 'Hígado', Z: 1.65, a: 0.40, s: 0.8, c: '#93584b' },
    { n: 'Quiste (líquido)', Z: 1.52, a: 0.01, s: 0, c: '#7fb3e0' },
    { n: 'Vaso (sangre)', Z: 1.61, a: 0.10, s: 0.03, c: '#d64545' },
    { n: 'Cálculo', Z: 6.0, a: 5.0, s: 0.8, c: '#f4f4f4' },
  ];

  function tejido(x, z) {
    if ((x - 2.3) ** 2 + (z - 7.0) ** 2 <= 0.55 ** 2) return 6;
    if ((x + 2.2) ** 2 + (z - 6.2) ** 2 <= 1.3 ** 2) return 4;
    if ((x - 0.3) ** 2 + (z - 4.6) ** 2 <= 0.45 ** 2) return 5;
    if (z < 0.25) return 0;
    if (z < 1.4 + 0.15 * Math.sin(0.8 * x)) return 1;
    if (z < 3.3 + 0.25 * Math.sin(0.5 * x + 1)) return 2;
    return 3;
  }

  // Ruido de speckle reproducible: hash de la posición → intensidad con distribución exponencial.
  function speckle(x, z) {
    let h = Math.imul(Math.round(x * 25) | 0, 374761393) ^ Math.imul(Math.round(z * 25) | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const u = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    return -Math.log(u + 1e-9);
  }

  // Simula una línea de pulso-eco con ángulo theta. Devuelve muestras en dB y las interfaces.
  function simularLinea(theta, conTGC) {
    const sx = Math.sin(theta), cz = Math.cos(theta);
    const r0 = -APEX_Z / cz;                         // donde la línea entra en la piel (z = 0)
    const nMuestras = Math.max(1, Math.floor((R_MAX - r0) / DR));
    const db = new Float32Array(nMuestras);
    const interfaces = [];
    let tAten = 1, tInterf = 1;                       // transmisión de ida: atenuación e interfaces
    let previo = tejido(r0 * sx, APEX_Z + r0 * cz);
    for (let k = 0; k < nMuestras; k++) {
      const r = r0 + k * DR, x = r * sx, z = APEX_Z + r * cz;
      const t = tejido(x, z), T = TEJIDOS[t];
      let reflejo = 0;
      if (t !== previo) {
        const Z1 = TEJIDOS[previo].Z, Z2 = T.Z;
        reflejo = ((Z2 - Z1) / (Z2 + Z1)) ** 2;
      }
      const b = reflejo + KAPPA * T.s * speckle(x, z);
      let recibido = b * (tAten * tInterf) ** 2;
      if (conTGC) recibido *= Math.exp(2 * ALFA0 * k * DR);
      db[k] = 10 * Math.log10(recibido + 1e-12);
      if (reflejo > 0) {
        interfaces.push({ k, d: k * DR, de: TEJIDOS[previo].n, a: T.n, R: reflejo, db: db[k] });
        tInterf *= 1 - reflejo;
      }
      tAten *= Math.exp(-T.a * DR);
      previo = t;
    }
    return { theta, r0, db, interfaces };
  }

  const gris = dB => Math.max(0, Math.min(1, (dB - (DB_MAX - RANGO_DB)) / RANGO_DB));

  /* ---------------- elementos y estado ---------------- */
  const cvAnat = document.getElementById('pe-anatomia');
  const cvA = document.getElementById('pe-modoA');
  const cvB = document.getElementById('pe-modoB');
  const txt = document.getElementById('pe-info');
  const chkTGC = document.getElementById('pe-tgc');
  const slTheta = enlazarSlider('pe-theta', () => { if (!anim) prepararA(); }, v => `${v}°`);
  const slLineas = enlazarSlider('pe-lineas', () => { if (!anim) prepararB(false); }, v => `${v}`);
  const slVel = enlazarSlider('pe-vel', () => {}, v => `${v} líneas/s`);

  const W_ANAT = 300, H_ANAT = 260;
  const aPx = (x, z) => [(x + 7) / 14 * W_ANAT, (z - APEX_Z) / R_MAX * H_ANAT];

  // Mapa de tejidos (fondo del canvas de anatomía), calculado una vez.
  const fondoAnat = (() => {
    const c = document.createElement('canvas');
    c.width = W_ANAT; c.height = H_ANAT;
    const ctx = c.getContext('2d'), img = ctx.createImageData(W_ANAT, H_ANAT);
    const rgb = TEJIDOS.map(t => [1, 3, 5].map(i => parseInt(t.c.slice(i, i + 2), 16)));
    for (let j = 0; j < H_ANAT; j++)
      for (let i = 0; i < W_ANAT; i++) {
        const x = i / W_ANAT * 14 - 7, z = APEX_Z + j / H_ANAT * R_MAX;
        const col = z < 0 ? [30, 34, 38] : rgb[tejido(x, z)];
        const p = 4 * (j * W_ANAT + i);
        img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2]; img.data[p + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    return c;
  })();

  function dibujarAnatomia(lineaActiva, profPulso, ecos) {
    cvAnat.width = W_ANAT; cvAnat.height = H_ANAT;
    const ctx = cvAnat.getContext('2d');
    ctx.drawImage(fondoAnat, 0, 0);
    // contorno del sector
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const [ax, ay] = aPx(0, APEX_Z);
    for (const th of [-THETA_MAX, THETA_MAX]) {
      ctx.moveTo(...aPx(-APEX_Z * Math.tan(th), 0));
      ctx.lineTo(...aPx(R_MAX * Math.sin(th), APEX_Z + R_MAX * Math.cos(th)));
    }
    ctx.stroke();
    // sonda
    ctx.fillStyle = '#9aa4ad';
    ctx.fillRect(ax - 22, aPx(0, 0)[1] - 7, 44, 7);
    if (!lineaActiva) return;
    const th = lineaActiva.theta, sx = Math.sin(th), cz = Math.cos(th);
    const punto = d => aPx((lineaActiva.r0 + d) * sx, APEX_Z + (lineaActiva.r0 + d) * cz);
    ctx.strokeStyle = 'rgba(80,170,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(...punto(0)); ctx.lineTo(...punto(R_MAX - lineaActiva.r0)); ctx.stroke();
    if (profPulso != null && profPulso >= 0) {
      ctx.fillStyle = '#2f9fd8';
      ctx.beginPath(); ctx.arc(...punto(profPulso), 5, 0, 2 * Math.PI); ctx.fill();
    }
    for (const e of ecos || []) {
      ctx.fillStyle = `rgba(235,129,27,${0.35 + 0.65 * gris(e.db)})`;
      ctx.beginPath(); ctx.arc(...punto(e.pos), 4, 0, 2 * Math.PI); ctx.fill();
    }
  }

  /* ---------------- MODO A: una línea, animada ---------------- */
  let lineaA = null;
  const usPorCm = 2 / (V_S * 100) * 1e6;   // µs de ida y vuelta por cm de profundidad (≈ 13 µs/cm)

  function prepararA() {
    lineaA = simularLinea(+slTheta.value * Math.PI / 180, chkTGC.checked);
    dibujarTrazaA(lineaA.db.length * DR);
    dibujarAnatomia(lineaA);
    const lista = lineaA.interfaces.filter(i => i.db > DB_MAX - RANGO_DB)
      .map(i => `${i.de}→${i.a}: R = ${(100 * i.R).toFixed(i.R < 0.01 ? 2 : 1)} %, eco a t = ${(i.d * usPorCm).toFixed(0)} µs → d = ${i.d.toFixed(1)} cm`);
    txt.innerHTML = lista.length ? '<b>Interfaces en esta línea:</b><br>' + lista.join('<br>') : 'Ninguna interfaz fuerte en esta línea.';
  }

  function dibujarTrazaA(profMostrada) {
    const ctx = cvA.getContext('2d'), W = cvA.width, H = cvA.height, pad = 22;
    ctx.clearRect(0, 0, W, H);
    const total = lineaA.db.length;
    const xDe = d => d / (total * DR) * W;
    ctx.strokeStyle = css('--accent-2');
    ctx.fillStyle = 'rgba(235,129,27,0.25)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, H - pad);
    const kMax = Math.min(total, Math.floor(profMostrada / DR));
    for (let k = 0; k < kMax; k++) ctx.lineTo(xDe(k * DR), H - pad - gris(lineaA.db[k]) * (H - pad - 6));
    ctx.lineTo(xDe(kMax * DR), H - pad);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = css('--muted');
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let d = 0; d <= 12; d += 2) {
      ctx.fillText(`${d} cm`, xDe(d), H - 9);
      ctx.fillText(`${Math.round(d * usPorCm)} µs`, xDe(d), H - 0.5);
    }
  }

  /* ---------------- MODO B: barrido de líneas ---------------- */
  const W_B = 280, H_B = 240;
  let lineasB = [];

  function prepararB(vacio) {
    const n = +slLineas.value;
    lineasB = [];
    for (let i = 0; i < n; i++) {
      const th = -THETA_MAX + (n === 1 ? THETA_MAX : 2 * THETA_MAX * i / (n - 1));
      lineasB.push(simularLinea(th, chkTGC.checked));
    }
    pintarB(vacio ? 0 : n);
    const tLinea = PROF * usPorCm;
    const tImagen = n * tLinea / 1000;
    document.getElementById('pe-fps').innerHTML =
      `Cada línea tarda 2·${PROF} cm / v<sub>s</sub> ≈ <b>${tLinea.toFixed(0)} µs</b>. Con ${n} líneas: ${n} × ${tLinea.toFixed(0)} µs ≈ <b>${tImagen.toFixed(1)} ms</b> por imagen → <b>${Math.round(1000 / tImagen)} imágenes/s</b> como máximo.`;
  }

  function pintarB(nAdquiridas) {
    const vals = new Float32Array(W_B * H_B);
    const n = lineasB.length;
    for (let j = 0; j < H_B; j++)
      for (let i = 0; i < W_B; i++) {
        const x = i / W_B * 14 - 7, z = APEX_Z + j / H_B * R_MAX;
        const r = Math.hypot(x, z - APEX_Z), th = Math.atan2(x, z - APEX_Z);
        let v = -1;
        if (z >= 0 && Math.abs(th) <= THETA_MAX && r <= R_MAX) {
          const idx = n === 1 ? 0 : Math.round((th + THETA_MAX) / (2 * THETA_MAX) * (n - 1));
          if (idx < nAdquiridas) {
            const L = lineasB[idx], k = Math.floor((r - L.r0) / DR);
            v = k >= 0 && k < L.db.length ? gris(L.db[k]) : 0;
          } else v = 0;
        }
        vals[j * W_B + i] = v < 0 ? 0.08 : v;
      }
    pintarGrises(cvB, vals, W_B, H_B);
  }

  /* ---------------- animación ---------------- */
  let anim = null;

  function parar() {
    if (anim) cancelAnimationFrame(anim.raf);
    anim = null;
  }

  function animarA() {
    parar();
    prepararA();
    const durAnim = 5000;                             // ms de animación para todo el viaje
    const profMax = lineaA.db.length * DR;
    const tReal = profMax * usPorCm;                  // µs reales de ida y vuelta
    document.getElementById('pe-camara').textContent =
      `Cámara lenta: ${Math.round(durAnim * 1000 / tReal).toLocaleString('es-ES')} veces más despacio que la realidad.`;
    const visibles = lineaA.interfaces.filter(i => i.db > DB_MAX - RANGO_DB);
    const inicio = performance.now();
    const paso = ahora => {
      const f = Math.min(1, (ahora - inicio) / durAnim);
      const viaje = f * 2 * profMax;                  // camino recorrido (ida y vuelta), en cm
      const profPulso = viaje <= profMax ? viaje : null;
      const ecos = visibles.filter(e => viaje >= e.d && viaje < 2 * e.d).map(e => ({ pos: 2 * e.d - viaje, db: e.db }));
      dibujarAnatomia(lineaA, profPulso, ecos);
      dibujarTrazaA(viaje / 2);                       // lo recibido hasta ahora: profundidad = camino/2
      if (f < 1) anim = { raf: requestAnimationFrame(paso) };
      else anim = null;
    };
    anim = { raf: requestAnimationFrame(paso) };
  }

  function animarB() {
    parar();
    prepararB(true);
    const inicio = performance.now();
    const paso = ahora => {
      const n = lineasB.length;
      const hechas = Math.min(n, Math.floor((ahora - inicio) / 1000 * +slVel.value));
      pintarB(hechas);
      dibujarAnatomia(lineasB[Math.min(n - 1, hechas)]);
      if (hechas < n) anim = { raf: requestAnimationFrame(paso) };
      else { anim = null; dibujarAnatomia(null); }
    };
    anim = { raf: requestAnimationFrame(paso) };
  }

  document.getElementById('pe-disparar').addEventListener('click', animarA);
  document.getElementById('pe-barrer').addEventListener('click', animarB);
  chkTGC.addEventListener('change', () => { parar(); prepararA(); prepararB(false); });
  window.addEventListener('pestana', ev => { if (ev.detail !== 'pulsoeco') parar(); });

  // Leyenda de tejidos
  document.getElementById('pe-leyenda').innerHTML = TEJIDOS.map(t =>
    `<span style="white-space:nowrap"><span style="display:inline-block;width:10px;height:10px;background:${t.c};border:1px solid #0003"></span> ${t.n} (Z = ${t.Z})</span>`).join(' · ');

  prepararA();
  prepararB(false);
})();

iniciarPestanas();
