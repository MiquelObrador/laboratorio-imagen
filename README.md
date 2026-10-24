# Laboratorio de imagen

Simulaciones interactivas para la asignatura *Teledetección y Procesado de
Imágenes* (Grado en Física, UNIR). Sitio estático: HTML + JavaScript puro, sin
dependencias ni paso de compilación. Pensado para publicarse con GitHub Pages.

## Estructura

```
index.html          portada con la lista de temas
assets/estilo.css   estilos comunes (claro/oscuro, móvil)
assets/comun.js     utilidades comunes (ruido con semilla, pestañas, sliders, FFT 1D/2D...)
tema01/             Tema 1: ventanas TC, bits, PET (animación), pulso-eco (animación),
                    impedancia/Doppler, SNR/CNR, Fourier con sonido y en imágenes,
                    MTF, volumen parcial, artefactos de TC, cabecera DICOM
                    (lab.js = pestañas estáticas; pet.js y ecografia.js = animaciones;
                    fourier.js = sonido/espectrograma y FFT 2D; calidad.js = MTF y
                    «rompe el escáner»; dicom.js = juego de anonimización)
```

Para añadir un tema: copiar `tema01/` como `temaXX/`, cambiar las pestañas y
el `lab.js`, y activar su tarjeta en `index.html`.

## Probar en local

```bash
python3 -m http.server 8000   # y abrir http://localhost:8000
```

## Publicar (GitHub Pages)

1. Crear un repositorio **público** en GitHub (p.ej. `laboratorio-imagen`).
2. Desde esta carpeta: `git remote add origin git@github.com:USUARIO/laboratorio-imagen.git && git push -u origin main`.
3. En GitHub: *Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`*.
4. A los ~1-2 min estará en `https://USUARIO.github.io/laboratorio-imagen/`.

Cada `git push` posterior actualiza la web.

**Al cambiar un `.js` o `.css`, subir el número de versión** (`?v=3` → `?v=4`)
en las etiquetas `<script>`/`<link>` de los `.html`. Así el navegador de los
alumnos no mezcla archivos nuevos con otros viejos guardados en caché.

## Reglas

- Solo imágenes **sintéticas** o con licencia libre (con atribución). Nunca
  datos de pacientes.
- Este repo es público: no subir aquí exámenes, soluciones de actividades
  evaluables ni material del temario de UNIR.

## Miniatura para redes (Open Graph)

`assets/og.jpg` (1200×630) es la previsualización que muestran WhatsApp,
Telegram, etc. Se genera renderizando `herramientas/og/tarjeta.html` (con
imágenes sacadas de las propias simulaciones) a 1200×630, p.ej. con Edge o
Chrome en modo headless:

```bash
msedge --headless=new --window-size=1200,630 --screenshot=og.png herramientas/og/tarjeta.html
```

y convirtiéndola a JPEG (< 300 KB, el límite práctico de WhatsApp). Ojo:
WhatsApp guarda en caché la previsualización de cada URL; si se cambia la
imagen, cambiar también su nombre (`og2.jpg`) y la etiqueta `og:image`.
