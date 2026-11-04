/* =====================================================================
   1. Curva de transferencia: lineal con umbrales, gamma, logarítmica, ecualización
   ===================================================================== */
(() => {
  const N = 160;
  const fan = crearFantomaRM(N, false);
  const gauss = crearGauss(crearRng(7));
  // Poco contraste: el tejido ocupa solo un tramo estrecho de niveles.
  const f = fan.v.map(t => (t === 0 ? 0.04 : Math.min(1, Math.max(0, 0.3 + 0.38 * t + 0.012 * gauss()))));
  const NIV = 256;

  const modo = () => document.querySelector('input[name="in-modo"]:checked').value;
  const f1 = enlazarSlider('in-f1', dibujar, v => coma(v, 2));
  const f2 = enlazarSlider('in-f2', dibujar, v => coma(v, 2));
  const gam = enlazarSlider('in-g', dibujar, v => coma(2 ** v, 2));
  document.querySelectorAll('input[name="in-modo"]').forEach(r => r.addEventListener('change', dibujar));

  // Ecualización: g = CDF(f), con la CDF calculada sobre 256 niveles.
  const hist = new Float64Array(NIV);
  for (const x of f) hist[Math.min(NIV - 1, Math.floor(x * NIV))]++;
  const cdf = new Float64Array(NIV);
  hist.reduce((s, h, k) => (cdf[k] = s + h), 0);
  for (let k = 0; k < NIV; k++) cdf[k] /= f.length;

  function T(x) {
    switch (modo()) {
      case 'lineal': {
        const a = +f1.value, b = Math.max(+f2.value, a + 0.01);
        return Math.min(1, Math.max(0, (x - a) / (b - a)));
      }
      case 'gamma': return x ** (2 ** +gam.value);
      case 'log': return Math.log(1 + 20 * x) / Math.log(21);
      default: return cdf[Math.min(NIV - 1, Math.floor(x * NIV))];
    }
  }

  function dibujarHist(g) {
    const cv = document.getElementById('in-hist'), c = cv.getContext('2d');
    const W = cv.width, H = cv.height, B = 64;
    const h0 = new Float64Array(B), h1 = new Float64Array(B);
    f.forEach((x, k) => { h0[Math.min(B - 1, Math.floor(x * B))]++; h1[Math.min(B - 1, Math.floor(g[k] * B))]++; });
    // Escala: el pico del fondo se recorta para que se vea el tejido.
    const tope = [...h0, ...h1].sort((a, b) => b - a)[2] || 1;
    c.clearRect(0, 0, W, H);
    const bw = (W - 20) / B;
    for (const [h, color] of [[h0, 'rgba(138,148,156,0.75)'], [h1, 'rgba(235,129,27,0.75)']]) {
      c.fillStyle = color;
      h.forEach((v, k) => { const y = Math.min(1, v / tope) * (H - 24); c.fillRect(10 + k * bw, H - 16 - y, bw - 1, y); });
    }
    c.fillStyle = getComputedStyle(document.body).color; c.font = '12px system-ui, sans-serif';
    c.fillText('negro', 10, H - 2); c.textAlign = 'right'; c.fillText('blanco', W - 10, H - 2); c.textAlign = 'left';
  }

  function dibujarCurva() {
    const cv = document.getElementById('in-curva'), c = cv.getContext('2d'), S = cv.width, m = 28, L = S - 2 * m;
    const texto = getComputedStyle(document.body).color;
    c.clearRect(0, 0, S, S);
    c.strokeStyle = texto; c.lineWidth = 1;
    c.beginPath(); c.moveTo(m, m); c.lineTo(m, S - m); c.lineTo(S - m, S - m); c.stroke();
    c.setLineDash([4, 4]); c.beginPath(); c.moveTo(m, S - m); c.lineTo(S - m, m); c.stroke(); c.setLineDash([]);
    c.strokeStyle = '#eb811b'; c.lineWidth = 3; c.beginPath();
    for (let k = 0; k <= 200; k++) {
      const x = k / 200, y = T(x);
      const X = m + x * L, Y = S - m - y * L;
      k ? c.lineTo(X, Y) : c.moveTo(X, Y);
    }
    c.stroke();
    c.fillStyle = texto; c.font = '13px system-ui, sans-serif';
    c.fillText('f (entrada)', S - m - 70, S - 8); c.fillText('g', 8, m + 4);
    c.fillText('0', m - 12, S - m + 14); c.fillText('1', m - 12, m + 4); c.fillText('1', S - m - 4, S - m + 14);
  }

  function dibujar() {
    const md = modo();
    document.getElementById('in-c-f1').hidden = document.getElementById('in-c-f2').hidden = md !== 'lineal';
    document.getElementById('in-c-g').hidden = md !== 'gamma';
    const g = f.map(T);
    pintarAmpliado(document.getElementById('in-res'), g, N, 2);
    dibujarHist(g);
    dibujarCurva();
    const y = 2 ** +gam.value;
    document.getElementById('in-info').innerHTML = {
      lineal: `g = (f − ${coma(+f1.value, 2)}) / (${coma(+f2.value, 2)} − ${coma(+f1.value, 2)}); por debajo de f<sub>1</sub> → 0 (negro), por encima de f<sub>2</sub> → 1 (blanco).`,
      gamma: `g = f<sup>${coma(y, 2)}</sup>: ${Math.abs(y - 1) < 0.03 ? 'no cambia nada' : y < 1 ? '<b>aclara</b> (sube los oscuros y medios)' : '<b>oscurece</b>'}.`,
      log: 'g = log(1 + 20 f) / log(21): estira los niveles bajos y comprime los altos (rangos dinámicos muy amplios).',
      ecu: 'g = CDF(f): cada nivel pasa a ser la fracción de píxeles que hay por debajo. El histograma queda casi plano.',
    }[md];
  }
  pintarAmpliado(document.getElementById('in-orig'), f, N, 2);
  dibujar();

  /* --- Problema tipo examen: gamma o ecualización sobre una 3 × 3 --- */
  const rng = Math.random, ent = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const mat = (M, centro) => `<table class="rejilla" style="display:inline-table;vertical-align:middle">${[0, 1, 2].map(i => `<tr>${[0, 1, 2].map(j => `<td${i === 1 && j === 1 ? ' style="font-weight:700"' : ''}>${M[i * 3 + j]}</td>`).join('')}</tr>`).join('')}</table>`;
  let prob;

  function nuevo() {
    if (rng() < 0.65) {
      const paso = [5, 10, 15][ent(0, 2)], base = ent(0, 4) * paso;
      const M = [0, 1, 2, 1, 2, 3, 2, 3, 4].map(k => base + k * paso * ent(1, 2));
      M[4] = base + ent(1, 6) * paso;
      const lo = Math.min(...M), hi = Math.max(...M);
      const minmax = rng() < 0.6 && lo > 0, gm = rng() < 0.8 ? 0.5 : 2;
      const norm = minmax ? (M[4] - lo) / (hi - lo) : M[4] / hi, r = norm ** gm;
      prob = {
        txt: `Sea la imagen ${mat(M)}. Normalice entre 0 y 1 usando ${minmax ? 'I<sub>norm</sub> = (I − I<sub>min</sub>) / (I<sub>max</sub> − I<sub>min</sub>)' : 'el máximo (I<sub>norm</sub> = I / I<sub>max</sub>)'} y aplique I<sub>out</sub> = I<sub>norm</sub><sup>γ</sup> con γ = ${coma(gm, 1)}. Calcule el nuevo valor del píxel central (con dos decimales).`,
        r, tol: 0.011,
        sol: `${minmax ? `(${M[4]} − ${lo}) / (${hi} − ${lo})` : `${M[4]} / ${hi}`} = ${coma(norm, 3)} → ${coma(norm, 3)}<sup>${coma(gm, 1)}</sup> = <b>${coma(r, 2)}</b>. ${gm < 1 ? 'Sube: γ &lt; 1 aclara.' : 'Baja: γ &gt; 1 oscurece.'}`,
      };
    } else {
      const b = ent(2, 8) * 5, M = Array.from({ length: 9 }, () => b + ent(0, 4) * 2);
      const c = M[4], orden = [...M].sort((x, y) => x - y), cuenta = M.filter(x => x <= c).length;
      prob = {
        txt: `Ecualización local. Considere la ventana ${mat(M)} centrada en el píxel central (${c}). Calcule el histograma acumulado (CDF) y el nuevo valor del píxel central con s = round(255 · CDF).`,
        r: Math.round(255 * cuenta / 9), tol: 1.01,
        sol: `Ordenados: ${orden.map(x => (x === c ? `<b>${x}</b>` : x)).join(', ')}. Hay ${cuenta} valores ≤ ${c} → CDF = ${cuenta}/9 → s = round(255 · ${cuenta}/9) = <b>${Math.round(255 * cuenta / 9)}</b>.`,
      };
    }
    document.getElementById('pi-enunciado').innerHTML = `<p>${prob.txt}</p>`;
    document.getElementById('pi-r').value = '';
    document.getElementById('pi-resultado').innerHTML = '';
  }
  document.getElementById('pi-nuevo').addEventListener('click', nuevo);
  document.getElementById('pi-comprobar').addEventListener('click', () => {
    const v = parseFloat(String(document.getElementById('pi-r').value).replace(',', '.'));
    const ok = Math.abs(v - prob.r) <= prob.tol;
    document.getElementById('pi-resultado').innerHTML = `<p class="${ok ? 'ok' : 'bad'}">${ok ? '✔ Correcto.' : '✘ No es eso.'}</p><p>${prob.sol}</p>`;
  });
  nuevo();
})();
