/* =====================================================================
   3. Fusión PET-RM: anatómica en grises + funcional en color con transparencia
   ===================================================================== */
(() => {
  const n = 128;
  const rm = crearFantomaRM(n, false).v;
  // Un tumor: en la RM apenas se distingue; en la PET consume mucha glucosa.
  const tumor = { x: 0.62 * n, y: 0.33 * n, r: 0.07 * n };
  const enTumor = (i, j) => Math.hypot(i - tumor.x, j - tumor.y) < tumor.r;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (enTumor(i, j) && rm[j * n + i] > 0.3) rm[j * n + i] = 0.62;

  // PET: captación por tejido (la sustancia gris consume más glucosa que la blanca) y tumor muy activo.
  const captacion = t => (cerca(t, TEJIDO.gris) ? 0.42 : cerca(t, TEJIDO.blanca) ? 0.2 : cerca(t, TEJIDO.lcr) ? 0.04 : cerca(t, TEJIDO.piel) ? 0.08 : 0);
  const base = crearFantomaRM(n, false).v;
  let pet = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) pet[j * n + i] = enTumor(i, j) && base[j * n + i] > 0.3 ? 1 : captacion(base[j * n + i]);
  // Poca resolución: medias de bloques de 4 × 4 (una PET de 32 × 32), suavizado y algo de ruido.
  const m = 4, baja = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let s = 0;
    for (let b = 0; b < m; b++) for (let a = 0; a < m; a++) s += pet[(Math.floor(j / m) * m + b) * n + Math.floor(i / m) * m + a];
    baja[j * n + i] = s / (m * m);
  }
  const suave = new Float32Array(n * n), R = 3;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let b = -R; b <= R; b++) for (let a = -R; a <= R; a++) {
      const y = j + b, x = i + a;
      if (x >= 0 && y >= 0 && x < n && y < n) { s += baja[y * n + x]; c++; }
    }
    suave[j * n + i] = s / c;
  }
  const gauss = crearGauss(crearRng(3));
  let mx = 0;
  for (let k = 0; k < n * n; k++) { suave[k] = Math.max(0, suave[k] + 0.008 * gauss()); mx = Math.max(mx, suave[k]); }
  for (let k = 0; k < n * n; k++) suave[k] /= mx;
  pet = suave;
  const petMovida = moverImagen(pet, n, 14, -14, 10);

  const alfa = enlazarSlider('fu-alfa', dibujar, v => num(v, 2));
  const umbral = enlazarSlider('fu-umbral', dibujar, v => num(v, 2));
  const desal = document.getElementById('fu-desal');
  const PALETAS = { hot: colorHot, jet: colorJet, gris: colorGris };

  function dibujar() {
    const mapa = PALETAS[document.querySelector('input[name="fu-pal"]:checked').value];
    const p = desal.checked ? petMovida : pet;
    pintarGrises(document.getElementById('fu-rm'), rm, n, n);
    pintarColor(document.getElementById('fu-pet'), p, n, n, mapa);
    pintarFusion(document.getElementById('fu-fus'), rm, p, n, mapa, +alfa.value, +umbral.value);
    const a = +alfa.value;
    document.getElementById('fu-info').innerHTML =
      `Fusión = (1 − α)·RM + α·PET en color = <b>${num(1 - a, 2)}</b>·RM + <b>${num(a, 2)}</b>·PET, ` +
      `solo donde la PET supera ${num(+umbral.value, 2)}.` +
      (desal.checked ? '<br><span class="bad">Sin registrar:</span> la captación cae sobre otra estructura.' : '');
  }
  document.querySelectorAll('input[name="fu-pal"]').forEach(r => r.addEventListener('change', dibujar));
  desal.addEventListener('change', dibujar);
  dibujar();
})();
