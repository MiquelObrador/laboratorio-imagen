/* =====================================================================
   1. Transformaciones geométricas: cadena de matrices y problema tipo examen
   Convención de los exámenes: vector columna, P' = M · P.
   ===================================================================== */
(() => {
  const plano = document.getElementById('tf-plano');
  const ctx = plano.getContext('2d');
  const L = 10;                                    // el plano va de −L a L en los dos ejes
  // Una «F»: no tiene simetrías, así se ve si se ha girado, reflejado o deformado.
  const FIGURA = [[0, 0], [1, 0], [1, 2], [2, 2], [2, 3], [1, 3], [1, 4], [3, 4], [3, 5], [0, 5]];
  const P = [3, 5];                                // vértice que se sigue con números

  const TIPOS = {
    T: { a: ['t<sub>x</sub>', -6, 6, 1, 2], b: ['t<sub>y</sub>', -6, 6, 1, 1], mat: (a, b) => matT(a, b), nombre: 'M<sub>T</sub>' },
    S: { a: ['s<sub>x</sub>', -2, 2, 0.5, 1.5], b: ['s<sub>y</sub>', -2, 2, 0.5, 0.5], mat: (a, b) => matS(a, b), nombre: 'M<sub>S</sub>' },
    C: { a: ['sh<sub>x</sub>', -1, 1, 0.25, 0.5], b: ['sh<sub>y</sub>', -1, 1, 0.25, 0], mat: (a, b) => matC(a, b), nombre: 'M<sub>C</sub>' },
    R: { a: ['θ (positivo = antihorario)', -180, 180, 15, 90], b: null, mat: a => matR(a), nombre: 'M<sub>R</sub>' },
  };
  let cadena = [];                                 // [{M, nombre}], en el orden en que se aplican
  const sa = document.getElementById('tf-a'), sb = document.getElementById('tf-b');
  const fmt = v => num(v) + (tipo() === 'R' ? '°' : '');
  enlazarSlider('tf-a', dibujar, fmt);
  enlazarSlider('tf-b', dibujar, v => num(v));

  function tipo() { return document.querySelector('input[name="tf-tipo"]:checked').value; }
  function candidata() { const t = TIPOS[tipo()]; return t.mat(+sa.value, +sb.value); }
  function total(conCandidata) {
    let M = ID3;
    for (const c of cadena) M = mult(c.M, M);
    return conCandidata ? mult(candidata(), M) : M;
  }

  function configurar() {
    const t = TIPOS[tipo()];
    const poner = (el, [nombre, min, max, paso, valor], idNombre) => {
      el.min = min; el.max = max; el.step = paso; el.value = valor;
      document.getElementById(idNombre).innerHTML = nombre;
      el.dispatchEvent(new Event('input'));
    };
    poner(sa, t.a, 'tf-a-nombre');
    document.getElementById('tf-c-b').style.display = t.b ? '' : 'none';
    if (t.b) poner(sb, t.b, 'tf-b-nombre');
    dibujar();
  }

  const aPx = ([x, y]) => [(x + L) / (2 * L) * plano.width, (L - y) / (2 * L) * plano.height];
  function poligono(M, color, relleno, discontinuo) {
    ctx.beginPath();
    FIGURA.forEach((q, k) => { const [u, v] = aPx(aplicar(M, q)); k ? ctx.lineTo(u, v) : ctx.moveTo(u, v); });
    ctx.closePath();
    ctx.setLineDash(discontinuo ? [6, 5] : []);
    if (relleno) { ctx.fillStyle = relleno; ctx.fill(); }
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.setLineDash([]);
    const [u, v] = aPx(aplicar(M, P));
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(u, v, 5, 0, 2 * Math.PI); ctx.fill();
  }

  function dibujar() {
    const W = plano.width, H = plano.height;
    const oscuro = matchMedia('(prefers-color-scheme: dark)').matches;
    ctx.fillStyle = oscuro ? '#1d2126' : '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = oscuro ? '#2f353c' : '#e6e8eb'; ctx.lineWidth = 1;
    for (let k = -L; k <= L; k++) {
      const [u] = aPx([k, 0]), [, v] = aPx([0, k]);
      ctx.beginPath(); ctx.moveTo(u, 0); ctx.lineTo(u, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(W, v); ctx.stroke();
    }
    ctx.strokeStyle = '#8a949c'; ctx.lineWidth = 1.5;
    const [ox, oy] = aPx([0, 0]);
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();
    ctx.fillStyle = '#8a949c'; ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('x', W - 14, oy - 6); ctx.fillText('y', ox + 6, 14);

    poligono(ID3, '#8a949c', 'rgba(138,148,156,.25)');
    const M = total(false), Mc = total(true);
    if (cadena.length) poligono(M, '#eb811b', 'rgba(235,129,27,.25)');
    poligono(Mc, '#eb811b', null, true);

    // Matrices: la candidata a la izquierda de la cadena (se aplica la última).
    const partes = cadena.map(c => matrizHTML(c.M, c.nombre));
    let html = '<div class="muted">Cadena (se aplica de derecha a izquierda):</div>';
    html += cadena.length ? cadena.map(c => c.nombre).reverse().join(' · ') + ' · P' : '<i>vacía</i>';
    html += '<div>' + partes.reverse().join('') + '</div>';
    html += '<div class="muted" style="margin-top:6px">Matriz que vas a añadir (línea discontinua):</div>' + matrizHTML(candidata(), TIPOS[tipo()].nombre);
    html += '<div class="muted" style="margin-top:6px">Producto total (con la que vas a añadir):</div>' + matrizHTML(Mc, 'M');
    document.getElementById('tf-matrices').innerHTML = html;
    const p1 = aplicar(Mc, P);
    document.getElementById('tf-info').innerHTML =
      `P = (${P[0]}, ${P[1]}) &nbsp;→&nbsp; P′ = M · P = (<b>${num(p1[0])}</b>, <b>${num(p1[1])}</b>)`;
  }

  document.querySelectorAll('input[name="tf-tipo"]').forEach(r => r.addEventListener('change', configurar));
  document.getElementById('tf-anadir').addEventListener('click', () => {
    if (cadena.length >= 4) cadena.shift();
    cadena.push({ M: candidata(), nombre: TIPOS[tipo()].nombre });
    dibujar();
  });
  document.getElementById('tf-borrar').addEventListener('click', () => { cadena = []; dibujar(); });
  window.addEventListener('pestana', ev => { if (ev.detail === 'transformaciones') dibujar(); });
  configurar();

  /* ---------- Problema tipo examen (formato de los modelos de examen) ---------- */
  const ent = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const noCero = (a, b) => { let x; do x = ent(a, b); while (x === 0); return x; };
  const pv = p => `(${num(p[0])}, ${num(p[1])})`;
  let prob;

  function nuevoProblema() {
    const p0 = [noCero(-6, 10), noCero(-6, 10)];
    const v = [noCero(-6, 7), noCero(-6, 7)];
    const giros = [[90, 'antihorario'], [-90, 'horario'], [180, '']];
    const escalas = [[0.5, 0.5], [2, 2], [2, 0.5], [3, 2], [0.5, 2]];
    const p1 = aplicar(matT(...v), p0);
    const pasos = [];
    pasos.push({ txt: `Escriba la matriz de traslación M<sub>T</sub> para el vector v = ${pv(v)} y calcule P′.`, M: matT(...v), nombre: 'M<sub>T</sub>', de: p0, a: p1, et: 'P′' });
    if (Math.random() < 0.5) {
      const [sx, sy] = escalas[ent(0, escalas.length - 1)];
      const p2 = aplicar(matS(sx, sy), p1);
      pasos.push({ txt: `Partiendo de P′, escriba la matriz de escalado M<sub>S</sub> con s<sub>x</sub> = ${num(sx)}, s<sub>y</sub> = ${num(sy)} y calcule P″.`, M: matS(sx, sy), nombre: 'M<sub>S</sub>', de: p1, a: p2, et: 'P″' });
    } else {
      const [g, s] = giros[ent(0, 2)];
      const p2 = aplicar(matR(g), p1);
      pasos.push({ txt: `Partiendo de P′, aplique una rotación de ${Math.abs(g)}°${s ? ' en sentido <b>' + s + '</b>' : ''}. Escriba M<sub>R</sub> y calcule P″.`, M: matR(g), nombre: 'M<sub>R</sub>', de: p1, a: p2, et: 'P″' });
    }
    const usados = pasos.map(p => p.nombre === 'M<sub>R</sub>' ? p.M[1][0] * 2 + p.M[0][0] : null);
    let g, s;
    do [g, s] = giros[ent(0, 2)]; while (usados.includes(matR(g)[1][0] * 2 + matR(g)[0][0]));
    pasos.push({ txt: `Escriba la matriz de rotación de ${Math.abs(g)}°${s ? ' en sentido <b>' + s + '</b>' : ''} y aplíquela al punto original P.`, M: matR(g), nombre: 'M<sub>R</sub>', de: p0, a: aplicar(matR(g), p0), et: 'P‴' });
    prob = { p0, pasos };
    document.getElementById('tp-enunciado').innerHTML =
      `<p>Consideramos un píxel en la coordenada <b>P(x, y) = ${pv(p0)}</b>. Use coordenadas homogéneas (vector columna, P′ = M · P) y escriba cada matriz. Rotaciones respecto al origen, eje y hacia arriba.</p><ol type="a">` +
      pasos.map(p => `<li>${p.txt}</li>`).join('') + '</ol>';
    const sol = document.getElementById('tp-sol');
    sol.style.display = 'none';
    sol.innerHTML = '<ol type="a">' + pasos.map(p =>
      `<li>${matrizHTML(p.M, p.nombre)} &nbsp; ${p.nombre} · (${num(p.de[0])}, ${num(p.de[1])}, 1)<sup>T</sup> = (<b>${num(p.a[0])}</b>, <b>${num(p.a[1])}</b>, 1)<sup>T</sup> → ${p.et} = ${pv(p.a)}</li>`).join('') +
      '</ol><p class="muted">Horario = ángulo negativo. Atajos: 90° antihorario (x, y) → (−y, x); 90° horario (x, y) → (y, −x); 180° (x, y) → (−x, −y). Con la convención del temario (vector fila, P′ = P · T) las matrices salen traspuestas y el punto final es el mismo.</p>';
  }
  document.getElementById('tp-solucion').addEventListener('click', () => {
    const s = document.getElementById('tp-sol');
    s.style.display = s.style.display === 'none' ? '' : 'none';
  });
  document.getElementById('tp-otro').addEventListener('click', nuevoProblema);
  nuevoProblema();
})();
