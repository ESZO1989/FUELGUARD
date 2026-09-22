'use strict';
// Generador mínimo de PDF (texto, líneas, rectángulos y tablas paginadas) sin dependencias.
// Usa las fuentes estándar Helvetica / Helvetica-Bold con WinAnsiEncoding (acentos y ñ incluidos).
const zlib = require('node:zlib');

// Anchos aproximados de Helvetica (por 1000 unidades) para las letras más comunes; el resto usa 556.
const ANCHOS = { ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278, '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, '[': 278, ']': 278, a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500, '·': 278, '—': 1000, '–': 556, '…': 1000, '€': 556 };
function anchoTexto(s, size) { let w = 0; for (const ch of String(s)) w += ANCHOS[ch] ?? 556; return (w / 1000) * size; }

class Pdf {
  constructor({ titulo = 'Documento', horizontal = false, margen = 40 } = {}) {
    this.ancho = horizontal ? 841.89 : 595.28; this.alto = horizontal ? 595.28 : 841.89; this.margen = margen;
    this.titulo = titulo; this.paginas = []; this.y = 0; this.nuevaPagina();
  }
  nuevaPagina() { this.actual = []; this.paginas.push(this.actual); this.y = this.alto - this.margen; this.numero = this.paginas.length; if (this.encabezado) this.encabezado(this); }
  get abajo() { return this.margen + 28; }
  espacio(h) { if (this.y - h < this.abajo) this.nuevaPagina(); }
  // Convierte a WinAnsi: caracteres fuera de Latin-1 que sí existen en cp1252 se mapean; el resto se sustituye.
  _esc(s) {
    const MAPA = { '…': '\x85', '€': '\x80', '–': '\x96', '—': '\x97', '‘': '\x91', '’': '\x92', '“': '\x93', '”': '\x94', '•': '\x95', '™': '\x99' };
    let out = '';
    for (const ch of String(s)) { const c = ch.codePointAt(0); out += c < 256 ? ch : (MAPA[ch] ?? '?'); }
    return out.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\r?\n/g, ' ');
  }
  texto(x, y, s, { size = 10, negrita = false, color = '0 0 0', alinear = 'izq', anchoMax } = {}) {
    let str = String(s ?? '');
    if (anchoMax) while (str.length > 1 && anchoTexto(str, size) > anchoMax) str = str.slice(0, -2) + '…';
    const w = anchoTexto(str, size);
    const xx = alinear === 'der' ? x - w : alinear === 'centro' ? x - w / 2 : x;
    this.actual.push(`BT /${negrita ? 'F2' : 'F1'} ${size} Tf ${color} rg ${xx.toFixed(2)} ${y.toFixed(2)} Td (${this._esc(str)}) Tj ET`);
    return w;
  }
  linea(x1, y1, x2, y2, { grosor = 0.5, color = '0.7 0.7 0.7' } = {}) { this.actual.push(`${color} RG ${grosor} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`); }
  rect(x, y, w, h, color = '0.93 0.95 0.98') { this.actual.push(`${color} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); }

  titulo1(s) { this.espacio(30); this.texto(this.margen, this.y - 16, s, { size: 16, negrita: true }); this.y -= 26; }
  titulo2(s) { this.espacio(26); this.texto(this.margen, this.y - 13, s, { size: 12, negrita: true, color: '0.11 0.36 0.67' }); this.y -= 20; }
  parrafo(s, { size = 9.5, color = '0.2 0.2 0.2' } = {}) {
    const anchoUtil = this.ancho - 2 * this.margen; const palabras = String(s).split(/\s+/); let linea = '';
    const lineas = [];
    for (const p of palabras) { const t = linea ? linea + ' ' + p : p; if (anchoTexto(t, size) > anchoUtil && linea) { lineas.push(linea); linea = p; } else linea = t; }
    if (linea) lineas.push(linea);
    for (const l of lineas) { this.espacio(size + 4); this.texto(this.margen, this.y - size, l, { size, color }); this.y -= size + 4; }
    this.y -= 4;
  }
  // Fichas de indicadores en una fila.
  indicadores(items) {
    const n = items.length, gap = 8, w = (this.ancho - 2 * this.margen - gap * (n - 1)) / n, h = 44;
    this.espacio(h + 10);
    items.forEach((it, i) => {
      const x = this.margen + i * (w + gap);
      this.rect(x, this.y - h, w, h, it.color || '0.93 0.95 0.98');
      this.texto(x + 8, this.y - 14, it.etiqueta, { size: 7.5, color: '0.35 0.35 0.35', anchoMax: w - 16 });
      this.texto(x + 8, this.y - 32, it.valor, { size: 14, negrita: true, anchoMax: w - 16 });
      if (it.sub) this.texto(x + 8, this.y - 41, it.sub, { size: 6.5, color: '0.4 0.4 0.4', anchoMax: w - 16 });
    });
    this.y -= h + 10;
  }
  // Tabla con encabezado repetido en cada página. columnas: [{ titulo, ancho (proporción), alinear, formato }]
  tabla(columnas, filas, { size = 8, altoFila = 14 } = {}) {
    const anchoUtil = this.ancho - 2 * this.margen; const total = columnas.reduce((a, c) => a + (c.ancho || 1), 0);
    const anchos = columnas.map(c => ((c.ancho || 1) / total) * anchoUtil);
    const cabecera = () => {
      this.rect(this.margen, this.y - altoFila, anchoUtil, altoFila, '0.11 0.36 0.67');
      let x = this.margen;
      columnas.forEach((c, i) => { const der = c.alinear === 'der'; this.texto(der ? x + anchos[i] - 4 : x + 4, this.y - altoFila + 4, c.titulo, { size, negrita: true, color: '1 1 1', alinear: der ? 'der' : 'izq', anchoMax: anchos[i] - 8 }); x += anchos[i]; });
      this.y -= altoFila;
    };
    this.espacio(altoFila * 3); cabecera();
    filas.forEach((f, r) => {
      if (this.y - altoFila < this.abajo) { this.nuevaPagina(); cabecera(); }
      if (r % 2) this.rect(this.margen, this.y - altoFila, anchoUtil, altoFila, '0.96 0.96 0.96');
      let x = this.margen;
      columnas.forEach((c, i) => {
        let v = f[i]; if (v == null) v = '';
        if (typeof v === 'number') v = c.formato === 'pct' ? `${v.toFixed(1)} %` : c.formato === 'dec' ? v.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : v.toLocaleString('es-PE', { maximumFractionDigits: 0 });
        const der = c.alinear === 'der' || typeof f[i] === 'number';
        this.texto(der ? x + anchos[i] - 4 : x + 4, this.y - altoFila + 4, v, { size, alinear: der ? 'der' : 'izq', anchoMax: anchos[i] - 8, negrita: !!f._negrita });
        x += anchos[i];
      });
      this.linea(this.margen, this.y - altoFila, this.margen + anchoUtil, this.y - altoFila, { grosor: 0.3, color: '0.85 0.85 0.85' });
      this.y -= altoFila;
    });
    this.y -= 10;
  }
  pie(fn) { this._pie = fn; }

  salida() {
    const objetos = [];
    const add = s => { objetos.push(s); return objetos.length; };
    const fuente1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const fuente2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const idsPaginas = [];
    const paginasId = objetos.length + 1 + this.paginas.length * 2; // se calcula tras crear contenidos y páginas
    const contenidos = this.paginas.map((ops, i) => {
      if (this._pie) { const guardado = this.actual; this.actual = ops; this._pie(this, i + 1, this.paginas.length); this.actual = guardado; }
      const flujo = zlib.deflateSync(Buffer.from(ops.join('\n'), 'latin1'));
      return { stream: flujo };
    });
    const idsContenido = contenidos.map(c => add({ dict: `<< /Length ${c.stream.length} /Filter /FlateDecode >>`, stream: c.stream }));
    idsContenido.forEach(cid => idsPaginas.push(add(`<< /Type /Page /Parent ${paginasId} 0 R /MediaBox [0 0 ${this.ancho.toFixed(2)} ${this.alto.toFixed(2)}] /Resources << /Font << /F1 ${fuente1} 0 R /F2 ${fuente2} 0 R >> >> /Contents ${cid} 0 R >>`)));
    const pid = add(`<< /Type /Pages /Kids [${idsPaginas.map(i => `${i} 0 R`).join(' ')}] /Count ${idsPaginas.length} >>`);
    if (pid !== paginasId) throw new Error('inconsistencia interna de objetos PDF');
    const catalogo = add(`<< /Type /Catalog /Pages ${pid} 0 R >>`);
    const info = add(`<< /Title (${this._esc(this.titulo)}) /Producer (FuelGuard) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>`);
    const partes = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')]; const offsets = []; let pos = partes[0].length;
    objetos.forEach((o, i) => {
      offsets.push(pos);
      let b;
      if (typeof o === 'string') b = Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1');
      else b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n${o.dict}\nstream\n`, 'latin1'), o.stream, Buffer.from('\nendstream\nendobj\n', 'latin1')]);
      partes.push(b); pos += b.length;
    });
    const xref = [`xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`, ...offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`)].join('');
    partes.push(Buffer.from(`${xref}trailer\n<< /Size ${objetos.length + 1} /Root ${catalogo} 0 R /Info ${info} 0 R >>\nstartxref\n${pos}\n%%EOF\n`, 'latin1'));
    return Buffer.concat(partes);
  }
}

module.exports = { Pdf, anchoTexto };
