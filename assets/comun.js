// Laboratorio web — utilidades comunes a todos los temas.

// Generador pseudoaleatorio con semilla (mulberry32): mismas imágenes en todos los navegadores.
function crearRng(semilla) {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ruido gaussiano N(0,1) por Box-Muller.
function crearGauss(rng) {
  return function () {
    let u = 0;
    while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  };
}

// Pinta una matriz de valores en [0,1] (Float32Array, ancho w) en escala de grises.
function pintarGrises(canvas, valores, w, h) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const g = Math.max(0, Math.min(255, Math.round(valores[i] * 255)));
    img.data[4 * i] = g;
    img.data[4 * i + 1] = g;
    img.data[4 * i + 2] = g;
    img.data[4 * i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return ctx;
}

// Mapa de color "hot" (negro → rojo → amarillo → blanco), típico de medicina nuclear.
function colorHot(t) {
  const c = v => Math.max(0, Math.min(255, Math.round(v * 255)));
  return [c(3 * t), c(3 * t - 1), c(3 * t - 2)];
}

// Pinta una matriz de valores en [0,1] con un mapa de color [r,g,b] = mapa(t).
function pintarColor(canvas, valores, w, h, mapa) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b] = mapa(Math.max(0, Math.min(1, valores[i])));
    img.data[4 * i] = r;
    img.data[4 * i + 1] = g;
    img.data[4 * i + 2] = b;
    img.data[4 * i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return ctx;
}

// Coordenadas de píxel a partir de un evento de ratón/táctil sobre un canvas escalado por CSS.
function pixelDeEvento(canvas, ev) {
  const r = canvas.getBoundingClientRect();
  const p = ev.touches ? ev.touches[0] : ev;
  return {
    x: Math.floor((p.clientX - r.left) / r.width * canvas.width),
    y: Math.floor((p.clientY - r.top) / r.height * canvas.height),
  };
}

// Media y desviación típica muestral de una lista de valores.
function mediaDesv(vals) {
  const n = vals.length;
  let s = 0;
  for (const v of vals) s += v;
  const mu = s / n;
  let q = 0;
  for (const v of vals) q += (v - mu) * (v - mu);
  return { mu, sigma: Math.sqrt(q / (n - 1)) };
}

// Pestañas: <nav class="tabs"> con enlaces #id y <section class="lab" id="id">.
function iniciarPestanas(alCambiar) {
  const enlaces = [...document.querySelectorAll('nav.tabs a')];
  function mostrar(id) {
    if (!document.getElementById(id)) id = enlaces[0].getAttribute('href').slice(1);
    document.querySelectorAll('section.lab').forEach(s => s.classList.toggle('active', s.id === id));
    enlaces.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
    if (alCambiar) alCambiar(id);
    // Las animaciones escuchan este evento para pausarse cuando su pestaña no está visible.
    window.dispatchEvent(new CustomEvent('pestana', { detail: id }));
  }
  window.addEventListener('hashchange', () => mostrar(location.hash.slice(1)));
  mostrar(location.hash.slice(1));
}

// Enlaza un <input type=range> con su <output> y una función de redibujado.
function enlazarSlider(id, alCambiar, formato) {
  const el = document.getElementById(id);
  const out = document.querySelector(`output[for="${id}"]`);
  const actualizar = () => {
    if (out) out.textContent = formato ? formato(+el.value) : el.value;
    alCambiar();
  };
  el.addEventListener('input', actualizar);
  if (out) out.textContent = formato ? formato(+el.value) : el.value;
  return el;
}
