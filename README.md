# Laboratorio de imagen

Simulaciones interactivas para la asignatura *Teledetección y Procesado de
Imágenes* (Grado en Física, UNIR). Sitio estático: HTML + JavaScript puro, sin
dependencias ni paso de compilación. Pensado para publicarse con GitHub Pages.

## Estructura

```
index.html          portada con la lista de temas
assets/estilo.css   estilos comunes (claro/oscuro, móvil)
assets/comun.js     utilidades comunes (ruido con semilla, pestañas, sliders...)
tema01/             Tema 1: ventanas TC, bits, SNR/CNR, volumen parcial, ecografía
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

## Reglas

- Solo imágenes **sintéticas** o con licencia libre (con atribución). Nunca
  datos de pacientes.
- Este repo es público: no subir aquí exámenes, soluciones de actividades
  evaluables ni material del temario de UNIR.
