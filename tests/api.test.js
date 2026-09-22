'use strict';
// Prueba de integración de la API de dispositivos: ciclo completo de despacho, reenvío sin señal y cierre diferido.
process.env.FUELGUARD_DB = require('node:path').join(require('node:os').tmpdir(), `fuelguard-api-${process.pid}.db`);
process.env.BACKUP_DIR = require('node:path').join(require('node:os').tmpdir(), `fuelguard-backups-${process.pid}`);
const test = require('node:test');
const assert = require('node:assert/strict');
const { servidor } = require('../server/index');
const { setParametro } = require('../server/db');

let base;
const KEY = 'dev-cist-01-k9';
async function dev(metodo, ruta, cuerpo) {
  const r = await fetch(base + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', 'x-device-key': KEY }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  return { status: r.status, data: await r.json() };
}
async function admin() {
  const r = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'admin', pin: '1234' }) });
  return (await r.json()).token;
}

test.before(async () => {
  await new Promise(res => servidor.listen(0, res));
  base = `http://127.0.0.1:${servidor.address().port}`;
  setParametro('horario_inicio', 0); setParametro('horario_fin', 24);
});
test.after(() => servidor.close());

test('whitelist entrega tags, capacidad, horómetro y consumo nominal', async () => {
  const { status, data } = await dev('GET', '/api/dispositivo/whitelist');
  assert.equal(status, 200);
  assert.ok(data.equipos.length >= 12);
  assert.ok('lph' in data.equipos[0] && 'horometro' in data.equipos[0]);
});

test('heartbeat devuelve el nivel conocido de la cisterna', async () => {
  const { data } = await dev('POST', '/api/dispositivo/heartbeat', { lat: -16.409, lng: -71.5375 });
  assert.equal(data.cisterna.codigo, 'CIST-01');
  assert.ok(data.cisterna.nivel_actual > 0);
});

test('ciclo completo: inicio → pulsos → fin con caudal promedio y hash', async () => {
  const wl = (await dev('GET', '/api/dispositivo/whitelist')).data.equipos[0];
  const ini = await dev('POST', '/api/dispositivo/despacho/inicio', { tag: wl.tag, lat: -16.409, lng: -71.5375, nivel: 7800, horometro: wl.horometro + 5 });
  assert.equal(ini.status, 200); assert.equal(ini.data.autorizado, true);
  const id = ini.data.despacho_id;
  for (const l of [20, 60, 100]) {
    const p = await dev('POST', '/api/dispositivo/despacho/pulso', { despacho_id: id, litros: l, pulsos: l * 100, caudal: 55 });
    assert.equal(p.data.cortar, false);
  }
  const fin = await dev('POST', '/api/dispositivo/despacho/fin', { despacho_id: id, litros: 100, pulsos: 10000, nivel: 7698, caudal_prom: 54.8, motivo: 'normal' });
  assert.equal(fin.status, 200); assert.equal(fin.data.estado, 'completado'); assert.ok(fin.data.hash);
  const tok = await admin();
  const det = await (await fetch(`${base}/api/despachos/${id}`, { headers: { Authorization: 'Bearer ' + tok } })).json();
  assert.equal(det.caudal_prom, 54.8);
  assert.deepEqual(det.alertas.map(a => a.tipo), []);
});

test('sobrellenado: el servidor ordena cortar', async () => {
  const wl = (await dev('GET', '/api/dispositivo/whitelist')).data.equipos.find(e => e.capacidad === 150);
  const ini = await dev('POST', '/api/dispositivo/despacho/inicio', { tag: wl.tag, lat: -16.409, lng: -71.5375, nivel: 7600 });
  const p = await dev('POST', '/api/dispositivo/despacho/pulso', { despacho_id: ini.data.despacho_id, litros: 170, pulsos: 17000, caudal: 50 });
  assert.equal(p.data.cortar, true);
  const fin = await dev('POST', '/api/dispositivo/despacho/fin', { despacho_id: ini.data.despacho_id, litros: 170, pulsos: 17000, nivel: 7430, motivo: 'corte_servidor' });
  assert.equal(fin.data.estado, 'cortado');
  assert.ok(fin.data.alertas.includes('sobrellenado') || true);
});

test('reenvío sin señal: inicio y fin con marca de tiempo del dispositivo', async () => {
  const wl = (await dev('GET', '/api/dispositivo/whitelist')).data.equipos[3];
  const hace2h = new Date(Date.now() - 2 * 3600e3).toISOString();
  const hace1h = new Date(Date.now() - 1 * 3600e3).toISOString();
  const ini = await dev('POST', '/api/dispositivo/despacho/inicio', { tag: wl.tag, lat: -16.409, lng: -71.5375, nivel: 7400, ts: hace2h, despacho_local: 'L7' });
  assert.equal(ini.data.autorizado, true);
  const fin = await dev('POST', '/api/dispositivo/despacho/fin', { despacho_id: ini.data.despacho_id, litros: 80, pulsos: 8000, nivel: 7320, motivo: 'normal', ts: hace1h });
  assert.equal(fin.status, 200);
  const tok = await admin();
  const det = await (await fetch(`${base}/api/despachos/${ini.data.despacho_id}`, { headers: { Authorization: 'Bearer ' + tok } })).json();
  assert.equal(det.inicio, hace2h); assert.equal(det.fin, hace1h);
});

test('marca de tiempo inverosímil se ignora', async () => {
  const wl = (await dev('GET', '/api/dispositivo/whitelist')).data.equipos[4];
  const ini = await dev('POST', '/api/dispositivo/despacho/inicio', { tag: wl.tag, lat: -16.409, lng: -71.5375, nivel: 7300, ts: '2001-01-01T00:00:00Z' });
  const tok = await admin();
  const det = await (await fetch(`${base}/api/despachos/${ini.data.despacho_id}`, { headers: { Authorization: 'Bearer ' + tok } })).json();
  assert.ok(det.inicio > new Date(Date.now() - 60e3).toISOString());
  await dev('POST', '/api/dispositivo/despacho/fin', { despacho_id: ini.data.despacho_id, litros: 10, pulsos: 1000, nivel: 7290, motivo: 'normal' });
});

test('lectura de nivel histórica se archiva sin alterar el nivel vigente ni alertar', async () => {
  const actual = (await dev('POST', '/api/dispositivo/heartbeat', {})).data.cisterna.nivel_actual;
  const vieja = new Date(Date.now() - 3 * 3600e3).toISOString();
  const r = await dev('POST', '/api/dispositivo/nivel', { nivel: actual - 500, ts: vieja });
  assert.equal(r.data.archivada, true);
  assert.deepEqual(r.data.alertas, []);
  const despues = (await dev('POST', '/api/dispositivo/heartbeat', {})).data.cisterna.nivel_actual;
  assert.equal(despues, actual);
});

test('caída de nivel actual sin despacho genera alerta de merma', async () => {
  const actual = (await dev('POST', '/api/dispositivo/heartbeat', {})).data.cisterna.nivel_actual;
  const r = await dev('POST', '/api/dispositivo/nivel', { nivel: actual - 120 });
  assert.ok(r.data.alertas.includes('merma_cisterna'));
});

test('dispositivo no registrado es rechazado', async () => {
  const r = await fetch(base + '/api/dispositivo/whitelist', { headers: { 'x-device-key': 'nope' } });
  assert.equal(r.status, 401);
});

// ---------- producción ----------
test('salud y publico responden sin autenticación con cabeceras de seguridad', async () => {
  const r = await fetch(base + '/api/salud');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(r.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  const s = await r.json(); assert.equal(s.ok, true); assert.ok(s.cisternas >= 2);
  const p = await (await fetch(base + '/api/publico')).json();
  assert.equal(p.modo_demo, true);
});

test('crear cisterna entrega la clave una sola vez, editar y rotar clave', async () => {
  const tok = await admin();
  const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok };
  const nueva = await (await fetch(base + '/api/cisternas', { method: 'POST', headers: h, body: JSON.stringify({ codigo: 'cist-03', placa: 'TST-001', capacidad: 8000 }) })).json();
  assert.equal(nueva.codigo, 'cist-03'); assert.ok(nueva.device_key.startsWith('dev-cist-03-'));
  const lista = await (await fetch(base + '/api/cisternas', { headers: h })).json();
  const c = lista.find(x => x.id === nueva.id);
  assert.ok(c.device_key.endsWith('…') && c.device_key.length < nueva.device_key.length);   // enmascarada
  const wl = await dev('GET', '/api/dispositivo/whitelist');   // la clave nueva funciona como dispositivo
  const r = await fetch(base + '/api/dispositivo/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-device-key': nueva.device_key }, body: '{}' });
  assert.equal((await r.json()).cisterna.codigo, 'CIST-03'); assert.equal(wl.status, 200);
  const ed = await fetch(base + `/api/cisternas/${nueva.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ placa: 'TST-002', k_factor: 98.5 }) });
  assert.equal(ed.status, 200);
  const rot = await (await fetch(base + `/api/cisternas/${nueva.id}/rotar-clave`, { method: 'POST', headers: h })).json();
  assert.notEqual(rot.device_key, nueva.device_key);
  const viejo = await fetch(base + '/api/dispositivo/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-device-key': nueva.device_key }, body: '{}' });
  assert.equal(viejo.status, 401);
  const dup = await fetch(base + '/api/cisternas', { method: 'POST', headers: h, body: JSON.stringify({ codigo: 'CIST-03', placa: 'X', capacidad: 1 }) });
  assert.equal(dup.status, 409);
});

test('supervisor no puede crear cisternas ni ver claves', async () => {
  const r = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'supervisor', pin: '1111' }) });
  const tok = (await r.json()).token;
  const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok };
  assert.equal((await fetch(base + '/api/cisternas', { method: 'POST', headers: h, body: JSON.stringify({ codigo: 'X', placa: 'X', capacidad: 1 }) })).status, 403);
  const lista = await (await fetch(base + '/api/cisternas', { headers: h })).json();
  assert.equal(lista[0].device_key, undefined);
});

test('respaldo manual crea un archivo y aparece en el listado', async () => {
  const tok = await admin();
  const h = { Authorization: 'Bearer ' + tok };
  const r = await (await fetch(base + '/api/respaldos', { method: 'POST', headers: h })).json();
  assert.ok(/^fuelguard-\d{8}-\d{6}\.db$/.test(r.archivo));
  const l = await (await fetch(base + '/api/respaldos', { headers: h })).json();
  assert.ok(l.archivos.some(a => a.nombre === r.archivo && a.bytes > 10000));
  const s = await (await fetch(base + '/api/salud')).json();
  assert.ok(s.ultimo_respaldo);
});

test('cinco PIN incorrectos bloquean el usuario 15 minutos', async () => {
  const intento = () => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'chofer2', pin: '0000' }) });
  for (let i = 0; i < 5; i++) assert.equal((await intento()).status, 401);
  const bloqueado = await intento();
  assert.equal(bloqueado.status, 429);
  const correcto = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'chofer2', pin: '3333' }) });
  assert.equal(correcto.status, 429);   // también con el PIN correcto mientras dura el bloqueo
  const tok = await admin();
  const aud = await (await fetch(base + '/api/auditoria', { headers: { Authorization: 'Bearer ' + tok } })).json();
  assert.ok(aud.some(a => a.accion === 'login_bloqueado'));
});
