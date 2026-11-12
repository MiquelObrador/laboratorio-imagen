/* =====================================================================
   2. Convolución paso a paso (y mediana), con problemas tipo examen
   ===================================================================== */
(() => {
  const KERNELS = {
    media: { nombre: 'Media 3 × 3', k: [1, 1, 1, 1, 1, 1, 1, 1, 1], div: 9, nota: 'Suaviza: cada píxel pasa a ser el promedio de su vecindario.' },
    gauss: { nombre: 'Gaussiano 3 × 3', k: [1, 2, 1, 2, 4, 2, 1, 2, 1], div: 16, nota: 'Suaviza dando más peso al centro.' },
    mediana: { nombre: 'Mediana 3 × 3 (no lineal)', mediana: true, nota: 'No multiplica: ordena los 9 valores y se queda con el del medio.' },
    laplace: { nombre: 'Laplaciano', k: [0, -1, 0, -1, 4, -1, 0, -1, 0], div: 1, nota: 'Responde a los cambios bruscos. En una zona homogénea (o en una rampa) da 0.' },
    realce: { nombre: 'Realce (identidad + Laplaciano)', k: [0, -1, 0, -1, 5, -1, 0, -1, 0], div: 1, nota: 'Imagen original + Laplaciano: exagera los bordes. Puede pasarse de 255.' },
    prewitt: { nombre: 'Prewitt vertical (bordes verticales)', k: [-1, 0, 1, -1, 0, 1, -1, 0, 1], div: 1, nota: 'Derecha − izquierda: positivo si se pasa de oscuro a claro hacia la derecha.' },
    sobelx: { nombre: 'Sobel x', k: [-1, 0, 1, -2, 0, 2, -1, 0, 1], div: 1, nota: 'Como Prewitt, con más peso en la fila central (suaviza el ruido).' },
    sobely: { nombre: 'Sobel y', k: [-1, -2, -1, 0, 0, 0, 1, 2, 1], div: 1, nota: 'Abajo − arriba: detecta bordes horizontales.' },
  };
  const N = 7;
  const IMAGENES = {
    punto: (i, j) => (i === 3 && j === 3 ? 100 : 10),
    borde: (i, j) => (j < 3 ? 10 : 50),
    sal: (i, j) => (i === 3 && j === 3 ? 255 : [14, 15, 13, 16, 14, 12, 15][(i * 3 + j * 5) % 7]),
    rampa: (i, j) => 10 * (j + 1),
  };
  const selK = document.getElementById('cv-kernel'), selI = document.getElementById('cv-img');
  for (const [id, k] of Object.entries(KERNELS)) selK.add(new Option(k.nombre, id));
  selK.value = 'media';

  const selP = document.getElementById('cv-pad');
  let f = [], g = [], actual = 24, timer = null;   // actual: índice 0..48 (todas las posiciones)
  const TOTAL = N * N;

  // Valor de M en (i, j); fuera de la imagen, el relleno (padding): ceros o el borde replicado.
  function val(M, i, j, modo) {
    if (i >= 0 && i < N && j >= 0 && j < N) return M[i * N + j];
    if (modo === 'replicar') return M[Math.min(N - 1, Math.max(0, i)) * N + Math.min(N - 1, Math.max(0, j))];
    return 0;
  }

  function aplicar(K, M, i, j, modo = selP.value) {   // M: matriz plana N × N
    const ventana = [];
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) ventana.push(val(M, i + di, j + dj, modo));
    if (K.mediana) {
      const orden = [...ventana].sort((a, b) => a - b);
      return { valor: orden[4], ventana, orden };
    }
    const s = ventana.reduce((acc, v, q) => acc + v * K.k[q], 0);
    return { valor: s / K.div, ventana, suma: s };
  }
  const fmt = v => (Number.isInteger(v) ? String(v) : coma(v, 1));
  const gris = (v, signo) => {
    const t = signo ? 0.5 + v / 510 : v / 255;
    const L = Math.round(255 * Math.min(1, Math.max(0, t)));
    return `background:rgb(${L},${L},${L});color:${L > 140 ? '#111' : '#fff'}`;
  };

  function recalcular() {
    const K = KERNELS[selK.value], img = IMAGENES[selI.value];
    f = []; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) f.push(img(i, j));
    g = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) g.push(aplicar(K, f, i, j).valor);
    document.getElementById('cv-nota').textContent = K.nota;
    const km = K.mediana ? '<p class="muted">Ordenar y tomar el 5.º de 9.</p>'
      : `<div class="muted">${K.div > 1 ? `1/${K.div} ×` : ''}</div><table class="rejilla">${[0, 1, 2].map(r => `<tr>${[0, 1, 2].map(c => `<td>${K.k[r * 3 + c]}</td>`).join('')}</tr>`).join('')}</table>`;
    document.getElementById('cv-kmat').innerHTML = km;
    pintar();
  }

  function pintar() {
    const K = KERNELS[selK.value], ci = Math.floor(actual / N), cj = actual % N, modo = selP.value;
    const signo = !K.mediana && K.k.some(x => x < 0) && K.k.reduce((a, b) => a + b, 0) === 0;
    const idx = [...Array(N + 2).keys()].map(q => q - 1);   // -1 .. N: la imagen con su marco de relleno
    document.getElementById('cv-ent').innerHTML = idx.map(i => `<tr>${idx.map(j => {
      const en = Math.abs(i - ci) <= 1 && Math.abs(j - cj) <= 1;
      const fuera = i < 0 || i >= N || j < 0 || j >= N, v = val(f, i, j, modo);
      return `<td class="${fuera ? 'relleno' : ''}${en ? ' ventana' : ''}${i === ci && j === cj ? ' centro' : ''}" style="${gris(v)}"${fuera ? ' title="Relleno (padding): no es parte de la imagen"' : ''}>${v}</td>`;
    }).join('')}</tr>`).join('');
    document.getElementById('cv-sal').innerHTML = [...Array(N).keys()].map(i => `<tr>${[...Array(N).keys()].map(j => {
      const v = g[i * N + j], k = i * N + j;
      return `<td data-k="${k}" class="${k === actual ? 'centro' : ''}" style="${gris(v, signo)}">${fmt(Math.round(v * 10) / 10)}</td>`;
    }).join('')}</tr>`).join('');
    const r = aplicar(K, f, ci, cj);
    let html;
    if (K.mediana) {
      html = `<p>Ventana: ${r.ventana.join(', ')}<br>Ordenada: ${r.orden.map((v, q) => (q === 4 ? `<b>[${v}]</b>` : v)).join(', ')}<br>Mediana = <b>${r.valor}</b> · (la media sería ${coma(r.ventana.reduce((a, b) => a + b, 0) / 9, 1)})</p>`;
    } else {
      const terminos = r.ventana.map((v, q) => (K.k[q] === 0 ? null : `${K.k[q] === 1 ? '' : K.k[q] === -1 ? '−' : K.k[q] + '·'}${v}`)).filter(Boolean);
      const txt = terminos.join(' + ').replace(/\+ −/g, '− ');
      html = `<p>${K.div > 1 ? `(${txt}) / ${K.div}` : txt} = ${K.div > 1 ? `${r.suma} / ${K.div} = ` : ''}<b>${fmt(Math.round(r.valor * 10) / 10)}</b></p>`;
    }
    document.getElementById('cv-cuenta').innerHTML = html;
  }

  document.getElementById('cv-sal').addEventListener('click', ev => {
    const td = ev.target.closest('td[data-k]');
    if (td) { actual = +td.dataset.k; pintar(); }
  });
  const parar = () => { clearInterval(timer); timer = null; document.getElementById('cv-play').textContent = '▶ Animar'; };
  document.getElementById('cv-paso').addEventListener('click', () => { parar(); actual = (actual + 1) % TOTAL; pintar(); });
  document.getElementById('cv-reset').addEventListener('click', () => { parar(); actual = 0; pintar(); });
  document.getElementById('cv-play').addEventListener('click', () => {
    if (timer) return parar();
    document.getElementById('cv-play').textContent = '⏸ Pausa';
    actual = -1;
    timer = setInterval(() => { actual++; if (actual >= TOTAL) { actual = TOTAL - 1; parar(); } pintar(); }, 700);
  });
  window.addEventListener('pestana', ev => { if (ev.detail !== 'convolucion') parar(); });
  selK.addEventListener('change', recalcular);
  selI.addEventListener('change', recalcular);
  selP.addEventListener('change', recalcular);
  recalcular();

  /* --- Problema tipo examen (arquetipos de los modelos de examen) --- */
  const ent = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const mat = M => `<table class="rejilla" style="display:inline-table;vertical-align:middle">${[0, 1, 2].map(i => `<tr>${[0, 1, 2].map(j => `<td${i === 1 && j === 1 ? ' style="font-weight:700"' : ''}>${M[i * 3 + j]}</td>`).join('')}</tr>`).join('')}</table>`;
  const kmat = (k, div) => `${div > 1 ? `<sup>1</sup>/<sub>${div}</sub>·` : ''}${mat(k)}`;
  let prob;
  function nuevo() {
    const tipo = ['laplace', 'prewitt', 'media', 'realce', 'mediana'][ent(0, 4)];
    let M;
    if (tipo === 'prewitt') {
      const a = ent(1, 4) * 10 + (Math.random() < 0.5 ? 5 : 0), b = a + ent(3, 6) * 10, corte = ent(1, 2);
      M = [0, 1, 2, 0, 1, 2, 0, 1, 2].map(c => (c < corte ? a : b));
    } else if (tipo === 'mediana') {
      const b = ent(2, 8) * 5; M = Array.from({ length: 9 }, () => b + ent(-3, 3)); M[4] = 255;
    } else {
      const b = ent(1, 7) * 10; let c = ent(1, 11) * 10; if (c === b) c += 40;
      M = Array(9).fill(b); M[4] = c;
    }
    const K = KERNELS[tipo];
    const plano = []; for (let i = 0; i < N * N; i++) plano.push(0);
    for (let q = 0; q < 9; q++) plano[(2 + Math.floor(q / 3)) * N + 2 + (q % 3)] = M[q];
    const r = aplicar(K, plano, 3, 3, 'ceros');
    const interp = {
      laplace: r.valor > 0 ? 'Positivo: el centro es más brillante que sus vecinos (punto o borde brillante). Si fuera homogéneo daría 0.' : 'Negativo: el centro es más oscuro que sus vecinos. Si fuera homogéneo daría 0.',
      prewitt: 'Positivo: la intensidad aumenta de izquierda a derecha (de oscuro a claro): hay un borde vertical.',
      media: 'El punto se reparte entre sus vecinos: menos ruido, pero menos nitidez.',
      realce: `El centro se exagera respecto a sus vecinos${r.valor > 255 ? ' (en 8 bits se saturaría a 255)' : ''}: realza bordes y detalles.`,
      mediana: 'La mediana ignora el valor atípico (ruido impulsivo, «sal»).',
    }[tipo];
    prob = {
      r: r.valor,
      txt: `Dada la imagen ${mat(M)} y ${K.mediana ? 'un <b>filtro de mediana 3 × 3</b>' : `el filtro <b>${K.nombre.toLowerCase()}</b> ${kmat(K.k, K.div)}`}, calcule el valor del píxel central (con un decimal si hace falta) e interprételo.`,
      sol: (K.mediana ? `Ordenados: ${r.orden.map((v, q) => (q === 4 ? `<b>${v}</b>` : v)).join(', ')} → mediana = <b>${r.valor}</b>.`
        : `${r.ventana.map((v, q) => `${K.k[q]}·${v}`).join(' + ').replace(/\+ -/g, '− ')} = ${r.suma}${K.div > 1 ? ` → ${r.suma} / ${K.div} = <b>${fmt(Math.round(r.valor * 10) / 10)}</b>` : ` → <b>${r.valor}</b>`}.`) + ` ${interp}`,
    };
    document.getElementById('pc-enunciado').innerHTML = `<p>${prob.txt}</p>`;
    document.getElementById('pc-r').value = '';
    document.getElementById('pc-resultado').innerHTML = '';
  }
  document.getElementById('pc-nuevo').addEventListener('click', nuevo);
  document.getElementById('pc-comprobar').addEventListener('click', () => {
    const v = parseFloat(String(document.getElementById('pc-r').value).replace(',', '.'));
    const ok = Math.abs(v - prob.r) <= 0.06;
    document.getElementById('pc-resultado').innerHTML = `<p class="${ok ? 'ok' : 'bad'}">${ok ? '✔ Correcto.' : '✘ No es eso.'}</p><p>${prob.sol}</p>`;
  });
  nuevo();
})();
