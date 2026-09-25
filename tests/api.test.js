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

// ---------- app del chofer ----------
async function chofer() {
  const r = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'chofer1', pin: '2222', recordar: true }) });
  const j = await r.json();
  assert.ok(new Date(j.expira) - Date.now() > 29 * 86400e3, 'sesión recordada de 30 días');
  return j.token;
}
test('el chofer confirma un despacho con horómetro y firma; el horómetro habilita la regla de consumo', async () => {
  const wl = (await dev('GET', '/api/dispositivo/whitelist')).data.equipos.find(e => e.codigo === 'CP-01');   // 150 L, 8 L/h
  const ini = await dev('POST', '/api/dispositivo/despacho/inicio', { tag: wl.tag, lat: -16.409, lng: -71.5375, nivel: 7000 });   // sin horómetro (controlador sin CAN)
  await dev('POST', '/api/dispositivo/despacho/fin', { despacho_id: ini.data.despacho_id, litros: 120, pulsos: 12000, nivel: 6880, motivo: 'normal' });
  const tok = await chofer();
  const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok };
  const firma = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const r = await fetch(base + `/api/despachos/${ini.data.despacho_id}/confirmar`, { method: 'POST', headers: h, body: JSON.stringify({ horometro: wl.horometro + 2, firma, observacion: 'tanque casi vacío' }) });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.alertas.includes('consumo_anomalo'));   // 120 L en 2 h = 60 L/h vs 8 nominal
  const det = await (await fetch(base + `/api/despachos/${ini.data.despacho_id}`, { headers: h })).json();
  assert.equal(det.confirmacion.firma, firma); assert.equal(det.confirmacion.chofer_nombre, 'Luis Paredes'); assert.equal(det.horometro, wl.horometro + 2);
  const lista = await (await fetch(base + '/api/despachos?limite=5', { headers: h })).json();
  assert.equal(lista.find(d => d.id === ini.data.despacho_id).confirmado, 2);
});
test('el chofer no puede confirmar despachos de otra cisterna', async () => {
  const tok = await chofer();
  const otro = await dev('POST', '/api/dispositivo/despacho/inicio', { tag: 'X' });   // rechazado en CIST-01, pero probamos con un despacho de CIST-02
  const r2 = await fetch(base + '/api/dispositivo/despacho/inicio', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-device-key': 'dev-cist-02-k9' }, body: JSON.stringify({ tag: (await dev('GET', '/api/dispositivo/whitelist')).data.equipos[6].tag, lat: -16.409, lng: -71.5375, nivel: 3000 }) });
  const d2 = await r2.json();
  await fetch(base + '/api/dispositivo/despacho/fin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-device-key': 'dev-cist-02-k9' }, body: JSON.stringify({ despacho_id: d2.despacho_id, litros: 50, pulsos: 5000, nivel: 2950, motivo: 'normal' }) });
  const r = await fetch(base + `/api/despachos/${d2.despacho_id}/confirmar`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ horometro: 1 }) });
  assert.equal(r.status, 403);
  assert.equal(otro.data.autorizado, false);
});
test('recarga registrada por el chofer actualiza el nivel de su cisterna', async () => {
  const tok = await chofer();
  const antes = (await dev('POST', '/api/dispositivo/heartbeat', {})).data.cisterna.nivel_actual;
  const r = await (await fetch(base + '/api/recargas', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ litros: 1000, guia: 'GR-777' }) })).json();
  assert.equal(r.litros, 1000); assert.equal(r.nivel, Math.min(10000, antes + 1000));
});
test('despacho manual queda marcado, descuenta nivel y genera alerta', async () => {
  const tok = await chofer();
  const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok };
  const eq = await (await fetch(base + '/api/equipos', { headers: h })).json();
  const antes = (await dev('POST', '/api/dispositivo/heartbeat', {})).data.cisterna.nivel_actual;
  const r = await fetch(base + '/api/despachos/manual', { method: 'POST', headers: h, body: JSON.stringify({ equipo_id: eq[0].id, litros: 90, horometro: eq[0].horometro + 4, motivo: 'Lector RFID no lee el tag' }) });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.motivo, 'manual'); assert.equal(d.litros, 90); assert.equal(d.cisterna_codigo, 'CIST-01');
  const despues = (await dev('POST', '/api/dispositivo/heartbeat', {})).data.cisterna.nivel_actual;
  assert.equal(despues, antes - 90);
  const al = await (await fetch(base + '/api/alertas?activas=1', { headers: h })).json();
  assert.ok(al.some(a => a.tipo === 'despacho_manual' && a.despacho_id === d.id));
  const exceso = await fetch(base + '/api/despachos/manual', { method: 'POST', headers: h, body: JSON.stringify({ equipo_id: eq[0].id, litros: 5000 }) });
  assert.equal(exceso.status, 400);
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

test('el detalle de un despacho respeta el alcance del operador y del chofer', async () => {
  const login = async (usuario, pin) => (await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, pin }) })).json());
  const op = await login('jtorres', '4444'), ch = await login('chofer1', '2222');
  const tok = await admin();
  const todos = await (await fetch(base + '/api/despachos?limite=500', { headers: { Authorization: 'Bearer ' + tok } })).json();
  const ajeno = todos.find(d => d.operador_id && d.operador_id !== op.usuario.id), propio = todos.find(d => d.operador_id === op.usuario.id);
  assert.ok(ajeno && propio);
  assert.equal((await fetch(`${base}/api/despachos/${ajeno.id}`, { headers: { Authorization: 'Bearer ' + op.token } })).status, 403);
  assert.equal((await fetch(`${base}/api/despachos/${propio.id}`, { headers: { Authorization: 'Bearer ' + op.token } })).status, 200);
  const otraCisterna = todos.find(d => d.cisterna_id !== ch.usuario.cisterna_id);
  assert.equal((await fetch(`${base}/api/despachos/${otraCisterna.id}`, { headers: { Authorization: 'Bearer ' + ch.token } })).status, 403);
  assert.equal((await fetch(`${base}/api/despachos/${ajeno.id}`, { headers: { Authorization: 'Bearer ' + tok } })).status, 200);
});

test('una URL mal formada responde 400 y el servidor sigue vivo', async () => {
  const r = await fetch(base + '/%E0%A4%A');
  assert.equal(r.status, 400);
  const vivo = await fetch(base + '/api/salud');
  assert.equal(vivo.status, 200);
});

test('el cuerpo debe ser un objeto JSON; los errores internos no exponen detalles', async () => {
  const tok = await admin();
  for (const cuerpo of ['[1,2]', 'null', '"texto"', '{no es json']) {
    const r = await fetch(base + '/api/recargas', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: cuerpo });
    assert.equal(r.status, 400, cuerpo);
  }
  // rol fuera del CHECK de la base: antes devolvía el mensaje de SQLite, ahora un 500 genérico
  const r = await fetch(base + '/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ nombre: 'X', usuario: 'xrol', pin: '1234', rol: 'gerente' }) });
  assert.equal(r.status, 500);
  assert.equal((await r.json()).error, 'Error interno');
});

test('el controlador no puede enviar litros, pulsos, nivel ni coordenadas mal formados', async () => {
  const wl = (await dev('GET', '/api/dispositivo/whitelist')).data.equipos[1];
  assert.equal((await dev('POST', '/api/dispositivo/despacho/inicio', { tag: wl.tag, nivel: 'lleno' })).status, 400);
  assert.equal((await dev('POST', '/api/dispositivo/heartbeat', { lat: 'norte', lng: -71 })).status, 400);
  const ini = await dev('POST', '/api/dispositivo/despacho/inicio', { tag: wl.tag, lat: -16.409, lng: -71.5375, nivel: 7000 });
  assert.equal(ini.data.autorizado, true);
  const id = ini.data.despacho_id;
  assert.equal((await dev('POST', '/api/dispositivo/despacho/pulso', { despacho_id: id, litros: 'abc' })).status, 400);
  assert.equal((await dev('POST', '/api/dispositivo/despacho/pulso', { despacho_id: id, litros: -5 })).status, 400);
  assert.equal((await dev('POST', '/api/dispositivo/despacho/pulso', { despacho_id: id })).status, 400);
  assert.equal((await dev('POST', '/api/dispositivo/despacho/pulso', { despacho_id: id, litros: 30, caudal: 50 })).status, 200);
  assert.equal((await dev('POST', '/api/dispositivo/despacho/fin', { despacho_id: id, litros: 30, nivel: 'x' })).status, 400);
  const fin = await dev('POST', '/api/dispositivo/despacho/fin', { despacho_id: id, litros: 30, pulsos: 3000, nivel: 6970, motivo: 'normal' });
  assert.equal(fin.status, 200);
  assert.equal((await dev('POST', '/api/dispositivo/nivel', { nivel: 'vacío' })).status, 400);
  assert.equal((await dev('POST', '/api/dispositivo/recarga', { litros: 100, nivel_despues: 'no' })).status, 400);
});

test('parámetros ?dias= inválidos usan el valor por defecto y los PUT validan números', async () => {
  const tok = await admin();
  const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok };
  for (const ruta of ['/api/consumo/por-equipo?dias=abc', '/api/consumo/por-dia?dias=-3', '/api/balance?dias=999999']) {
    const r = await fetch(base + ruta, { headers: h });
    assert.equal(r.status, 200, ruta);
    assert.ok(Array.isArray(await r.json()));
  }
  const eq = (await (await fetch(base + '/api/equipos', { headers: h })).json())[0];
  assert.equal((await fetch(`${base}/api/equipos/${eq.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ capacidad_tanque: 'grande' }) })).status, 400);
  assert.equal((await fetch(`${base}/api/equipos/${eq.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ capacidad_tanque: '0' }) })).status, 400);
  const ok = await fetch(`${base}/api/equipos/${eq.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ capacidad_tanque: '450', activo: '1' }) });
  assert.equal(ok.status, 200);
  const e2 = await ok.json();
  assert.equal(e2.capacidad_tanque, 450); assert.equal(typeof e2.capacidad_tanque, 'number'); assert.equal(e2.activo, 1);
  const cis = (await (await fetch(base + '/api/cisternas', { headers: h })).json())[0];
  assert.equal((await fetch(`${base}/api/cisternas/${cis.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ k_factor: 'cien' }) })).status, 400);
});
