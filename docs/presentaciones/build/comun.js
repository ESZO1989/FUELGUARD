// Elementos comunes de las presentaciones FuelGuard (pptxgenjs).
'use strict';
const path = require('node:path');
const IMG = f => path.join(__dirname, 'img', f);

const C = { navy: '1E2761', navy2: '2A3A8C', ice: 'CADCFC', white: 'FFFFFF', ink: '1B1B1B', gris: '5A5F66', gris2: '8A8F96', lineas: 'DDE1E6', tinta: 'F4F6F9', naranja: 'EC835A', naranjaTenue: 'FFF1EA', verde: '1FB51F', verdeTenue: 'E9F5EC', rojo: 'D03B3B', amarillo: 'FAB219' };
const F = { titulo: 'Calibri', cuerpo: 'Calibri' };

function nuevaPresentacion(pptxgen, titulo) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
  pres.author = 'FuelGuard'; pres.title = titulo; pres.lang = 'es-CL';
  return pres;
}

// Portada o cierre en fondo oscuro.
function portada(pres, { titulo, subtitulo, pie, kicker }) {
  const s = pres.addSlide(); s.background = { color: C.navy };
  if (kicker) s.addText(kicker, { x: 0.8, y: 1.3, w: 11, h: 0.5, fontSize: 16, color: C.ice, fontFace: F.cuerpo, isTextBox: true, margin: 0, charSpacing: 2 });
  s.addText(titulo, { x: 0.8, y: 1.9, w: 11.5, h: 1.8, fontSize: 48, bold: true, color: C.white, fontFace: F.titulo, isTextBox: true, margin: 0, valign: 'top' });
  if (subtitulo) s.addText(subtitulo, { x: 0.8, y: 3.9, w: 11, h: 1.2, fontSize: 22, color: C.ice, fontFace: F.cuerpo, isTextBox: true, margin: 0, valign: 'top' });
  s.addShape(pres.ShapeType.roundRect, { x: 0.8, y: 5.6, w: 0.9, h: 0.9, fill: { color: C.naranja }, rectRadius: 0.2, line: { color: C.naranja } });
  s.addText('FG', { x: 0.8, y: 5.6, w: 0.9, h: 0.9, fontSize: 22, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: F.titulo, isTextBox: true, margin: 0 });
  s.addText('FuelGuard · control automatizado de combustible', { x: 1.9, y: 5.75, w: 8, h: 0.6, fontSize: 16, color: C.white, fontFace: F.cuerpo, isTextBox: true, margin: 0, valign: 'middle' });
  if (pie) s.addText(pie, { x: 0.8, y: 6.6, w: 11.5, h: 0.4, fontSize: 12, color: C.ice, fontFace: F.cuerpo, isTextBox: true, margin: 0 });
  return s;
}

// Diapositiva de contenido con título; devuelve el slide.
function contenido(pres, titulo, subtitulo) {
  const s = pres.addSlide(); s.background = { color: C.white };
  s.addText(titulo, { x: 0.6, y: 0.35, w: 12.1, h: 0.7, fontSize: 30, bold: true, color: C.navy, fontFace: F.titulo, isTextBox: true, margin: 0, valign: 'middle' });
  if (subtitulo) s.addText(subtitulo, { x: 0.6, y: 1.02, w: 12.1, h: 0.4, fontSize: 14, color: C.gris, fontFace: F.cuerpo, isTextBox: true, margin: 0 });
  s.addText('FuelGuard', { x: 11.3, y: 7.0, w: 1.5, h: 0.3, fontSize: 9, color: C.gris2, align: 'right', fontFace: F.cuerpo, isTextBox: true, margin: 0 });
  return s;
}

// Tarjeta con fondo tenue, título y texto/lista.
function tarjeta(pres, s, { x, y, w, h, titulo, lineas, color = C.tinta, colorTitulo = C.navy, fontSize = 12, icono, bullets = true, borde }) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color }, rectRadius: 0.12, line: { color: borde || color, width: borde ? 1.5 : 0.5 } });
  let ty = y + 0.15;
  if (icono) { s.addText(icono, { x: x + 0.2, y: ty, w: 0.5, h: 0.45, fontSize: 20, isTextBox: true, margin: 0, valign: 'middle' }); }
  if (titulo) { s.addText(titulo, { x: x + (icono ? 0.75 : 0.2), y: ty, w: w - (icono ? 0.95 : 0.4), h: 0.45, fontSize: fontSize + 3, bold: true, color: colorTitulo, fontFace: F.titulo, isTextBox: true, margin: 0, valign: 'middle' }); ty += 0.5; }
  if (lineas && lineas.length) {
    const items = lineas.map((l, i) => (typeof l === 'string' ? { text: l, options: { bullet: bullets ? { indent: 12 } : false, breakLine: i < lineas.length - 1, paraSpaceAfter: 4 } } : { text: l.text, options: { ...l.options, breakLine: i < lineas.length - 1, paraSpaceAfter: 4 } }));
    s.addText(items, { x: x + 0.2, y: ty, w: w - 0.4, h: h - (ty - y) - 0.15, fontSize, color: C.ink, fontFace: F.cuerpo, isTextBox: true, margin: 0, valign: 'top' });
  }
}

// Ficha de indicador grande.
function indicador(pres, s, { x, y, w, h = 1.3, valor, etiqueta, sub, color = C.navy, fondo = C.tinta }) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: fondo }, rectRadius: 0.12, line: { color: fondo } });
  s.addText(etiqueta, { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.3, fontSize: 11, color: C.gris, fontFace: F.cuerpo, isTextBox: true, margin: 0 });
  s.addText(valor, { x: x + 0.2, y: y + 0.4, w: w - 0.4, h: 0.55, fontSize: 26, bold: true, color, fontFace: F.titulo, isTextBox: true, margin: 0, valign: 'middle' });
  if (sub) s.addText(sub, { x: x + 0.2, y: y + 0.95, w: w - 0.4, h: 0.3, fontSize: 10, color: C.gris, fontFace: F.cuerpo, isTextBox: true, margin: 0 });
}

// Marco reservado para foto o video del piloto.
function marcoFoto(pres, s, { x, y, w, h, etiqueta, descripcion, video = false }) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: 'F8F9FB' }, rectRadius: 0.1, line: { color: C.gris2, width: 1, dashType: 'dash' } });
  s.addText(video ? '🎥' : '📷', { x, y: y + h / 2 - 0.55, w, h: 0.6, fontSize: 28, align: 'center', isTextBox: true, margin: 0 });
  s.addText(etiqueta, { x: x + 0.15, y: y + h / 2 + 0.05, w: w - 0.3, h: 0.35, fontSize: 12, bold: true, color: C.navy, align: 'center', fontFace: F.cuerpo, isTextBox: true, margin: 0 });
  if (descripcion) s.addText(descripcion, { x: x + 0.15, y: y + h / 2 + 0.4, w: w - 0.3, h: h / 2 - 0.5, fontSize: 10, color: C.gris, align: 'center', fontFace: F.cuerpo, isTextBox: true, margin: 0, valign: 'top' });
}

// Imagen con borde redondeado simulado (sombra suave).
function imagen(s, archivo, { x, y, w, h, sombra = true }) {
  const o = { path: IMG(archivo), x, y, w, h, rounding: false };
  if (sombra) o.shadow = { type: 'outer', blur: 6, offset: 2, angle: 90, color: '000000', opacity: 0.25 };
  s.addImage(o);
}

// Tabla con estilo de la casa.
function tabla(pres, s, filas, { x, y, w, colW, fontSize = 11, alto }) {
  const cab = filas[0].map(t => ({ text: String(t), options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize, fontFace: F.cuerpo, valign: 'middle' } }));
  const cuerpo = filas.slice(1).map((f, i) => f.map((c, j) => {
    const celda = typeof c === 'object' && c !== null && 'text' in c ? c : { text: String(c ?? '') };
    return { text: celda.text, options: { fontSize, fontFace: F.cuerpo, color: C.ink, fill: { color: i % 2 ? 'F4F6F9' : 'FFFFFF' }, valign: 'middle', align: j === 0 ? 'left' : 'center', bold: !!celda.bold, ...(celda.options || {}) } };
  }));
  s.addTable([cab, ...cuerpo], { x, y, w, colW, border: { type: 'solid', pt: 0.5, color: C.lineas }, rowH: alto || 0.36, margin: 0.06 });
}

function pieNota(s, texto) { s.addText(texto, { x: 0.6, y: 6.85, w: 10.5, h: 0.4, fontSize: 10, color: C.gris2, fontFace: F.cuerpo, isTextBox: true, margin: 0, italic: true }); }

module.exports = { C, F, IMG, nuevaPresentacion, portada, contenido, tarjeta, indicador, marcoFoto, imagen, tabla, pieNota };
