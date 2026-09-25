// Presentación comercial: planes por nivel de funcionalidad y tipo de solución.
'use strict';
const pptxgen = require('pptxgenjs');
const path = require('node:path');
const { C, F, nuevaPresentacion, portada, contenido, tarjeta, indicador, imagen, tabla, pieNota } = require('./comun');

const pres = nuevaPresentacion(pptxgen, 'FuelGuard · Planes comerciales');
const fecha = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

// 1. Portada
portada(pres, { kicker: 'PROPUESTA COMERCIAL', titulo: 'Control automatizado de combustible para cisternas y equipos', subtitulo: 'Planes por nivel de funcionalidad y tipo de solución', pie: fecha });

// 2. El problema
{
  const s = contenido(pres, 'El combustible es el gasto que menos se controla', 'Cuando el despacho se anota en un vale de papel, nadie sabe cuánto se perdió');
  indicador(pres, s, { x: 0.6, y: 1.6, w: 3.9, valor: '5 % a 15 %', etiqueta: 'del combustible comprado se pierde', sub: 'robo directo, bidones, vales inflados, sifoneo', color: C.rojo, fondo: 'FDECEC' });
  indicador(pres, s, { x: 4.7, y: 1.6, w: 3.9, valor: 'USD 3 600 – 10 800', etiqueta: 'al mes en una flota de 60 000 L', sub: 'a USD 1,20 por litro', color: C.rojo, fondo: 'FDECEC' });
  indicador(pres, s, { x: 8.8, y: 1.6, w: 3.9, valor: '0 evidencia', etiqueta: 'con vale de papel', sub: 'no hay cómo probar quién, cuánto ni cuándo', color: C.rojo, fondo: 'FDECEC' });
  tarjeta(pres, s, { x: 0.6, y: 3.3, w: 5.9, h: 3.3, titulo: 'Cómo se pierde hoy', icono: '🕳️', lineas: ['Despachos a vehículos ajenos o a bidones "de paso"', 'Litros inflados en el vale: el equipo recibió menos de lo anotado', 'Extracción directa de la cisterna estacionada de noche', 'Manguera paralela que evita el contador', 'Sifoneo del tanque del equipo en el turno', 'El proveedor entrega menos que la guía de remisión'], fontSize: 13 });
  tarjeta(pres, s, { x: 6.8, y: 3.3, w: 5.9, h: 3.3, titulo: 'Qué cambia con FuelGuard', icono: '🛡️', color: C.verdeTenue, colorTitulo: '0A6F0A', lineas: ['Sin tag válido la válvula no abre: nadie carga fuera de la lista', 'Cada litro lo mide el caudalímetro, no una persona', 'El sensor de nivel avisa si la cisterna baja sin despacho', 'Firma del operador en la tablet y ticket con hash', 'Alertas en el celular del supervisor en segundos', 'Reporte de merma automático cada mañana'], fontSize: 13 });
}

// 3. Cómo funciona
{
  const s = contenido(pres, 'Cómo funciona', 'Todo el proceso es automático: el chofer solo acerca la pistola al tanque');
  imagen(s, 'diagrama-arquitectura.png', { x: 0.6, y: 1.5, w: 12.1, h: 5.3, sombra: false });
}

// 4. Qué detecta
{
  const s = contenido(pres, 'Doce reglas que vigilan cada litro', 'Cada alerta indica el dato exacto que la disparó y queda en la auditoría');
  const items = [
    ['🔖', 'Tag no autorizado', 'La válvula no abre. Queda registrado el intento con hora y GPS'],
    ['📍', 'Fuera de la geocerca', 'Despachos fuera de la obra bloqueados (venta en ruta)'],
    ['⏰', 'Fuera de horario', 'Cargas nocturnas o en días no permitidos'],
    ['🛑', 'Sobrellenado', 'Corte automático al superar la capacidad del tanque'],
    ['📉', 'Merma en cisterna', 'El nivel baja sin despacho: robo directo'],
    ['🔁', 'Bypass del caudalímetro', 'La cisterna bajó más de lo que midió el contador'],
    ['⛽', 'Sifoneo del equipo', 'Consumo por hora muy superior al nominal'],
    ['🚚', 'Recarga incompleta', 'El proveedor entregó menos que la guía'],
    ['📵', 'Sin señal', 'Cierre seguro del despacho y reenvío al recuperar cobertura'],
  ];
  items.forEach((it, i) => { const col = i % 3, fila = Math.floor(i / 3); tarjeta(pres, s, { x: 0.6 + col * 4.1, y: 1.6 + fila * 1.75, w: 3.9, h: 1.55, icono: it[0], titulo: it[1], lineas: [it[2]], bullets: false, fontSize: 12 }); });
  pieNota(s, 'Además: equipo inactivo, caudal anómalo (manipulación del sensor), despacho repetido y despacho manual de contingencia.');
}

// 5. Dashboard
{
  const s = contenido(pres, 'Dashboard en tiempo real', 'Cada rol ve lo suyo: gerencia, supervisor, chofer y operador');
  imagen(s, 'dashboard-panel.png', { x: 0.6, y: 1.5, w: 8.6, h: 5.37 });
  tarjeta(pres, s, { x: 9.5, y: 1.5, w: 3.2, h: 5.37, titulo: 'En pantalla', lineas: ['Litros del día y del mes con costo', 'Merma detectada y su costo', 'Stock de cada cisterna', 'Despachos llenándose en vivo, litro a litro', 'Alertas con botón de resolución', 'Consumo por equipo y por operador', 'Historial con hash de integridad y firma'], fontSize: 12 });
}

// 6. App del chofer
{
  const s = contenido(pres, 'App del chofer en la tablet del camión', 'Instalable, funciona sin cobertura y sincroniza sola');
  imagen(s, 'chofer-inicio.png', { x: 0.6, y: 1.5, w: 3.2, h: 5.12 });
  imagen(s, 'chofer-confirmar.png', { x: 4.0, y: 1.5, w: 3.2, h: 5.12 });
  imagen(s, 'chofer-ticket.png', { x: 7.4, y: 1.5, w: 3.2, h: 5.12 });
  tarjeta(pres, s, { x: 10.8, y: 1.5, w: 1.95, h: 5.12, titulo: 'Incluye', lineas: ['Despacho en vivo', 'Bloqueos con motivo', 'Firma del operador', 'Horómetro', 'Ticket 58 mm', 'Recargas', 'Manual de contingencia', 'Cola sin señal'], fontSize: 11 });
}

// 7. Reportes
{
  const s = contenido(pres, 'Reportes y comparativa de merma', 'Excel con siete hojas, PDF ejecutivo y envío automático por correo');
  imagen(s, 'dashboard-reportes.png', { x: 0.6, y: 1.5, w: 8.6, h: 5.37 });
  tarjeta(pres, s, { x: 9.5, y: 1.5, w: 3.2, h: 2.55, titulo: 'Períodos', lineas: ['Hoy, ayer, 7 días', 'Semana y mes anteriores', 'Fechas libres'], fontSize: 12 });
  tarjeta(pres, s, { x: 9.5, y: 4.25, w: 3.2, h: 2.62, titulo: 'Automático', lineas: ['Diario a las 6:00', 'Semanal los lunes', 'Mensual el día 1', 'Merma vs. período anterior'], fontSize: 12, color: C.verdeTenue, colorTitulo: '0A6F0A' });
}

// 8. Niveles de funcionalidad
{
  const s = contenido(pres, 'Tres niveles de funcionalidad', 'El nivel define qué hardware lleva la cisterna y cada equipo, y qué detecta el sistema');
  const cols = [
    { t: 'Básico', st: 'Identifica y mide', color: C.tinta, ct: C.navy, l: ['Caudalímetro, electroválvula, lector RFID, controlador 4G + GPS', 'Tag RFID por equipo', 'Bloqueo sin tag, geocerca, horario, sobrellenado, caudal anómalo', 'Dashboard en tiempo real', 'Reportes Excel y PDF', 'Soporte en horario hábil'] },
    { t: 'Estándar  ·  recomendado', st: 'Concilia y controla', color: C.naranjaTenue, ct: 'B5532C', l: ['Todo lo del Básico', 'Sensor de nivel de la cisterna', 'Tablet del chofer con firma, ticket y recargas', 'Detecta robo directo, bypass, recarga incompleta y sifoneo por horómetro', 'Reportes automáticos por correo y comparativa de merma', 'API REST · soporte por WhatsApp'] },
    { t: 'Completo', st: 'Extremo a extremo', color: C.verdeTenue, ct: '0A6F0A', l: ['Todo lo del Estándar', 'Sensor de nivel y rastreador CAN/GPS en cada equipo', 'Sifoneo en tiempo real y consumo L/h automático', 'Dashboard multi‑obra', 'Exportación programada a ERP', 'Soporte prioritario y revisión mensual de merma'] },
  ];
  cols.forEach((c, i) => {
    const x = 0.6 + i * 4.1;
    tarjeta(pres, s, { x, y: 1.6, w: 3.9, h: 5.2, color: c.color, borde: i === 1 ? C.naranja : undefined });
    s.addText(c.t, { x: x + 0.25, y: 1.75, w: 3.4, h: 0.45, fontSize: 20, bold: true, color: c.ct, fontFace: F.titulo, isTextBox: true, margin: 0 });
    s.addText(c.st, { x: x + 0.25, y: 2.2, w: 3.4, h: 0.35, fontSize: 13, italic: true, color: C.gris, fontFace: F.cuerpo, isTextBox: true, margin: 0 });
    s.addText(c.l.map((t, k) => ({ text: t, options: { bullet: { indent: 12 }, breakLine: k < c.l.length - 1, paraSpaceAfter: 6 } })), { x: x + 0.25, y: 2.65, w: 3.4, h: 4.0, fontSize: 12.5, color: C.ink, fontFace: F.cuerpo, isTextBox: true, margin: 0, valign: 'top' });
  });
}

// 9. Tipos de solución
{
  const s = contenido(pres, 'Cuatro formas de contratarlo', 'Cualquier nivel se puede entregar de cualquiera de estas formas');
  const t = [
    ['🔑', 'Llave en mano', 'Hardware, instalación, calibración, software en nuestra nube y soporte. Cero fricción para el cliente.', 'Pago inicial por cisterna y equipo + suscripción mensual'],
    ['☁️', 'Solo software (SaaS)', 'El cliente compra e instala el hardware con nuestra lista y guía; nosotros configuramos, capacitamos y operamos la nube.', 'Puesta en marcha + suscripción mensual reducida'],
    ['🏢', 'Servidor propio', 'Licencia perpetua instalada en la infraestructura del cliente. Para mineras con política de datos internos.', 'Licencia + 18 % anual de mantenimiento'],
    ['🧪', 'Piloto de 90 días', 'Una cisterna nivel Estándar llave en mano con informe de merma al cierre. Para decidir con cifras reales.', 'Implementación reducida, sin cuota mensual'],
  ];
  t.forEach((it, i) => { const col = i % 2, fila = Math.floor(i / 2); const x = 0.6 + col * 6.2, y = 1.6 + fila * 2.6; tarjeta(pres, s, { x, y, w: 5.9, h: 2.4, icono: it[0], titulo: it[1], lineas: [{ text: it[2], options: { bullet: false } }, { text: it[3], options: { bullet: false, bold: true, color: C.navy } }], fontSize: 13 }); });
}

// 10. Tarifas llave en mano
{
  const s = contenido(pres, 'Tarifas · llave en mano', 'USD sin IVA · precios de lista');
  tabla(pres, s, [
    ['Concepto', 'Básico', 'Estándar', 'Completo'],
    ['Implementación por cisterna (hardware, instalación, calibración, configuración, capacitación)', '4 500', { text: '6 500', bold: true }, '6 500'],
    ['Alta por equipo (tag, instalación, registro)', '70', { text: '70', bold: true }, '850 (tag + sensor de nivel + rastreador CAN/GPS)'],
    ['Suscripción mensual por cisterna (software, nube, SIM, soporte, actualizaciones)', '250', { text: '350', bold: true }, '450'],
    ['Suscripción mensual por equipo', '—', '—', '20'],
  ], { x: 0.6, y: 1.6, w: 12.1, colW: [5.6, 1.9, 1.9, 2.7], fontSize: 12, alto: 0.62 });
  tarjeta(pres, s, { x: 0.6, y: 4.9, w: 5.9, h: 1.8, titulo: 'Descuentos por volumen', lineas: ['5 % de 3 a 5 cisternas · 10 % de 6 a 10 · 15 % desde 11', 'Contrato anual pagado por adelantado: un mes gratis'], fontSize: 12 });
  tarjeta(pres, s, { x: 6.8, y: 4.9, w: 5.9, h: 1.8, titulo: 'Qué incluye la suscripción', lineas: ['Servidor y respaldos diarios', 'SIM del controlador y monitoreo de conexión', 'Actualizaciones de software y firmware', 'Soporte y reposición de tags'], fontSize: 12, color: C.verdeTenue, colorTitulo: '0A6F0A' });
}

// 11. SaaS, on-premise, piloto
{
  const s = contenido(pres, 'Tarifas · software, servidor propio y piloto', 'USD sin IVA');
  s.addText('Solo software (SaaS)', { x: 0.6, y: 1.5, w: 6, h: 0.35, fontSize: 15, bold: true, color: C.navy, fontFace: F.titulo, isTextBox: true, margin: 0 });
  tabla(pres, s, [['Concepto', 'Básico', 'Estándar', 'Completo'], ['Puesta en marcha', '1 500', '2 500', '3 500'], ['Suscripción mensual por cisterna', '200', '250', '300'], ['Suscripción mensual por equipo', '—', '—', '10']], { x: 0.6, y: 1.9, w: 6.0, colW: [3.0, 1.0, 1.0, 1.0], fontSize: 11, alto: 0.4 });
  s.addText('Servidor propio (licencia perpetua)', { x: 6.9, y: 1.5, w: 6, h: 0.35, fontSize: 15, bold: true, color: C.navy, fontFace: F.titulo, isTextBox: true, margin: 0 });
  tabla(pres, s, [['Concepto', 'Hasta 5', 'Hasta 15', 'Ilimitado'], ['Licencia perpetua', '9 000', '18 000', '30 000'], ['Mantenimiento anual', '18 %', '18 %', '18 %'], ['Instalación del servidor', '1 500', '1 500', '2 500']], { x: 6.9, y: 1.9, w: 5.8, colW: [2.6, 1.0, 1.1, 1.1], fontSize: 11, alto: 0.4 });
  tarjeta(pres, s, { x: 0.6, y: 4.0, w: 6.0, h: 2.8, titulo: 'Piloto de 90 días', icono: '🧪', color: C.naranjaTenue, colorTitulo: 'B5532C', lineas: ['1 cisterna nivel Estándar llave en mano, hasta 15 equipos: USD 4 500 (en lugar de 7 550)', 'Sin cuota mensual durante el piloto', 'Informe de merma con cifras reales al cierre', 'Al convertir a contrato anual: 10 % de descuento en las cisternas siguientes', 'Si no continúa, el hardware queda instalado y pagado'], fontSize: 12 });
  tarjeta(pres, s, { x: 6.9, y: 4.0, w: 5.8, h: 2.8, titulo: 'Servicios adicionales', icono: '➕', lineas: ['Tablet rugged adicional con soporte: 450', 'Integración con ERP: 1 500 – 3 000', 'Capacitación adicional en faena: 600 por día + viáticos', 'Soporte 24/7 con respuesta en 1 h: 150 por cisterna al mes', 'Auditoría de merma histórica: 1 200'], fontSize: 12 });
}

// 12. Ejemplo de retorno
{
  const s = contenido(pres, 'Ejemplo: contratista con 2 cisternas y 12 equipos', 'Nivel Estándar llave en mano · consumo 60 000 L/mes a USD 1,20 · pérdida actual 8 % · recuperación 80 %');
  indicador(pres, s, { x: 0.6, y: 1.6, w: 2.9, valor: 'USD 13 840', etiqueta: 'Inversión inicial', sub: '2 × 6 500 + 12 × 70' });
  indicador(pres, s, { x: 0.6, y: 3.05, w: 2.9, valor: 'USD 700 / mes', etiqueta: 'Suscripción', sub: '2 cisternas × 350' });
  indicador(pres, s, { x: 0.6, y: 4.5, w: 2.9, valor: 'USD 4 600 / mes', etiqueta: 'Ahorro esperado del cliente', sub: '80 % de una pérdida de 5 760', color: '0A6F0A', fondo: C.verdeTenue });
  indicador(pres, s, { x: 0.6, y: 5.95, w: 2.9, h: 0.9, valor: '≈ 3 meses', etiqueta: 'Retorno de la inversión', color: '0A6F0A', fondo: C.verdeTenue });
  const meses = Array.from({ length: 25 }, (_, i) => i);
  const conFG = meses.map(m => -13840 + (4600 - 700) * m);
  const sinFG = meses.map(m => -5760 * m);
  s.addChart(pres.ChartType.line, [
    { name: 'Flujo acumulado con FuelGuard', labels: meses.map(m => m === 0 ? 'Inicio' : 'M' + m), values: conFG },
    { name: 'Pérdida acumulada sin control', labels: meses.map(m => m === 0 ? 'Inicio' : 'M' + m), values: sinFG },
  ], { x: 3.8, y: 1.5, w: 8.9, h: 5.3, chartColors: ['1FB51F', 'D03B3B'], lineSize: 3, lineDataSymbol: 'none', showLegend: true, legendPos: 'b', legendFontSize: 11, showTitle: true, title: 'Flujo de caja acumulado a 24 meses (USD)', titleFontSize: 13, titleColor: C.navy, catAxisLabelFontSize: 9, valAxisLabelFontSize: 9, catAxisLabelColor: C.gris, valAxisLabelColor: C.gris, valGridLine: { color: 'E5E7EB', size: 0.5 }, catGridLine: { style: 'none' }, valAxisLabelFormatCode: '#,##0' });
}

// 13. Comparación con alternativas
{
  const s = contenido(pres, 'Frente a las alternativas', 'Más control por un precio comparable');
  tabla(pres, s, [
    ['', 'Vale de papel', 'Contador con llave / RFID (Piusi MC Box)', 'Telemetría de flota', 'FuelGuard Estándar'],
    ['Identifica al equipo automáticamente', 'No', 'Sí', 'Parcial', 'Sí'],
    ['Mide cada litro sin intervención', 'No', 'Sí', 'No', 'Sí'],
    ['Detecta robo directo de la cisterna', 'No', 'No', 'No', 'Sí'],
    ['Detecta bypass del contador', 'No', 'No', 'No', 'Sí'],
    ['Firma del operador y ticket con hash', 'No', 'Ticket', 'No', 'Sí'],
    ['Dashboard en tiempo real y alertas', 'No', 'Descarga manual', 'Sí', 'Sí'],
    ['Reportes automáticos de merma', 'No', 'No', 'Parcial', 'Sí'],
    ['Precio por cisterna', '—', 'Similar o superior', '15 – 40 USD por vehículo/mes', '6 500 + 350/mes'],
  ], { x: 0.6, y: 1.6, w: 12.1, colW: [3.7, 1.6, 2.6, 2.1, 2.1], fontSize: 11, alto: 0.5 });
}

// 14. Cierre
{
  const s = portada(pres, { kicker: 'PRÓXIMO PASO', titulo: 'Piloto de 90 días en una cisterna', subtitulo: 'Instalación en un día · informe de merma con cifras reales · decisión con datos, no con estimaciones', pie: 'Edison Zavala · [correo] · [teléfono]' });
  s.addNotes('Cerrar con la calculadora de retorno del dashboard usando los litros reales del cliente.');
}

const salida = path.join(__dirname, '..', 'FuelGuard-Planes-Comerciales.pptx');
pres.writeFile({ fileName: salida }).then(() => console.log('OK', salida));
