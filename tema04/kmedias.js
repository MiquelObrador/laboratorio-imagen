/* =====================================================================
   3. K-medias paso a paso (1D, formato de examen), sobre una imagen y problemas tipo examen
   ===================================================================== */
(() => {
  const COLORES = ['#3b7dd8', '#eb811b', '#2e9e57', '#c43c8f', '#8a6d3b', '#d62f2f'];
  const fmt = x => (Number.isInteger(x) ? String(x) : coma(x, 2));
  const leer = id => document.getElementById(id).value.split(/[;,\s]+/).map(s => parseFloat(s.replace(',', '.'))).filter(x => !isNaN(x));

  // --- Paso a paso sobre la recta ---
  const cv = document.getElementById('km-recta'), btn = document.getElementById('km-paso');
  let P = [], C = [], grupo = null, fase = 'asignar', iter = 0, anterior = null, convergido = false, anim = null;

  function reiniciar() {
    P = leer('km-datos'); C = leer('km-sem').slice(0, 6);
    if (P.length < 2 || C.length < 1) { document.getElementById('km-info').textContent = 'Escribe al menos 2 intensidades y 1 centroide.'; return; }
    grupo = null; fase = 'asignar'; iter = 0; anterior = null; convergido = false;
    btn.textContent = '1 · Asignar'; btn.disabled = false;
    document.getElementById('km-tabla').innerHTML = '';
    document.getElementById('km-info').innerHTML = `${P.length} píxeles, k = ${C.length}. Pulsa «Asignar».`;
    dibujar();
  }

  function rango() {
    const todos = P.concat(C), lo = Math.min(...todos), hi = Math.max(...todos), m = Math.max(2, (hi - lo) * 0.08);
    return [lo - m, hi + m];
  }
  const X = v => { const [lo, hi] = rango(); return 30 + ((cv.width - 60) * (v - lo)) / (hi - lo); };

  function dibujar() {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, css = getComputedStyle(document.documentElement);
    ctx.clearRect(0, 0, W, H);
    const y0 = 95;
    ctx.strokeStyle = css.getPropertyValue('--muted'); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(20, y0); ctx.lineTo(W - 20, y0); ctx.stroke();
    ctx.font = '13px system-ui'; ctx.textAlign = 'center';
    // Puntos (los repetidos se apilan)
    const cuenta = {};
    P.forEach((p, i) => {
      const k = cuenta[p] = (cuenta[p] || 0) + 1;
      ctx.fillStyle = grupo ? COLORES[grupo[i]] : css.getPropertyValue('--muted');
      ctx.beginPath(); ctx.arc(X(p), y0 - 12 - 16 * (k - 1), 7, 0, 2 * Math.PI); ctx.fill();
      if (k === 1) { ctx.fillStyle = css.getPropertyValue('--text'); ctx.fillText(fmt(p), X(p), y0 + 18); }
    });
    // Centroides
    C.forEach((c, j) => {
      ctx.strokeStyle = ctx.fillStyle = COLORES[j]; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(X(c), y0 + 28); ctx.lineTo(X(c), y0 - 70); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(c) - 8, y0 - 70); ctx.lineTo(X(c) + 8, y0 - 70); ctx.lineTo(X(c), y0 - 58); ctx.fill();
      ctx.fillText(`C${j + 1} = ${fmt(Math.round(c * 100) / 100)}`, X(c), y0 + 46);
    });
  }

  function asignar() {
    const d = P.map(p => C.map(c => Math.abs(p - c)));
    grupo = d.map(fila => fila.indexOf(Math.min(...fila)));
    const empates = d.filter(fila => fila.filter(v => v === Math.min(...fila)).length > 1).length;
    const cambia = anterior && grupo.some((g, i) => g !== anterior[i]);
    convergido = anterior !== null && !cambia;
    // Tabla de distancias
    let h = `<table class="km"><tr><th>Píxel</th>${C.map((c, j) => `<th style="color:${COLORES[j]}">|x − C${j + 1}|</th>`).join('')}<th>Grupo</th></tr>`;
    P.forEach((p, i) => {
      h += `<tr><td>${fmt(p)}</td>${d[i].map((v, j) => `<td class="${j === grupo[i] ? 'min' : ''}" style="${j === grupo[i] ? `color:${COLORES[j]}` : ''}">${fmt(Math.round(v * 100) / 100)}</td>`).join('')}<td style="color:${COLORES[grupo[i]]}">C${grupo[i] + 1}</td></tr>`;
    });
    document.getElementById('km-tabla').innerHTML = h + '</table>';
    let txt = `Iteración ${iter + 1}, asignación: cada píxel al centroide más cercano.`;
    if (empates) txt += ` Hay ${empates} empate(s): van al grupo de menor índice (hay que decidir una regla).`;
    if (convergido) { txt += ' <span class="ok">Nadie ha cambiado de grupo: ha convergido.</span>'; btn.disabled = true; btn.textContent = 'Fin'; }
    else { fase = 'recalcular'; btn.textContent = '2 · Recalcular centroides'; }
    document.getElementById('km-info').innerHTML = txt;
    dibujar();
  }

  function recalcular() {
    const nuevos = C.map((c, j) => {
      const g = P.filter((_, i) => grupo[i] === j);
      return g.length ? g.reduce((a, b) => a + b, 0) / g.length : c;
    });
    const formulas = C.map((c, j) => {
      const g = P.filter((_, i) => grupo[i] === j);
      return g.length ? `C${j + 1}′ = (${g.map(fmt).join(' + ')}) / ${g.length} = <b>${fmt(Math.round(nuevos[j] * 100) / 100)}</b>` : `C${j + 1}: grupo vacío, no se mueve`;
    });
    const desde = C.slice(), t0 = performance.now();
    cancelAnimationFrame(anim);
    const mover = t => {
      const a = Math.min(1, (t - t0) / 600);
      C = desde.map((c, j) => c + (nuevos[j] - c) * a);
      dibujar();
      if (a < 1) anim = requestAnimationFrame(mover);
    };
    anim = requestAnimationFrame(mover);
    anterior = grupo.slice(); iter++;
    fase = 'asignar'; btn.textContent = '1 · Asignar otra vez';
    document.getElementById('km-info').innerHTML = `Iteración ${iter}, centroides nuevos (la media de cada grupo):<br>${formulas.join('<br>')}`;
  }

  btn.addEventListener('click', () => (fase === 'asignar' ? asignar() : recalcular()));
  document.getElementById('km-reset').addEventListener('click', reiniciar);
  ['km-datos', 'km-sem'].forEach(id => document.getElementById(id).addEventListener('change', reiniciar));

  // Arrastrar un centroide reinicia el algoritmo desde ese inicio.
  let arrastre = -1;
  const valorDe = ev => {
    const r = cv.getBoundingClientRect(), p = ev.touches ? ev.touches[0] : ev;
    const x = ((p.clientX - r.left) / r.width) * cv.width, [lo, hi] = rango();
    return lo + ((x - 30) / (cv.width - 60)) * (hi - lo);
  };
  const empezar = ev => {
    const v = valorDe(ev), [lo, hi] = rango(), umbral = (hi - lo) * 0.04;
    arrastre = C.reduce((mejor, c, j) => (Math.abs(c - v) < umbral && (mejor < 0 || Math.abs(c - v) < Math.abs(C[mejor] - v)) ? j : mejor), -1);
    if (arrastre >= 0) ev.preventDefault();
  };
  const mover = ev => {
    if (arrastre < 0) return;
    C[arrastre] = Math.round(valorDe(ev) * 2) / 2;
    document.getElementById('km-sem').value = C.map(fmt).join(', ');
    grupo = null; fase = 'asignar'; iter = 0; anterior = null; convergido = false;
    btn.textContent = '1 · Asignar'; btn.disabled = false;
    document.getElementById('km-tabla').innerHTML = '';
    document.getElementById('km-info').innerHTML = 'Nuevo inicio. Pulsa «Asignar».';
    dibujar();
  };
  cv.addEventListener('mousedown', empezar);
  window.addEventListener('mousemove', mover);
  window.addEventListener('mouseup', () => { arrastre = -1; });
  cv.addEventListener('touchstart', empezar, { passive: false });
  cv.addEventListener('touchmove', ev => { if (arrastre >= 0) { mover(ev); ev.preventDefault(); } }, { passive: false });
  cv.addEventListener('touchend', () => { arrastre = -1; });
  reiniciar();

  // --- K-medias sobre una imagen (RM sintética con ruido) ---
  const NI = 128, fant = crearFantomaRM(NI, false), gauss = crearGauss(crearRng(5));
  const img = new Float32Array(NI * NI);
  for (let i = 0; i < NI * NI; i++) img[i] = Math.max(0, Math.min(1, fant.v[i] + 0.04 * gauss()));
  pintarGrises(document.getElementById('ki-img'), img, NI, NI);
  const hI = new Float64Array(256);
  for (let i = 0; i < NI * NI; i++) hI[Math.round(img[i] * 255)]++;
  let rngIni = crearRng(1);

  function kmediasImagen() {
    const k = +document.getElementById('ki-k').value;
    // Inicio: k píxeles al azar (distintos), como dice el temario.
    let c = [];
    while (c.length < k) {
      const v = Math.round(img[Math.floor(rngIni() * NI * NI)] * 255);
      if (!c.includes(v)) c.push(v);
    }
    c.sort((a, b) => a - b);
    let it = 0, lab = new Int8Array(256);
    for (; it < 100; it++) {
      for (let v = 0; v < 256; v++) {
        let mejor = 0;
        for (let j = 1; j < k; j++) if (Math.abs(v - c[j]) < Math.abs(v - c[mejor])) mejor = j;
        lab[v] = mejor;
      }
      const s = new Float64Array(k), nn = new Float64Array(k);
      for (let v = 0; v < 256; v++) { s[lab[v]] += v * hI[v]; nn[lab[v]] += hI[v]; }
      const nuevos = c.map((x, j) => (nn[j] ? s[j] / nn[j] : x));
      const quieto = nuevos.every((x, j) => Math.abs(x - c[j]) < 1e-6);
      c = nuevos;
      if (quieto) break;
    }
    const orden = c.map((x, j) => j).sort((a, b) => c[a] - c[b]), rangoDe = [];
    orden.forEach((j, r) => { rangoDe[j] = r; });
    const canvas = document.getElementById('ki-lab');
    canvas.width = canvas.height = NI;
    const ctx = canvas.getContext('2d'), data = ctx.createImageData(NI, NI);
    for (let i = 0; i < NI * NI; i++) {
      const col = COLORES[rangoDe[lab[Math.round(img[i] * 255)]]];
      data.data[4 * i] = parseInt(col.slice(1, 3), 16); data.data[4 * i + 1] = parseInt(col.slice(3, 5), 16);
      data.data[4 * i + 2] = parseInt(col.slice(5, 7), 16); data.data[4 * i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    // Histograma con los centroides
    const ch = document.getElementById('ki-hist'), hx = ch.getContext('2d'), W = ch.width, H = ch.height;
    const css = getComputedStyle(document.documentElement);
    hx.clearRect(0, 0, W, H);
    let ymax = 0;
    for (let v = 3; v < 256; v++) ymax = Math.max(ymax, hI[v]);
    for (let v = 0; v < 256; v++) {
      hx.fillStyle = COLORES[rangoDe[lab[v]]];
      const h = Math.min(1, hI[v] / (ymax * 1.1)) * (H - 20);
      hx.fillRect(10 + ((W - 20) * v) / 256, H - 10 - h, Math.max(1, (W - 20) / 256), h);
    }
    hx.strokeStyle = css.getPropertyValue('--text'); hx.lineWidth = 2;
    c.forEach(x => { const px = 10 + ((W - 20) * x) / 256; hx.beginPath(); hx.moveTo(px, 4); hx.lineTo(px, H - 10); hx.stroke(); });
    const cs = c.slice().sort((a, b) => a - b).map(x => Math.round(x));
    document.getElementById('ki-info').innerHTML = `Converge en ${it + 1} iteraciones. Centroides: <b>${cs.join(', ')}</b> (de 0 a 255).`;
  }
  enlazarSlider('ki-k', kmediasImagen);
  document.getElementById('ki-azar').addEventListener('click', () => { rngIni = Math.random; kmediasImagen(); });
  kmediasImagen();

  // --- Problema tipo examen: 6 intensidades, k = 2, una iteración ---
  const ent = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  let prob;
  function nuevoProblema() {
    for (;;) {
      const a = ent(2, 20), b = a + ent(15, 60);
      const A = [a, a + ent(1, 4), a + ent(2, 7)], B = [b, b + ent(2, 6), b + ent(4, 12)];
      const Pv = A.concat(B).sort(() => Math.random() - 0.5);
      const c1 = a + ent(0, 6), c2 = Math.random() < 0.5 ? b + ent(-3, 5) : Math.round((a + b) / 2) + ent(5, 15);
      if (c2 <= c1 + 4) continue;
      const g = Pv.map(p => (Math.abs(p - c1) < Math.abs(p - c2) ? 0 : Math.abs(p - c1) > Math.abs(p - c2) ? 1 : -1));
      if (g.includes(-1) || g.filter(x => x === 0).length !== 3) continue;
      const G1 = Pv.filter((_, i) => g[i] === 0), G2 = Pv.filter((_, i) => g[i] === 1);
      const n1 = G1.reduce((s, x) => s + x, 0) / 3, n2 = G2.reduce((s, x) => s + x, 0) / 3;
      prob = { Pv, c1, c2, g, G1, G2, n1, n2 };
      break;
    }
    document.getElementById('kp-enunciado').innerHTML =
      `<p>Se tienen las intensidades de 6 píxeles: <b>P = [${prob.Pv.join(', ')}]</b>. Aplique <b>una iteración</b> de k-medias con k = 2 y semillas iniciales <b>C<sub>1</sub> = ${prob.c1}</b> y <b>C<sub>2</sub> = ${prob.c2}</b>:</p>` +
      `<p>a) Asigne cada píxel a su grupo (distancia |x − C|). b) Calcule los nuevos centroides (con 2 decimales).</p>`;
    ['kp-c1', 'kp-c2'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('kp-resultado').innerHTML = '';
  }
  document.getElementById('kp-comprobar').addEventListener('click', () => {
    const v1 = parseFloat(document.getElementById('kp-c1').value), v2 = parseFloat(document.getElementById('kp-c2').value);
    const ok = Math.abs(v1 - prob.n1) < 0.011 && Math.abs(v2 - prob.n2) < 0.011;
    const dist = prob.Pv.map((p, i) => `${p}: |${p} − ${prob.c1}| = ${Math.abs(p - prob.c1)}, |${p} − ${prob.c2}| = ${Math.abs(p - prob.c2)} → C${prob.g[i] + 1}`).join('<br>');
    const conv = prob.Pv.every((p, i) => (Math.abs(p - prob.n1) < Math.abs(p - prob.n2) ? 0 : 1) === prob.g[i]);
    document.getElementById('kp-resultado').innerHTML =
      `<p class="${ok ? 'ok' : 'bad'}">${ok ? '✔ Correcto.' : '✘ No es eso.'}</p><p>a) ${dist}</p>` +
      `<p>b) C<sub>1</sub>′ = (${prob.G1.join(' + ')}) / 3 = <b>${coma(prob.n1, 2)}</b> · C<sub>2</sub>′ = (${prob.G2.join(' + ')}) / 3 = <b>${coma(prob.n2, 2)}</b></p>` +
      `<p class="muted">${conv ? 'Con los centroides nuevos nadie cambiaría de grupo: el algoritmo ya habría convergido.' : 'Con los centroides nuevos algún píxel cambiaría de grupo: haría falta otra iteración.'}</p>`;
  });
  document.getElementById('kp-otro').addEventListener('click', nuevoProblema);
  nuevoProblema();
})();
