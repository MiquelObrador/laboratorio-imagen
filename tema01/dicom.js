// Laboratorio web — Tema 1 — Juego: anonimiza la cabecera DICOM.
// Depende de ../assets/comun.js y de lab.js (TC sintético `tc`, aplicarVentana).
// Todos los datos son inventados (mismo paciente ficticio que la demo de DCMTK).
(function () {
  // tipo: 'id' = identifica (hay que borrarlo o sustituirlo), 'cuasi' = depende,
  //       'tec' = dato técnico (si lo borras, la imagen deja de servir)
  const CAMPOS = [
    ['0008,0018', 'SOPInstanceUID', '1.2.826.0.1.3680043.8.498.10734589', 'id', 'Los UID pueden rastrearse hasta el hospital y el estudio original: se sustituyen por otros nuevos.'],
    ['0008,0020', 'StudyDate', '20261021', 'cuasi', 'Depende: la fecha sola no identifica, pero junto a otros datos sí. Se suele desplazar (p. ej. todas las fechas −137 días).'],
    ['0008,0050', 'AccessionNumber', 'A2026-00123', 'id', 'Es el número de petición del hospital: lleva directo al paciente.'],
    ['0008,0060', 'Modality', 'CT', 'tec', 'Sin la modalidad el visor no sabe cómo interpretar los valores (¿HU?).'],
    ['0008,0070', 'Manufacturer', 'FABRICANTE FICTICIO', 'tec', 'El fabricante del equipo no identifica al paciente y es útil para investigar (cada escáner es un poco distinto).'],
    ['0008,0080', 'InstitutionName', 'HOSPITAL FICTICIO', 'id', 'El hospital reduce muchísimo los candidatos. Se borra.'],
    ['0008,0090', 'ReferringPhysicianName', 'DRA^INVENTADA', 'id', 'El nombre del médico también es un dato personal (y apunta al paciente).'],
    ['0008,1030', 'StudyDescription', 'TC TORAX CON CONTRASTE', 'tec', 'Describe la prueba, no a la persona. Se conserva (¡revisando que nadie haya escrito ahí el nombre!).'],
    ['0010,0010', 'PatientName', 'FULANO^DE TAL', 'id', 'El nombre, obviamente.'],
    ['0010,0020', 'PatientID', 'P001', 'id', 'El número de historia clínica identifica directamente.'],
    ['0010,0030', 'PatientBirthDate', '19610312', 'id', 'Fecha de nacimiento + código postal + sexo identifican a la mayoría de la población.'],
    ['0010,0040', 'PatientSex', 'M', 'cuasi', 'Depende: suele conservarse porque es clínicamente relevante, pero suma información para reidentificar.'],
    ['0010,1010', 'PatientAge', '065Y', 'cuasi', 'Depende: se suele conservar o agrupar en rangos (60-69).'],
    ['0010,1040', 'PatientAddress', 'C/ INVENTADA 1, VALENCIA', 'id', 'La dirección identifica directamente.'],
    ['0018,0015', 'BodyPartExamined', 'CHEST', 'tec', 'Dato clínico necesario.'],
    ['0018,0050', 'SliceThickness', '1.25', 'tec', 'Sin el grosor de corte no puedes hablar de volumen parcial ni medir volúmenes.'],
    ['0018,0060', 'KVP', '120', 'tec', 'Parámetro de adquisición (energía del haz). Necesario para comparar estudios.'],
    ['0020,000D', 'StudyInstanceUID', '1.2.826.0.1.3680043.8.498.55120934', 'id', 'Igual que el otro UID: se sustituye por uno nuevo (manteniendo qué imágenes van juntas).'],
    ['0028,0010', 'Rows', '512', 'tec', '¡Sin filas y columnas el visor no sabe cómo ordenar los píxeles!'],
    ['0028,0011', 'Columns', '512', 'tec', '¡Sin filas y columnas el visor no sabe cómo ordenar los píxeles!'],
    ['0028,0030', 'PixelSpacing', '0.703\\0.703', 'tec', 'Sin el tamaño del píxel no se pueden medir distancias: adiós biomarcadores (apartado 7).'],
    ['0028,0100', 'BitsAllocated', '16', 'tec', 'Necesario para leer los píxeles.'],
    ['0028,0101', 'BitsStored', '12', 'tec', 'Necesario para leer los píxeles (12 bits → 4096 niveles).'],
    ['0028,1050', 'WindowCenter', '40', 'tec', 'La ventana por defecto (WL) para mostrar la imagen.'],
    ['0028,1051', 'WindowWidth', '400', 'tec', 'La ventana por defecto (WW) para mostrar la imagen.'],
    ['7FE0,0010', 'PixelData', 'imagen 512 × 512 con texto incrustado', 'pix', 'La trampa: el nombre está «quemado» en los propios píxeles (abajo a la izquierda). Borrar la cabecera no basta: hay que tapar ese texto.'],
  ];

  const tbody = document.getElementById('dc-tabla');
  const cv = document.getElementById('dc-img');
  const marcados = new Set();
  let corregido = false;

  function pintar() {
    tbody.innerHTML = '';
    CAMPOS.forEach(([etq, nombre, valor, tipo, porque], n) => {
      const tr = document.createElement('tr');
      const borrado = marcados.has(n);
      tr.className = borrado ? 'marcada' : '';
      let nota = '';
      if (corregido) {
        const bien = tipo === 'cuasi' || (tipo === 'tec' ? !borrado : borrado);
        nota = `<div class="nota ${tipo === 'cuasi' ? '' : bien ? 'ok' : 'bad'}">${tipo === 'cuasi' ? '≈' : bien ? '✓' : '✗'} ${porque}</div>`;
      }
      tr.innerHTML = `<td class="etq">(${etq})</td><td>${nombre}</td><td>${valor}${nota}</td>`;
      tr.addEventListener('click', () => {
        borrado ? marcados.delete(n) : marcados.add(n);
        pintar();
      });
      tbody.appendChild(tr);
    });
    dibujarImagen();
  }

  function dibujarImagen() {
    // El TC sintético de la pestaña 1, con texto «quemado» como el de un escáner real.
    const ctx = pintarGrises(cv, aplicarVentana(tc, 40, 400), N_TC, N_TC);
    const tapado = marcados.has(CAMPOS.length - 1);
    ctx.font = '9px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('HOSPITAL FICTICIO', 4, 12);
    ctx.fillText('120 kV  1.25 mm', N_TC - 80, 12);
    if (tapado) {
      ctx.fillStyle = '#000';
      ctx.fillRect(2, N_TC - 30, 128, 28);
    } else {
      ctx.fillText('FULANO DE TAL', 4, N_TC - 18);
      ctx.fillText('P001  12/03/1961', 4, N_TC - 6);
    }
  }

  document.getElementById('dc-comprobar').addEventListener('click', () => {
    corregido = true;
    pintar();
    let ids = 0, idsBien = 0, rotos = 0;
    CAMPOS.forEach(([, , , tipo], n) => {
      if (tipo === 'id' || tipo === 'pix') { ids++; if (marcados.has(n)) idsBien++; }
      if (tipo === 'tec' && marcados.has(n)) rotos++;
    });
    const res = document.getElementById('dc-resultado');
    res.innerHTML = `Identificadores eliminados: <b>${idsBien} de ${ids}</b>. Datos técnicos que has roto: <b class="${rotos ? 'bad' : 'ok'}">${rotos}</b>.` +
      (idsBien === ids && !rotos ? ' <span class="ok">¡Perfecto! Esta imagen se puede compartir para investigación.</span>' :
        !marcados.has(CAMPOS.length - 1) ? ' Pista: mira bien la imagen…' : '');
  });
  document.getElementById('dc-reiniciar').addEventListener('click', () => {
    marcados.clear();
    corregido = false;
    document.getElementById('dc-resultado').textContent = '';
    pintar();
  });

  pintar();
})();
