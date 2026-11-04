// Tema 2 — RM sintética (corte axial T1) que comparten las pestañas.
// Valores en [0,1] por tejidos: fondo 0, cuero cabelludo 0,8, hueso 0,08, LCR 0,2,
// sustancia gris 0,5, sustancia blanca 0,78, ventrículos 0,2.

const TEJIDO = { fondo: 0, piel: 0.8, hueso: 0.08, lcr: 0.2, gris: 0.5, blanca: 0.78 };

// n × n píxeles. Devuelve { v, n, lesion: {x, y}, roi: {x0, y0, x1, y1} } (coordenadas en píxeles).
function crearFantomaRM(n, conLesion) {
  const v = new Float32Array(n * n);
  const VENTRICULOS = [{ cx: -0.12, cy: -0.02, a: 0.07, b: 0.27, giro: 0.18 }, { cx: 0.12, cy: -0.02, a: 0.07, b: 0.27, giro: -0.18 }];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const u = (2 * (i + 0.5)) / n - 1, w = (2 * (j + 0.5)) / n - 1;
      const rho = Math.hypot(u / 0.8, w / 0.95), th = Math.atan2(w, u);
      let t;
      if (rho > 1) t = TEJIDO.fondo;
      else if (rho > 0.95) t = TEJIDO.piel;
      else if (rho > 0.89) t = TEJIDO.hueso;
      else if (rho > 0.86) t = TEJIDO.lcr;
      else {
        // Circunvoluciones: el borde gris-blanca ondula con el ángulo.
        const borde = 0.86 * (0.8 + 0.05 * Math.sin(9 * th) + 0.03 * Math.sin(17 * th + 1));
        t = rho > borde ? TEJIDO.gris : TEJIDO.blanca;
        if (Math.abs(u) < 0.012 && (w < -0.35 || w > 0.5)) t = TEJIDO.lcr;    // cisura interhemisférica
        for (const e of VENTRICULOS) {
          const c = Math.cos(e.giro), s = Math.sin(e.giro), du = u - e.cx, dw = w - e.cy;
          const p = (c * du + s * dw) / e.a, q = (-s * du + c * dw) / e.b;
          if (p * p + q * q <= 1) t = TEJIDO.lcr;
        }
      }
      v[j * n + i] = t;
    }
  const px = (u, w) => ({ x: Math.round(((u + 1) * n) / 2), y: Math.round(((w + 1) * n) / 2) });
  const lesion = px(-0.12, 0.02);
  if (conLesion)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) v[(lesion.y + dy) * n + lesion.x + dx] = 0.95;
  // Zona homogénea de sustancia blanca para medir σ.
  const a = px(0.27, 0.07), b = px(0.43, 0.23);
  return { v, n, lesion, roi: { x0: a.x, y0: a.y, x1: b.x, y1: b.y } };
}

// Pinta valores en [0,1] de n × n en un lienzo ampliado `escala` veces (sin suavizar).
function pintarAmpliado(canvas, valores, n, escala) {
  const tmp = document.createElement('canvas');
  pintarGrises(tmp, valores, n, n);
  canvas.width = canvas.height = n * escala;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, n * escala, n * escala);
  return ctx;
}

const coma = (x, d) => x.toFixed(d).replace('.', ',').replace('-', '−');
