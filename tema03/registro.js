/* =====================================================================
   2. Alinea tú: registro rígido (giro + traslación) con ECM o información mutua
   ===================================================================== */
(() => {
  const n = 128, B = 24;
  const t1 = crearFantomaRM(n, false).v, t2 = aT2(t1);
  const sTh = enlazarSlider('rg-th', dibujar, v => num(v, 1) + '°');
  const sTx = enlazarSlider('rg-tx', dibujar, v => num(v, 1));
  const sTy = enlazarSlider('rg-ty', dibujar, v => num(v, 1));
  const curva = document.getElementById('rg-curva');
  let off = [0, 0, 0], historia = [], optimizando = false;

  const modalidad = () => document.querySelector('input[name="rg-mod"]:checked').value;
  const metrica = () => document.querySelector('input[name="rg-met"]:checked').value;
  const movil = () => (modalidad() === 't1' ? t1 : t2);
  // Pose de la imagen móvil = desalineación oculta + lo que mueve el alumno. Alineada cuando es (0, 0, 0).
  const pose = q => [off[0] + q[0], off[1] + q[1], off[2] + q[2]];
  const actual = () => [+sTh.value, +sTx.value, +sTy.value];
  const imagen = q => moverImagen(movil(), n, ...pose(q));

  function nuevoCaso() {
    const r = (a, b) => (Math.random() < 0.5 ? -1 : 1) * (a + Math.random() * (b - a));
    off = [Math.round(r(8, 18)), Math.round(r(5, 12)), Math.round(r(5, 12))];
    sTh.value = sTx.value = sTy.value = 0;
    [sTh, sTx, sTy].forEach(s => s.dispatchEvent(new Event('input')));
    historia = [];
    dibujar();
  }

  function dibujar() {
    const m = imagen(actual());
    // Verde = referencia, magenta = móvil: donde coinciden se ve gris; donde no, franjas de color.
    const cv = document.getElementById('rg-fusion'); cv.width = cv.height = n;
    const cx = cv.getContext('2d'), img = cx.createImageData(n, n);
    for (let k = 0; k < n * n; k++) {
      img.data[4 * k] = img.data[4 * k + 2] = 255 * m[k];
      img.data[4 * k + 1] = 255 * t1[k];
      img.data[4 * k + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    // Histograma conjunto en escala logarítmica.
    const h = histConjunto(t1, m, B), lg = new Float32Array(B * B);
    let mx = 0;
    for (let k = 0; k < B * B; k++) { lg[k] = Math.log(1 + h[k]); mx = Math.max(mx, lg[k]); }
    for (let k = 0; k < B * B; k++) lg[k] /= mx;
    pintarColor(document.getElementById('rg-hist'), lg, B, B, colorHot);
    const e = ecm(t1, m), im = infoMutua(t1, m, B);
    document.getElementById('rg-info').innerHTML =
      `ECM = <b>${num(e * 1000, 2)}</b> ·10⁻³ (mejor cuanto más bajo) &nbsp;·&nbsp; IM = <b>${num(im, 3)}</b> bits (mejor cuanto más alta)`;
    pintarCurva();
  }

  function pintarCurva() {
    const c = curva.getContext('2d'), W = curva.width, H = curva.height;
    const oscuro = matchMedia('(prefers-color-scheme: dark)').matches;
    c.fillStyle = oscuro ? '#1d2126' : '#ffffff'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#8a949c'; c.font = '12px system-ui, sans-serif';
    if (historia.length < 2) { c.fillText('Pulsa «Optimizar» para ver cómo mejora la métrica en cada iteración.', 10, H / 2); return; }
    const lo = Math.min(...historia), hi = Math.max(...historia), rango = hi - lo || 1;
    c.strokeStyle = '#eb811b'; c.lineWidth = 2; c.beginPath();
    historia.forEach((v, k) => {
      const x = 30 + (W - 40) * k / (historia.length - 1), y = H - 20 - (H - 35) * (v - lo) / rango;
      k ? c.lineTo(x, y) : c.moveTo(x, y);
    });
    c.stroke();
    c.fillText(metrica() === 'ecm' ? 'ECM' : 'IM', 4, 14);
    c.fillText('iteración ' + (historia.length - 1), W - 90, H - 4);
  }

  // Optimizador sencillo (búsqueda por coordenadas): prueba ±paso en cada parámetro,
  // se queda con la mejora y, si no hay ninguna, reduce el paso. Una iteración por fotograma.
  function optimizar() {
    if (optimizando) return;
    optimizando = true;
    const met = metrica();
    const coste = q => { const m = imagen(q); return met === 'ecm' ? ecm(t1, m) : -infoMutua(t1, m, B); };
    let p = actual(), paso = [2, 2, 2], mejor = coste(p), it = 0;
    historia = [met === 'ecm' ? mejor : -mejor];
    document.getElementById('rg-opt').disabled = true;
    const lim = [30, 20, 20];
    function iteracion() {
      if (!optimizando) return;
      let elegido = null;
      for (let d = 0; d < 3; d++)
        for (const s of [1, -1]) {
          const q = p.slice(); q[d] = Math.max(-lim[d], Math.min(lim[d], q[d] + s * paso[d]));
          const v = coste(q);
          if (v < mejor - 1e-12) { mejor = v; elegido = q; }
        }
      if (elegido) p = elegido; else paso = paso.map(x => x / 2);
      it++;
      historia.push(met === 'ecm' ? mejor : -mejor);
      sTh.value = p[0]; sTx.value = p[1]; sTy.value = p[2];
      [sTh, sTx, sTy].forEach(s => s.dispatchEvent(new Event('input')));
      if (it < 200 && Math.max(...paso) > 0.2) requestAnimationFrame(iteracion);
      else { optimizando = false; document.getElementById('rg-opt').disabled = false; }
    }
    requestAnimationFrame(iteracion);
  }

  function comprobar() {
    const [a, x, y] = pose(actual()), d = Math.hypot(x, y);
    const msg = Math.abs(a) < 1 && d < 1
      ? '<span class="ok">¡Alineada!</span> Error menor de 1° y de 1 píxel.'
      : `<span class="bad">Todavía no.</span> Faltan ${num(-a, 1)}° de giro y (${num(-x, 1)}, ${num(-y, 1)}) píxeles.`;
    document.getElementById('rg-info').innerHTML += '<br>' + msg;
  }

  document.querySelectorAll('input[name="rg-mod"]').forEach(r => r.addEventListener('change', () => { historia = []; dibujar(); }));
  document.querySelectorAll('input[name="rg-met"]').forEach(r => r.addEventListener('change', () => { historia = []; pintarCurva(); }));
  document.getElementById('rg-opt').addEventListener('click', optimizar);
  document.getElementById('rg-comprobar').addEventListener('click', comprobar);
  document.getElementById('rg-nuevo').addEventListener('click', () => { optimizando = false; document.getElementById('rg-opt').disabled = false; nuevoCaso(); });
  window.addEventListener('pestana', ev => { if (ev.detail !== 'registro') optimizando = false; else pintarCurva(); });
  nuevoCaso();
})();
