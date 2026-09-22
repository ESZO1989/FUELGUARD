'use strict';
// Capa de persistencia: SQLite integrado en Node (node:sqlite), sin dependencias externas.
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.FUELGUARD_DB || path.join(DATA_DIR, 'fuelguard.db');

let db;

function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  crearEsquema(db);
  if (estaVacia(db)) sembrar(db);
  migrar(db);
  return db;
}

function crearEsquema(db) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS parametros (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    usuario TEXT NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin','supervisor','chofer','operador')),
    activo INTEGER NOT NULL DEFAULT 1,
    creado TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS cisternas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    placa TEXT NOT NULL,
    capacidad REAL NOT NULL,
    nivel_actual REAL NOT NULL DEFAULT 0,
    chofer_id INTEGER REFERENCES usuarios(id),
    device_key TEXT NOT NULL UNIQUE,
    k_factor REAL NOT NULL DEFAULT 100,
    caudal_min REAL NOT NULL DEFAULT 10,
    caudal_max REAL NOT NULL DEFAULT 120,
    lat REAL, lng REAL,
    ultima_lectura TEXT,
    en_linea INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS equipos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    capacidad_tanque REAL NOT NULL,
    tag_rfid TEXT UNIQUE,
    operador_id INTEGER REFERENCES usuarios(id),
    consumo_nominal_lph REAL NOT NULL DEFAULT 20,
    horometro REAL NOT NULL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS despachos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cisterna_id INTEGER NOT NULL REFERENCES cisternas(id),
    equipo_id INTEGER REFERENCES equipos(id),
    tag_rfid TEXT,
    chofer_id INTEGER REFERENCES usuarios(id),
    operador_id INTEGER REFERENCES usuarios(id),
    inicio TEXT NOT NULL,
    fin TEXT,
    litros REAL NOT NULL DEFAULT 0,
    pulsos INTEGER NOT NULL DEFAULT 0,
    caudal_prom REAL,
    caudal_actual REAL,
    lat REAL, lng REAL,
    horometro REAL,
    horometro_anterior REAL,
    nivel_antes REAL,
    nivel_despues REAL,
    estado TEXT NOT NULL CHECK (estado IN ('en_curso','completado','rechazado','cortado')),
    motivo TEXT,
    hash TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_despachos_inicio ON despachos(inicio);
  CREATE INDEX IF NOT EXISTS idx_despachos_equipo ON despachos(equipo_id);
  CREATE TABLE IF NOT EXISTS alertas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    tipo TEXT NOT NULL,
    severidad TEXT NOT NULL CHECK (severidad IN ('info','media','alta','critica')),
    mensaje TEXT NOT NULL,
    despacho_id INTEGER REFERENCES despachos(id),
    cisterna_id INTEGER REFERENCES cisternas(id),
    equipo_id INTEGER REFERENCES equipos(id),
    litros_afectados REAL DEFAULT 0,
    resuelta INTEGER NOT NULL DEFAULT 0,
    resuelta_por INTEGER REFERENCES usuarios(id),
    resuelta_ts TEXT,
    nota TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_alertas_ts ON alertas(ts);
  CREATE TABLE IF NOT EXISTS lecturas_nivel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cisterna_id INTEGER NOT NULL REFERENCES cisternas(id),
    ts TEXT NOT NULL,
    nivel REAL NOT NULL,
    lat REAL, lng REAL
  );
  CREATE INDEX IF NOT EXISTS idx_lecturas_cist ON lecturas_nivel(cisterna_id, ts);
  CREATE TABLE IF NOT EXISTS recargas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cisterna_id INTEGER NOT NULL REFERENCES cisternas(id),
    ts TEXT NOT NULL,
    litros REAL NOT NULL,
    guia TEXT,
    nivel_antes REAL, nivel_despues REAL
  );
  CREATE TABLE IF NOT EXISTS sesiones (
    token TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    creado TEXT NOT NULL,
    expira TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    usuario_id INTEGER,
    accion TEXT NOT NULL,
    detalle TEXT
  );
  `);
}

// Migraciones idempotentes para bases creadas con versiones anteriores.
const PARAMS_DEFECTO = { precision_nivel_pct: '0.5' };
function migrar(db) {
  const cols = db.prepare('PRAGMA table_info(despachos)').all().map(c => c.name);
  if (!cols.includes('ultimo_pulso')) db.exec('ALTER TABLE despachos ADD COLUMN ultimo_pulso TEXT');
  const ins = db.prepare('INSERT OR IGNORE INTO parametros (clave, valor) VALUES (?,?)');
  for (const [k, v] of Object.entries(PARAMS_DEFECTO)) ins.run(k, v);
}

function estaVacia(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n === 0;
}

function hashPin(pin) {
  return crypto.createHash('sha256').update('fuelguard:' + String(pin)).digest('hex');
}

// ---------- Datos semilla (demostración) ----------
function sembrar(db) {
  const ahora = new Date();
  const insU = db.prepare('INSERT INTO usuarios (nombre, usuario, pin_hash, rol) VALUES (?,?,?,?)');
  const usuarios = [
    ['Administrador General', 'admin', '1234', 'admin'],
    ['Carla Ríos', 'supervisor', '1111', 'supervisor'],
    ['Luis Paredes', 'chofer1', '2222', 'chofer'],
    ['Marco Quispe', 'chofer2', '3333', 'chofer'],
    ['Juan Torres', 'jtorres', '4444', 'operador'],
    ['Ana Flores', 'aflores', '5555', 'operador'],
    ['Pedro Mamani', 'pmamani', '6666', 'operador'],
    ['Rosa Huamán', 'rhuaman', '7777', 'operador'],
    ['Diego Salas', 'dsalas', '8888', 'operador'],
    ['José Vargas', 'jvargas', '9999', 'operador'],
  ];
  const uid = {};
  for (const [nombre, usuario, pin, rol] of usuarios) {
    const r = insU.run(nombre, usuario, hashPin(pin), rol);
    uid[usuario] = Number(r.lastInsertRowid);
  }

  // Geocerca del proyecto (ejemplo: tajo / obra). Coordenadas genéricas.
  const params = {
    empresa: 'Proyecto Demo',
    moneda: 'USD',
    precio_litro: '1.20',
    tolerancia_descuadre_pct: '2',
    tolerancia_descuadre_l: '10',
    merma_umbral_l: '15',
    horario_inicio: '0',
    horario_fin: '24',
    geocerca_lat: '-16.4090',
    geocerca_lng: '-71.5375',
    geocerca_radio_m: '3000',
    factor_sobrellenado: '1.10',
    minutos_entre_despachos: '30',
    factor_consumo_anomalo: '1.35',
    precision_nivel_pct: '0.5',
  };
  const insP = db.prepare('INSERT INTO parametros (clave, valor) VALUES (?,?)');
  for (const [k, v] of Object.entries(params)) insP.run(k, v);

  const insC = db.prepare(`INSERT INTO cisternas (codigo, placa, capacidad, nivel_actual, chofer_id, device_key, k_factor, caudal_min, caudal_max, lat, lng)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const c1 = Number(insC.run('CIST-01', 'ABC-123', 10000, 7800, uid.chofer1, 'dev-cist-01-k9', 100, 10, 120, -16.4085, -71.5370).lastInsertRowid);
  const c2 = Number(insC.run('CIST-02', 'XYZ-789', 5000, 3900, uid.chofer2, 'dev-cist-02-k9', 100, 10, 120, -16.4102, -71.5388).lastInsertRowid);

  const insE = db.prepare(`INSERT INTO equipos (codigo, nombre, tipo, capacidad_tanque, tag_rfid, operador_id, consumo_nominal_lph, horometro)
    VALUES (?,?,?,?,?,?,?,?)`);
  const equipos = [
    ['EX-01', 'Excavadora CAT 336', 'Excavadora', 400, 'E200341A1B2C01', 'jtorres', 26, 4210],
    ['EX-02', 'Excavadora Komatsu PC350', 'Excavadora', 420, 'E200341A1B2C02', 'jtorres', 25, 3875],
    ['CF-01', 'Cargador Frontal CAT 950', 'Cargador', 300, 'E200341A1B2C03', 'aflores', 18, 5120],
    ['VQ-01', 'Volquete Volvo FMX 15m3', 'Volquete', 350, 'E200341A1B2C04', 'aflores', 20, 6230],
    ['VQ-02', 'Volquete Volvo FMX 15m3', 'Volquete', 350, 'E200341A1B2C05', 'pmamani', 20, 6015],
    ['VQ-03', 'Volquete Scania P410', 'Volquete', 350, 'E200341A1B2C06', 'pmamani', 21, 5890],
    ['TR-01', 'Tractor Oruga CAT D8', 'Tractor', 500, 'E200341A1B2C07', 'rhuaman', 32, 3320],
    ['MN-01', 'Motoniveladora CAT 140K', 'Motoniveladora', 350, 'E200341A1B2C08', 'rhuaman', 15, 2980],
    ['RD-01', 'Rodillo Dynapac CA250', 'Rodillo', 200, 'E200341A1B2C09', 'dsalas', 10, 2110],
    ['CP-01', 'Compresora Atlas Copco', 'Compresora', 150, 'E200341A1B2C10', 'dsalas', 8, 1540],
    ['GEN-01', 'Generador 250 kVA', 'Generador', 600, 'E200341A1B2C11', 'jvargas', 36, 8120],
    ['GEN-02', 'Generador 150 kVA', 'Generador', 400, 'E200341A1B2C12', 'jvargas', 22, 7430],
  ];
  const eid = [];
  for (const e of equipos) {
    const r = insE.run(e[0], e[1], e[2], e[3], e[4], uid[e[5]], e[6], e[7]);
    eid.push({ id: Number(r.lastInsertRowid), operador_id: uid[e[5]], cap: e[3], lph: e[6], horometro: e[7] });
  }

  // Historial de 14 días de despachos para que el dashboard tenga datos desde el inicio.
  const insD = db.prepare(`INSERT INTO despachos (cisterna_id, equipo_id, tag_rfid, chofer_id, operador_id, inicio, fin, litros, pulsos, caudal_prom, lat, lng, horometro, horometro_anterior, nivel_antes, nivel_despues, estado, motivo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insA = db.prepare(`INSERT INTO alertas (ts, tipo, severidad, mensaje, despacho_id, cisterna_id, equipo_id, litros_afectados, resuelta, nota)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const rnd = mulberry32(42);
  const horom = eid.map(e => e.horometro - 14 * 9);
  for (let d = 14; d >= 1; d--) {
    for (let i = 0; i < eid.length; i++) {
      if (rnd() < 0.25) continue; // no todos los equipos cargan todos los días
      const e = eid[i];
      const cist = i % 2 === 0 ? { id: c1, chofer: uid.chofer1 } : { id: c2, chofer: uid.chofer2 };
      const horasTrab = 6 + rnd() * 5;
      const hAnt = horom[i];
      horom[i] += horasTrab;
      let litros = Math.round(e.lph * horasTrab * (0.9 + rnd() * 0.2));
      litros = Math.min(litros, e.cap);
      const inicio = new Date(ahora);
      inicio.setDate(inicio.getDate() - d);
      inicio.setHours(6 + Math.floor(rnd() * 12), Math.floor(rnd() * 60), 0, 0);
      const caudal = 45 + rnd() * 30;
      const fin = new Date(inicio.getTime() + (litros / caudal) * 60000);
      const nivelAntes = 3000 + rnd() * 5000;
      let nivelDespues = nivelAntes - litros;
      let anomalia = null;
      if (rnd() < 0.06) { anomalia = 'descuadre'; nivelDespues -= 40 + rnd() * 60; }
      const r = insD.run(cist.id, e.id, equipos[i][4], cist.chofer, e.operador_id, inicio.toISOString(), fin.toISOString(),
        litros, litros * 100, Math.round(caudal * 10) / 10, -16.409 + (rnd() - 0.5) * 0.01, -71.5375 + (rnd() - 0.5) * 0.01,
        Math.round(horom[i] * 10) / 10, Math.round(hAnt * 10) / 10, Math.round(nivelAntes), Math.round(nivelDespues), 'completado', null);
      if (anomalia === 'descuadre') {
        const dif = Math.round(nivelAntes - nivelDespues - litros);
        insA.run(fin.toISOString(), 'descuadre_caudalimetro', 'alta',
          `Cisterna bajó ${dif} L más de lo medido por el caudalímetro durante el despacho a ${equipos[i][0]}. Posible bypass o fuga.`,
          Number(r.lastInsertRowid), cist.id, e.id, dif, d > 3 ? 1 : 0, d > 3 ? 'Revisado: fuga en manguera reparada' : null);
      }
    }
    // Alertas históricas de merma en cisterna (robo directo)
    if (d === 9 || d === 4) {
      const ts = new Date(ahora); ts.setDate(ts.getDate() - d); ts.setHours(23, 10, 0, 0);
      insA.run(ts.toISOString(), 'merma_cisterna', 'critica',
        `Caída de nivel de ${d === 9 ? 118 : 86} L en CIST-0${d === 9 ? 1 : 2} sin despacho en curso (fuera de horario, cisterna estacionada).`,
        null, d === 9 ? c1 : c2, null, d === 9 ? 118 : 86, d === 9 ? 1 : 0, d === 9 ? 'Denuncia interna. Se cambió candado de descarga.' : null);
    }
  }
  const updH = db.prepare('UPDATE equipos SET horometro = ? WHERE id = ?');
  eid.forEach((e, i) => updH.run(Math.round(horom[i] * 10) / 10, e.id));

  // Recargas históricas
  const insR = db.prepare('INSERT INTO recargas (cisterna_id, ts, litros, guia, nivel_antes, nivel_despues) VALUES (?,?,?,?,?,?)');
  for (let d = 12; d >= 2; d -= 5) {
    const ts = new Date(ahora); ts.setDate(ts.getDate() - d); ts.setHours(5, 30, 0, 0);
    insR.run(c1, ts.toISOString(), 8000, `GR-00${d}1`, 1800, 9800);
    insR.run(c2, ts.toISOString(), 4000, `GR-00${d}2`, 900, 4900);
  }
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Helpers ----------
function param(clave, porDefecto) {
  const r = getDb().prepare('SELECT valor FROM parametros WHERE clave = ?').get(clave);
  return r ? r.valor : porDefecto;
}
function paramNum(clave, porDefecto) {
  const v = Number(param(clave, porDefecto));
  return Number.isFinite(v) ? v : porDefecto;
}
function todosParametros() {
  const out = {};
  for (const r of getDb().prepare('SELECT clave, valor FROM parametros').all()) out[r.clave] = r.valor;
  return out;
}
function setParametro(clave, valor) {
  getDb().prepare('INSERT INTO parametros (clave, valor) VALUES (?,?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor').run(clave, String(valor));
}

module.exports = { getDb, hashPin, param, paramNum, todosParametros, setParametro, DB_PATH };
