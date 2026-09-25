// Elementos comunes de las presentaciones FuelGuard (pptxgenjs) · diseño v2.
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const QR = require('qrcode');
const IMG = f => path.join(__dirname, 'img', f);
const VIDEOS = JSON.parse(fs.readFileSync(path.join(__dirname, 'img', 'yt', 'videos.json'), 'utf8'));

const C = { navy: '14213D', navy2: '1F2F5F', azul: '1C5CAB', ice: 'C9D8F2', white: 'FFFFFF', ink: '15181D', gris: '5B6470', gris2: '8C93A0', lineas: 'DEE3EA', tinta: 'F3F5F9', naranja: 'F0803C', naranjaTenue: 'FFF0E6', verde: '1E9E4A', verdeTenue: 'E8F6EC', rojo: 'D03B3B', rojoTenue: 'FCE9E9', amarillo: 'FAB219', oscuro: '0E1626' };
const F = { titulo: 'Calibri', cuerpo: 'Calibri' };
const T = t => ({ fontFace: F.titulo, isTextBox: true, margin: 0, ...t });

function nuevaPresentacion(pptxgen, titulo) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
  pres.author = 'FuelGuard'; pres.title = titulo; pres.lang = 'es-CL';
  return pres;
}

// Formas decorativas de fondo (círculos translúcidos) para portadas y separadores.
function decoracion(pres, s) {
  s.addShape(pres.ShapeType.ellipse, { x: 9.6, y: -1.6, w: 5.2, h: 5.2, fill: { color: C.azul, transparency: 78 }, line: { color: C.azul, transparency: 100 } });
  s.addShape(pres.ShapeType.ellipse, { x: 11.2, y: 4.2, w: 4.0, h: 4.0, fill: { color: C.naranja, transparency: 82 }, line: { color: C.naranja, transparency: 100 } });
}

// Portada con imagen a la derecha.
function portada(pres, { titulo, subtitulo, pie, kicker, imagen: img }) {
  const s = pres.addSlide(); s.background = { color: C.navy };
  decoracion(pres, s);
  s.addShape(pres.ShapeType.roundRect, { x: 0.8, y: 0.8, w: 0.7, h: 0.7, fill: { color: C.naranja }, rectRadius: 0.16, line: { color: C.naranja } });
  s.addText('FG', T({ x: 0.8, y: 0.8, w: 0.7, h: 0.7, fontSize: 18, bold: true, color: C.white, align: 'center', valign: 'middle' }));
  s.addText('FuelGuard', T({ x: 1.65, y: 0.8, w: 5, h: 0.7, fontSize: 18, bold: true, color: C.white, valign: 'middle' }));
  if (kicker) s.addText(kicker, T({ x: 0.8, y: 2.0, w: 6.8, h: 0.4, fontSize: 13, color: C.naranja, bold: true, charSpacing: 3 }));
  s.addText(titulo, T({ x: 0.8, y: 2.45, w: 6.9, h: 2.2, fontSize: 40, bold: true, color: C.white, valign: 'top', lineSpacingMultiple: 1.0 }));
  if (subtitulo) s.addText(subtitulo, T({ x: 0.8, y: 4.8, w: 6.6, h: 1.2, fontSize: 17, color: C.ice, valign: 'top', fontFace: F.cuerpo }));
  if (pie) s.addText(pie, T({ x: 0.8, y: 6.6, w: 6.8, h: 0.4, fontSize: 12, color: C.ice, fontFace: F.cuerpo }));
  if (img) {
    s.addShape(pres.ShapeType.roundRect, { x: 7.9, y: 1.2, w: 5.2, h: 5.1, fill: { color: C.oscuro }, rectRadius: 0.2, line: { color: C.navy2, width: 1 }, shadow: { type: 'outer', blur: 18, offset: 6, angle: 90, color: '000000', opacity: 0.45 } });
    s.addImage({ path: IMG(img.archivo), x: 8.1, y: 1.4, w: 4.8, h: 4.7, sizing: { type: 'cover', w: 4.8, h: 4.7 } });
    if (img.leyenda) s.addText(img.leyenda, T({ x: 7.9, y: 6.4, w: 5.2, h: 0.35, fontSize: 11, color: C.ice, align: 'center', fontFace: F.cuerpo }));
  }
  return s;
}

// Separador de sección (fondo oscuro, letra grande).
function seccion(pres, { letra, titulo, subtitulo, datos }) {
  const s = pres.addSlide(); s.background = { color: C.navy2 };
  decoracion(pres, s);
  s.addShape(pres.ShapeType.ellipse, { x: 0.9, y: 2.2, w: 2.4, h: 2.4, fill: { color: C.naranja }, line: { color: C.naranja } });
  s.addText(letra, T({ x: 0.9, y: 2.2, w: 2.4, h: 2.4, fontSize: 80, bold: true, color: C.white, align: 'center', valign: 'middle' }));
  s.addText(titulo, T({ x: 3.8, y: 2.2, w: 8.8, h: 1.3, fontSize: 40, bold: true, color: C.white, valign: 'middle' }));
  if (subtitulo) s.addText(subtitulo, T({ x: 3.8, y: 3.5, w: 8.6, h: 0.9, fontSize: 18, color: C.ice, valign: 'top', fontFace: F.cuerpo }));
  if (datos) datos.forEach((d, i) => {
    s.addShape(pres.ShapeType.roundRect, { x: 3.8 + i * 2.9, y: 4.7, w: 2.7, h: 1.0, fill: { color: C.navy, transparency: 0 }, rectRadius: 0.12, line: { color: C.navy } });
    s.addText(d[0], T({ x: 3.95 + i * 2.9, y: 4.78, w: 2.4, h: 0.32, fontSize: 10, color: C.ice, fontFace: F.cuerpo }));
    s.addText(d[1], T({ x: 3.95 + i * 2.9, y: 5.1, w: 2.4, h: 0.5, fontSize: 16, bold: true, color: C.white, valign: 'middle' }));
  });
  return s;
}

// Diapositiva de contenido con etiqueta de sección (kicker) y título.
function contenido(pres, titulo, subtitulo, kicker) {
  const s = pres.addSlide(); s.background = { color: C.white };
  let y = 0.4;
  if (kicker) { s.addText(kicker, T({ x: 0.6, y: 0.32, w: 8, h: 0.3, fontSize: 10.5, bold: true, color: C.naranja, charSpacing: 2 })); y = 0.62; }
  s.addText(titulo, T({ x: 0.6, y, w: 12.1, h: 0.65, fontSize: 28, bold: true, color: C.navy, valign: 'middle' }));
  if (subtitulo) s.addText(subtitulo, T({ x: 0.6, y: y + 0.63, w: 12.1, h: 0.36, fontSize: 13.5, color: C.gris, fontFace: F.cuerpo }));
  s.addText('FuelGuard', T({ x: 11.3, y: 7.05, w: 1.5, h: 0.3, fontSize: 9, color: C.gris2, align: 'right', fontFace: F.cuerpo }));
  return s;
}

// Tarjeta con título y lista.
function tarjeta(pres, s, { x, y, w, h, titulo, lineas, color = C.tinta, colorTitulo = C.navy, fontSize = 12, icono, bullets = true, borde, numero }) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color }, rectRadius: 0.14, line: { color: borde || color, width: borde ? 1.5 : 0.5 } });
  let ty = y + 0.18, tx = x + 0.22;
  if (numero != null) { s.addShape(pres.ShapeType.ellipse, { x: x + 0.2, y: ty, w: 0.46, h: 0.46, fill: { color: colorTitulo }, line: { color: colorTitulo } }); s.addText(String(numero), T({ x: x + 0.2, y: ty, w: 0.46, h: 0.46, fontSize: 13, bold: true, color: C.white, align: 'center', valign: 'middle' })); tx = x + 0.8; }
  else if (icono) { s.addShape(pres.ShapeType.ellipse, { x: x + 0.2, y: ty, w: 0.46, h: 0.46, fill: { color: C.white }, line: { color: C.lineas, width: 0.75 } }); s.addText(icono, T({ x: x + 0.2, y: ty, w: 0.46, h: 0.46, fontSize: 14, align: 'center', valign: 'middle' })); tx = x + 0.8; }
  if (titulo) { s.addText(titulo, T({ x: tx, y: ty, w: w - (tx - x) - 0.2, h: 0.46, fontSize: fontSize + 3, bold: true, color: colorTitulo, valign: 'middle' })); ty += 0.56; }
  if (lineas && lineas.length) {
    const items = lineas.map((l, i) => (typeof l === 'string' ? { text: l, options: { bullet: bullets ? { indent: 12 } : false, breakLine: i < lineas.length - 1, paraSpaceAfter: 5 } } : { text: l.text, options: { ...l.options, breakLine: i < lineas.length - 1, paraSpaceAfter: 5 } }));
    const lx = !titulo && (numero != null || icono) ? tx : x + 0.22;
    s.addText(items, T({ x: lx, y: ty, w: w - (lx - x) - 0.22, h: h - (ty - y) - 0.15, fontSize, color: C.ink, fontFace: F.cuerpo, valign: 'top' }));
  }
}

// Ficha de indicador.
function indicador(pres, s, { x, y, w, h = 1.3, valor, etiqueta, sub, color = C.navy, fondo = C.tinta }) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: fondo }, rectRadius: 0.14, line: { color: fondo } });
  s.addText(etiqueta, T({ x: x + 0.22, y: y + 0.12, w: w - 0.44, h: 0.3, fontSize: 11, color: C.gris, fontFace: F.cuerpo }));
  s.addText(valor, T({ x: x + 0.22, y: y + 0.4, w: w - 0.44, h: 0.55, fontSize: String(valor).length > 11 && w < 3.2 ? 20 : 26, bold: true, color, valign: 'middle' }));
  if (sub) s.addText(sub, T({ x: x + 0.22, y: y + 0.95, w: w - 0.44, h: 0.3, fontSize: 10, color: C.gris, fontFace: F.cuerpo }));
}

// Marco para foto o video propio del piloto.
function marcoFoto(pres, s, { x, y, w, h, etiqueta, descripcion, video = false }) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: 'F8F9FB' }, rectRadius: 0.12, line: { color: C.gris2, width: 1, dashType: 'dash' } });
  s.addText(video ? '🎥' : '📷', T({ x, y: y + h / 2 - 0.6, w, h: 0.6, fontSize: 26, align: 'center' }));
  s.addText(etiqueta, T({ x: x + 0.15, y: y + h / 2, w: w - 0.3, h: 0.35, fontSize: 11.5, bold: true, color: C.navy, align: 'center', fontFace: F.cuerpo }));
  if (descripcion) s.addText(descripcion, T({ x: x + 0.15, y: y + h / 2 + 0.35, w: w - 0.3, h: h / 2 - 0.45, fontSize: 10, color: C.gris, align: 'center', fontFace: F.cuerpo, valign: 'top' }));
}

// Imagen con sombra.
function imagen(s, archivo, { x, y, w, h, sombra = true, hyperlink }) {
  const o = { path: IMG(archivo), x, y, w, h };
  if (sombra) o.shadow = { type: 'outer', blur: 8, offset: 3, angle: 90, color: '000000', opacity: 0.28 };
  if (hyperlink) o.hyperlink = { url: hyperlink };
  s.addImage(o);
}

// Tarjeta de video de YouTube: miniatura real con botón de reproducción, título, canal, qué mirar y código QR.
async function videoTarjeta(pres, s, { x, y, w, h, id, queMirar, etiqueta }) {
  const v = VIDEOS[id]; if (!v) throw new Error('video no verificado: ' + id);
  const qr = await QR.toDataURL(v.url, { margin: 1, width: 320, color: { dark: '14213DFF', light: 'FFFFFFFF' } });
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: C.white }, rectRadius: 0.14, line: { color: C.lineas, width: 1 }, shadow: { type: 'outer', blur: 6, offset: 2, angle: 90, color: '000000', opacity: 0.12 } });
  const iw = w - 0.3, ih = iw * 9 / 16;
  s.addImage({ path: IMG('yt/' + id + '.jpg'), x: x + 0.15, y: y + 0.15, w: iw, h: ih, hyperlink: { url: v.url, tooltip: 'Ver en YouTube' } });
  // botón de reproducción
  s.addShape(pres.ShapeType.roundRect, { x: x + 0.15 + iw / 2 - 0.42, y: y + 0.15 + ih / 2 - 0.3, w: 0.84, h: 0.6, fill: { color: 'FF0000' }, rectRadius: 0.15, line: { color: 'FF0000' } });
  s.addText('▶', T({ x: x + 0.15 + iw / 2 - 0.42, y: y + 0.15 + ih / 2 - 0.3, w: 0.84, h: 0.6, fontSize: 16, color: C.white, align: 'center', valign: 'middle' }));
  if (etiqueta) { s.addShape(pres.ShapeType.roundRect, { x: x + 0.25, y: y + 0.25, w: 1.3, h: 0.3, fill: { color: C.naranja }, rectRadius: 0.1, line: { color: C.naranja } }); s.addText(etiqueta, T({ x: x + 0.25, y: y + 0.25, w: 1.3, h: 0.3, fontSize: 9, bold: true, color: C.white, align: 'center', valign: 'middle' })); }
  let ty = y + ih + 0.25;
  const qrW = Math.min(1.05, w * 0.3);
  s.addText(v.titulo, T({ x: x + 0.15, y: ty, w: w - 0.3, h: 0.58, fontSize: 11, bold: true, color: C.navy, valign: 'top', fontFace: F.cuerpo, hyperlink: { url: v.url, tooltip: v.url } }));
  s.addText(v.canal + ' · YouTube', T({ x: x + 0.15, y: ty + 0.58, w: w - 0.3, h: 0.26, fontSize: 9.5, color: C.gris2, fontFace: F.cuerpo }));
  const yq = ty + 0.9, hq = h - ih - 1.3;
  s.addImage({ data: qr, x: x + w - qrW - 0.15, y: y + h - qrW - 0.38, w: qrW, h: qrW, hyperlink: { url: v.url } });
  s.addText(v.url, T({ x: x + w - qrW - 0.25, y: y + h - 0.36, w: qrW + 0.2, h: 0.22, fontSize: 6.5, color: C.gris2, align: 'center', fontFace: F.cuerpo }));
  if (queMirar) s.addText([{ text: 'Qué mirar: ', options: { bold: true, color: C.naranja } }, { text: queMirar, options: { color: C.ink } }], T({ x: x + 0.15, y: yq, w: w - qrW - 0.45, h: hq, fontSize: 10, fontFace: F.cuerpo, valign: 'top' }));
}

// Tabla con estilo de la casa.
function tabla(pres, s, filas, { x, y, w, colW, fontSize = 11, alto }) {
  const cab = filas[0].map(t => ({ text: String(t), options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize, fontFace: F.cuerpo, valign: 'middle' } }));
  const cuerpo = filas.slice(1).map((f, i) => f.map((c, j) => {
    const celda = typeof c === 'object' && c !== null && 'text' in c ? c : { text: String(c ?? '') };
    return { text: celda.text, options: { fontSize, fontFace: F.cuerpo, color: C.ink, fill: { color: i % 2 ? 'F3F5F9' : 'FFFFFF' }, valign: 'middle', align: j === 0 ? 'left' : 'center', bold: !!celda.bold, ...(celda.options || {}) } };
  }));
  s.addTable([cab, ...cuerpo], { x, y, w, colW, border: { type: 'solid', pt: 0.5, color: C.lineas }, rowH: alto || 0.36, margin: 0.06 });
}

function pieNota(s, texto) { s.addText(texto, T({ x: 0.6, y: 6.9, w: 10.5, h: 0.4, fontSize: 10, color: C.gris2, fontFace: F.cuerpo, italic: true })); }

module.exports = { C, F, T, IMG, VIDEOS, nuevaPresentacion, portada, seccion, contenido, tarjeta, indicador, marcoFoto, imagen, videoTarjeta, tabla, pieNota };
