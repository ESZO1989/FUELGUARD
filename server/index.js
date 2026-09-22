'use strict';
// FuelGuard — servidor HTTP: API REST, telemetría de dispositivos, eventos en tiempo real (SSE) y dashboard estático.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { getDb, hashPin, paramNum, todosParametros, setParametro } = require('./db');
const reglas = require('./rules');

const PUERTO = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const db = getDb();

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------
const ahoraISO = () => new Date().toISOString();
const inicioDelDia = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.toISOString(); };
const haceDias = n => { const x = new Date(); x.setDate(x.getDate() - n); x.setHours(0, 0, 0, 0); return x.toISOString(); };
const r1 = n => Math.round(n * 10) / 10;

function json(res, codigo, cuerpo) {
  const data = JSON.stringify(cuerpo);
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data);
}
class HttpError extends Error { constructor(codigo, msg) { super(msg); this.codigo = codigo; } }

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) { reject(new HttpError(413, 'Cuerpo demasiado grande')); req.destroy(); } });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new HttpError(400, 'JSON inválido')); }
    });
    req.on('error', reject);
  });
}

// ------------------------------------------------------------------
// Autenticación y alcance por rol
// ------------------------------------------------------------------
const qUsuarioPorToken = db.prepare(`SELECT u.* FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ? AND s.expira > ? AND u.activo = 1`);
const qCisternaPorChofer = db.prepare('SELECT id, codigo FROM cisternas WHERE chofer_id = ?');
const qCisternaPorKey = db.prepare('SELECT * FROM cisternas WHERE device_key = ?');

function usuarioDesde(req, url) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token');
  if (!token) return null;
  const u = qUsuarioPorToken.get(token, ahoraISO());
  if (!u) return null;
  delete u.pin_hash;
  if (u.rol === 'chofer') { const c = qCisternaPorChofer.get(u.id); u.cisterna_id = c ? c.id : null; u.cisterna_codigo = c ? c.codigo : null; }
  return u;
}
function requerir(usuario, ...roles) {
  if (!usuario) throw new HttpError(401, 'No autenticado');
  if (roles.length && !roles.includes(usuario.rol)) throw new HttpError(403, 'Sin permiso para esta operación');
  return usuario;
}
// Devuelve fragmento SQL (sobre alias d = despachos) y parámetros que limitan lo que ve cada rol.
function alcanceDespachos(u) {
  if (u.rol === 'admin' || u.rol === 'supervisor') return { sql: '', params: [] };
  if (u.rol === 'chofer') return { sql: ' AND d.cisterna_id = ?', params: [u.cisterna_id || -1] };
  return { sql: ' AND d.operador_id = ?', params: [u.id] };
}
function alcanceAlertas(u) {
  if (u.rol === 'admin' || u.rol === 'supervisor') return { sql: '', params: [] };
  if (u.rol === 'chofer') return { sql: ' AND a.cisterna_id = ?', params: [u.cisterna_id || -1] };
  return { sql: ' AND a.equipo_id IN (SELECT id FROM equipos WHERE operador_id = ?)', params: [u.id] };
}
function veEvento(u, ev) {
  if (u.rol === 'admin' || u.rol === 'supervisor') return true;
  const a = ev.alcance || {};
  if (u.rol === 'chofer') return a.cisterna_id == null || a.cisterna_id === u.cisterna_id;
  if (u.rol === 'operador') return a.operador_id === u.id;
  return false;
}

// ------------------------------------------------------------------
// Server-Sent Events (tiempo real hacia el dashboard)
// ------------------------------------------------------------------
const clientesSSE = new Set();
function emitir(tipo, payload, alcance = {}) {
  const ev = { tipo, ts: ahoraISO(), payload, alcance };
  const linea = `event: ${tipo}\ndata: ${JSON.stringify({ ts: ev.ts, ...payload })}\n\n`;
  for (const c of clientesSSE) {
    if (veEvento(c.usuario, ev)) { try { c.res.write(linea); } catch { clientesSSE.delete(c); } }
  }
}
setInterval(() => { for (const c of clientesSSE) { try { c.res.write(': ping\n\n'); } catch { clientesSSE.delete(c); } } }, 20000).unref();

// ------------------------------------------------------------------
// Consultas preparadas
// ------------------------------------------------------------------
const q = {
  equipoPorTag: db.prepare(`SELECT e.*, u.nombre AS operador FROM equipos e LEFT JOIN usuarios u ON u.id = e.operador_id WHERE e.tag_rfid = ?`),
  equipoPorId: db.prepare(`SELECT e.*, u.nombre AS operador FROM equipos e LEFT JOIN usuarios u ON u.id = e.operador_id WHERE e.id = ?`),
  cisternaPorId: db.prepare('SELECT * FROM cisternas WHERE id = ?'),
  ultimoDespachoEquipo: db.prepare(`SELECT * FROM despachos WHERE equipo_id = ? AND estado IN ('completado','cortado') ORDER BY fin DESC LIMIT 1`),
  despachoEnCursoCisterna: db.prepare(`SELECT * FROM despachos WHERE cisterna_id = ? AND estado = 'en_curso' ORDER BY id DESC LIMIT 1`),
  despachoPorId: db.prepare('SELECT * FROM despachos WHERE id = ?'),
  ultimoHash: db.prepare(`SELECT hash FROM despachos WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1`),
  insDespacho: db.prepare(`INSERT INTO despachos (cisterna_id, equipo_id, tag_rfid, chofer_id, operador_id, inicio, litros, pulsos, lat, lng, horometro, horometro_anterior, nivel_antes, estado, motivo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`),
  updPulso: db.prepare(`UPDATE despachos SET litros = ?, pulsos = ?, caudal_actual = ?, ultimo_pulso = ? WHERE id = ?`),
  updFin: db.prepare(`UPDATE despachos SET fin = ?, litros = ?, pulsos = ?, caudal_prom = ?, caudal_actual = 0, nivel_despues = ?, estado = ?, motivo = ?, hash = ? WHERE id = ?`),
  updNivelCisterna: db.prepare(`UPDATE cisternas SET nivel_actual = ?, ultima_lectura = ?, lat = COALESCE(?, lat), lng = COALESCE(?, lng), en_linea = 1 WHERE id = ?`),
  updHorometro: db.prepare('UPDATE equipos SET horometro = ? WHERE id = ?'),
  insAlerta: db.prepare(`INSERT INTO alertas (ts, tipo, severidad, mensaje, despacho_id, cisterna_id, equipo_id, litros_afectados) VALUES (?,?,?,?,?,?,?,?)`),
  insLectura: db.prepare('INSERT INTO lecturas_nivel (cisterna_id, ts, nivel, lat, lng) VALUES (?,?,?,?,?)'),
  insRecarga: db.prepare('INSERT INTO recargas (cisterna_id, ts, litros, guia, nivel_antes, nivel_despues) VALUES (?,?,?,?,?,?)'),
  insAuditoria: db.prepare('INSERT INTO auditoria (ts, usuario_id, accion, detalle) VALUES (?,?,?,?)'),
  despachoDetalle: db.prepare(`
    SELECT d.*, e.codigo AS equipo_codigo, e.nombre AS equipo_nombre, e.capacidad_tanque, c.codigo AS cisterna_codigo,
           uo.nombre AS operador, uc.nombre AS chofer
    FROM despachos d LEFT JOIN equipos e ON e.id = d.equipo_id JOIN cisternas c ON c.id = d.cisterna_id
    LEFT JOIN usuarios uo ON uo.id = d.operador_id LEFT JOIN usuarios uc ON uc.id = d.chofer_id WHERE d.id = ?`),
};

function registrarAlertas(lista, ref) {
  const creadas = [];
  for (const a of lista) {
    const r = q.insAlerta.run(ahoraISO(), a.tipo, a.severidad, a.mensaje, ref.despacho_id || null, ref.cisterna_id || null, ref.equipo_id || null, a.litros ? r1(a.litros) : 0);
    const alerta = { id: Number(r.lastInsertRowid), ts: ahoraISO(), ...a, ...ref, resuelta: 0 };
    creadas.push(alerta);
    emitir('alerta', alerta, { cisterna_id: ref.cisterna_id, operador_id: ref.operador_id });
  }
  return creadas;
}

function calcularHash(d, anterior) {
  const base = `${anterior || ''}|${d.id}|${d.cisterna_id}|${d.equipo_id}|${d.inicio}|${d.fin}|${d.litros}|${d.pulsos}`;
  return crypto.createHash('sha256').update(base).digest('hex').slice(0, 24);
}

// ------------------------------------------------------------------
// Rutas
// ------------------------------------------------------------------
const rutas = [];
function ruta(metodo, patron, manejador) {
  const claves = [];
  const re = new RegExp('^' + patron.replace(/:(\w+)/g, (_, k) => { claves.push(k); return '([^/]+)'; }) + '$');
  rutas.push({ metodo, re, claves, manejador });
}

// --- Autenticación ---
ruta('POST', '/api/login', async ({ cuerpo }) => {
  const { usuario, pin } = cuerpo;
  const u = db.prepare('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1').get(String(usuario || '').trim().toLowerCase());
  if (!u || u.pin_hash !== hashPin(pin)) throw new HttpError(401, 'Usuario o PIN incorrecto');
  const token = crypto.randomBytes(24).toString('hex');
  const expira = new Date(Date.now() + 12 * 3600e3).toISOString();
  db.prepare('INSERT INTO sesiones (token, usuario_id, creado, expira) VALUES (?,?,?,?)').run(token, u.id, ahoraISO(), expira);
  q.insAuditoria.run(ahoraISO(), u.id, 'login', null);
  delete u.pin_hash;
  if (u.rol === 'chofer') { const c = qCisternaPorChofer.get(u.id); u.cisterna_id = c ? c.id : null; u.cisterna_codigo = c ? c.codigo : null; }
  return { token, usuario: u, expira };
});
ruta('POST', '/api/logout', async ({ req, url }) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token');
  if (token) db.prepare('DELETE FROM sesiones WHERE token = ?').run(token);
  return { ok: true };
});
ruta('GET', '/api/me', async ({ usuario }) => ({ usuario: requerir(usuario), parametros: publicos(todosParametros()) }));
function publicos(p) { const { empresa, moneda, precio_litro } = p; return { empresa, moneda, precio_litro: Number(precio_litro) }; }

// --- Resumen / KPIs ---
ruta('GET', '/api/resumen', async ({ usuario }) => {
  const u = requerir(usuario);
  const al = alcanceDespachos(u);
  const hoy = inicioDelDia(), mes = haceDias(29), ayer = haceDias(1);
  const agg = (desde, hasta) => db.prepare(`SELECT COALESCE(SUM(d.litros),0) AS litros, COUNT(*) AS n FROM despachos d WHERE d.estado IN ('completado','cortado') AND d.inicio >= ? AND d.inicio < ?${al.sql}`).get(desde, hasta, ...al.params);
  const hoyAgg = agg(hoy, '9999'), ayerAgg = agg(ayer, hoy), mesAgg = agg(mes, '9999');
  const aa = alcanceAlertas(u);
  const alertas = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN a.severidad='critica' THEN 1 ELSE 0 END),0) AS criticas FROM alertas a WHERE a.resuelta = 0${aa.sql}`).get(...aa.params);
  const mermaMes = db.prepare(`SELECT COALESCE(SUM(a.litros_afectados),0) AS l FROM alertas a WHERE a.ts >= ? AND a.tipo IN ('merma_cisterna','descuadre_caudalimetro','sobrellenado','consumo_anomalo')${aa.sql}`).get(mes, ...aa.params).l;
  const rechazadosHoy = db.prepare(`SELECT COUNT(*) AS n FROM despachos d WHERE d.estado = 'rechazado' AND d.inicio >= ?${al.sql}`).get(hoy, ...al.params).n;
  let cisternas = db.prepare(`SELECT c.id, c.codigo, c.placa, c.capacidad, c.nivel_actual, c.en_linea, c.ultima_lectura, c.lat, c.lng, u.nombre AS chofer,
      (SELECT id FROM despachos WHERE cisterna_id = c.id AND estado = 'en_curso' LIMIT 1) AS despacho_en_curso
      FROM cisternas c LEFT JOIN usuarios u ON u.id = c.chofer_id ORDER BY c.codigo`).all();
  if (u.rol === 'chofer') cisternas = cisternas.filter(c => c.id === u.cisterna_id);
  if (u.rol === 'operador') cisternas = [];
  const enCurso = db.prepare(`SELECT d.id FROM despachos d WHERE d.estado = 'en_curso'${al.sql}`).all(...al.params).map(r => q.despachoDetalle.get(r.id));
  const precio = paramNum('precio_litro', 1.2);
  return {
    litros_hoy: r1(hoyAgg.litros), despachos_hoy: hoyAgg.n, litros_ayer: r1(ayerAgg.litros),
    litros_mes: r1(mesAgg.litros), despachos_mes: mesAgg.n, costo_mes: r1(mesAgg.litros * precio),
    alertas_activas: alertas.n, alertas_criticas: alertas.criticas,
    merma_mes_l: r1(mermaMes), merma_mes_pct: mesAgg.litros ? r1((mermaMes / mesAgg.litros) * 100) : 0, merma_mes_costo: r1(mermaMes * precio),
    rechazados_hoy: rechazadosHoy, cisternas, en_curso: enCurso, moneda: todosParametros().moneda, precio_litro: precio,
  };
});

// --- Despachos ---
ruta('GET', '/api/despachos', async ({ usuario, url }) => {
  const u = requerir(usuario);
  const al = alcanceDespachos(u);
  const limite = Math.min(Number(url.searchParams.get('limite') || 100), 1000);
  const filtros = []; const params = [];
  if (url.searchParams.get('desde')) { filtros.push('d.inicio >= ?'); params.push(url.searchParams.get('desde')); }
  if (url.searchParams.get('hasta')) { filtros.push('d.inicio <= ?'); params.push(url.searchParams.get('hasta')); }
  if (url.searchParams.get('equipo_id')) { filtros.push('d.equipo_id = ?'); params.push(Number(url.searchParams.get('equipo_id'))); }
  if (url.searchParams.get('estado')) { filtros.push('d.estado = ?'); params.push(url.searchParams.get('estado')); }
  const where = 'WHERE 1=1' + (filtros.length ? ' AND ' + filtros.join(' AND ') : '') + al.sql;
  return db.prepare(`
    SELECT d.*, e.codigo AS equipo_codigo, e.nombre AS equipo_nombre, e.capacidad_tanque, c.codigo AS cisterna_codigo, uo.nombre AS operador, uc.nombre AS chofer,
      (SELECT COUNT(*) FROM alertas a WHERE a.despacho_id = d.id) AS n_alertas
    FROM despachos d LEFT JOIN equipos e ON e.id = d.equipo_id JOIN cisternas c ON c.id = d.cisterna_id
    LEFT JOIN usuarios uo ON uo.id = d.operador_id LEFT JOIN usuarios uc ON uc.id = d.chofer_id
    ${where} ORDER BY d.inicio DESC LIMIT ?`).all(...params, ...al.params, limite);
});
ruta('GET', '/api/despachos/:id', async ({ usuario, params }) => {
  requerir(usuario);
  const d = q.despachoDetalle.get(Number(params.id));
  if (!d) throw new HttpError(404, 'Despacho no encontrado');
  d.alertas = db.prepare('SELECT * FROM alertas WHERE despacho_id = ? ORDER BY ts').all(d.id);
  return d;
});

// --- Alertas ---
ruta('GET', '/api/alertas', async ({ usuario, url }) => {
  const u = requerir(usuario);
  const aa = alcanceAlertas(u);
  const soloActivas = url.searchParams.get('activas') === '1';
  const limite = Math.min(Number(url.searchParams.get('limite') || 200), 1000);
  return db.prepare(`SELECT a.*, e.codigo AS equipo_codigo, c.codigo AS cisterna_codigo, u.nombre AS resuelta_por_nombre
    FROM alertas a LEFT JOIN equipos e ON e.id = a.equipo_id LEFT JOIN cisternas c ON c.id = a.cisterna_id LEFT JOIN usuarios u ON u.id = a.resuelta_por
    WHERE 1=1 ${soloActivas ? 'AND a.resuelta = 0' : ''}${aa.sql} ORDER BY a.ts DESC LIMIT ?`).all(...aa.params, limite);
});
ruta('POST', '/api/alertas/:id/resolver', async ({ usuario, params, cuerpo }) => {
  const u = requerir(usuario, 'admin', 'supervisor');
  const r = db.prepare('UPDATE alertas SET resuelta = 1, resuelta_por = ?, resuelta_ts = ?, nota = ? WHERE id = ? AND resuelta = 0').run(u.id, ahoraISO(), String(cuerpo.nota || '').slice(0, 500), Number(params.id));
  if (!r.changes) throw new HttpError(404, 'Alerta no encontrada o ya resuelta');
  q.insAuditoria.run(ahoraISO(), u.id, 'resolver_alerta', `alerta ${params.id}: ${cuerpo.nota || ''}`);
  emitir('alerta_resuelta', { id: Number(params.id), resuelta_por_nombre: u.nombre, nota: cuerpo.nota || '' });
  return { ok: true };
});

// --- Consumo agregado ---
ruta('GET', '/api/consumo/por-equipo', async ({ usuario, url }) => {
  const u = requerir(usuario); const al = alcanceDespachos(u);
  const dias = Number(url.searchParams.get('dias') || 7);
  return db.prepare(`SELECT e.id, e.codigo, e.nombre, e.tipo, e.consumo_nominal_lph, e.capacidad_tanque, uo.nombre AS operador,
      COALESCE(SUM(d.litros),0) AS litros, COUNT(d.id) AS despachos,
      COALESCE(SUM(CASE WHEN d.horometro > d.horometro_anterior THEN d.horometro - d.horometro_anterior END),0) AS horas
    FROM equipos e LEFT JOIN usuarios uo ON uo.id = e.operador_id
    LEFT JOIN despachos d ON d.equipo_id = e.id AND d.estado IN ('completado','cortado') AND d.inicio >= ? ${al.sql}
    WHERE ${u.rol === 'operador' ? 'e.operador_id = ?' : '1=1'}
    GROUP BY e.id ORDER BY litros DESC`).all(haceDias(dias - 1), ...al.params, ...(u.rol === 'operador' ? [u.id] : []))
    .map(r => ({ ...r, lph_real: r.horas > 0.5 ? r1(r.litros / r.horas) : null }));
});
ruta('GET', '/api/consumo/por-usuario', async ({ usuario, url }) => {
  const u = requerir(usuario); const al = alcanceDespachos(u);
  const dias = Number(url.searchParams.get('dias') || 7);
  return db.prepare(`SELECT uo.id, uo.nombre, uo.rol, COALESCE(SUM(d.litros),0) AS litros, COUNT(d.id) AS despachos,
      COUNT(DISTINCT d.equipo_id) AS equipos,
      (SELECT COUNT(*) FROM alertas a JOIN equipos e2 ON e2.id = a.equipo_id WHERE e2.operador_id = uo.id AND a.ts >= ?) AS alertas
    FROM usuarios uo LEFT JOIN despachos d ON d.operador_id = uo.id AND d.estado IN ('completado','cortado') AND d.inicio >= ? ${al.sql}
    WHERE uo.rol = 'operador' AND uo.activo = 1 ${u.rol === 'operador' ? 'AND uo.id = ?' : ''}
    GROUP BY uo.id ORDER BY litros DESC`).all(haceDias(dias - 1), haceDias(dias - 1), ...al.params, ...(u.rol === 'operador' ? [u.id] : []));
});
ruta('GET', '/api/consumo/por-dia', async ({ usuario, url }) => {
  const u = requerir(usuario); const al = alcanceDespachos(u);
  const dias = Number(url.searchParams.get('dias') || 14);
  const filas = db.prepare(`SELECT d.inicio, d.litros FROM despachos d WHERE d.estado IN ('completado','cortado') AND d.inicio >= ?${al.sql}`).all(haceDias(dias - 1), ...al.params);
  const buckets = new Map();
  for (let i = dias - 1; i >= 0; i--) { const k = haceDias(i).slice(0, 10); buckets.set(k, 0); }
  for (const f of filas) { const k = inicioDelDia(new Date(f.inicio)).slice(0, 10); if (buckets.has(k)) buckets.set(k, buckets.get(k) + f.litros); }
  return [...buckets].map(([dia, litros]) => ({ dia, litros: r1(litros) }));
});
ruta('GET', '/api/consumo/por-hora', async ({ usuario }) => {
  const u = requerir(usuario); const al = alcanceDespachos(u);
  const filas = db.prepare(`SELECT d.inicio, d.litros FROM despachos d WHERE d.estado IN ('completado','cortado','en_curso') AND d.inicio >= ?${al.sql}`).all(inicioDelDia(), ...al.params);
  const horas = Array.from({ length: 24 }, (_, h) => ({ hora: h, litros: 0 }));
  for (const f of filas) horas[new Date(f.inicio).getHours()].litros += f.litros;
  return horas.map(h => ({ ...h, litros: r1(h.litros) }));
});
ruta('GET', '/api/balance', async ({ usuario, url }) => {
  const u = requerir(usuario, 'admin', 'supervisor', 'chofer');
  const dias = Number(url.searchParams.get('dias') || 7);
  const desde = haceDias(dias - 1);
  let cisternas = db.prepare('SELECT * FROM cisternas ORDER BY codigo').all();
  if (u.rol === 'chofer') cisternas = cisternas.filter(c => c.id === u.cisterna_id);
  return cisternas.map(c => {
    // El balance físico solo es válido desde la primera lectura del sensor de nivel dentro del periodo.
    const primera = db.prepare('SELECT nivel, ts FROM lecturas_nivel WHERE cisterna_id = ? AND ts >= ? ORDER BY ts LIMIT 1').get(c.id, desde);
    const desdeFisico = primera ? primera.ts : desde;
    const recargas = db.prepare('SELECT COALESCE(SUM(litros),0) AS l, COUNT(*) AS n FROM recargas WHERE cisterna_id = ? AND ts >= ?').get(c.id, desdeFisico);
    const desp = db.prepare(`SELECT COALESCE(SUM(litros),0) AS l, COUNT(*) AS n FROM despachos WHERE cisterna_id = ? AND estado IN ('completado','cortado') AND inicio >= ?`).get(c.id, desdeFisico);
    const merma = db.prepare(`SELECT COALESCE(SUM(litros_afectados),0) AS l, COUNT(*) AS n FROM alertas WHERE cisterna_id = ? AND ts >= ? AND tipo IN ('merma_cisterna','descuadre_caudalimetro')`).get(c.id, desde);
    const stockInicial = primera ? primera.nivel : c.nivel_actual + desp.l - recargas.l;
    const b = reglas.balance(stockInicial, recargas.l, desp.l, c.nivel_actual);
    return { cisterna: c.codigo, placa: c.placa, capacidad: c.capacidad, desde: desdeFisico, stock_inicial: r1(stockInicial), recargas_l: r1(recargas.l), recargas_n: recargas.n,
      despachado_l: r1(desp.l), despachos_n: desp.n, stock_final: r1(c.nivel_actual), teorico: r1(b.teorico), merma_l: r1(b.merma), merma_pct: r1(b.mermaPct), merma_detectada_l: r1(merma.l), eventos_merma: merma.n };
  });
});

// --- Catálogos ---
ruta('GET', '/api/equipos', async ({ usuario }) => {
  const u = requerir(usuario);
  const filtro = u.rol === 'operador' ? 'WHERE e.operador_id = ?' : '';
  return db.prepare(`SELECT e.*, uo.nombre AS operador,
      (SELECT MAX(fin) FROM despachos WHERE equipo_id = e.id AND estado IN ('completado','cortado')) AS ultimo_despacho,
      (SELECT litros FROM despachos WHERE equipo_id = e.id AND estado IN ('completado','cortado') ORDER BY fin DESC LIMIT 1) AS ultimos_litros,
      (SELECT COUNT(*) FROM alertas WHERE equipo_id = e.id AND resuelta = 0) AS alertas_activas
    FROM equipos e LEFT JOIN usuarios uo ON uo.id = e.operador_id ${filtro} ORDER BY e.codigo`).all(...(filtro ? [u.id] : []));
});
ruta('POST', '/api/equipos', async ({ usuario, cuerpo }) => {
  const u = requerir(usuario, 'admin');
  const { codigo, nombre, tipo, capacidad_tanque, tag_rfid, operador_id, consumo_nominal_lph, horometro } = cuerpo;
  if (!codigo || !nombre || !capacidad_tanque) throw new HttpError(400, 'codigo, nombre y capacidad_tanque son obligatorios');
  try {
    const r = db.prepare(`INSERT INTO equipos (codigo, nombre, tipo, capacidad_tanque, tag_rfid, operador_id, consumo_nominal_lph, horometro) VALUES (?,?,?,?,?,?,?,?)`)
      .run(String(codigo).toUpperCase(), nombre, tipo || 'Otro', Number(capacidad_tanque), tag_rfid ? String(tag_rfid).toUpperCase() : null, operador_id || null, Number(consumo_nominal_lph || 20), Number(horometro || 0));
    q.insAuditoria.run(ahoraISO(), u.id, 'crear_equipo', codigo);
    emitir('catalogo', { entidad: 'equipos' });
    return q.equipoPorId.get(Number(r.lastInsertRowid));
  } catch (e) { if (/UNIQUE/.test(e.message)) throw new HttpError(409, 'Código o tag RFID ya existe'); throw e; }
});
ruta('PUT', '/api/equipos/:id', async ({ usuario, params, cuerpo }) => {
  const u = requerir(usuario, 'admin');
  const e = q.equipoPorId.get(Number(params.id)); if (!e) throw new HttpError(404, 'Equipo no encontrado');
  const campos = ['nombre', 'tipo', 'capacidad_tanque', 'tag_rfid', 'operador_id', 'consumo_nominal_lph', 'horometro', 'activo'];
  const sets = [], vals = [];
  for (const c of campos) if (c in cuerpo) { sets.push(`${c} = ?`); vals.push(cuerpo[c] === '' ? null : cuerpo[c]); }
  if (!sets.length) throw new HttpError(400, 'Nada que actualizar');
  try { db.prepare(`UPDATE equipos SET ${sets.join(', ')} WHERE id = ?`).run(...vals, e.id); }
  catch (er) { if (/UNIQUE/.test(er.message)) throw new HttpError(409, 'Tag RFID ya asignado a otro equipo'); throw er; }
  q.insAuditoria.run(ahoraISO(), u.id, 'editar_equipo', `${e.codigo}: ${JSON.stringify(cuerpo)}`);
  emitir('catalogo', { entidad: 'equipos' });
  return q.equipoPorId.get(e.id);
});
ruta('GET', '/api/cisternas', async ({ usuario }) => {
  const u = requerir(usuario, 'admin', 'supervisor', 'chofer');
  let lista = db.prepare(`SELECT c.id, c.codigo, c.placa, c.capacidad, c.nivel_actual, c.k_factor, c.caudal_min, c.caudal_max, c.lat, c.lng, c.ultima_lectura, c.en_linea, u.nombre AS chofer, c.chofer_id
    FROM cisternas c LEFT JOIN usuarios u ON u.id = c.chofer_id ORDER BY c.codigo`).all();
  if (u.rol === 'chofer') lista = lista.filter(c => c.id === u.cisterna_id);
  return lista;
});
ruta('GET', '/api/usuarios', async ({ usuario }) => {
  requerir(usuario, 'admin', 'supervisor');
  return db.prepare(`SELECT u.id, u.nombre, u.usuario, u.rol, u.activo, u.creado,
      (SELECT GROUP_CONCAT(codigo, ', ') FROM equipos WHERE operador_id = u.id) AS equipos,
      (SELECT codigo FROM cisternas WHERE chofer_id = u.id) AS cisterna
    FROM usuarios u ORDER BY u.rol, u.nombre`).all();
});
ruta('POST', '/api/usuarios', async ({ usuario, cuerpo }) => {
  const u = requerir(usuario, 'admin');
  const { nombre, usuario: login, pin, rol } = cuerpo;
  if (!nombre || !login || !pin || !rol) throw new HttpError(400, 'nombre, usuario, pin y rol son obligatorios');
  if (!/^\d{4,8}$/.test(String(pin))) throw new HttpError(400, 'El PIN debe tener entre 4 y 8 dígitos');
  try {
    const r = db.prepare('INSERT INTO usuarios (nombre, usuario, pin_hash, rol) VALUES (?,?,?,?)').run(nombre, String(login).trim().toLowerCase(), hashPin(pin), rol);
    q.insAuditoria.run(ahoraISO(), u.id, 'crear_usuario', login);
    emitir('catalogo', { entidad: 'usuarios' });
    return { id: Number(r.lastInsertRowid), nombre, usuario: login, rol };
  } catch (e) { if (/UNIQUE/.test(e.message)) throw new HttpError(409, 'El nombre de usuario ya existe'); throw e; }
});
ruta('PUT', '/api/usuarios/:id', async ({ usuario, params, cuerpo }) => {
  const u = requerir(usuario, 'admin');
  const sets = [], vals = [];
  if ('nombre' in cuerpo) { sets.push('nombre = ?'); vals.push(cuerpo.nombre); }
  if ('rol' in cuerpo) { sets.push('rol = ?'); vals.push(cuerpo.rol); }
  if ('activo' in cuerpo) { sets.push('activo = ?'); vals.push(cuerpo.activo ? 1 : 0); }
  if (cuerpo.pin) { if (!/^\d{4,8}$/.test(String(cuerpo.pin))) throw new HttpError(400, 'PIN inválido'); sets.push('pin_hash = ?'); vals.push(hashPin(cuerpo.pin)); }
  if (!sets.length) throw new HttpError(400, 'Nada que actualizar');
  db.prepare(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ?`).run(...vals, Number(params.id));
  q.insAuditoria.run(ahoraISO(), u.id, 'editar_usuario', `${params.id}: ${Object.keys(cuerpo).join(',')}`);
  emitir('catalogo', { entidad: 'usuarios' });
  return { ok: true };
});
ruta('GET', '/api/parametros', async ({ usuario }) => { requerir(usuario, 'admin', 'supervisor'); return todosParametros(); });
ruta('PUT', '/api/parametros', async ({ usuario, cuerpo }) => {
  const u = requerir(usuario, 'admin');
  const permitidas = ['empresa', 'moneda', 'precio_litro', 'tolerancia_descuadre_pct', 'tolerancia_descuadre_l', 'merma_umbral_l', 'horario_inicio', 'horario_fin', 'geocerca_lat', 'geocerca_lng', 'geocerca_radio_m', 'factor_sobrellenado', 'minutos_entre_despachos', 'factor_consumo_anomalo', 'precision_nivel_pct'];
  for (const [k, v] of Object.entries(cuerpo)) if (permitidas.includes(k)) setParametro(k, v);
  q.insAuditoria.run(ahoraISO(), u.id, 'editar_parametros', JSON.stringify(cuerpo));
  return todosParametros();
});
ruta('GET', '/api/auditoria', async ({ usuario }) => {
  requerir(usuario, 'admin');
  return db.prepare('SELECT a.*, u.nombre FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id ORDER BY a.id DESC LIMIT 200').all();
});
ruta('GET', '/api/recargas', async ({ usuario }) => {
  const u = requerir(usuario, 'admin', 'supervisor', 'chofer');
  const filtro = u.rol === 'chofer' ? 'WHERE r.cisterna_id = ?' : '';
  return db.prepare(`SELECT r.*, c.codigo AS cisterna_codigo FROM recargas r JOIN cisternas c ON c.id = r.cisterna_id ${filtro} ORDER BY r.ts DESC LIMIT 100`).all(...(filtro ? [u.cisterna_id] : []));
});

// --- Tiempo real (SSE) ---
ruta('GET', '/api/stream', async ({ usuario, req, res }) => {
  const u = requerir(usuario);
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write(`event: conectado\ndata: ${JSON.stringify({ usuario: u.nombre, rol: u.rol, ts: ahoraISO() })}\n\n`);
  const cliente = { res, usuario: u };
  clientesSSE.add(cliente);
  req.on('close', () => clientesSSE.delete(cliente));
  return undefined; // respuesta ya manejada
});

// ------------------------------------------------------------------
// Telemetría de dispositivos (controlador del camión cisterna)
// ------------------------------------------------------------------
function cisternaDesde(req) {
  const key = req.headers['x-device-key'];
  if (!key) throw new HttpError(401, 'Falta x-device-key');
  const c = qCisternaPorKey.get(String(key));
  if (!c) throw new HttpError(401, 'Dispositivo no registrado');
  return c;
}
ruta('GET', '/api/dispositivo/whitelist', async ({ req }) => {
  cisternaDesde(req);
  return {
    equipos: db.prepare('SELECT tag_rfid AS tag, codigo, capacidad_tanque AS capacidad, horometro, consumo_nominal_lph AS lph FROM equipos WHERE activo = 1 AND tag_rfid IS NOT NULL').all(),
    parametros: { factor_sobrellenado: paramNum('factor_sobrellenado', 1.1), horario_inicio: paramNum('horario_inicio', 5), horario_fin: paramNum('horario_fin', 22) },
  };
});
ruta('POST', '/api/dispositivo/heartbeat', async ({ req, cuerpo }) => {
  const c = cisternaDesde(req);
  db.prepare('UPDATE cisternas SET en_linea = 1, ultima_lectura = ?, lat = COALESCE(?, lat), lng = COALESCE(?, lng) WHERE id = ?').run(ahoraISO(), cuerpo.lat ?? null, cuerpo.lng ?? null, c.id);
  // El controlador recibe el último nivel conocido y su configuración para operar coherente tras un reinicio.
  return { ok: true, hora_servidor: ahoraISO(), cisterna: { codigo: c.codigo, capacidad: c.capacidad, nivel_actual: c.nivel_actual, k_factor: c.k_factor, caudal_min: c.caudal_min, caudal_max: c.caudal_max } };
});

ruta('POST', '/api/dispositivo/despacho/inicio', async ({ req, cuerpo }) => {
  const cisterna = cisternaDesde(req);
  const tag = cuerpo.tag ? String(cuerpo.tag).toUpperCase() : null;
  const enCurso = q.despachoEnCursoCisterna.get(cisterna.id);
  if (enCurso) throw new HttpError(409, `Ya hay un despacho en curso (#${enCurso.id}) en ${cisterna.codigo}`);
  const equipo = tag ? q.equipoPorTag.get(tag) : null;
  const ultimo = equipo ? q.ultimoDespachoEquipo.get(equipo.id) : null;
  const lat = cuerpo.lat ?? cisterna.lat, lng = cuerpo.lng ?? cisterna.lng;
  const ev = reglas.evaluarInicio({ tag, equipo, cisterna, lat, lng, ahora: new Date(), ultimoDespachoEquipo: ultimo });
  const nivelAntes = cuerpo.nivel ?? cisterna.nivel_actual;
  const horometro = cuerpo.horometro != null ? Number(cuerpo.horometro) : null;
  const r = q.insDespacho.run(cisterna.id, equipo ? equipo.id : null, tag, cisterna.chofer_id, equipo ? equipo.operador_id : null, ahoraISO(), 0, 0, lat, lng,
    horometro, equipo ? equipo.horometro : null, nivelAntes, ev.rechazar ? 'rechazado' : 'en_curso', ev.rechazar ? ev.alertas.map(a => a.tipo).join(',') : null);
  const id = Number(r.lastInsertRowid);
  registrarAlertas(ev.alertas, { despacho_id: id, cisterna_id: cisterna.id, equipo_id: equipo ? equipo.id : null, operador_id: equipo ? equipo.operador_id : null });
  const detalle = q.despachoDetalle.get(id);
  if (ev.rechazar) {
    emitir('despacho_rechazado', detalle, { cisterna_id: cisterna.id, operador_id: equipo ? equipo.operador_id : null });
    return { autorizado: false, despacho_id: id, motivo: ev.alertas.map(a => a.mensaje).join(' ') };
  }
  emitir('despacho_inicio', detalle, { cisterna_id: cisterna.id, operador_id: equipo.operador_id });
  return { autorizado: true, despacho_id: id, equipo: { codigo: equipo.codigo, nombre: equipo.nombre, operador: equipo.operador }, max_litros: r1(equipo.capacidad_tanque * paramNum('factor_sobrellenado', 1.1)), advertencias: ev.alertas.map(a => a.tipo) };
});

ruta('POST', '/api/dispositivo/despacho/pulso', async ({ req, cuerpo }) => {
  const cisterna = cisternaDesde(req);
  const d = q.despachoPorId.get(Number(cuerpo.despacho_id));
  if (!d || d.cisterna_id !== cisterna.id) throw new HttpError(404, 'Despacho no encontrado para este dispositivo');
  if (d.estado !== 'en_curso') return { ok: false, cortar: true, motivo: `Despacho ${d.estado}` };
  const pulsos = Number(cuerpo.pulsos ?? Math.round(Number(cuerpo.litros) * cisterna.k_factor));
  const litros = cuerpo.litros != null ? Number(cuerpo.litros) : pulsos / cisterna.k_factor;
  const caudal = cuerpo.caudal != null ? Number(cuerpo.caudal) : null;
  q.updPulso.run(r1(litros), pulsos, caudal, ahoraISO(), d.id);
  const equipo = d.equipo_id ? q.equipoPorId.get(d.equipo_id) : null;
  const marcas = pulsoMarcas.get(d.id) || {};
  if (caudal != null && caudal > 0) { marcas._sumCaudal = (marcas._sumCaudal || 0) + caudal; marcas._nCaudal = (marcas._nCaudal || 0) + 1; }
  const ev = reglas.evaluarPulso({ despacho: { ...d, ...marcas }, equipo, cisterna, litros, caudal });
  if (ev.alertas.some(a => a.tipo === 'sobrellenado')) marcas._alertaSobrellenado = true;
  if (ev.alertas.some(a => a.tipo === 'caudal_anomalo')) marcas._alertaCaudal = true;
  pulsoMarcas.set(d.id, marcas);
  registrarAlertas(ev.alertas, { despacho_id: d.id, cisterna_id: cisterna.id, equipo_id: d.equipo_id, operador_id: d.operador_id });
  emitir('despacho_pulso', { id: d.id, cisterna_id: cisterna.id, cisterna_codigo: cisterna.codigo, equipo_codigo: equipo ? equipo.codigo : null, capacidad_tanque: equipo ? equipo.capacidad_tanque : null, litros: r1(litros), pulsos, caudal, operador_id: d.operador_id },
    { cisterna_id: cisterna.id, operador_id: d.operador_id });
  return { ok: true, cortar: ev.cortar, litros: r1(litros) };
});
const pulsoMarcas = new Map();

ruta('POST', '/api/dispositivo/despacho/fin', async ({ req, cuerpo }) => {
  const cisterna = cisternaDesde(req);
  const d = q.despachoPorId.get(Number(cuerpo.despacho_id));
  if (!d || d.cisterna_id !== cisterna.id) throw new HttpError(404, 'Despacho no encontrado para este dispositivo');
  if (d.estado !== 'en_curso') throw new HttpError(409, `El despacho ya está ${d.estado}`);
  const pulsos = Number(cuerpo.pulsos ?? d.pulsos);
  const litros = cuerpo.litros != null ? Number(cuerpo.litros) : pulsos / cisterna.k_factor;
  const fin = ahoraISO();
  const minutos = Math.max((new Date(fin) - new Date(d.inicio)) / 60000, 1 / 60);
  const marcasFin = pulsoMarcas.get(d.id) || {};
  const caudalProm = cuerpo.caudal_prom != null ? r1(Number(cuerpo.caudal_prom)) : marcasFin._nCaudal ? r1(marcasFin._sumCaudal / marcasFin._nCaudal) : r1(litros / minutos);
  const nivelDespues = cuerpo.nivel != null ? Number(cuerpo.nivel) : null;
  const equipo = d.equipo_id ? q.equipoPorId.get(d.equipo_id) : null;
  const motivo = cuerpo.motivo || null;
  const estado = motivo && motivo !== 'normal' ? 'cortado' : 'completado';
  const anterior = q.ultimoHash.get();
  const hash = calcularHash({ ...d, fin, litros: r1(litros), pulsos }, anterior ? anterior.hash : null);
  q.updFin.run(fin, r1(litros), pulsos, caudalProm, nivelDespues, estado, motivo, hash, d.id);
  if (nivelDespues != null) { q.updNivelCisterna.run(nivelDespues, fin, null, null, cisterna.id); q.insLectura.run(cisterna.id, fin, nivelDespues, cisterna.lat, cisterna.lng); }
  else db.prepare('UPDATE cisternas SET nivel_actual = MAX(0, nivel_actual - ?), ultima_lectura = ? WHERE id = ?').run(r1(litros), fin, cisterna.id);
  if (equipo && d.horometro != null) q.updHorometro.run(d.horometro, equipo.id);
  const ultimo = equipo ? q.ultimoDespachoEquipo.get(equipo.id) : null;
  const ev = reglas.evaluarFin({ despacho: d, equipo, cisterna, litros, fin, nivelAntes: d.nivel_antes, nivelDespues, horometro: d.horometro, horometroAnterior: d.horometro_anterior, ultimoDespachoEquipo: ultimo && ultimo.id !== d.id ? ultimo : null });
  registrarAlertas(ev.alertas, { despacho_id: d.id, cisterna_id: cisterna.id, equipo_id: d.equipo_id, operador_id: d.operador_id });
  pulsoMarcas.delete(d.id);
  const detalle = q.despachoDetalle.get(d.id);
  emitir('despacho_fin', detalle, { cisterna_id: cisterna.id, operador_id: d.operador_id });
  emitir('nivel', { cisterna_id: cisterna.id, codigo: cisterna.codigo, nivel: nivelDespues ?? q.cisternaPorId.get(cisterna.id).nivel_actual, capacidad: cisterna.capacidad }, { cisterna_id: cisterna.id });
  return { ok: true, estado, litros: r1(litros), hash, alertas: ev.alertas.map(a => a.tipo) };
});

ruta('POST', '/api/dispositivo/nivel', async ({ req, cuerpo }) => {
  const cisterna = cisternaDesde(req);
  const nivel = Number(cuerpo.nivel);
  if (!Number.isFinite(nivel)) throw new HttpError(400, 'nivel inválido');
  const enCurso = q.despachoEnCursoCisterna.get(cisterna.id);
  const ev = reglas.evaluarNivel({ cisterna, nivelAnterior: cisterna.ultima_lectura ? cisterna.nivel_actual : null, nivelNuevo: nivel, despachoEnCurso: !!enCurso });
  q.updNivelCisterna.run(nivel, ahoraISO(), cuerpo.lat ?? null, cuerpo.lng ?? null, cisterna.id);
  q.insLectura.run(cisterna.id, ahoraISO(), nivel, cuerpo.lat ?? null, cuerpo.lng ?? null);
  registrarAlertas(ev.alertas, { cisterna_id: cisterna.id });
  emitir('nivel', { cisterna_id: cisterna.id, codigo: cisterna.codigo, nivel, capacidad: cisterna.capacidad, lat: cuerpo.lat, lng: cuerpo.lng }, { cisterna_id: cisterna.id });
  return { ok: true, alertas: ev.alertas.map(a => a.tipo) };
});

ruta('POST', '/api/dispositivo/recarga', async ({ req, cuerpo }) => {
  const cisterna = cisternaDesde(req);
  const litros = Number(cuerpo.litros);
  if (!(litros > 0)) throw new HttpError(400, 'litros inválido');
  const nivelDespues = cuerpo.nivel_despues != null ? Number(cuerpo.nivel_despues) : Math.min(cisterna.capacidad, cisterna.nivel_actual + litros);
  q.insRecarga.run(cisterna.id, ahoraISO(), litros, cuerpo.guia || null, cisterna.nivel_actual, nivelDespues);
  q.updNivelCisterna.run(nivelDespues, ahoraISO(), null, null, cisterna.id);
  q.insLectura.run(cisterna.id, ahoraISO(), nivelDespues, cisterna.lat, cisterna.lng);
  const dif = nivelDespues - cisterna.nivel_actual - litros;
  if (Math.abs(dif) > Math.max(paramNum('tolerancia_descuadre_l', 10) * 3, litros * 0.02)) {
    registrarAlertas([{ tipo: 'recarga_descuadrada', severidad: 'alta', litros: Math.abs(dif),
      mensaje: `Recarga de ${litros} L en ${cisterna.codigo} (guía ${cuerpo.guia || 's/n'}) pero el nivel subió ${Math.round(nivelDespues - cisterna.nivel_actual)} L. Diferencia ${Math.round(dif)} L con el proveedor.` }], { cisterna_id: cisterna.id });
  }
  emitir('recarga', { cisterna_id: cisterna.id, codigo: cisterna.codigo, litros, guia: cuerpo.guia, nivel: nivelDespues, capacidad: cisterna.capacidad }, { cisterna_id: cisterna.id });
  emitir('nivel', { cisterna_id: cisterna.id, codigo: cisterna.codigo, nivel: nivelDespues, capacidad: cisterna.capacidad }, { cisterna_id: cisterna.id });
  return { ok: true, nivel: nivelDespues };
});

// Vigilante: despachos sin señal y cisternas fuera de línea.
setInterval(() => {
  const limite = new Date(Date.now() - 90e3).toISOString();
  for (const d of db.prepare(`SELECT * FROM despachos WHERE estado = 'en_curso' AND COALESCE(ultimo_pulso, inicio) < ?`).all(limite)) {
    // Sin pulsos del caudalímetro durante 90 s: se asume pérdida de señal y se cierra con lo medido.
    const cis = q.cisternaPorId.get(d.cisterna_id);
    const fin = ahoraISO();
    q.updFin.run(fin, d.litros, d.pulsos, null, null, 'cortado', 'sin_senal', null, d.id);
    registrarAlertas([{ tipo: 'sin_senal', severidad: 'media', mensaje: `Se perdió comunicación con ${cis.codigo} durante el despacho #${d.id} (${Math.round(d.litros)} L medidos). Cerrado por el servidor.` }],
      { despacho_id: d.id, cisterna_id: d.cisterna_id, equipo_id: d.equipo_id, operador_id: d.operador_id });
    emitir('despacho_fin', q.despachoDetalle.get(d.id), { cisterna_id: d.cisterna_id, operador_id: d.operador_id });
  }
  const offline = new Date(Date.now() - 120e3).toISOString();
  const r = db.prepare('UPDATE cisternas SET en_linea = 0 WHERE en_linea = 1 AND (ultima_lectura IS NULL OR ultima_lectura < ?)').run(offline);
  if (r.changes) emitir('catalogo', { entidad: 'cisternas' });
}, 30000).unref();

// ------------------------------------------------------------------
// Archivos estáticos
// ------------------------------------------------------------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8' };
function servirEstatico(url, res) {
  let ruta = decodeURIComponent(url.pathname);
  if (ruta === '/') ruta = '/index.html';
  const archivo = path.normalize(path.join(PUBLIC_DIR, ruta));
  if (!archivo.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(archivo, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

// ------------------------------------------------------------------
// Servidor
// ------------------------------------------------------------------
const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-device-key', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE' }); return res.end(); }
  if (!url.pathname.startsWith('/api/')) return servirEstatico(url, res);
  try {
    const r = rutas.find(x => x.metodo === req.method && x.re.test(url.pathname));
    if (!r) throw new HttpError(404, 'Ruta no encontrada');
    const m = url.pathname.match(r.re);
    const params = Object.fromEntries(r.claves.map((k, i) => [k, m[i + 1]]));
    const cuerpo = req.method === 'GET' ? {} : await leerCuerpo(req);
    const usuario = usuarioDesde(req, url);
    const salida = await r.manejador({ req, res, url, params, cuerpo, usuario });
    if (salida !== undefined) json(res, 200, salida);
  } catch (e) {
    const codigo = e.codigo || 500;
    if (codigo === 500) console.error('[error]', req.method, url.pathname, e);
    json(res, codigo, { error: e.message || 'Error interno' });
  }
});

if (require.main === module) {
  servidor.listen(PUERTO, () => {
    console.log(`FuelGuard escuchando en http://localhost:${PUERTO}`);
    console.log(`Base de datos: ${require('./db').DB_PATH}`);
    console.log('Usuarios demo: admin/1234, supervisor/1111, chofer1/2222, jtorres/4444 (operador)');
  });
}
module.exports = { servidor, emitir };
