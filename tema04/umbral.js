/* =====================================================================
   1. Umbral y Otsu: «gánale a Otsu», iluminación no uniforme y umbral adaptativo
   ===================================================================== */
(() => {
  const N = 160;
  const cImg = document.getElementById('um-img'), cMask = document.getElementById('um-mask');
  const cHist = document.getElementById('um-hist');
  const sT = document.getElementById('um-t'), chkLuz = document.getElementById('um-luz');
  const chkAdapt = document.getElementById('um-adapt'), sVent = document.getElementById('um-ventana');

  // --- Imágenes sintéticas (valores en [0,1]) ---
  function crearCelulas() {
    const rng = crearRng(7), gauss = crearGauss(rng);
    const v = new Float32Array(N * N).fill(0.30), centros = [];
    let intentos = 0;
    while (centros.length < 30 && intentos++ < 5000) {
      const c = { x: 10 + rng() * (N - 20), y: 10 + rng() * (N - 20), r: 4 + rng() * 4 };
      if (centros.every(d => Math.hypot(c.x - d.x, c.y - d.y) > c.r + d.r + 5)) centros.push(c);
    }
    for (const c of centros)
      for (let y = Math.floor(c.y - c.r); y <= c.y + c.r; y++)
        for (let x = Math.floor(c.x - c.r); x <= c.x + c.r; x++)
          if (Math.hypot(x - c.x, y - c.y) <= c.r) v[y * N + x] = 0.55;
    for (let i = 0; i < N * N; i++) v[i] += 0.055 * gauss();
    return { v, celulas: centros.length };
  }
  function crearRM() {
    const f = crearFantomaRM(N, false), gauss = crearGauss(crearRng(11));
    const v = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) v[i] = f.v[i] + 0.035 * gauss();
    return { v, celulas: 0 };
  }
  const BASE = { celulas: crearCelulas(), rm: crearRM() };

  let g = new Uint8Array(N * N), hist = new Float64Array(256), sb2 = new Float64Array(256), tOtsu = 0;

  function imagenActual() {
    const tipo = document.querySelector('input[name="um-imagen"]:checked').value;
    const base = BASE[tipo];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const luz = chkLuz.checked ? 0.35 + (1.0 * x) / N : 1;
        g[y * N + x] = Math.max(0, Math.min(255, Math.round(255 * base.v[y * N + x] * luz)));
      }
    hist.fill(0);
    for (let i = 0; i < N * N; i++) hist[g[i]]++;
    // Otsu: sigma_b^2(t) = w1 w2 (mu1 - mu2)^2, clase 1 = 0..t, clase 2 = t+1..255
    let w1 = 0, s1 = 0, sT_ = 0;
    for (let i = 0; i < 256; i++) sT_ += i * hist[i];
    const tot = N * N;
    sb2.fill(0);
    for (let t = 0; t < 255; t++) {
      w1 += hist[t]; s1 += t * hist[t];
      const w2 = tot - w1;
      if (w1 === 0 || w2 === 0) continue;
      const mu1 = s1 / w1, mu2 = (sT_ - s1) / w2;
      sb2[t] = (w1 / tot) * (w2 / tot) * (mu1 - mu2) ** 2;
    }
    tOtsu = 0;
    for (let t = 1; t < 256; t++) if (sb2[t] > sb2[tOtsu]) tOtsu = t;
    return { tipo, celulas: base.celulas };
  }

  // Máscara: global (g > t) o adaptativa (g > media del vecindario + 20), con imagen integral.
  function mascara(t) {
    const m = new Uint8Array(N * N);
    if (!chkAdapt.checked) {
      for (let i = 0; i < N * N; i++) m[i] = g[i] > t ? 1 : 0;
      return m;
    }
    const r = (+sVent.value - 1) / 2, S = new Float64Array((N + 1) * (N + 1));
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        S[(y + 1) * (N + 1) + x + 1] = g[y * N + x] + S[y * (N + 1) + x + 1] + S[(y + 1) * (N + 1) + x] - S[y * (N + 1) + x];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(N, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(N, y + r + 1);
        const suma = S[y1 * (N + 1) + x1] - S[y0 * (N + 1) + x1] - S[y1 * (N + 1) + x0] + S[y0 * (N + 1) + x0];
        m[y * N + x] = g[y * N + x] > suma / ((x1 - x0) * (y1 - y0)) + 20 ? 1 : 0;
      }
    return m;
  }

  // Objetos de la máscara (4 vecinos), sin contar el fondo ni las motas de menos de 10 píxeles.
  function contarObjetos(m) {
    const visto = new Uint8Array(N * N), pila = [];
    let n = 0;
    for (let i = 0; i < N * N; i++) {
      if (!m[i] || visto[i]) continue;
      let tam = 0;
      pila.push(i); visto[i] = 1;
      while (pila.length) {
        const p = pila.pop(), x = p % N, y = (p - x) / N;
        tam++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy, q = yy * N + xx;
          if (xx >= 0 && xx < N && yy >= 0 && yy < N && m[q] && !visto[q]) { visto[q] = 1; pila.push(q); }
        }
      }
      if (tam >= 10) n++;
    }
    return n;
  }

  function pintarHist(t) {
    const ctx = cHist.getContext('2d'), W = cHist.width, H = cHist.height, pad = 22;
    const css = getComputedStyle(document.documentElement);
    ctx.clearRect(0, 0, W, H);
    let ymax = 0;
    for (let i = 3; i < 256; i++) ymax = Math.max(ymax, hist[i]);
    ymax *= 1.15;
    const X = i => pad + ((W - 2 * pad) * i) / 255;
    ctx.fillStyle = css.getPropertyValue('--muted');
    for (let i = 0; i < 256; i++) {
      const h = Math.min(1, hist[i] / ymax) * (H - 2 * pad);
      ctx.fillRect(X(i) - 1, H - pad - h, Math.max(1.5, (W - 2 * pad) / 256), h);
    }
    // sigma_b^2
    const smax = Math.max(...sb2);
    ctx.strokeStyle = '#d62f2f'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const y = H - pad - (sb2[i] / smax) * (H - 2 * pad);
      i ? ctx.lineTo(X(i), y) : ctx.moveTo(X(i), y);
    }
    ctx.stroke();
    ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(X(tOtsu), pad); ctx.lineTo(X(tOtsu), H - pad); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#d62f2f'; ctx.font = '12px system-ui';
    ctx.fillText('Otsu', X(tOtsu) + 4, pad + 10);
    if (!chkAdapt.checked) {
      ctx.strokeStyle = css.getPropertyValue('--accent-2'); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(X(t), 6); ctx.lineTo(X(t), H - pad); ctx.stroke();
      ctx.fillStyle = css.getPropertyValue('--accent-2'); ctx.fillText('t = ' + t, X(t) + 4, 16);
    }
    ctx.fillStyle = css.getPropertyValue('--muted');
    ctx.fillText('0', X(0) - 3, H - 6); ctx.fillText('255', X(255) - 18, H - 6);
    ctx.fillText('σb²(t)', W - pad - 40, pad + 24);
  }

  function dibujar() {
    const { tipo, celulas } = imagenActual();
    const t = +sT.value;
    const vals = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) vals[i] = g[i] / 255;
    pintarGrises(cImg, vals, N, N);
    const m = mascara(t);
    const mv = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) mv[i] = m[i];
    pintarGrises(cMask, mv, N, N);
    pintarHist(t);
    document.getElementById('um-c-ventana').style.display = chkAdapt.checked ? '' : 'none';
    sT.disabled = chkAdapt.checked;
    let txt;
    if (chkAdapt.checked) txt = `Umbral adaptativo: cada píxel se compara con la media de su vecindario de ${sVent.value} × ${sVent.value}.`;
    else {
      const pct = Math.round((100 * sb2[t]) / sb2[tOtsu]);
      txt = `Tu umbral: σ<sub>b</sub><sup>2</sup> = <b>${pct} %</b> del máximo. Otsu: t = ${tOtsu}.` +
        (pct >= 100 ? ' <span class="ok">¡Empate con Otsu!</span>' : pct >= 97 ? ' Casi.' : '');
    }
    if (tipo === 'celulas') {
      const n = contarObjetos(m);
      txt += `<br>Objetos en la máscara: <b>${n}</b> (hay ${celulas} células)` +
        (n === celulas ? ' <span class="ok">✔</span>' : '');
    }
    document.getElementById('um-info').innerHTML = txt;
  }

  enlazarSlider('um-t', dibujar);
  enlazarSlider('um-ventana', dibujar, v => `${v} × ${v}`);
  [chkLuz, chkAdapt].forEach(c => c.addEventListener('change', dibujar));
  document.querySelectorAll('input[name="um-imagen"]').forEach(r => r.addEventListener('change', dibujar));
  document.getElementById('um-otsu').addEventListener('click', () => {
    chkAdapt.checked = false; sT.value = tOtsu; sT.dispatchEvent(new Event('input'));
  });
  // Arrastrar sobre el histograma
  let arrastrando = false;
  const mover = ev => {
    if (chkAdapt.checked) return;
    const r = cHist.getBoundingClientRect(), p = ev.touches ? ev.touches[0] : ev;
    const x = ((p.clientX - r.left) / r.width) * cHist.width;
    sT.value = Math.max(0, Math.min(255, Math.round(((x - 22) / (cHist.width - 44)) * 255)));
    sT.dispatchEvent(new Event('input'));
  };
  cHist.addEventListener('mousedown', ev => { arrastrando = true; mover(ev); });
  window.addEventListener('mousemove', ev => { if (arrastrando) mover(ev); });
  window.addEventListener('mouseup', () => { arrastrando = false; });
  cHist.addEventListener('touchstart', ev => { mover(ev); ev.preventDefault(); }, { passive: false });
  cHist.addEventListener('touchmove', ev => { mover(ev); ev.preventDefault(); }, { passive: false });
  dibujar();
})();
