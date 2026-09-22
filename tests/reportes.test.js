'use strict';
// Reportes: datos, Excel (ZIP válido), PDF (estructura válida) y envío por correo contra un servidor SMTP simulado.
process.env.FUELGUARD_DB = require('node:path').join(require('node:os').tmpdir(), `fuelguard-rep-${process.pid}.db`);
process.env.BACKUP_DIR = require('node:path').join(require('node:os').tmpdir(), `fuelguard-rep-bk-${process.pid}`);
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const zlib = require('node:zlib');
const { servidor } = require('../server/index');
const { setParametro } = require('../server/db');
const reportes = require('../server/reportes');
const { crearXlsx } = require('../server/xlsx');
const { Pdf } = require('../server/pdf');

let base, token;
const auth = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token });
test.before(async () => {
  await new Promise(res => servidor.listen(0, res));
  base = `http://127.0.0.1:${servidor.address().port}`;
  const r = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'admin', pin: '1234' }) });
  token = (await r.json()).token;
});
test.after(() => servidor.close());

// Lector mínimo de ZIP para verificar el .xlsx sin dependencias.
function leerZip(buf) {
  const fin = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const n = buf.readUInt16LE(fin + 10), inicioCentral = buf.readUInt32LE(fin + 16);
  const entradas = {}; let p = inicioCentral;
  for (let i = 0; i < n; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const compLen = buf.readUInt32LE(p + 20), nomLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), comLen = buf.readUInt16LE(p + 32), offset = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + nomLen);
    const lNom = buf.readUInt16LE(offset + 26), lExtra = buf.readUInt16LE(offset + 28);
    const datos = buf.subarray(offset + 30 + lNom + lExtra, offset + 30 + lNom + lExtra + compLen);
    entradas[nombre] = zlib.inflateRawSync(datos).toString('utf8');
    p += 46 + nomLen + extraLen + comLen;
  }
  return entradas;
}

test('rangos de período', () => {
  const s = reportes.rango('semana'); assert.equal(s.dias, 7);
  const m = reportes.rango('mes_anterior'); assert.ok(m.dias >= 28 && m.dias <= 31);
  const c = reportes.rango('personalizado', '2026-09-01', '2026-09-10'); assert.equal(c.dias, 10);
  assert.throws(() => reportes.rango('personalizado', '2026-09-10', '2026-09-01'));
});

test('el reporte JSON agrega equipos, operadores, cisternas con comparativa y alertas', async () => {
  const r = await fetch(base + '/api/reportes/consumo?periodo=semana', { headers: auth() });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(d.resumen.litros > 0 && d.resumen.despachos > 0);
  assert.ok(d.equipos.length >= 10 && d.equipos[0].litros >= d.equipos[1].litros);
  assert.ok(d.operadores.length >= 5);
  assert.equal(d.cisternas.length, 2);
  for (const c of d.cisternas) { assert.ok('ant_merma_pct' in c && 'variacion_merma_l' in c); }
  assert.ok(Array.isArray(d.alertasPorTipo) && Array.isArray(d.diario) && d.diario.length >= 5);
  assert.equal(d.despachos, undefined);   // la vista previa no incluye el detalle
});

test('el operador solo ve sus equipos en el reporte', async () => {
  const r = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'jtorres', pin: '4444' }) });
  const tok = (await r.json()).token;
  const d = await (await fetch(base + '/api/reportes/consumo?periodo=mes', { headers: { Authorization: 'Bearer ' + tok } })).json();
  assert.ok(d.equipos.every(e => ['EX-01', 'EX-02'].includes(e.codigo)));
  assert.equal(d.cisternas.length, 2);
  const est = await fetch(base + '/api/reportes/estado', { headers: { Authorization: 'Bearer ' + tok } });
  assert.equal(est.status, 403);
});

test('el Excel es un ZIP válido con 7 hojas y celdas correctas', async () => {
  const r = await fetch(base + '/api/reportes/consumo?periodo=semana&formato=xlsx', { headers: auth() });
  assert.equal(r.status, 200);
  assert.ok(r.headers.get('content-disposition').includes('.xlsx'));
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.readUInt32LE(0), 0x04034b50);
  const z = leerZip(buf);
  assert.ok(z['xl/workbook.xml'].includes('name="Despachos"') && z['xl/workbook.xml'].includes('name="Cisternas y merma"'));
  assert.equal(Object.keys(z).filter(k => k.startsWith('xl/worksheets/')).length, 7);
  assert.ok(z['xl/worksheets/sheet1.xml'].includes('Litros despachados'));
  assert.ok(/<c r="A2" s="4"><v>[\d.]+<\/v>/.test(z['xl/worksheets/sheet5.xml']) || z['xl/worksheets/sheet5.xml'].includes('<row r="2">'));
  // caracteres especiales escapados
  const x = crearXlsx([{ nombre: 'Hoja', columnas: [{ titulo: 'T' }], filas: [['a<b>&"c"']] }]);
  assert.ok(leerZip(x)['xl/worksheets/sheet1.xml'].includes('a&lt;b&gt;&amp;&quot;c&quot;'));
});

test('el PDF tiene estructura válida, varias páginas y acentos', async () => {
  const r = await fetch(base + '/api/reportes/consumo?periodo=mes&formato=pdf', { headers: auth() });
  assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'application/pdf');
  const buf = Buffer.from(await r.arrayBuffer());
  const s = buf.toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4') && s.trimEnd().endsWith('%%EOF'));
  const paginas = (s.match(/\/Type \/Page\b(?!s)/g) || []).length;
  assert.ok(paginas >= 2, `páginas: ${paginas}`);
  const startxref = Number(s.match(/startxref\n(\d+)/)[1]);
  assert.equal(s.slice(startxref, startxref + 4), 'xref');
  // los offsets de la tabla xref apuntan a "N 0 obj"
  const lineas = s.slice(startxref).split('\n'); const n = Number(lineas[1].split(' ')[1]);
  for (let i = 1; i < n; i++) { const off = Number(lineas[2 + i].slice(0, 10)); assert.ok(s.slice(off).startsWith(`${i} 0 obj`), `objeto ${i}`); }
  // texto con ñ y acentos codificado en WinAnsi dentro del flujo comprimido
  const p = new Pdf({ titulo: 'x' }); p.titulo1('Año — señal…'); const out = p.salida();
  const flujo = out.subarray(out.indexOf(Buffer.from('stream\n')) + 7, out.indexOf(Buffer.from('\nendstream')));
  const txt = zlib.inflateSync(flujo).toString('latin1');
  assert.ok(txt.includes('A\xf1o \x97 se\xf1al\x85'));
});

// ---------- SMTP simulado ----------
function smtpFalso() {
  const recibido = { mensajes: [] };
  const srv = net.createServer(sock => {
    let buffer = '', enDatos = false, actual = { rcpt: [] };
    sock.write('220 falso ESMTP\r\n');
    sock.on('data', d => {
      buffer += d.toString('latin1');
      let i;
      while ((i = buffer.indexOf('\r\n')) >= 0) {
        const linea = buffer.slice(0, i); buffer = buffer.slice(i + 2);
        if (enDatos) { if (linea === '.') { enDatos = false; recibido.mensajes.push(actual); actual = { rcpt: [] }; sock.write('250 OK queued\r\n'); } else actual.datos = (actual.datos || '') + linea + '\n'; continue; }
        const cmd = linea.toUpperCase();
        if (cmd.startsWith('EHLO')) sock.write('250-falso\r\n250-AUTH LOGIN PLAIN\r\n250 8BITMIME\r\n');
        else if (cmd.startsWith('AUTH PLAIN')) { actual.auth = Buffer.from(linea.split(' ')[2], 'base64').toString(); sock.write('235 ok\r\n'); }
        else if (cmd.startsWith('MAIL FROM')) { actual.from = linea; sock.write('250 ok\r\n'); }
        else if (cmd.startsWith('RCPT TO')) { actual.rcpt.push(linea.match(/<([^>]+)>/)[1]); sock.write('250 ok\r\n'); }
        else if (cmd === 'DATA') { enDatos = true; sock.write('354 go\r\n'); }
        else if (cmd === 'QUIT') { sock.write('221 bye\r\n'); sock.end(); }
        else sock.write('250 ok\r\n');
      }
    });
  });
  return new Promise(res => srv.listen(0, '127.0.0.1', () => res({ srv, puerto: srv.address().port, recibido })));
}

test('envío por correo con adjuntos Excel y PDF contra un SMTP simulado', async () => {
  const { srv, puerto, recibido } = await smtpFalso();
  Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(puerto), SMTP_SECURE: '0', SMTP_USER: 'reportes@empresa.com', SMTP_PASS: 'secreto', SMTP_FROM: 'FuelGuard <reportes@empresa.com>' });
  try {
    const r = await fetch(base + '/api/reportes/enviar', { method: 'POST', headers: auth(), body: JSON.stringify({ periodo: 'ayer', destinatarios: 'gerencia@empresa.com; supervisor@empresa.com', formatos: ['xlsx', 'pdf'] }) });
    const texto = await r.text();
    assert.equal(r.status, 200, texto);
    const j = JSON.parse(texto);
    assert.deepEqual(j.destinatarios, ['gerencia@empresa.com', 'supervisor@empresa.com']);
    assert.equal(recibido.mensajes.length, 1);
    const m = recibido.mensajes[0];
    assert.equal(m.auth, '\0reportes@empresa.com\0secreto');
    assert.deepEqual(m.rcpt, ['gerencia@empresa.com', 'supervisor@empresa.com']);
    assert.ok(m.datos.includes('Subject: =?UTF-8?B?'));
    assert.ok(m.datos.includes('filename="fuelguard-consumo-') && m.datos.includes('.xlsx"') && m.datos.includes('.pdf"'));
    assert.ok(m.datos.includes('Content-Type: text/html'));
    const est = await (await fetch(base + '/api/reportes/estado', { headers: auth() })).json();
    assert.ok(est.smtp_configurado && est.ultimo_envio.includes('gerencia@empresa.com'));
    // destinatarios inválidos
    const mal = await fetch(base + '/api/reportes/enviar', { method: 'POST', headers: auth(), body: JSON.stringify({ periodo: 'ayer', destinatarios: 'nada' }) });
    assert.equal(mal.status, 400);
  } finally { srv.close(); for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']) delete process.env[k]; }
});

test('sin SMTP configurado el envío informa cómo configurarlo', async () => {
  const r = await fetch(base + '/api/reportes/enviar', { method: 'POST', headers: auth(), body: JSON.stringify({ periodo: 'ayer', destinatarios: 'a@b.co' }) });
  assert.equal(r.status, 400);
  assert.ok((await r.json()).error.includes('SMTP_HOST'));
  setParametro('reporte_destinatarios', 'a@b.co');
});
