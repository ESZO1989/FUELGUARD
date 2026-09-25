// Guía de instalación paso a paso · diseño v2 con videos de referencia de YouTube.
'use strict';
const pptxgen = require('pptxgenjs');
const path = require('node:path');
const { C, F, T, nuevaPresentacion, portada, seccion, contenido, tarjeta, marcoFoto, imagen, videoTarjeta, tabla, pieNota } = require('./comun');

(async () => {
  const pres = nuevaPresentacion(pptxgen, 'FuelGuard · Guía de instalación');
  const fecha = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  const K = { A: 'ETAPA A · PREPARACIÓN', B: 'ETAPA B · MONTAJE MECÁNICO', C: 'ETAPA C · MONTAJE ELÉCTRICO', D: 'ETAPA D · TAGS EN LOS EQUIPOS', E: 'ETAPA E · CALIBRACIÓN Y PRUEBA FINAL' };
  const VID = { x: [0.6, 4.72, 8.84], w: 3.9, h: 4.95, y: 1.55 };
  const filaVideos = async (s, lista) => { for (let i = 0; i < lista.length; i++) await videoTarjeta(pres, s, { x: VID.x[i], y: VID.y, w: VID.w, h: VID.h, id: lista[i][0], queMirar: lista[i][1], etiqueta: lista[i][2] }); };

  // 1. Portada
  portada(pres, { kicker: 'GUÍA DE INSTALACIÓN', titulo: 'Instalación del kit FuelGuard en la cisterna', subtitulo: 'Paso a paso mecánico, eléctrico y de puesta en marcha, con videos de referencia para cada etapa. Un día de trabajo para dos personas.', pie: fecha, imagen: { archivo: 'chofer-inicio.png', leyenda: 'App del chofer en la tablet del camión' } });

  // 2. Resumen de etapas
  {
    const s = contenido(pres, 'Cinco etapas, un día de trabajo', 'No hace falta programar: el firmware está hecho y solo se edita un archivo de configuración', 'RESUMEN');
    const etapas = [['A', 'Preparación y prueba en mesa', 'Oficina · 2–3 h', 'Técnico', C.azul], ['B', 'Montaje mecánico', 'Camión · 2–3 h', 'Mecánico', C.naranja], ['C', 'Montaje eléctrico', 'Camión · 2–3 h', 'Electricista', C.naranja], ['D', 'Tags en los equipos', 'Faena · 5 min por equipo', 'Técnico', C.verde], ['E', 'Calibración y prueba final', 'Camión · 1–2 h', 'Técnico + chofer', C.azul]];
    s.addShape(pres.ShapeType.line, { x: 1.55, y: 2.55, w: 10.2, h: 0, line: { color: C.lineas, width: 3 } });
    etapas.forEach((e, i) => {
      const x = 0.6 + i * 2.5;
      s.addShape(pres.ShapeType.ellipse, { x: x + 0.7, y: 2.1, w: 0.9, h: 0.9, fill: { color: e[4] }, line: { color: C.white, width: 3 } });
      s.addText(e[0], T({ x: x + 0.7, y: 2.1, w: 0.9, h: 0.9, fontSize: 24, bold: true, color: C.white, align: 'center', valign: 'middle' }));
      s.addText(e[1], T({ x, y: 3.15, w: 2.3, h: 0.7, fontSize: 14, bold: true, color: C.ink, align: 'center', valign: 'top' }));
      s.addText(e[2] + '\n' + e[3], T({ x, y: 3.85, w: 2.3, h: 0.7, fontSize: 11, color: C.gris, align: 'center', fontFace: F.cuerpo, valign: 'top' }));
    });
    tarjeta(pres, s, { x: 0.6, y: 4.85, w: 3.95, h: 1.95, titulo: 'Quién hace qué', icono: '👷', lineas: ['Mecánico: línea de combustible y sensor', 'Electricista: caja, cableado y antenas', 'Técnico FuelGuard: firmware, tags, calibración'], fontSize: 11.5 });
    tarjeta(pres, s, { x: 4.7, y: 4.85, w: 3.95, h: 1.95, titulo: 'Antes de ir al camión', icono: '✅', color: C.verdeTenue, colorTitulo: '0A6F0A', lineas: ['Kit recibido y verificado', 'Cisterna creada en el dashboard', 'Prueba en mesa aprobada'], fontSize: 11.5 });
    tarjeta(pres, s, { x: 8.8, y: 4.85, w: 3.9, h: 1.95, titulo: 'Videos de referencia', icono: '▶', color: C.naranjaTenue, colorTitulo: 'B5532C', lineas: ['Cada etapa incluye videos de fabricantes y técnicos que muestran el procedimiento', 'Escanee el QR o toque la miniatura'], fontSize: 11.5 });
  }

  // 3. Kit
  {
    const s = contenido(pres, 'Kit estándar por cisterna', 'Lista de compra con proveedores y precios en docs/LISTA_DE_COMPRA_PILOTO.md', 'MATERIALES');
    tarjeta(pres, s, { x: 0.6, y: 1.55, w: 4.0, h: 5.25, titulo: 'Línea de combustible', icono: '🔧', color: C.naranjaTenue, colorTitulo: 'B5532C', lineas: ['Caudalímetro de pulsos 1½" (Piusi K600/4) con hoja de K‑factor', 'Electroválvula NC 1½", 12/24 V, sello Viton', 'Pistola automática (si la actual no lo es)', 'Niples, uniones, teflón y sellador para hidrocarburos', 'Abrazaderas y soportes'], fontSize: 12 });
    tarjeta(pres, s, { x: 4.75, y: 1.55, w: 4.0, h: 5.25, titulo: 'Electrónica', icono: '🔌', lineas: ['Controlador ESP32 + 4G + GPS (LILYGO T‑SIM7600G‑H)', 'Lector RFID RDM6300 y bobina de antena', 'Sensor de nivel hidrostático 4–20 mA', 'Módulo relé 5 V, fuente DC‑DC 24→5 V 3 A, shunt 150 Ω', 'Antenas LTE y GPS, SIM M2M', 'Caja IP67, prensaestopas, fusible 3 A, supresor'], fontSize: 12 });
    tarjeta(pres, s, { x: 8.9, y: 1.55, w: 3.8, h: 2.5, titulo: 'Por equipo', icono: '🏷️', color: C.verdeTenue, colorTitulo: '0A6F0A', lineas: ['Tag RFID anti‑metal 125 kHz', 'Desengrasante y resina epóxica'], fontSize: 12 });
    tarjeta(pres, s, { x: 8.9, y: 4.3, w: 3.8, h: 2.5, titulo: 'Herramientas', icono: '🧰', lineas: ['Llaves de tubo, cortatubos, terraja 1½"', 'Multímetro, crimpadora, etiquetadora', 'Recipiente patrón de 20 L', 'Notebook con PlatformIO y cable USB'], fontSize: 12 });
  }

  // 4. Sección A
  seccion(pres, { letra: 'A', titulo: 'Preparación y prueba en mesa', subtitulo: 'Todo lo que se puede validar en la oficina antes de tocar el camión', datos: [['Dónde', 'Oficina'], ['Tiempo', '2 – 3 horas'], ['Quién', 'Técnico']] });

  // 5. A1 dashboard
  {
    const s = contenido(pres, 'Dar de alta la cisterna y los equipos', 'La clave de dispositivo que entrega el dashboard es la que va en el firmware', K.A);
    imagen(s, 'dashboard-admin.png', { x: 0.6, y: 1.55, w: 7.9, h: 4.93 });
    tarjeta(pres, s, { x: 8.8, y: 1.55, w: 3.9, h: 4.93, titulo: 'Pasos', lineas: [{ text: '1. Administración → Cisternas → Nueva cisterna. Anote la clave: se muestra una sola vez.', options: { bullet: false } }, { text: '2. Equipos → Nuevo equipo: código, capacidad del tanque y consumo nominal en L/h.', options: { bullet: false } }, { text: '3. Usuarios: chofer asignado a la cisterna y operadores de cada equipo.', options: { bullet: false } }, { text: '4. Parámetros: geocerca, horario y precio del litro.', options: { bullet: false } }], fontSize: 12 });
    pieNota(s, 'El tag RFID de cada equipo se completa en la etapa D, cuando se lee con el lector.');
  }

  // 6. A2 firmware
  {
    const s = contenido(pres, 'Configurar y grabar el firmware', 'Un archivo de configuración y un comando', K.A);
    s.addShape(pres.ShapeType.roundRect, { x: 0.6, y: 1.55, w: 6.4, h: 4.15, fill: { color: C.oscuro }, rectRadius: 0.14, line: { color: C.oscuro } });
    const cfg = ['// firmware/include/config.h', '#define DEVICE_KEY   "dev-cist-01-8f3a…"  // dashboard', '#define SERVER_HOST  "combustible.miempresa.com"', '#define SERVER_PORT  443', '#define SERVER_TLS   1', '#define GSM_APN      "m2m.entel.cl"       // según SIM', '#define K_FACTOR_PULSES_PER_L  100.0f  // hoja', '#define TANK_CAPACITY_L        10000.0f', '#define LEVEL_TABLE {{0,0},{50,5000},{100,10000}}', '', '// grabar y ver el monitor', 'pio run -e esp32-sim7600 -t upload', 'pio device monitor -b 115200'];
    s.addText(cfg.map((l, i) => ({ text: l, options: { breakLine: i < cfg.length - 1, color: l.startsWith('//') ? '8C93A0' : l.startsWith('pio') ? '9BE79B' : 'E8E8E8' } })), T({ x: 0.8, y: 1.7, w: 6.0, h: 3.9, fontSize: 11, fontFace: 'Courier New', valign: 'top' }));
    tarjeta(pres, s, { x: 7.3, y: 1.55, w: 5.4, h: 4.15, titulo: 'Qué comprobar en el monitor serie', icono: '🖥️', lineas: ['"heartbeat ok, señal N" → el controlador llegó al servidor', 'En el dashboard la cisterna pasa a "en línea" con posición GPS', 'LED: parpadeo lento = en línea, rápido = sin señal', 'Si no conecta: revisar DEVICE_KEY, APN y antena LTE'], fontSize: 12 });
    tarjeta(pres, s, { x: 0.6, y: 5.9, w: 12.1, h: 0.9, lineas: [{ text: 'PlatformIO se instala con  pip install platformio . Compilación verificada para las dos variantes: esp32-wifi (banco de pruebas) y esp32-sim7600 (producción).', options: { bullet: false } }], fontSize: 12, color: C.verdeTenue });
  }

  // 7. A3 prueba en mesa
  {
    const s = contenido(pres, 'Prueba en mesa: el sistema completo sin el camión', 'Si esto funciona, el 80 % del riesgo de la instalación queda resuelto', K.A);
    imagen(s, 'diagrama-mesa.png', { x: 0.6, y: 1.55, w: 8.4, h: 3.25, sombra: false });
    marcoFoto(pres, s, { x: 9.3, y: 1.55, w: 3.4, h: 3.25, etiqueta: 'VIDEO PROPIO 1 · Prueba en mesa', descripcion: 'tag → autorizado → pulsador → cierre', video: true });
    tarjeta(pres, s, { x: 0.6, y: 5.0, w: 6.0, h: 1.8, titulo: 'Probar los tags anti‑metal aquí', icono: '🏷️', color: C.naranjaTenue, colorTitulo: 'B5532C', lineas: ['Pegar uno sobre una plancha de acero', 'Lectura estable a 2–3 cm; pérdida en menos de 1 s al alejar', 'Si falla: tag más grande o antena reubicada, antes de comprar el lote'], fontSize: 11.5 });
    tarjeta(pres, s, { x: 6.8, y: 5.0, w: 5.9, h: 1.8, titulo: 'Resultado esperado', icono: '✅', color: C.verdeTenue, colorTitulo: '0A6F0A', lineas: ['Despacho en el historial del dashboard con hash', 'Alerta "tag no autorizado" con un tag desconocido', 'Confirmación con firma desde la tablet'], fontSize: 11.5 });
  }

  // 8. Videos etapa A
  {
    const s = contenido(pres, 'Videos de referencia · preparación', 'Herramientas de programación, la placa 4G y el lector RFID que usa el kit', K.A);
    await filaVideos(s, [
      ['ao42PLgavdo', 'instalación de PlatformIO en VS Code y primera grabación de un ESP32; en FuelGuard el proyecto ya está listo, solo se edita config.h', 'FIRMWARE'],
      ['qz8jcXVtNuY', 'la placa LILYGO T‑SIM7600G‑H: dónde va la SIM, las antenas LTE y GPS y cómo se alimenta; es el controlador del piloto', 'PLACA 4G'],
      ['l8RDbHd1cak', 'cómo se conecta el lector RDM6300 y cómo entrega el número del tag por serie; es el mismo lector que va en la pistola', 'LECTOR RFID'],
    ]);
  }

  // 9. Sección B
  seccion(pres, { letra: 'B', titulo: 'Montaje mecánico', subtitulo: 'Caudalímetro y electroválvula en la línea, sonda de nivel en el tanque, antena RFID en la pistola', datos: [['Dónde', 'Camión'], ['Tiempo', '2 – 3 horas'], ['Quién', 'Mecánico']] });

  // 10. B1 línea
  {
    const s = contenido(pres, 'Dónde va cada pieza', 'Intercalar caudalímetro y electroválvula en serie, después de la bomba y del filtro', K.B);
    imagen(s, 'diagrama-linea.png', { x: 0.6, y: 1.5, w: 12.1, h: 5.4, sombra: false });
  }

  // 11. B2 tres puntos delicados
  {
    const s = contenido(pres, 'Los tres puntos delicados', 'Marcos reservados para las fotos del piloto', K.B);
    const pasos = [
      ['FOTO 1 · Corte e inserción en la línea', 'Tramo recto y accesible después del filtro. Respetar la flecha de flujo. Sellar con teflón o sellador para hidrocarburos. Fijar al chasis: nunca colgado de la manguera.'],
      ['FOTO 2 · Sonda de nivel por la boca', 'Introducir hasta apoyar en el fondo, fijar el cable con prensaestopas en el tapón. Sin perforar ni soldar. Anotar el compartimento si hay rompeolas.'],
      ['FOTO 3 · Antena RFID en la boquilla', 'Bobina a 2–3 cm de la punta con abrazadera plástica, cubierta con resina epóxica. Cable en espiral protector junto a la manguera.'],
    ];
    pasos.forEach((p, i) => { const x = 0.6 + i * 4.12; marcoFoto(pres, s, { x, y: 1.55, w: 3.9, h: 2.8, etiqueta: p[0] }); tarjeta(pres, s, { x, y: 4.5, w: 3.9, h: 2.3, numero: i + 1, lineas: [{ text: p[1], options: { bullet: false } }], fontSize: 11.5 }); });
    pieNota(s, 'Prueba de fugas obligatoria antes de la etapa C: bomba encendida con la pistola cerrada, revisar todas las uniones.');
  }

  // 12. Videos B: caudalímetro y válvula
  {
    const s = contenido(pres, 'Videos de referencia · caudalímetro y electroválvula', 'Cómo son las piezas por dentro y cómo verificar que funcionan antes de montarlas', K.B);
    await filaVideos(s, [
      ['PkwhzUWP8uE', 'la familia de caudalímetros digitales Piusi (K600 incluido), la salida de pulsos y su ubicación en la línea después de la bomba', 'CAUDALÍMETRO'],
      ['OSs0oUbmIqM', 'cómo se abre el K600 Pulser y cómo son los engranajes ovales; sirve para el mantenimiento anual y para respetar el sentido de flujo', 'MANTENIMIENTO'],
      ['vkLoBfkcm_U', 'cómo comprobar con multímetro y alimentación que la bobina de una electroválvula abre y cierra; hágalo antes de roscarla', 'ELECTROVÁLVULA'],
    ]);
  }

  // 13. Videos B: nivel y RFID
  {
    const s = contenido(pres, 'Videos de referencia · sensor de nivel y RFID en la pistola', 'El principio de la sonda hidrostática y cómo se ve un lector RFID integrado en la pistola', K.B);
    await filaVideos(s, [
      ['oMFeT2PzwG0', 'cómo se instala y conecta una sonda de nivel sumergible 4–20 mA: cable ventilado, posición en el fondo y conexión al lazo', 'SENSOR DE NIVEL'],
      ['f8mnRFkr7Nc', 'el concepto que replica FuelGuard: tag en el cuello del tanque y lector en la pistola; la válvula solo abre con tag válido', 'RFID EN PISTOLA'],
      ['N6mRTJTVEbY', 'demostración del kit con pistola y tag: distancia de lectura y cómo se comporta al retirar la pistola', 'DEMOSTRACIÓN'],
    ]);
  }

  // 14. Sección C
  seccion(pres, { letra: 'C', titulo: 'Montaje eléctrico', subtitulo: 'Caja del controlador, alimentación protegida, ocho cables etiquetados y antenas en el techo', datos: [['Dónde', 'Camión'], ['Tiempo', '2 – 3 horas'], ['Quién', 'Electricista']] });

  // 15. C1 cableado
  {
    const s = contenido(pres, 'Conexiones al controlador', 'Ocho cables, todos etiquetados en ambos extremos', K.C);
    imagen(s, 'diagrama-cableado.png', { x: 0.6, y: 1.5, w: 12.1, h: 5.4, sombra: false });
  }

  // 16. C2 caja y antenas
  {
    const s = contenido(pres, 'Caja, alimentación y antenas', 'Marcos reservados para las fotos y el video del piloto', K.C);
    marcoFoto(pres, s, { x: 0.6, y: 1.55, w: 3.9, h: 2.8, etiqueta: 'FOTO 4 · Caja IP67 montada', descripcion: 'prensaestopas hacia abajo, lejos del escape' });
    marcoFoto(pres, s, { x: 4.72, y: 1.55, w: 3.9, h: 2.8, etiqueta: 'FOTO 5 · Interior cableado', descripcion: 'placa, relé, fuente, shunt en bornera, etiquetas' });
    marcoFoto(pres, s, { x: 8.84, y: 1.55, w: 3.9, h: 2.8, etiqueta: 'VIDEO PROPIO 2 · Encendido', descripcion: 'LED en línea y cisterna en el dashboard', video: true });
    tarjeta(pres, s, { x: 0.6, y: 4.5, w: 6.0, h: 2.3, titulo: 'Alimentación', icono: '🔋', lineas: ['12/24 V del vehículo con fusible de 3 A y supresor de transitorios', 'Convertidor DC‑DC a 5 V; negativo común al chasis', 'La bobina de la válvula se alimenta de 12/24 V a través del relé, con diodo'], fontSize: 11.5 });
    tarjeta(pres, s, { x: 6.8, y: 4.5, w: 5.94, h: 2.3, titulo: 'Antenas y señal', icono: '📡', lineas: ['LTE y GPS en el techo de la cabina, con vista al cielo y fuera del metal', 'Cables de señal apantallados, malla a GND solo en la caja', 'SIM M2M insertada y APN cargado en config.h'], fontSize: 11.5 });
  }

  // 17. Videos C
  {
    const s = contenido(pres, 'Videos de referencia · cableado en el vehículo', 'Alimentación con fusible, paso de cables y antenas: lo mismo que se hace al instalar un GPS o un sistema de control de combustible', K.C);
    await filaVideos(s, [
      ['QuZk-UYsifQ', 'cableado eléctrico de un sistema de control de combustible Piusi: alimentación, pulsos del contador y válvula; los mismos cuatro circuitos del kit', 'CABLEADO'],
      ['V94yF1DhnUU', 'cómo tomar 12/24 V del vehículo con fusible, dónde fijar la caja y cómo tender la antena de un rastreador; idéntico para el controlador', 'INSTALACIÓN EN VEHÍCULO'],
      ['qcmB7YRpoFw', 'cómo funciona una electroválvula y por qué la bobina se conecta a través de un relé con diodo de protección', 'ELECTROVÁLVULA'],
    ]);
  }

  // 18. Sección D
  seccion(pres, { letra: 'D', titulo: 'Tags en los equipos', subtitulo: 'Un tag anti‑metal en el cuello del tanque de cada máquina, registrado en el dashboard', datos: [['Dónde', 'Faena'], ['Tiempo', '5 min por equipo'], ['Quién', 'Técnico']] });

  // 19. D tags
  {
    const s = contenido(pres, 'Pegar, leer y registrar', 'La lectura del tag se hace con el mismo lector de la pistola', K.D);
    marcoFoto(pres, s, { x: 0.6, y: 1.55, w: 3.9, h: 2.8, etiqueta: 'FOTO 6 · Tag en el cuello del tanque', descripcion: 'donde apoya la boquilla al cargar' });
    imagen(s, 'dashboard-equipos.png', { x: 4.72, y: 1.55, w: 8.0, h: 5.0 });
    tarjeta(pres, s, { x: 0.6, y: 4.5, w: 3.9, h: 2.3, lineas: [{ text: '1. Desengrasar y pegar el tag anti‑metal (o fijar con abrazadera). Resina si recibe golpes.', options: { bullet: false } }, { text: '2. Leerlo con el lector: aparece en el monitor serie o como "tag no autorizado" en el dashboard.', options: { bullet: false } }, { text: '3. Equipos → Editar → Tag RFID. Carga corta de prueba.', options: { bullet: false } }], fontSize: 11 });
  }

  // 20. Sección E
  seccion(pres, { letra: 'E', titulo: 'Calibración y prueba final', subtitulo: 'Diez minutos que definen la precisión de todo el sistema, y el primer despacho real con el chofer', datos: [['Dónde', 'Camión'], ['Tiempo', '1 – 2 horas'], ['Quién', 'Técnico + chofer']] });

  // 21. E calibración
  {
    const s = contenido(pres, 'Calibración del caudalímetro y del sensor de nivel', 'Con recipiente patrón de 20 L y niveles conocidos del tanque', K.E);
    tarjeta(pres, s, { x: 0.6, y: 1.55, w: 5.95, h: 3.0, titulo: 'Caudalímetro', icono: '⏱️', color: C.naranjaTenue, colorTitulo: 'B5532C', lineas: ['Despachar tres veces a un recipiente patrón de 20 L', 'Si el sistema promedia 19,4 L:  K nuevo = K actual × 19,4 / 20', 'Regrabar config.h y anotar el K‑factor en la cisterna del dashboard', 'Objetivo: error menor al 0,5 %'], fontSize: 12.5 });
    tarjeta(pres, s, { x: 6.8, y: 1.55, w: 5.94, h: 3.0, titulo: 'Sensor de nivel', icono: '📏', lineas: ['Con el tanque a un nivel conocido anotar los litros reportados', 'Repetir en dos o tres niveles y cargar los puntos en LEVEL_TABLE', 'Tanque cilíndrico horizontal: tabla no lineal, al menos 7 puntos', 'Ajustar precision_nivel_pct en Parámetros a la precisión real'], fontSize: 12.5 });
    marcoFoto(pres, s, { x: 0.6, y: 4.7, w: 3.9, h: 2.1, etiqueta: 'VIDEO PROPIO 3 · Calibración', descripcion: 'con recipiente patrón', video: true });
    tarjeta(pres, s, { x: 4.72, y: 4.7, w: 8.02, h: 2.1, titulo: 'Geocerca, horario y precio', icono: '⚙️', color: C.verdeTenue, colorTitulo: '0A6F0A', lineas: ['Administración → Parámetros: coordenadas del proyecto y radio (3 km por defecto), horario permitido, precio por litro', 'Con la precisión del sensor bien configurada, las conciliaciones no generan falsas alarmas'], fontSize: 12 });
  }

  // 22. Videos E
  {
    const s = contenido(pres, 'Videos de referencia · calibración del K600', 'El procedimiento del fabricante con recipiente patrón; en FuelGuard el ajuste se hace en el K‑factor del firmware en lugar del display', K.E);
    await filaVideos(s, [
      ['DmYBOnf2ark', 'el procedimiento oficial de Piusi: despacho a recipiente patrón, lectura y corrección; anote la cifra y aplique la fórmula del K‑factor', 'PIUSI'],
      ['Ks_KHxz97NM', 'la misma calibración explicada por un distribuidor, con consejos sobre caudal estable y purga de aire antes de medir', 'DISTRIBUIDOR'],
    ]);
    tarjeta(pres, s, { x: 8.84, y: 1.55, w: 3.9, h: 4.95, titulo: 'Regla del 0,5 %', icono: '🎯', color: C.verdeTenue, colorTitulo: '0A6F0A', lineas: ['Tres despachos de 20 L, no uno', 'Caudal normal de trabajo, sin aire en la línea', 'Mismo combustible que en operación', 'Repetir tras cualquier cambio de manguera o bomba', 'Anotar K‑factor y fecha en la carpeta del vehículo'], fontSize: 12 });
  }

  // 23. Prueba final
  {
    const s = contenido(pres, 'Prueba final con el chofer', 'El despacho completo, tal como se hará cada día', K.E);
    imagen(s, 'chofer-inicio.png', { x: 0.6, y: 1.55, w: 3.2, h: 5.12 });
    imagen(s, 'chofer-ticket.png', { x: 4.0, y: 1.55, w: 3.2, h: 5.12 });
    tarjeta(pres, s, { x: 7.4, y: 1.55, w: 5.3, h: 5.12, titulo: 'Secuencia de aceptación', lineas: [{ text: '1. Leer tag → "autorizado" y litros subiendo en vivo', options: { bullet: false } }, { text: '2. Retirar la pistola → cierre automático', options: { bullet: false } }, { text: '3. Confirmar con horómetro y firma → imprimir ticket', options: { bullet: false } }, { text: '4. Verificar registro y hash en el dashboard', options: { bullet: false } }, { text: '5. Tag desconocido → válvula bloqueada y alerta', options: { bullet: false } }, { text: '6. Sin antena LTE → despacho con lista local → reconectar → se sincroniza con su hora original', options: { bullet: false } }, { text: '7. Registrar una recarga desde la tablet', options: { bullet: false } }], fontSize: 12 });
  }

  // 24. Problemas frecuentes
  {
    const s = contenido(pres, 'Dónde suele complicarse y cómo resolverlo', undefined, 'SOPORTE');
    tabla(pres, s, [
      ['Problema', 'Causa habitual', 'Solución'],
      ['El tag no se lee o se pierde al mover la pistola', 'Tag común sobre metal; antena mal orientada', 'Tag anti‑metal Ø 30–50 mm; antena paralela al tag a 2–3 cm; probar en mesa'],
      ['La válvula no abre aunque el relé cierra', 'Válvula servoasistida con bomba de baja presión; bobina de otra tensión', 'Válvula de acción directa (presión mínima 0 bar); bobina 12 o 24 V según el camión'],
      ['Litros erráticos o pulsos con la bomba apagada', 'Ruido eléctrico del vehículo', 'Cable apantallado con malla a GND solo en la caja; FLOW_DEBOUNCE_US más alto; optoacoplador'],
      ['Nivel que oscila ±50 L', 'Combustible en movimiento con el motor en marcha', 'Normal: el sistema tolera la precisión configurada; conciliaciones con el camión detenido'],
      ['Sin cobertura 4G en el tajo', 'Zona sin señal', 'Despacha con lista blanca local y sincroniza al recuperar señal; WiFi en el punto de recarga si nunca hay señal'],
      ['El dashboard no ve la cisterna', 'Clave de dispositivo o APN incorrectos', 'Revisar DEVICE_KEY y GSM_APN; el monitor serie muestra el error exacto'],
    ], { x: 0.6, y: 1.4, w: 12.1, colW: [3.4, 3.6, 5.1], fontSize: 11, alto: 0.7 });
  }

  // 25. Checklist
  {
    const s = contenido(pres, 'Lista de entrega', 'La instalación se da por aceptada cuando se cumplen los nueve puntos', 'ACEPTACIÓN');
    const items = ['Cisterna en línea en el dashboard con posición GPS', 'Tres despachos de calibración con error menor al 0,5 %', 'Tabla de aforo cargada y nivel coherente con la varilla', 'Todos los equipos con tag registrado y leídos al menos una vez', 'Bloqueo con tag desconocido comprobado', 'Despacho sin señal sincronizado correctamente', 'Chofer capacitado: despacho, firma, ticket, recarga, manual de contingencia', 'Supervisor capacitado: alertas, reportes, cierre de alertas con nota', 'Copia de config.h, K‑factor y aforo en la carpeta del vehículo'];
    items.forEach((t, i) => { const col = i % 2, fila = Math.floor(i / 2); const x = 0.6 + col * 6.2, y = 1.55 + fila * 1.05; s.addShape(pres.ShapeType.roundRect, { x, y, w: 5.9, h: 0.9, fill: { color: C.tinta }, rectRadius: 0.12, line: { color: C.tinta } }); s.addShape(pres.ShapeType.rect, { x: x + 0.25, y: y + 0.25, w: 0.4, h: 0.4, fill: { color: C.white }, line: { color: C.navy, width: 1.5 } }); s.addText(t, T({ x: x + 0.85, y, w: 4.9, h: 0.9, fontSize: 13, color: C.ink, fontFace: F.cuerpo, valign: 'middle' })); });
  }

  // 26. Registro del piloto
  {
    const s = contenido(pres, 'Registro fotográfico y en video del piloto', 'Qué capturar durante la primera instalación para completar esta guía con material propio', 'DOCUMENTACIÓN');
    tarjeta(pres, s, { x: 0.6, y: 1.55, w: 5.95, h: 5.25, titulo: 'Fotos (una por marco de esta guía)', icono: '📷', lineas: ['1 · Corte e inserción del caudalímetro y la válvula en la línea', '2 · Sonda de nivel entrando por la boca de inspección', '3 · Antena RFID fijada en la boquilla', '4 · Caja IP67 montada en el camión', '5 · Interior de la caja cableado y etiquetado', '6 · Tag pegado en el cuello del tanque de un equipo', 'Extra: antenas en el techo, kit completo desembalado'], fontSize: 12.5 });
    tarjeta(pres, s, { x: 6.8, y: 1.55, w: 5.94, h: 5.25, titulo: 'Videos propios (1 a 3 minutos, horizontal)', icono: '🎥', color: C.naranjaTenue, colorTitulo: 'B5532C', lineas: ['1 · Prueba en mesa: tag, pulsador, cierre', '2 · Encendido y primera conexión al dashboard', '3 · Calibración con recipiente patrón de 20 L', '4 · Despacho completo con firma y ticket (para capacitar choferes)', '5 · Bloqueo con tag desconocido (para mostrar al cliente)', 'Subirlos a un canal de YouTube no listado y reemplazar los marcos de esta guía con sus enlaces y QR'], fontSize: 12.5 });
  }

  // 27. Cierre
  portada(pres, { kicker: 'SOPORTE', titulo: '¿Dudas durante la instalación?', subtitulo: 'Guía detallada: docs/INSTALACION_PASO_A_PASO.md · conexiones y calibración: firmware/README.md', pie: 'Edison Zavala · [correo] · [teléfono]', imagen: { archivo: 'diagrama-linea.png', leyenda: 'Diagrama de la línea de combustible' } });

  const salida = path.join(__dirname, '..', 'FuelGuard-Guia-Instalacion.pptx');
  await pres.writeFile({ fileName: salida });
  console.log('OK', salida);
})().catch(e => { console.error(e); process.exit(1); });
