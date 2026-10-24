// Laboratorio web — Tema 1 — Calidad de imagen: artefactos de TC simulados ("rompe el escáner").
// Depende de ../assets/comun.js y de lab.js (TC sintético `tc`, aplicarVentana, css).

/* =====================================================================
   10. Rompe el escáner: artefactos de TC
   ===================================================================== */
(function () {
  const NS = 185, NTH = 180, NR = 192;         // bins de distancia, ángulos, píxeles reconstruidos
  const MU_AGUA = 0.19, CM = 20;               // μ del agua (cm⁻¹, ~70 keV); 1 unidad = 20 cm
  const MU_METAL = 6;                          // acero, cm⁻¹
  const DS = 2 / (NS - 1);
  const TORNILLOS = [{ x: -0.055, y: 0.42, r: 0.02 }, { x: 0.055, y: 0.42, r: 0.02 }];
  const IANILLO = Math.round((NS - 1) / 2 + 38);
  const DOSIS = [1e3, 3e3, 1e4, 3e4, 1e5, 3e5, 1e6];
  const PROY = [6, 10, 12, 18, 30, 45, 60, 90, 180];

  // μ (cm⁻¹) del TC de lab.js
  const mu = Float32Array.from(tc, h => Math.max(0, MU_AGUA * (1 + h / 1000)));
  function muEn(x, y) {
    const fx = (x + 1) / 2 * N_TC - 0.5, fy = (y + 1) / 2 * N_TC - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= N_TC - 1 || j >= N_TC - 1) return 0;
    const a = fx - i, b = fy - j, k = j * N_TC + i;
    return (1 - a) * (1 - b) * mu[k] + a * (1 - b) * mu[k + 1] + (1 - a) * b * mu[k + N_TC] + a * b * mu[k + N_TC + 1];
  }

  // Sinograma ideal del paciente (integrales de línea de μ, en cm·cm⁻¹), calculado una vez.
  const base = new Float32Array(NTH * NS);
  for (let t = 0; t < NTH; t++) {
    const th = t / NTH * Math.PI, c = Math.cos(th), sn = Math.sin(th);
    for (let i = 0; i < NS; i++) {
      const s = -1 + i * DS, L = Math.sqrt(Math.max(0, 1 - s * s)), dt = 2 / 256;
      let acc = 0;
      for (let u = -L; u <= L; u += dt) acc += muEn(s * c - u * sn, s * sn + u * c);
      base[t * NS + i] = acc * dt * CM;
    }
  }

  const cvImg = document.getElementById('art-img');
  const cvSino = document.getElementById('art-sino');
  const panel = document.getElementById('art-panel');
  const chkAnillo = document.getElementById('art-anillo');
  const chkMetal = document.getElementById('art-metal');
  const fmtN = v => v.toLocaleString('es-ES');
  const slDosis = enlazarSlider('art-dosis', programar, v => `${fmtN(DOSIS[v])} fotones/rayo`);
  const slProy = enlazarSlider('art-proy', programar, v => `${PROY[v]}`);
  const slMov = enlazarSlider('art-mov', programar, v => `${v} mm`);
  let ventana = { wl: 40, ww: 400 };

  // Kernel rampa de Ram-Lak (en bins).
  const rampa = new Float32Array(2 * NS - 1);
  for (let n = -(NS - 1); n <= NS - 1; n++) rampa[n + NS - 1] = n === 0 ? 0.25 : (n % 2 ? -1 / (Math.PI * Math.PI * n * n) : 0);

  function medir() {
    const N0 = DOSIS[+slDosis.value], paso = NTH / PROY[+slProy.value];
    const mov = +slMov.value / 10 / CM;             // mm → unidades
    const gauss = crearGauss(crearRng(1895));        // semilla fija: la imagen no «baila» al cambiar la ventana
    const medida = new Float32Array(NTH * NS);
    const usados = [];
    for (let t = 0; t < NTH; t += paso) {
      usados.push(t);
      const th = t / NTH * Math.PI, c = Math.cos(th), sn = Math.sin(th);
      // A mitad de la adquisición el paciente se desplaza `mov` hacia delante (eje y).
      const dy = t >= NTH / 2 ? mov : 0, desp = dy * sn;
      for (let i = 0; i < NS; i++) {
        const s = -1 + i * DS;
        const pos = (s - desp + 1) / DS, i0 = Math.floor(pos), f = pos - i0;
        let p = i0 >= 0 && i0 < NS - 1 ? (1 - f) * base[t * NS + i0] + f * base[t * NS + i0 + 1] : 0;
        if (chkMetal.checked) {
          let pm = 0;
          for (const m of TORNILLOS) {
            const d = s - (m.x * c + (m.y + dy) * sn);
            if (Math.abs(d) < m.r) pm += 2 * Math.sqrt(m.r * m.r - d * d) * CM * MU_METAL;
          }
          // Endurecimiento del haz: el metal se «come» los fotones blandos y atenúa menos de lo esperado.
          p += pm * Math.max(0.45, 1 - 0.06 * pm);
        }
        // Ruido de Poisson (aprox. gaussiana) en el número de fotones que llegan al detector.
        const lam = N0 * Math.exp(-p);
        const n = Math.max(0.5, lam + Math.sqrt(lam) * gauss());
        let pmed = Math.log(N0 / n);
        if (chkAnillo.checked && i === IANILLO) pmed *= 1.08;   // detector con la ganancia mal calibrada
        medida[t * NS + i] = pmed;
      }
    }
    return { medida, usados };
  }

  function reconstruir({ medida, usados }) {
    const img = new Float32Array(NR * NR), q = new Float32Array(NS), qs = new Float32Array(NS);
    const dcm = DS * CM;
    for (const t of usados) {
      for (let i = 0; i < NS; i++) {
        let acc = 0;
        for (let j = 0; j < NS; j++) acc += medida[t * NS + j] * rampa[i - j + NS - 1];
        q[i] = acc / dcm;
      }
      for (let i = 0; i < NS; i++) qs[i] = 0.25 * q[Math.max(0, i - 1)] + 0.5 * q[i] + 0.25 * q[Math.min(NS - 1, i + 1)];
      const th = t / NTH * Math.PI, c = Math.cos(th), sn = Math.sin(th);
      for (let y = 0; y < NR; y++) {
        const yy = (y + 0.5) / NR * 2 - 1;
        for (let x = 0; x < NR; x++) {
          const xx = (x + 0.5) / NR * 2 - 1;
          const pos = (xx * c + yy * sn + 1) / DS, i0 = Math.floor(pos), f = pos - i0;
          if (i0 >= 0 && i0 < NS - 1) img[y * NR + x] += (1 - f) * qs[i0] + f * qs[i0 + 1];
        }
      }
    }
    const k = Math.PI / usados.length;
    for (let y = 0; y < NR; y++)
      for (let x = 0; x < NR; x++) {
        const xx = (x + 0.5) / NR * 2 - 1, yy = (y + 0.5) / NR * 2 - 1, i = y * NR + x;
        img[i] = xx * xx + yy * yy > 0.98 ? -1000 : 1000 * (img[i] * k / MU_AGUA - 1);   // a HU
      }
    return img;
  }

  let ultima = null;
  function calcular() {
    const m = medir();
    ultima = reconstruir(m);
    pintarVentana();
    let maxP = 0;
    for (const v of m.medida) maxP = Math.max(maxP, v);
    pintarGrises(cvSino, Float32Array.from(m.medida, v => v / maxP), NS, NTH);
    explicar();
  }
  function pintarVentana() {
    if (ultima) pintarGrises(cvImg, aplicarVentana(ultima, ventana.wl, ventana.ww), NR, NR);
  }
  let pendiente = false;
  function programar() {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; calcular(); });
  }

  const TEXTOS = {
    anillo: ['Anillo: un detector descalibrado',
      'Un detector mide un 8 % de más en <b>todos</b> los ángulos. En el sinograma es una línea vertical; al retroproyectar, todos los puntos a esa distancia del centro heredan el mismo error → un <b>anillo</b>. Se evita calibrando el escáner (con aire y con un fantoma de agua).'],
    metal: ['Metal: rayas',
      'Los tornillos de acero absorben casi todos los fotones (<b>falta de fotones</b>, muchísimo ruido) y además <b>endurecen el haz</b> (se quedan con los fotones de baja energía). Las proyecciones que cruzan el metal no cuadran con las demás y la retroproyección reparte el error en forma de <b>rayas</b>. En RM el metal da otro artefacto distinto: el de <b>susceptibilidad magnética</b> (diapositiva 4.4).'],
    mov: ['Movimiento del paciente',
      'La primera mitad de las proyecciones ve al paciente en un sitio y la segunda, desplazado. No existe ninguna imagen que cuadre con todas → <b>bordes dobles y rayas</b>. Por eso se pide aguantar la respiración (y por eso los TC rápidos son mejores).'],
    proy: ['Pocas proyecciones (submuestreo angular)',
      'Cada proyección se retroproyecta como una franja; con pocas, las franjas no se cancelan entre sí → <b>rayas radiales</b>. Es <b>aliasing</b>: muestrear por debajo de lo que pide el criterio de Nyquist, pero en ángulo.'],
    dosis: ['Poca dosis: ruido',
      'Menos fotones → más ruido de Poisson: σ ∝ 1/√N. Para dividir el ruido entre 2 hace falta 4 veces más dosis. Es el compromiso dosis-calidad de la SNR (diapositiva 4.1 bis).'],
  };
  function activos() {
    const a = [];
    if (chkAnillo.checked) a.push('anillo');
    if (chkMetal.checked) a.push('metal');
    if (+slMov.value > 0) a.push('mov');
    if (PROY[+slProy.value] < 90) a.push('proy');
    if (DOSIS[+slDosis.value] < 3e4) a.push('dosis');
    return a;
  }
  let misterio = false;
  function explicar() {
    const div = document.getElementById('art-explica');
    if (misterio) {
      div.innerHTML = '<b>¿Qué artefacto es?</b> Mira la imagen y el sinograma y responde en el chat. Luego pulsa «Revelar».';
      return;
    }
    const a = activos();
    div.innerHTML = a.length
      ? a.map(k => `<p><b>${TEXTOS[k][0]}.</b> ${TEXTOS[k][1]}</p>`).join('')
      : 'Escáner en perfecto estado. Rómpelo con los controles (o pulsa «Artefacto misterioso»).';
  }

  function normal() {
    chkAnillo.checked = false; chkMetal.checked = false;
    slMov.value = 0; slProy.value = PROY.length - 1; slDosis.value = 5;
    [slMov, slProy, slDosis].forEach(s => s.dispatchEvent(new Event('input')));
  }
  document.getElementById('art-normal').addEventListener('click', () => { misterio = false; panel.classList.remove('oculto'); normal(); });
  document.getElementById('art-misterio').addEventListener('click', () => {
    normal();
    const op = ['anillo', 'metal', 'mov', 'proy', 'dosis'][Math.floor(Math.random() * 5)];
    if (op === 'anillo') chkAnillo.checked = true;
    if (op === 'metal') chkMetal.checked = true;
    if (op === 'mov') slMov.value = 8;
    if (op === 'proy') slProy.value = 5;
    if (op === 'dosis') slDosis.value = 1;
    [slMov, slProy, slDosis].forEach(s => s.dispatchEvent(new Event('input')));
    misterio = true;
    panel.classList.add('oculto');
    programar();
  });
  document.getElementById('art-revelar').addEventListener('click', () => { misterio = false; panel.classList.remove('oculto'); explicar(); });
  [chkAnillo, chkMetal].forEach(c => c.addEventListener('change', programar));
  document.querySelectorAll('[data-art-wl]').forEach(b => b.addEventListener('click', () => {
    ventana = { wl: +b.dataset.artWl, ww: +b.dataset.artWw };
    pintarVentana();
  }));

  let calculado = false;
  window.addEventListener('pestana', ev => {
    if (ev.detail === 'artefactos' && !calculado) { calculado = true; calcular(); }
  });
})();
