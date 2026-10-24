// Laboratorio web — Tema 1 — Fourier sin matemáticas: con sonido (armónicos y
// espectrograma en directo) y con imágenes (espectro 2D y filtros paso bajo/alto).
// Depende de ../assets/comun.js (fft, fft2...) y de lab.js (TC sintético `tc`).

/* =====================================================================
   7. Fourier con sonido
   ===================================================================== */
(function () {
  const NH = 16;                       // nº de armónicos que se pueden dibujar
  const amp = new Float32Array(NH);
  const PRESETS = {
    diapason: k => (k === 1 ? 1 : 0),
    cuadrada: k => (k % 2 ? 1 / k : 0),
    sierra: k => 1 / k,
    trompeta: k => [0.55, 0.9, 1, 0.85, 0.65, 0.5, 0.38, 0.28, 0.2, 0.14, 0.1, 0.07, 0.05, 0.035, 0.025, 0.02][k - 1],
  };

  const cvEsp = document.getElementById('fs-espectro');
  const cvOnda = document.getElementById('fs-onda');
  const cvGrama = document.getElementById('fs-grama');
  const cvEjes = document.getElementById('fs-grama-ejes');
  const slF0 = enlazarSlider('fs-f0', () => { actualizarSonido(); dibujar(); }, v => `${v} Hz`);
  const slCorte = enlazarSlider('fs-corte', () => { actualizarSonido(); dibujar(); },
    v => (v >= NH ? 'todos' : `hasta el ${v}.º`));
  const corte = () => +slCorte.value;

  function preset(nombre) {
    for (let k = 1; k <= NH; k++) amp[k - 1] = PRESETS[nombre](k);
    slCorte.value = NH;
    slCorte.dispatchEvent(new Event('input'));
  }

  /* ---------- dibujo: espectro (editable) y forma de onda ---------- */
  const MARGEN = 30;
  function dibujarEspectro() {
    const ctx = cvEsp.getContext('2d'), W = cvEsp.width, H = cvEsp.height;
    ctx.clearRect(0, 0, W, H);
    const ancho = (W - MARGEN) / NH, alto = H - 34;
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    for (let k = 1; k <= NH; k++) {
      const x = MARGEN + (k - 1) * ancho, h = amp[k - 1] * alto;
      ctx.fillStyle = k <= corte() ? css('--accent-2') : css('--border');
      ctx.fillRect(x + 3, 8 + alto - h, ancho - 6, h);
      ctx.fillStyle = css('--muted');
      ctx.fillText(k, x + ancho / 2, H - 16);
      if (k === 1 || k % 4 === 0) {
        ctx.textAlign = k === NH ? 'right' : 'center';
        ctx.fillText(`${Math.round(k * slF0.value)} Hz`, k === NH ? W - 2 : x + ancho / 2, H - 3);
        ctx.textAlign = 'center';
      }
    }
    if (corte() < NH) {
      const x = MARGEN + corte() * ancho;
      ctx.strokeStyle = css('--bad');
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, 8 + alto); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = css('--bad');
      ctx.textAlign = 'left';
      ctx.fillText('filtro: no pasa', x + 4, 16);
    }
    ctx.save();
    ctx.translate(11, 8 + alto / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = css('--muted');
    ctx.textAlign = 'center';
    ctx.fillText('amplitud', 0, 0);
    ctx.restore();
  }

  function senal(t, filtrada) {
    let y = 0;
    for (let k = 1; k <= NH; k++) if (!filtrada || k <= corte()) y += amp[k - 1] * Math.sin(2 * Math.PI * k * t);
    return y;
  }

  function dibujarOnda() {
    const ctx = cvOnda.getContext('2d'), W = cvOnda.width, H = cvOnda.height;
    ctx.clearRect(0, 0, W, H);
    const M = 600;
    let maxA = 1e-6;
    for (let i = 0; i <= M; i++) maxA = Math.max(maxA, Math.abs(senal(2 * i / M, false)), Math.abs(senal(2 * i / M, true)));
    const y = v => H / 2 - v / maxA * (H / 2 - 8);
    ctx.strokeStyle = css('--border');
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    const trazo = (filtrada, color, ancho, guiones) => {
      ctx.strokeStyle = color; ctx.lineWidth = ancho; ctx.setLineDash(guiones);
      ctx.beginPath();
      for (let i = 0; i <= M; i++) {
        const px = i / M * W, py = y(senal(2 * i / M, filtrada));
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 1;
    };
    if (corte() < NH) trazo(false, css('--muted'), 1, [4, 3]);
    trazo(true, css('--accent-2'), 2, []);
    ctx.fillStyle = css('--muted');
    ctx.font = '11px system-ui';
    ctx.fillText('2 periodos', 6, H - 6);
  }

  function dibujar() { dibujarEspectro(); dibujarOnda(); }

  // Editar el espectro arrastrando el ratón (o el dedo) sobre las barras.
  function editar(ev) {
    const r = cvEsp.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width * cvEsp.width, y = (ev.clientY - r.top) / r.height * cvEsp.height;
    const k = Math.floor((x - MARGEN) / ((cvEsp.width - MARGEN) / NH));
    if (k < 0 || k >= NH) return;
    amp[k] = Math.max(0, Math.min(1, 1 - (y - 8) / (cvEsp.height - 34)));
    if (amp[k] < 0.03) amp[k] = 0;
    actualizarSonido();
    dibujar();
  }
  let arrastrando = false;
  cvEsp.addEventListener('pointerdown', ev => { arrastrando = true; cvEsp.setPointerCapture(ev.pointerId); editar(ev); });
  cvEsp.addEventListener('pointermove', ev => { if (arrastrando) editar(ev); });
  cvEsp.addEventListener('pointerup', () => { arrastrando = false; });

  /* ---------- audio ---------- */
  let ac = null, salida, analizador, osc = null, barrido = null, micro = null;
  function audio() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      analizador = ac.createAnalyser();
      analizador.fftSize = 4096;
      analizador.smoothingTimeConstant = 0.2;
      analizador.minDecibels = -100;
      analizador.maxDecibels = -20;
      salida = ac.createGain();
      salida.gain.value = 0.15;
      salida.connect(ac.destination);
      salida.connect(analizador);
    }
    if (ac.state === 'suspended') ac.resume();
    arrancarGrama();
    return ac;
  }
  function ondaPeriodica() {
    const real = new Float32Array(NH + 1), imag = new Float32Array(NH + 1);
    for (let k = 1; k <= NH; k++) imag[k] = k <= corte() ? amp[k - 1] : 0;
    return ac.createPeriodicWave(real, imag);
  }
  function actualizarSonido() {
    if (!osc) return;
    osc.setPeriodicWave(ondaPeriodica());
    osc.frequency.setValueAtTime(+slF0.value, ac.currentTime);
  }
  const btnPlay = document.getElementById('fs-play');
  function pararSonido() {
    if (osc) { osc.stop(); osc.disconnect(); osc = null; }
    btnPlay.textContent = '▶ Escuchar';
  }
  btnPlay.addEventListener('click', () => {
    if (osc) return pararSonido();
    audio();
    osc = ac.createOscillator();
    osc.setPeriodicWave(ondaPeriodica());
    osc.frequency.value = +slF0.value;
    osc.connect(salida);
    osc.start();
    btnPlay.textContent = '⏸ Parar';
  });

  document.getElementById('fs-barrido').addEventListener('click', () => {
    audio();
    if (barrido) barrido.stop();
    barrido = ac.createOscillator();
    const t0 = ac.currentTime;
    barrido.frequency.setValueAtTime(100, t0);
    barrido.frequency.exponentialRampToValueAtTime(4000, t0 + 4);
    barrido.connect(salida);
    barrido.start(t0);
    barrido.stop(t0 + 4);
  });

  const btnMicro = document.getElementById('fs-micro');
  const avisoMicro = document.getElementById('fs-micro-aviso');
  btnMicro.addEventListener('click', async () => {
    audio();
    if (micro) {
      micro.fuente.disconnect();
      micro.stream.getTracks().forEach(t => t.stop());
      micro = null;
      btnMicro.textContent = '🎤 Usar el micrófono';
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const fuente = ac.createMediaStreamSource(stream);
      fuente.connect(analizador);           // solo al analizador: no se reproduce (sin acople)
      micro = { stream, fuente };
      btnMicro.textContent = '⏹ Cerrar el micrófono';
      avisoMicro.textContent = 'Silba, canta una nota o di «aaaa» y luego «ssss».';
    } catch (e) {
      avisoMicro.textContent = 'No se ha podido abrir el micrófono (permiso denegado o no hay micrófono).';
    }
  });

  /* ---------- espectrograma ---------- */
  const FMAX = 4000;
  let datos = null, gramaActivo = false;
  function ejesGrama() {
    const ctx = cvEjes.getContext('2d'), W = cvEjes.width, H = cvEjes.height;
    ctx.clearRect(0, 0, W, H);
    ctx.font = '11px system-ui';
    for (let f = 1000; f < FMAX; f += 1000) {
      const y = H - f / FMAX * H;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(`${f} Hz`, 4, y - 3);
    }
    ctx.fillText('tiempo →', W - 62, H - 5);
  }
  function columnaGrama() {
    const ctx = cvGrama.getContext('2d'), W = cvGrama.width, H = cvGrama.height;
    ctx.drawImage(cvGrama, -2, 0);
    analizador.getByteFrequencyData(datos);
    const binHz = ac.sampleRate / analizador.fftSize;
    const img = ctx.createImageData(2, H);
    for (let y = 0; y < H; y++) {
      const f = (H - 1 - y) / H * FMAX;
      const [r, g, b] = colorHot(datos[Math.min(datos.length - 1, Math.round(f / binHz))] / 255);
      for (let x = 0; x < 2; x++) {
        const i = 4 * (y * 2 + x);
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, W - 2, 0);
  }
  function bucleGrama() {
    if (!gramaActivo) return;
    columnaGrama();
    requestAnimationFrame(bucleGrama);
  }
  function arrancarGrama() {
    if (gramaActivo) return;
    datos = new Uint8Array(analizador.frequencyBinCount);
    gramaActivo = true;
    requestAnimationFrame(bucleGrama);
  }
  function limpiarGrama() {
    const ctx = cvGrama.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cvGrama.width, cvGrama.height);
  }

  document.querySelectorAll('[data-fs-preset]').forEach(b => b.addEventListener('click', () => preset(b.dataset.fsPreset)));
  window.addEventListener('pestana', ev => {
    if (ev.detail === 'sonido') {
      dibujar();
      if (ac) arrancarGrama();
      return;
    }
    pararSonido();
    gramaActivo = false;
  });

  limpiarGrama();
  ejesGrama();
  preset('cuadrada');
})();

/* =====================================================================
   8. Fourier en imágenes: espectro 2D y filtros
   ===================================================================== */
(function () {
  const N = 256;
  const cvImg = document.getElementById('fi-img');
  const cvEsp = document.getElementById('fi-esp');
  const cvRes = document.getElementById('fi-res');
  const slFreq = enlazarSlider('fi-freq', calcular, v => `${v} ciclos por imagen`);
  const slAng = enlazarSlider('fi-ang', calcular, v => `${v}°`);
  const slCorte = enlazarSlider('fi-corte', filtrar, v => `radio ${v}`);
  const fuente = () => document.querySelector('input[name="fi-fuente"]:checked').value;
  const filtro = () => document.querySelector('input[name="fi-filtro"]:checked').value;

  function imagen() {
    const img = new Float64Array(N * N), f = +slFreq.value, a = +slAng.value * Math.PI / 180;
    const onda = (x, y, fr, an) => Math.cos(2 * Math.PI * fr * (x * Math.cos(an) + y * Math.sin(an)) / N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        let v;
        switch (fuente()) {
          case 'onda': v = 0.5 + 0.5 * onda(x, y, f, a); break;
          case 'dos': v = 0.5 + 0.25 * onda(x, y, f, a) + 0.25 * onda(x, y, 2.5 * f, a + Math.PI / 3); break;
          case 'cuadro': v = Math.abs(x - N / 2) < 32 && Math.abs(y - N / 2) < 32 ? 1 : 0; break;
          default: {
            // TC de lab.js con una ventana amplia (pulmón y mediastino a la vez)
            v = (tc[y * N_TC + x] + 1000) / 1400;
            v = Math.max(0, Math.min(1, v));
          }
        }
        img[y * N + x] = v;
      }
    return img;
  }

  let espRe, espIm;
  function calcular() {
    const esOnda = ['onda', 'dos'].includes(fuente());
    document.getElementById('fi-ctrl-onda').hidden = !esOnda;
    const img = imagen();
    pintarGrises(cvImg, Float32Array.from(img), N, N);
    espRe = Float64Array.from(img);
    espIm = new Float64Array(N * N);
    fft2(espRe, espIm, N, false);
    filtrar();
  }

  // Índice de frecuencia centrado (fftshift): -N/2 … N/2-1.
  const fc = i => (i < N / 2 ? i : i - N);

  function filtrar() {
    const r0 = +slCorte.value, modo = filtro();
    document.getElementById('fi-ctrl-corte').hidden = modo === 'nada';
    const re = new Float64Array(N * N), im = new Float64Array(N * N);
    const espVista = new Float32Array(N * N);
    let maxLog = 0;
    for (let v = 0; v < N; v++)
      for (let u = 0; u < N; u++) {
        const i = v * N + u, rho = Math.hypot(fc(u), fc(v));
        const pasa = modo === 'nada' || (modo === 'bajo' ? rho <= r0 : rho > r0);
        if (pasa) { re[i] = espRe[i]; im[i] = espIm[i]; }
        const l = Math.log1p(Math.hypot(espRe[i], espIm[i]));
        const j = ((v + N / 2) % N) * N + ((u + N / 2) % N);
        espVista[j] = pasa ? l : 0.25 * l;
        maxLog = Math.max(maxLog, l);
      }
    for (let i = 0; i < N * N; i++) espVista[i] /= maxLog;
    // Las ondas puras son puntos de 1 píxel: se engordan (máximo en un entorno 5 × 5) para que se vean.
    let vistaEsp = espVista;
    if (['onda', 'dos'].includes(fuente())) {
      vistaEsp = new Float32Array(N * N);
      for (let v = 0; v < N; v++)
        for (let u = 0; u < N; u++) {
          let m = 0;
          for (let dv = -2; dv <= 2; dv++)
            for (let du = -2; du <= 2; du++) {
              const uu = u + du, vv = v + dv;
              if (uu >= 0 && vv >= 0 && uu < N && vv < N) m = Math.max(m, espVista[vv * N + uu]);
            }
          vistaEsp[v * N + u] = m;
        }
    }
    const ctx = pintarColor(cvEsp, vistaEsp, N, N, colorHot);
    if (modo !== 'nada') {
      ctx.strokeStyle = '#7fd4ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(N / 2, N / 2, r0, 0, 2 * Math.PI); ctx.stroke();
    }
    fft2(re, im, N, true);
    let vista = Float32Array.from(re);
    if (modo === 'alto') {
      // Los bordes salen positivos y negativos: se centran en gris medio.
      let s = 0;
      for (const v of vista) s += v * v;
      const k = 3 * Math.sqrt(s / vista.length) || 1;
      vista = vista.map(v => 0.5 + 0.5 * v / k);
    }
    pintarGrises(cvRes, vista, N, N);
    document.getElementById('fi-texto').innerHTML = explicacion(modo, r0);
  }

  function explicacion(modo, r0) {
    const f = fuente();
    if (f === 'onda')
      return `Una sola onda de ${slFreq.value} ciclos por imagen son <b>dos puntos</b> en el espectro, a distancia ${slFreq.value} del centro y en la dirección en la que oscila la onda. Muévela y mira cómo se mueven.` +
        (modo === 'bajo' && +slFreq.value > r0 ? ' El filtro paso bajo la ha borrado: es «demasiado fina» para pasar.' : '');
    if (f === 'dos') return 'Dos ondas son cuatro puntos: el espectro es la «receta» de qué ondas forman la imagen. Con un paso bajo de radio intermedio puedes quedarte solo con la más ancha.';
    if (f === 'cuadro') return 'Un borde brusco necesita <b>muchas frecuencias</b> (la cruz del espectro llega muy lejos). Si cortas las altas, el borde se redondea y aparecen ondulaciones (artefacto de Gibbs o de truncamiento, típico de RM).';
    if (modo === 'bajo') return 'Paso bajo: solo pasan las frecuencias cercanas al centro. La imagen pierde los <b>detalles finos</b>: es lo que hace un sistema con mala resolución espacial.';
    if (modo === 'alto') return 'Paso alto: quitas lo «grueso» y quedan los <b>bordes y los detalles finos</b> (y el ruido). Lo usaremos en el Tema 2 para realzar bordes.';
    return 'El centro del espectro son las frecuencias bajas (zonas grandes y suaves); lejos del centro, las altas (bordes, detalles finos, ruido). Escala logarítmica.';
  }

  document.querySelectorAll('input[name="fi-fuente"]').forEach(r => r.addEventListener('change', calcular));
  document.querySelectorAll('input[name="fi-filtro"]').forEach(r => r.addEventListener('change', filtrar));
  calcular();
})();
