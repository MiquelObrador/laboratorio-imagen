// Tema 3 — utilidades compartidas: imágenes sintéticas T1/T2/PET, movimiento rígido
// con interpolación bilineal, métricas de registro (ECM e información mutua) y paletas.
// Usa crearFantomaRM y TEJIDO de ../tema02/fantoma.js.

// Valor bilineal en (x, y) (columna, fila, en píxeles). Fuera de la imagen vale 0.
function muestrearBilineal(v, n, x, y) {
  if (x < 0 || y < 0 || x > n - 1 || y > n - 1) return 0;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, n - 1), y1 = Math.min(y0 + 1, n - 1);
  const fx = x - x0, fy = y - y0;
  return (1 - fy) * ((1 - fx) * v[y0 * n + x0] + fx * v[y0 * n + x1]) +
         fy * ((1 - fx) * v[y1 * n + x0] + fx * v[y1 * n + x1]);
}

// Movimiento rígido alrededor del centro de la imagen: girar θ grados (positivo =
// antihorario, con el eje y hacia arriba) y desplazar (tx, ty) píxeles (ty > 0 = arriba).
// Se recorre la imagen de SALIDA y se aplica la transformación inversa (temario, ec. 2).
function moverImagen(v, n, th, tx, ty) {
  const out = new Float32Array(n * n), c = (n - 1) / 2;
  const a = th * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const X = i - c - tx, Y = (c - j) - ty;      // destino, relativo al centro, y hacia arriba
      const xs = co * X + si * Y, ys = -si * X + co * Y;   // R(−θ)·(d − t)
      out[j * n + i] = muestrearBilineal(v, n, xs + c, c - ys);
    }
  return out;
}

const cerca = (a, b) => Math.abs(a - b) < 1e-3;

// La misma anatomía con contraste T2: el LCR pasa de oscuro a brillante y la sustancia
// blanca queda más oscura que la gris (la relación de grises es otra, pero predecible).
function aT2(v) {
  const out = new Float32Array(v.length);
  for (let k = 0; k < v.length; k++) {
    const t = v[k];
    out[k] = cerca(t, TEJIDO.blanca) ? 0.35 : cerca(t, TEJIDO.piel) ? 0.55 : cerca(t, TEJIDO.gris) ? 0.6
           : cerca(t, TEJIDO.lcr) ? 0.95 : cerca(t, TEJIDO.hueso) ? 0.05 : 0;
  }
  return out;
}

// Error cuadrático medio (temario, ec. 7).
function ecm(a, b) {
  let s = 0;
  for (let k = 0; k < a.length; k++) { const d = a[k] - b[k]; s += d * d; }
  return s / a.length;
}

// Histograma conjunto con B × B casillas (fila = referencia, columna = móvil).
function histConjunto(a, b, B) {
  const h = new Float64Array(B * B);
  const q = x => Math.min(B - 1, Math.max(0, Math.floor(x * B)));
  for (let k = 0; k < a.length; k++) h[q(a[k]) * B + q(b[k])]++;
  return h;
}

// Información mutua IM = H(A) + H(B) − H(A,B), en bits (temario, ec. 8-11).
function infoMutua(a, b, B = 24) {
  const h = histConjunto(a, b, B), N = a.length;
  const pa = new Float64Array(B), pb = new Float64Array(B);
  let hab = 0;
  for (let i = 0; i < B; i++)
    for (let j = 0; j < B; j++) {
      const p = h[i * B + j] / N;
      pa[i] += p; pb[j] += p;
      if (p > 0) hab -= p * Math.log2(p);
    }
  let ha = 0, hb = 0;
  for (let i = 0; i < B; i++) {
    if (pa[i] > 0) ha -= pa[i] * Math.log2(pa[i]);
    if (pb[i] > 0) hb -= pb[i] * Math.log2(pb[i]);
  }
  return ha + hb - hab;
}

// Paleta «arcoíris» (tipo jet): azul → cian → amarillo → rojo.
function colorJet(t) {
  const c = v => Math.max(0, Math.min(255, Math.round(v * 255)));
  return [c(1.5 - Math.abs(4 * t - 3)), c(1.5 - Math.abs(4 * t - 2)), c(1.5 - Math.abs(4 * t - 1))];
}
function colorGris(t) { const g = Math.round(255 * t); return [g, g, g]; }

// Fusión: base en grises y capa en color con transparencia α, solo donde la capa supera el umbral.
// I_fus = (1 − α)·I_gris + α·I_color  (lo mismo que cv2.addWeighted).
function pintarFusion(canvas, base, capa, n, mapa, alfa, umbral) {
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(n, n);
  for (let k = 0; k < n * n; k++) {
    const g = 255 * Math.max(0, Math.min(1, base[k]));
    let r = g, gg = g, b = g;
    if (capa[k] >= umbral) {
      const [cr, cg, cb] = mapa(Math.max(0, Math.min(1, capa[k])));
      r = (1 - alfa) * g + alfa * cr; gg = (1 - alfa) * g + alfa * cg; b = (1 - alfa) * g + alfa * cb;
    }
    img.data[4 * k] = r; img.data[4 * k + 1] = gg; img.data[4 * k + 2] = b; img.data[4 * k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// Número con coma decimal y signo menos tipográfico; los enteros sin decimales.
function num(x, d = 2) {
  if (Math.abs(x) < 1e-9) x = 0;
  const r = Math.round(x * 10 ** d) / 10 ** d;
  return (Number.isInteger(r) ? String(r) : String(r).replace('.', ',')).replace('-', '−');
}

// Matriz 3 × 3 (lista de filas) como tabla HTML con corchetes.
function matrizHTML(M, nombre) {
  const filas = M.map(f => '<tr>' + f.map(x => `<td style="padding:1px 7px;text-align:right">${num(x)}</td>`).join('') + '</tr>').join('');
  return `<span style="display:inline-flex;align-items:center;gap:6px;margin:4px 10px 4px 0;vertical-align:middle">${nombre ? `<span>${nombre} =</span>` : ''}` +
    `<table style="border-left:2px solid currentColor;border-right:2px solid currentColor;border-radius:4px;font-variant-numeric:tabular-nums;border-collapse:separate">${filas}</table></span>`;
}

function mult(A, B) {
  return A.map((f, i) => B[0].map((_, j) => f.reduce((s, _, k) => s + A[i][k] * B[k][j], 0)));
}
function aplicar(M, p) {
  return [M[0][0] * p[0] + M[0][1] * p[1] + M[0][2], M[1][0] * p[0] + M[1][1] * p[1] + M[1][2]];
}
const ID3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const matT = (tx, ty) => [[1, 0, tx], [0, 1, ty], [0, 0, 1]];
const matS = (sx, sy) => [[sx, 0, 0], [0, sy, 0], [0, 0, 1]];
const matC = (shx, shy) => [[1, shx, 0], [shy, 1, 0], [0, 0, 1]];
function matR(gradosAntihorario) {
  const a = gradosAntihorario * Math.PI / 180, r = x => Math.round(x * 1e9) / 1e9;
  const c = r(Math.cos(a)), s = r(Math.sin(a));
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}
