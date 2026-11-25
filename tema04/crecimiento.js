/* =====================================================================
   2. Crecimiento de regiones paso a paso y problemas tipo examen
   ===================================================================== */
(() => {
  const ent = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const PASOS4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const PASOS8 = PASOS4.concat([[-1, -1], [-1, 1], [1, -1], [1, 1]]);

  // Crecimiento completo por «vueltas»: devuelve la lista de vueltas (cada una, los píxeles añadidos),
  // los comprobados y rechazados, y la región final. Tolerancia respecto a la semilla.
  function crecer(M, n, semilla, tol, vec) {
    const Is = M[semilla], pasos = vec === 8 ? PASOS8 : PASOS4;
    const dentro = new Uint8Array(n * n), fuera = new Uint8Array(n * n);
    dentro[semilla] = 1;
    const vueltas = [[semilla]], rechazos = [[]];
    let frontera = [semilla];
    while (frontera.length) {
      const nuevos = [], rech = [];
      for (const p of frontera) {
        const f = Math.floor(p / n), c = p % n;
        for (const [df, dc] of pasos) {
          const g = f + df, d = c + dc, q = g * n + d;
          if (g < 0 || g >= n || d < 0 || d >= n || dentro[q]) continue;
          if (Math.abs(M[q] - Is) <= tol) { dentro[q] = 1; fuera[q] = 0; nuevos.push(q); }
          else if (!fuera[q]) { fuera[q] = 1; rech.push(q); }
        }
      }
      if (!nuevos.length && !rech.length) break;
      vueltas.push(nuevos); rechazos.push(rech);
      frontera = nuevos;
    }
    const trampas = [];
    for (let q = 0; q < n * n; q++) if (!dentro[q] && Math.abs(M[q] - Is) <= tol) trampas.push(q);
    return { vueltas, rechazos, dentro, trampas, Is };
  }

  // --- Modo explorar: imagen de 8 × 8 ---
  const n = 8, tabla = document.getElementById('cr-tabla');
  tabla.classList.add('clic');
  let M = [], semilla = 27, res = null, vuelta = 0, timer = null;

  function nuevaImagen() {
    const b = ent(15, 40);
    for (let intento = 0; intento < 3000; intento++) {
      // Una mancha conectada de valores parecidos a b, con ruido; el resto, lejos.
      M = new Array(n * n).fill(0).map(() => b + (Math.random() < 0.5 ? ent(6, 30) : -ent(6, 14)));
      let p = 27;
      for (let k = 0; k < 22; k++) {
        M[p] = b + ent(-3, 3);
        const [df, dc] = PASOS4[ent(0, 3)], f = Math.floor(p / n) + df, c = (p % n) + dc;
        if (f >= 0 && f < n && c >= 0 && c < n) p = f * n + c;
      }
      for (let k = 0; k < 3; k++) M[ent(0, n * n - 1)] = b + ent(-3, 3);   // posibles trampas
      M[27] = b;
      const r4 = crecer(M, n, 27, 3, 4), r8 = crecer(M, n, 27, 3, 8);
      const t4 = r4.trampas.length, d48 = r8.dentro.reduce((a, v) => a + v, 0) - r4.dentro.reduce((a, v) => a + v, 0);
      if (t4 >= 2 && d48 >= 1 && r4.dentro.reduce((a, v) => a + v, 0) >= 8) break;
    }
    semilla = 27;
  }

  function calcular() {
    parar();
    const tol = +document.getElementById('cr-tol').value;
    const vec = +document.querySelector('input[name="cr-vec"]:checked').value;
    res = crecer(M, n, semilla, tol, vec);
    vuelta = 0;
    pintar();
  }

  function pintar() {
    const tol = +document.getElementById('cr-tol').value;
    const estado = new Array(n * n).fill('');
    for (let v = 0; v <= vuelta && v < res.vueltas.length; v++) {
      for (const q of res.vueltas[v]) estado[q] = v === vuelta && v > 0 ? 'dentro nuevo' : 'dentro';
      for (const q of res.rechazos[v]) if (!estado[q]) estado[q] = 'fuera';
    }
    const fin = vuelta >= res.vueltas.length - 1;
    if (fin) for (const q of res.trampas) estado[q] = 'trampa';
    estado[semilla] = 'semilla';
    tabla.innerHTML = [...Array(n).keys()].map(f => `<tr>${[...Array(n).keys()].map(c => {
      const q = f * n + c;
      return `<td data-q="${q}" class="${estado[q]}">${M[q]}</td>`;
    }).join('')}</tr>`).join('');
    const total = estado.filter(e => e.startsWith('dentro') || e === 'semilla').length;
    let txt = `Semilla ${res.Is} → intervalo <b>[${res.Is - tol}, ${res.Is + tol}]</b>. Vuelta ${vuelta}: ${total} píxeles en la región.`;
    if (fin) txt += ` <b>Fin</b>: ningún vecino nuevo cumple el criterio.` +
      (res.trampas.length ? ` <span style="background:#ffe08a;color:#111;padding:0 3px">${res.trampas.length} píxel(es)</span> cumplen la tolerancia pero no están conectados.` : '');
    document.getElementById('cr-info').innerHTML = txt;
  }

  function paso() { if (vuelta < res.vueltas.length - 1) { vuelta++; pintar(); return true; } return false; }
  function parar() { clearInterval(timer); timer = null; document.getElementById('cr-play').textContent = '▶ Animar'; }
  document.getElementById('cr-play').addEventListener('click', () => {
    if (timer) return parar();
    if (vuelta >= res.vueltas.length - 1) { vuelta = 0; pintar(); }
    document.getElementById('cr-play').textContent = '⏸ Pausa';
    timer = setInterval(() => { if (!paso()) parar(); }, 650);
  });
  document.getElementById('cr-paso').addEventListener('click', () => { parar(); paso(); });
  document.getElementById('cr-reset').addEventListener('click', () => { parar(); vuelta = 0; pintar(); });
  document.getElementById('cr-otra').addEventListener('click', () => { nuevaImagen(); calcular(); });
  tabla.addEventListener('click', ev => {
    const td = ev.target.closest('td[data-q]');
    if (td) { semilla = +td.dataset.q; calcular(); }
  });
  enlazarSlider('cr-tol', calcular, v => '± ' + v);
  document.querySelectorAll('input[name="cr-vec"]').forEach(r => r.addEventListener('change', calcular));
  window.addEventListener('pestana', ev => { if (ev.detail !== 'crecimiento') parar(); });
  nuevaImagen();
  calcular();

  // --- Problema tipo examen: el alumno pinta la máscara ---
  const tp = document.getElementById('cp-tabla');
  tp.classList.add('clic');
  let prob = null, pintadas = new Set();
  const pos = (q, m) => `(${Math.floor(q / m) + 1},${(q % m) + 1})`;

  function nuevoProblema() {
    for (let intento = 0; intento < 5000; intento++) {
      const m = Math.random() < 0.5 ? 3 : 4, tol = ent(2, 3), vec = Math.random() < 0.7 ? 4 : 8;
      const s = ent(5, 50), sem = m + 1;            // semilla en (2,2)
      const A = new Array(m * m).fill(0).map(() => {
        if (Math.random() < 0.5) return Math.max(0, s + ent(-tol, tol));
        return Math.random() < 0.7 ? s + tol + ent(2, 35) : Math.max(0, s - tol - ent(2, 10));
      });
      A[sem] = s;
      if (A.some(v => v !== s && Math.abs(v - s) > tol && Math.abs(v - s) < tol + 2)) continue;
      const r = crecer(A, m, sem, tol, vec), otro = crecer(A, m, sem, tol, vec === 4 ? 8 : 4);
      const tam = r.dentro.reduce((a, v) => a + v, 0);
      const vecinosSem = (vec === 8 ? PASOS8 : PASOS4).map(([df, dc]) => (1 + df) * m + 1 + dc);
      const indirecto = [...Array(m * m).keys()].some(q => r.dentro[q] && q !== sem && !vecinosSem.includes(q));
      const cambia = r.dentro.some((v, q) => v !== otro.dentro[q]);
      if (tam < 3 || tam > m * m - 2) continue;
      if (!(r.trampas.length || indirecto)) continue;
      if (m === 4 && !(indirecto && (r.trampas.length || cambia))) continue;
      prob = { A, m, tol, vec, s, sem, r, otro, cambia };
      break;
    }
    pintadas = new Set([prob.sem]);
    document.getElementById('cp-enunciado').innerHTML =
      `<p>Aplique crecimiento de regiones a la imagen de la izquierda, con la semilla en el píxel <b>(2,2)</b> (valor ${prob.s}), ` +
      `tolerancia <b>±${prob.tol}</b> respecto a la semilla y conectividad de <b>${prob.vec} vecinos</b>.</p>` +
      `<p class="muted">Haz clic en las casillas que forman parte de la región (la semilla ya está marcada) y pulsa «Comprobar».</p>`;
    document.getElementById('cp-resultado').innerHTML = '';
    pintarProblema(false);
  }

  function pintarProblema(corregir) {
    const { A, m, sem, r } = prob;
    tp.innerHTML = [...Array(m).keys()].map(f => `<tr>${[...Array(m).keys()].map(c => {
      const q = f * m + c;
      let cls = q === sem ? 'semilla' : pintadas.has(q) ? 'pintada' : '';
      if (corregir && q !== sem) cls += (pintadas.has(q) === !!r.dentro[q]) ? ' bien' : ' malo';
      return `<td data-q="${q}" class="${cls}">${q === sem ? `<b>${A[q]}</b>` : A[q]}</td>`;
    }).join('')}</tr>`).join('');
  }

  tp.addEventListener('click', ev => {
    const td = ev.target.closest('td[data-q]');
    if (!td || +td.dataset.q === prob.sem) return;
    const q = +td.dataset.q;
    pintadas.has(q) ? pintadas.delete(q) : pintadas.add(q);
    pintarProblema(false);
    document.getElementById('cp-resultado').innerHTML = '';
  });

  document.getElementById('cp-comprobar').addEventListener('click', () => {
    const { m, r, otro, tol, s, vec, cambia, A } = prob;
    let fallos = 0;
    for (let q = 0; q < m * m; q++) if (pintadas.has(q) !== !!r.dentro[q]) fallos++;
    pintarProblema(true);
    const lista = r.vueltas.slice(1).map((v, k) => v.length ? `vuelta ${k + 1}: ${v.map(q => `${A[q]} ${pos(q, m)}`).join(', ')}` : '').filter(Boolean);
    const mascara = [...Array(m).keys()].map(f => `[${[...Array(m).keys()].map(c => r.dentro[f * m + c]).join(' ')}]`).join(' ');
    let sol = `<p>Intervalo: ${s} ± ${tol} = <b>[${s - tol}, ${s + tol}]</b>.<br>${lista.join('<br>')}<br>` +
      `Máscara: <span style="font-family:ui-monospace,monospace">${mascara}</span></p>`;
    if (r.trampas.length) sol += `<p><span style="background:#ffe08a;color:#111;padding:0 3px">Trampa</span>: ${r.trampas.map(q => `${A[q]} ${pos(q, m)}`).join(', ')} cumple(n) la tolerancia pero <b>no está(n) conectado(s)</b> a la región: no entra(n).</p>`;
    sol += `<p>Con ${vec === 4 ? 8 : 4} vecinos, el resultado ${cambia ? `<b>cambiaría</b>: entrarían ${otro.dentro.reduce((a, v) => a + v, 0)} píxeles en vez de ${r.dentro.reduce((a, v) => a + v, 0)}` : '<b>no cambiaría</b>'}.</p>`;
    document.getElementById('cp-resultado').innerHTML =
      `<p class="${fallos ? 'bad' : 'ok'}">${fallos ? `✘ ${fallos} casilla(s) mal (en rojo).` : '✔ Correcto.'}</p>` + sol;
  });
  document.getElementById('cp-otro').addEventListener('click', nuevoProblema);
  nuevoProblema();
})();
