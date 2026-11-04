/* =====================================================================
   4. «Zoom y mejora»: vecino más próximo frente a bilineal
   ===================================================================== */
(() => {
  const W = 480, H = 120;
  const LETRAS = 'BCDFGHJKLMNPRSTVWXYZ';
  const ANCHOS = [12, 16, 20, 24, 32, 40, 48, 60, 80, 96];   // divisores de 480 (bloques enteros)
  const px = enlazarSlider('zm-px', dibujar, v => `${ANCHOS[v]} × ${ANCHOS[v] / 4}`);
  const real = document.getElementById('zm-real');
  let original;

  function nuevaMatricula() {
    const al = n => Array.from({ length: n }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');
    const num = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.fillStyle = '#ebebeb'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#141414'; c.font = 'bold 82px system-ui, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(`${num} ${al(3)}`, W / 2, H / 2 + 4);
    const d = c.getImageData(0, 0, W, H).data;
    original = new Float32Array(W * H);
    for (let k = 0; k < W * H; k++) original[k] = d[4 * k] / 255;
    pintarGrises(real, original, W, H);
    real.classList.add('oculto');
    dibujar();
  }

  function dibujar() {
    if (!original) return;
    const w = ANCHOS[+px.value], h = w / 4, b = W / w;
    // Lo que graba la cámara: la media de cada bloque de b × b píxeles.
    const baja = new Float32Array(w * h);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) baja[Math.floor(y / b) * w + Math.floor(x / b)] += original[y * W + x] / (b * b);
    const vec = new Float32Array(W * H), bil = new Float32Array(W * H);
    const at = (x, y) => baja[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        vec[y * W + x] = at(Math.floor(x / b), Math.floor(y / b));
        const u = (x + 0.5) / b - 0.5, v = (y + 0.5) / b - 0.5, x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
        bil[y * W + x] = (1 - fy) * ((1 - fx) * at(x0, y0) + fx * at(x0 + 1, y0)) + fy * ((1 - fx) * at(x0, y0 + 1) + fx * at(x0 + 1, y0 + 1));
      }
    pintarGrises(document.getElementById('zm-vecino'), vec, W, H);
    pintarGrises(document.getElementById('zm-bilineal'), bil, W, H);
    document.getElementById('zm-info').innerHTML = `La cámara tiene ${w} × ${h} = ${w * h} píxeles: cada carácter ocupa unos ${coma(w / 9, 1)} píxeles de ancho. Las dos ampliaciones usan <b>exactamente esos ${w * h} números</b>.`;
  }
  document.getElementById('zm-ver').addEventListener('click', () => real.classList.toggle('oculto'));
  document.getElementById('zm-otra').addEventListener('click', nuevaMatricula);
  nuevaMatricula();
})();
