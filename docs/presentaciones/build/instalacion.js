// Presentación de instalación paso a paso en la cisterna.
'use strict';
const pptxgen = require('pptxgenjs');
const path = require('node:path');
const { C, F, nuevaPresentacion, portada, contenido, tarjeta, marcoFoto, imagen, tabla, pieNota } = require('./comun');

const pres = nuevaPresentacion(pptxgen, 'FuelGuard · Guía de instalación');
const fecha = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

// 1. Portada
portada(pres, { kicker: 'GUÍA DE INSTALACIÓN', titulo: 'Instalación del kit FuelGuard en la cisterna', subtitulo: 'Paso a paso mecánico, eléctrico y de puesta en marcha · un día de trabajo para dos personas', pie: fecha });

// 2. Resumen de etapas (línea de tiempo)
{
  const s = contenido(pres, 'Cinco etapas, un día de trabajo', 'No hace falta programar: el firmware está hecho y solo se edita un archivo de configuración');
  const etapas = [
    ['A', 'Preparación y prueba en mesa', 'Oficina · 2–3 h', 'Técnico', C.navy],
    ['B', 'Montaje mecánico', 'Camión · 2–3 h', 'Mecánico', 'B5532C'],
    ['C', 'Montaje eléctrico', 'Camión · 2–3 h', 'Electricista', 'B5532C'],
    ['D', 'Tags en los equipos', 'Faena · 5 min por equipo', 'Técnico', '0A6F0A'],
    ['E', 'Calibración y prueba final', 'Camión · 1–2 h', 'Técnico + chofer', C.navy],
  ];
  s.addShape(pres.ShapeType.line, { x: 1.4, y: 2.75, w: 10.6, h: 0, line: { color: C.lineas, width: 3 } });
  etapas.forEach((e, i) => {
    const x = 0.6 + i * 2.5;
    s.addShape(pres.ShapeType.ellipse, { x: x + 0.75, y: 2.35, w: 0.8, h: 0.8, fill: { color: e[4] }, line: { color: e[4] } });
    s.addText(e[0], { x: x + 0.75, y: 2.35, w: 0.8, h: 0.8, fontSize: 22, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: F.titulo, isTextBox: true, margin: 0 });
    s.addText(e[1], { x, y: 3.3, w: 2.3, h: 0.7, fontSize: 14, bold: true, color: C.ink, align: 'center', fontFace: F.titulo, isTextBox: true, margin: 0, valign: 'top' });
    s.addText(e[2] + '\n' + e[3], { x, y: 4.0, w: 2.3, h: 0.7, fontSize: 11, color: C.gris, align: 'center', fontFace: F.cuerpo, isTextBox: true, margin: 0, valign: 'top' });
  });
  tarjeta(pres, s, { x: 0.6, y: 5.0, w: 5.9, h: 1.8, titulo: 'Quién hace qué', icono: '👷', lineas: ['Mecánico o gásfiter industrial: línea de combustible y sensor de nivel', 'Electricista o técnico automotriz: caja, cableado y antenas', 'Técnico de FuelGuard: firmware, tags, calibración y capacitación'], fontSize: 12 });
  tarjeta(pres, s, { x: 6.8, y: 5.0, w: 5.9, h: 1.8, titulo: 'Antes de ir al camión', icono: '✅', color: C.verdeTenue, colorTitulo: '0A6F0A', lineas: ['Kit completo recibido y verificado (K‑factor, tensión de bobina, rango del sensor)', 'Cisterna creada en el dashboard con su clave de dispositivo', 'Prueba en mesa aprobada: tag → despacho → cierre'], fontSize: 12 });
}

// 3. Materiales
{
  const s = contenido(pres, 'Kit estándar por cisterna', 'Lista de compra con proveedores en docs/LISTA_DE_COMPRA_PILOTO.md');
  tarjeta(pres, s, { x: 0.6, y: 1.5, w: 4.0, h: 5.3, titulo: 'Línea de combustible', icono: '🔧', color: C.naranjaTenue, colorTitulo: 'B5532C', lineas: ['Caudalímetro de pulsos 1½" (Piusi K600/4) con hoja de K‑factor', 'Electroválvula NC 1½", 12/24 V, sello Viton', 'Pistola automática (si la actual no lo es)', 'Niples, uniones, teflón y sellador para hidrocarburos', 'Abrazaderas y soportes'], fontSize: 12 });
  tarjeta(pres, s, { x: 4.75, y: 1.5, w: 4.0, h: 5.3, titulo: 'Electrónica', icono: '🔌', lineas: ['Controlador ESP32 + 4G + GPS (LILYGO T‑SIM7600G‑H)', 'Lector RFID RDM6300 y bobina de antena', 'Sensor de nivel hidrostático 4–20 mA', 'Módulo relé 5 V, fuente DC‑DC 24→5 V 3 A, shunt 150 Ω', 'Antenas LTE y GPS, SIM M2M', 'Caja IP67, prensaestopas, fusible 3 A, supresor'], fontSize: 12 });
  tarjeta(pres, s, { x: 8.9, y: 1.5, w: 3.8, h: 2.55, titulo: 'Por equipo', icono: '🏷️', color: C.verdeTenue, colorTitulo: '0A6F0A', lineas: ['Tag RFID anti‑metal 125 kHz', 'Desengrasante y resina epóxica'], fontSize: 12 });
  tarjeta(pres, s, { x: 8.9, y: 4.25, w: 3.8, h: 2.55, titulo: 'Herramientas', icono: '🧰', lineas: ['Llaves de tubo, cortatubos, terraja 1½"', 'Multímetro, crimpadora, etiquetadora', 'Recipiente patrón de 20 L', 'Notebook con PlatformIO y cable USB'], fontSize: 12 });
}

// 4. Etapa A.1: dashboard
{
  const s = contenido(pres, 'A · Preparación: dar de alta la cisterna y los equipos', 'Se hace en la oficina, antes de tocar el camión');
  imagen(s, 'dashboard-admin.png', { x: 0.6, y: 1.5, w: 7.9, h: 4.93 });
  tarjeta(pres, s, { x: 8.8, y: 1.5, w: 3.9, h: 4.93, titulo: 'Pasos', lineas: [{ text: '1. Administración → Cisternas → Nueva cisterna. Anote la clave de dispositivo: se muestra una sola vez.', options: { bullet: false } }, { text: '2. Equipos → Nuevo equipo: código, capacidad del tanque y consumo nominal en L/h.', options: { bullet: false } }, { text: '3. Usuarios: chofer asignado a la cisterna y operadores de cada equipo.', options: { bullet: false } }, { text: '4. Parámetros: geocerca, horario y precio del litro.', options: { bullet: false } }], fontSize: 12 });
  pieNota(s, 'El tag RFID de cada equipo se completa en la etapa D, cuando se lee con el lector.');
}

// 5. Etapa A.2: firmware
{
  const s = contenido(pres, 'A · Configurar y grabar el firmware', 'Un archivo de configuración y un comando');
  s.addShape(pres.ShapeType.roundRect, { x: 0.6, y: 1.5, w: 6.4, h: 4.2, fill: { color: '1B1B1B' }, rectRadius: 0.1, line: { color: '1B1B1B' } });
  const cfg = ['// firmware/include/config.h', '#define DEVICE_KEY   "dev-cist-01-8f3a…"  // dashboard', '#define SERVER_HOST  "combustible.miempresa.com"', '#define SERVER_PORT  443', '#define SERVER_TLS   1', '#define GSM_APN      "m2m.entel.cl"       // según SIM', '#define K_FACTOR_PULSES_PER_L  100.0f  // hoja', '#define TANK_CAPACITY_L        10000.0f', '#define LEVEL_TABLE {{0,0},{50,5000},{100,10000}}', '', '// grabar y ver el monitor', 'pio run -e esp32-sim7600 -t upload', 'pio device monitor -b 115200'];
  s.addText(cfg.map((l, i) => ({ text: l, options: { breakLine: i < cfg.length - 1, color: l.startsWith('//') ? '8A8F96' : l.startsWith('pio') ? '9BE79B' : 'E8E8E8' } })), { x: 0.8, y: 1.65, w: 6.0, h: 3.9, fontSize: 11, fontFace: 'Courier New', isTextBox: true, margin: 0, valign: 'top' });
  tarjeta(pres, s, { x: 7.3, y: 1.5, w: 5.4, h: 4.2, titulo: 'Qué comprobar en el monitor serie', icono: '🖥️', lineas: ['"heartbeat ok, señal N" → el controlador llegó al servidor', 'En el dashboard la cisterna pasa a "en línea" con posición GPS', 'LED: parpadeo lento = en línea, rápido = sin señal', 'Si no conecta: revisar DEVICE_KEY, APN y antena LTE'], fontSize: 12 });
  tarjeta(pres, s, { x: 0.6, y: 5.9, w: 12.1, h: 0.9, titulo: undefined, lineas: [{ text: 'PlatformIO se instala con  pip install platformio . Compilación verificada para las dos variantes: esp32-wifi (banco de pruebas) y esp32-sim7600 (producción).', options: { bullet: false } }], fontSize: 12, color: C.verdeTenue });
}

// 6. Etapa A.3: prueba en mesa
{
  const s = contenido(pres, 'A · Prueba en mesa: el sistema completo sin el camión', 'Si esto funciona, el 80 % del riesgo de la instalación queda resuelto');
  imagen(s, 'diagrama-mesa.png', { x: 0.6, y: 1.5, w: 8.4, h: 3.25, sombra: false });
  marcoFoto(pres, s, { x: 9.3, y: 1.5, w: 3.4, h: 3.25, etiqueta: 'VIDEO 1 · Prueba en mesa (2 min)', descripcion: 'Tag → autorizado en la tablet → pulsador → litros suben → retirar tag → despacho cerrado', video: true });
  tarjeta(pres, s, { x: 0.6, y: 4.95, w: 6.0, h: 1.85, titulo: 'Probar los tags anti‑metal aquí', icono: '🏷️', color: C.naranjaTenue, colorTitulo: 'B5532C', lineas: ['Pegar uno sobre una plancha de acero', 'Lectura estable a 2–3 cm; pérdida en menos de 1 s al alejar la antena', 'Si falla: tag más grande o antena reubicada, antes de comprar el lote'], fontSize: 12 });
  tarjeta(pres, s, { x: 6.8, y: 4.95, w: 5.9, h: 1.85, titulo: 'Resultado esperado', icono: '✅', color: C.verdeTenue, colorTitulo: '0A6F0A', lineas: ['Despacho en el historial del dashboard con hash', 'Alerta "tag no autorizado" al acercar un tag desconocido', 'Confirmación con firma desde la tablet'], fontSize: 12 });
}

// 7. Etapa B.1: línea de combustible
{
  const s = contenido(pres, 'B · Montaje mecánico: dónde va cada pieza', 'Intercalar caudalímetro y electroválvula en serie después de la bomba y el filtro');
  imagen(s, 'diagrama-linea.png', { x: 0.6, y: 1.45, w: 12.1, h: 5.4, sombra: false });
}

// 8. Etapa B.2: detalles mecánicos con fotos
{
  const s = contenido(pres, 'B · Montaje mecánico: los tres puntos delicados', 'Registro fotográfico del piloto');
  const pasos = [
    ['FOTO 1 · Corte e inserción en la línea', 'Tramo recto y accesible después del filtro. Respetar la flecha de flujo. Sellar con teflón o sellador para hidrocarburos. Fijar al chasis: nunca colgado de la manguera.'],
    ['FOTO 2 · Sonda de nivel por la boca', 'Introducir hasta apoyar en el fondo, fijar el cable con prensaestopas en el tapón. Sin perforar ni soldar. Anotar el compartimento si hay rompeolas.'],
    ['FOTO 3 · Antena RFID en la boquilla', 'Bobina a 2–3 cm de la punta con abrazadera plástica, cubierta con resina epóxica. Cable en espiral protector junto a la manguera.'],
  ];
  pasos.forEach((p, i) => { const x = 0.6 + i * 4.1; marcoFoto(pres, s, { x, y: 1.5, w: 3.9, h: 2.9, etiqueta: p[0] }); tarjeta(pres, s, { x, y: 4.55, w: 3.9, h: 2.25, lineas: [{ text: p[1], options: { bullet: false } }], fontSize: 12 }); });
  pieNota(s, 'Prueba de fugas obligatoria antes de la etapa C: bomba encendida con la pistola cerrada, revisar todas las uniones.');
}

// 9. Etapa C.1: cableado
{
  const s = contenido(pres, 'C · Montaje eléctrico: conexiones al controlador', 'Ocho cables, todos etiquetados en ambos extremos');
  imagen(s, 'diagrama-cableado.png', { x: 0.6, y: 1.45, w: 12.1, h: 5.4, sombra: false });
}

// 10. Etapa C.2: caja y antenas
{
  const s = contenido(pres, 'C · Caja, alimentación y antenas', 'Registro fotográfico del piloto');
  marcoFoto(pres, s, { x: 0.6, y: 1.5, w: 3.9, h: 2.9, etiqueta: 'FOTO 4 · Caja IP67 montada', descripcion: 'prensaestopas hacia abajo, lejos del escape' });
  marcoFoto(pres, s, { x: 4.7, y: 1.5, w: 3.9, h: 2.9, etiqueta: 'FOTO 5 · Interior cableado', descripcion: 'placa, relé, fuente, shunt en bornera, etiquetas' });
  marcoFoto(pres, s, { x: 8.8, y: 1.5, w: 3.9, h: 2.9, etiqueta: 'VIDEO 2 · Encendido y primera conexión', descripcion: 'LED en línea y cisterna en el dashboard', video: true });
  tarjeta(pres, s, { x: 0.6, y: 4.55, w: 5.9, h: 2.25, titulo: 'Alimentación', icono: '🔋', lineas: ['12/24 V del vehículo con fusible de 3 A y supresor de transitorios', 'Convertidor DC‑DC a 5 V; negativo común al chasis', 'La bobina de la válvula se alimenta directo de 12/24 V a través del relé, con diodo'], fontSize: 12 });
  tarjeta(pres, s, { x: 6.8, y: 4.55, w: 5.9, h: 2.25, titulo: 'Antenas y señal', icono: '📡', lineas: ['LTE y GPS en el techo de la cabina, con vista al cielo y fuera del metal', 'Cables de señal apantallados, malla a GND solo en la caja', 'SIM M2M insertada y APN cargado en config.h'], fontSize: 12 });
}

// 11. Etapa D: tags
{
  const s = contenido(pres, 'D · Tags en los equipos', 'Cinco minutos por máquina');
  marcoFoto(pres, s, { x: 0.6, y: 1.5, w: 3.9, h: 2.9, etiqueta: 'FOTO 6 · Tag en el cuello del tanque', descripcion: 'donde apoya la boquilla al cargar' });
  imagen(s, 'dashboard-equipos.png', { x: 4.7, y: 1.5, w: 8.0, h: 5.0 });
  tarjeta(pres, s, { x: 0.6, y: 4.55, w: 3.9, h: 2.25, lineas: [{ text: '1. Desengrasar y pegar el tag anti‑metal (o fijar con abrazadera). Resina si recibe golpes.', options: { bullet: false } }, { text: '2. Leerlo con el lector: aparece en el monitor serie o como "tag no autorizado" en el dashboard.', options: { bullet: false } }, { text: '3. Equipos → Editar → Tag RFID. Carga corta de prueba.', options: { bullet: false } }], fontSize: 11.5 });
}

// 12. Etapa E: calibración
{
  const s = contenido(pres, 'E · Calibración', 'Diez minutos que definen la precisión de todo el sistema');
  tarjeta(pres, s, { x: 0.6, y: 1.5, w: 5.9, h: 3.0, titulo: 'Caudalímetro', icono: '⏱️', color: C.naranjaTenue, colorTitulo: 'B5532C', lineas: ['Despachar tres veces a un recipiente patrón de 20 L', 'Si el sistema promedia 19,4 L:  K nuevo = K actual × 19,4 / 20', 'Regrabar config.h y anotar el K‑factor en la cisterna del dashboard', 'Objetivo: error menor al 0,5 %'], fontSize: 12.5 });
  tarjeta(pres, s, { x: 6.8, y: 1.5, w: 5.9, h: 3.0, titulo: 'Sensor de nivel', icono: '📏', lineas: ['Con el tanque a un nivel conocido (varilla o guía de carga) anotar los litros reportados', 'Repetir en dos o tres niveles y cargar los puntos en LEVEL_TABLE', 'Tanque cilíndrico horizontal: tabla no lineal, al menos 7 puntos', 'Ajustar precision_nivel_pct en Parámetros a la precisión real'], fontSize: 12.5 });
  marcoFoto(pres, s, { x: 0.6, y: 4.7, w: 3.9, h: 2.1, etiqueta: 'VIDEO 3 · Calibración con recipiente patrón', video: true });
  tarjeta(pres, s, { x: 4.7, y: 4.7, w: 8.0, h: 2.1, titulo: 'Geocerca, horario y precio', icono: '⚙️', color: C.verdeTenue, colorTitulo: '0A6F0A', lineas: ['Administración → Parámetros: coordenadas del proyecto y radio (3 km por defecto), horario permitido, precio por litro', 'Con la precisión del sensor bien configurada, las conciliaciones no generan falsas alarmas'], fontSize: 12 });
}

// 13. Prueba final
{
  const s = contenido(pres, 'E · Prueba final con el chofer', 'El despacho completo, tal como se hará cada día');
  imagen(s, 'chofer-inicio.png', { x: 0.6, y: 1.5, w: 3.2, h: 5.12 });
  imagen(s, 'chofer-ticket.png', { x: 4.0, y: 1.5, w: 3.2, h: 5.12 });
  tarjeta(pres, s, { x: 7.4, y: 1.5, w: 5.3, h: 5.12, titulo: 'Secuencia de aceptación', lineas: [{ text: '1. Leer tag → la tablet muestra "autorizado" y los litros suben en vivo', options: { bullet: false } }, { text: '2. Retirar la pistola → cierre automático', options: { bullet: false } }, { text: '3. Confirmar con horómetro y firma → imprimir ticket', options: { bullet: false } }, { text: '4. Verificar el registro y el hash en el dashboard', options: { bullet: false } }, { text: '5. Tag desconocido → válvula bloqueada y alerta', options: { bullet: false } }, { text: '6. Quitar antena LTE → despacho con lista local → reconectar → se sincroniza con su hora original', options: { bullet: false } }, { text: '7. Registrar una recarga desde la tablet', options: { bullet: false } }], fontSize: 12 });
}

// 14. Problemas frecuentes
{
  const s = contenido(pres, 'Dónde suele complicarse y cómo resolverlo');
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

// 15. Checklist
{
  const s = contenido(pres, 'Lista de entrega', 'La instalación se da por aceptada cuando se cumplen los nueve puntos');
  const items = ['Cisterna en línea en el dashboard con posición GPS', 'Tres despachos de calibración con error menor al 0,5 %', 'Tabla de aforo cargada y nivel coherente con la varilla', 'Todos los equipos con tag registrado y leídos al menos una vez', 'Bloqueo con tag desconocido comprobado', 'Despacho sin señal sincronizado correctamente', 'Chofer capacitado: despacho, firma, ticket, recarga, manual de contingencia', 'Supervisor capacitado: alertas, reportes, cierre de alertas con nota', 'Copia de config.h, K‑factor y aforo en la carpeta del vehículo'];
  items.forEach((t, i) => { const col = i % 2, fila = Math.floor(i / 2); const x = 0.6 + col * 6.2, y = 1.5 + fila * 1.05; s.addShape(pres.ShapeType.roundRect, { x, y, w: 5.9, h: 0.9, fill: { color: C.tinta }, rectRadius: 0.1, line: { color: C.tinta } }); s.addShape(pres.ShapeType.rect, { x: x + 0.25, y: y + 0.25, w: 0.4, h: 0.4, fill: { color: C.white }, line: { color: C.navy, width: 1.5 } }); s.addText(t, { x: x + 0.85, y, w: 4.9, h: 0.9, fontSize: 13, color: C.ink, fontFace: F.cuerpo, isTextBox: true, margin: 0, valign: 'middle' }); });
}

// 16. Registro fotográfico del piloto
{
  const s = contenido(pres, 'Registro fotográfico y en video del piloto', 'Qué capturar durante la primera instalación para completar esta guía y la capacitación');
  tarjeta(pres, s, { x: 0.6, y: 1.5, w: 5.9, h: 5.3, titulo: 'Fotos (una por marco de esta guía)', icono: '📷', lineas: ['1 · Corte e inserción del caudalímetro y la válvula en la línea', '2 · Sonda de nivel entrando por la boca de inspección', '3 · Antena RFID fijada en la boquilla', '4 · Caja IP67 montada en el camión', '5 · Interior de la caja cableado y etiquetado', '6 · Tag pegado en el cuello del tanque de un equipo', 'Extra: antenas en el techo, kit completo desembalado'], fontSize: 12.5 });
  tarjeta(pres, s, { x: 6.8, y: 1.5, w: 5.9, h: 5.3, titulo: 'Videos cortos (1 a 3 minutos, horizontal)', icono: '🎥', color: C.naranjaTenue, colorTitulo: 'B5532C', lineas: ['1 · Prueba en mesa: tag, pulsador, cierre', '2 · Encendido y primera conexión al dashboard', '3 · Calibración con recipiente patrón de 20 L', '4 · Despacho completo con firma y ticket (para capacitar choferes)', '5 · Bloqueo con tag desconocido (para mostrar al cliente)', 'Guardar en la carpeta docs/presentaciones/media y reemplazar los marcos de esta guía'], fontSize: 12.5 });
}

// 17. Cierre
portada(pres, { kicker: 'SOPORTE', titulo: '¿Dudas durante la instalación?', subtitulo: 'Guía detallada: docs/INSTALACION_PASO_A_PASO.md · conexiones y calibración: firmware/README.md', pie: 'Edison Zavala · [correo] · [teléfono]' });

const salida = path.join(__dirname, '..', 'FuelGuard-Guia-Instalacion.pptx');
pres.writeFile({ fileName: salida }).then(() => console.log('OK', salida));
