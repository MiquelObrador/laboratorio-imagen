/* =====================================================================
   3. Ruido y filtros: limpiar sin borrar la lesión
   ===================================================================== */
(() => {
  const N = 128, ESC = 3;
  const fan = crearFantomaRM(N, true), { lesion, roi } = fan;
  // Textura suave del tejido (σ = 0,01), para que σ no sea exactamente 0 tras filtrar.
  const textura = crearGauss(crearRng(11));
  const limpia = fan.v.map(t => (t === 0 ? 0 : Math.min(1, t + 0.01 * textura())));
  const FONDO_LES = TEJIDO.lcr, VALOR_LES = 0.95;
  const selTipo = document.getElementById('rf-tipo'), selFil = document.getElementById('rf-filtro');
  const nivel = enlazarSlider('rf-nivel', nuevoRuido, v => `${Math.round(v * 100)} %`);
  const tam = enlazarSlider('rf-n', filtrar, v => `${v} × ${v}`);
  const iter = enlazarSlider('rf-it', filtrar, v => String(v));
  const kdif = enlazarSlider('rf-k', filtrar, v => coma(v, 2));
  let ruidosa;

  // --- Ruido (con semilla fija: cambiar de filtro no cambia el ruido) ---
  function nuevoRuido() {
    const rng = crearRng(2026), gauss = crearGauss(rng), a = +nivel.value, t = selTipo.value;
    ruidosa = new Float32Array(N * N);
    for (let k = 0; k < N * N; k++) {
      const x = limpia[k];
      let y;
      if (t === 'sp') { const u = rng(), d = 0.01 + 0.19 * a; y = u < d / 2 ? 0 : u > 1 - d / 2 ? 1 : x; }
      else if (t === 'gauss') y = x + (0.01 + 0.19 * a) * gauss();
      else if (t === 'poisson') { const fot = 600 * (1 - a) ** 2 + 6; y = poisson(rng, gauss, x * fot) / fot; }
      else { const L = Math.max(1, Math.round(1 + 30 * (1 - a) ** 2)); let s = 0; for (let q = 0; q < L; q++) s -= Math.log(1 - rng()); y = x * s / L; }
      ruidosa[k] = Math.min(1, Math.max(0, y));
    }
    filtrar();
  }
  function poisson(rng, gauss, lam) {
    if (lam > 40) return Math.max(0, Math.round(lam + Math.sqrt(lam) * gauss()));
    const L = Math.exp(-lam); let k = 0, p = 1;
    do { k++; p *= rng(); } while (p > L);
    return k - 1;
  }

  // --- Filtros (borde: se repite el píxel más cercano, como 'replicate' en Octave) ---
  const at = (I, x, y) => I[Math.min(N - 1, Math.max(0, y)) * N + Math.min(N - 1, Math.max(0, x))];
  function convolucion(I, pesos, n) {
    const r = (n - 1) / 2, S = pesos.reduce((a, b) => a + b, 0), O = new Float32Array(N * N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        let s = 0, q = 0;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) s += pesos[q++] * at(I, x + dx, y + dy);
        O[y * N + x] = s / S;
      }
    return O;
  }
  function mediana(I, n) {
    const r = (n - 1) / 2, O = new Float32Array(N * N), v = new Float32Array(n * n);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        let q = 0;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) v[q++] = at(I, x + dx, y + dy);
        v.sort(); O[y * N + x] = v[(n * n - 1) / 2];
      }
    return O;
  }
  // Perona-Malik (ecuaciones 13-15 del temario): λ = 0,2 ≤ 1/4, g(∇) = exp(−(∇/K)²).
  function difusion(I, its, K) {
    let A = Float32Array.from(I);
    const g = d => Math.exp(-((d / K) ** 2));
    for (let t = 0; t < its; t++) {
      const B = new Float32Array(N * N);
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const c = A[y * N + x];
          const dN = at(A, x, y - 1) - c, dS = at(A, x, y + 1) - c, dE = at(A, x + 1, y) - c, dW = at(A, x - 1, y) - c;
          B[y * N + x] = c + 0.2 * (g(dN) * dN + g(dS) * dS + g(dE) * dE + g(dW) * dW);
        }
      A = B;
    }
    return A;
  }

  function sigmaROI(I) {
    let s = 0, s2 = 0, n = 0;
    for (let y = roi.y0; y < roi.y1; y++) for (let x = roi.x0; x < roi.x1; x++) { const v = I[y * N + x]; s += v; s2 += v * v; n++; }
    const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m) * n / (n - 1));
  }
  const contrasteLes = I => (I[lesion.y * N + lesion.x] - FONDO_LES) / (VALOR_LES - FONDO_LES);

  function marcar(ctx) {
    if (!document.getElementById('rf-marca').checked) return;
    ctx.strokeStyle = '#eb811b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc((lesion.x + 0.5) * ESC, (lesion.y + 0.5) * ESC, 7 * ESC, 0, 2 * Math.PI); ctx.stroke();
    ctx.strokeStyle = '#2f9fd8'; ctx.strokeRect(roi.x0 * ESC, roi.y0 * ESC, (roi.x1 - roi.x0) * ESC, (roi.y1 - roi.y0) * ESC);
  }

  function filtrar() {
    const tipo = selFil.value, n = +tam.value;
    document.getElementById('rf-c-n').hidden = tipo === 'no' || tipo === 'difusion';
    document.getElementById('rf-c-it').hidden = document.getElementById('rf-c-k').hidden = tipo !== 'difusion';
    let F;
    if (tipo === 'no') F = ruidosa;
    else if (tipo === 'media') F = convolucion(ruidosa, new Array(n * n).fill(1), n);
    else if (tipo === 'gauss') {
      const s = n / 4, r = (n - 1) / 2, p = [];
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) p.push(Math.exp(-(dx * dx + dy * dy) / (2 * s * s)));
      F = convolucion(ruidosa, p, n);
    } else if (tipo === 'mediana') F = mediana(ruidosa, n);
    else F = difusion(ruidosa, +iter.value, +kdif.value);

    marcar(pintarAmpliado(document.getElementById('rf-ruidosa'), ruidosa, N, ESC));
    marcar(pintarAmpliado(document.getElementById('rf-filtrada'), F, N, ESC));
    const s0 = sigmaROI(ruidosa), s1 = sigmaROI(F), c0 = contrasteLes(ruidosa), c1 = contrasteLes(F);
    document.getElementById('rf-tabla').innerHTML =
      `<tr><td>σ en la zona azul</td><td>${coma(s0, 3)}</td><td>${coma(s1, 3)} ${tipo === 'no' ? '' : `(÷ ${coma(s0 / s1, 1)})`}</td></tr>` +
      `<tr><td>Contraste de la lesión</td><td>${Math.round(c0 * 100)} %</td><td class="${c1 < 0.5 ? 'bad' : ''}">${Math.round(c1 * 100)} %</td></tr>`;
    const limpio = s1 < 0.04, viva = c1 >= 0.5;
    document.getElementById('rf-veredicto').innerHTML = !viva
      ? '<span class="bad">✘ La lesión ha desaparecido (o casi): el filtro se ha llevado la patología.</span>'
      : limpio
        ? '<span class="ok">✔ Imagen limpia y la lesión sigue ahí: buen compromiso.</span>'
        : 'La lesión se ve, pero aún queda bastante ruido.';
  }
  selTipo.addEventListener('change', nuevoRuido);
  selFil.addEventListener('change', filtrar);
  document.getElementById('rf-marca').addEventListener('change', filtrar);
  nuevoRuido();
})();
