'use strict';
// Pruebas del motor de reglas antirrobo. Ejecutar: npm test
process.env.FUELGUARD_DB = require('node:path').join(require('node:os').tmpdir(), `fuelguard-test-${process.pid}.db`);
const test = require('node:test');
const assert = require('node:assert/strict');
const reglas = require('../server/rules');
const { getDb } = require('../server/db');
getDb(); // crea esquema + parámetros semilla

const cisterna = { id: 1, codigo: 'CIST-01', capacidad: 10000, caudal_min: 10, caudal_max: 120, chofer_id: 3 };
const equipo = { id: 1, codigo: 'EX-01', activo: 1, capacidad_tanque: 400, consumo_nominal_lph: 25, operador_id: 5 };
const enGeocerca = { lat: -16.4090, lng: -71.5375 };
const mediodia = new Date(); mediodia.setHours(12, 0, 0, 0);

test('tag desconocido bloquea la válvula', () => {
  const r = reglas.evaluarInicio({ tag: 'FFFF0001', equipo: null, cisterna, ...enGeocerca, ahora: mediodia });
  assert.equal(r.rechazar, true);
  assert.equal(r.alertas[0].tipo, 'tag_no_autorizado');
});
test('equipo autorizado en horario y geocerca pasa sin alertas', () => {
  const r = reglas.evaluarInicio({ tag: equipo.tag, equipo, cisterna, ...enGeocerca, ahora: mediodia, ultimoDespachoEquipo: null });
  assert.equal(r.rechazar, false);
  assert.deepEqual(r.alertas, []);
});
test('fuera de geocerca bloquea con alerta crítica', () => {
  const r = reglas.evaluarInicio({ tag: 'X', equipo, cisterna, lat: -16.30, lng: -71.40, ahora: mediodia });
  assert.equal(r.rechazar, true);
  assert.ok(r.alertas.some(a => a.tipo === 'fuera_de_geocerca' && a.severidad === 'critica'));
});
test('geocerca en 0,0 (base nueva) no bloquea aunque el controlador envíe GPS', () => {
  const { setParametro, param } = require('../server/db');
  const lat0 = param('geocerca_lat'), lng0 = param('geocerca_lng');
  setParametro('geocerca_lat', '0'); setParametro('geocerca_lng', '0');
  try {
    const r = reglas.evaluarInicio({ tag: 'X', equipo, cisterna, lat: -33.45, lng: -70.66, ahora: mediodia });
    assert.equal(r.rechazar, false);
    assert.ok(!r.alertas.some(a => a.tipo === 'fuera_de_geocerca'));
  } finally { setParametro('geocerca_lat', lat0); setParametro('geocerca_lng', lng0); }
});
test('fuera de horario genera alerta media pero no bloquea', () => {
  const { setParametro } = require('../server/db');
  setParametro('horario_inicio', 5); setParametro('horario_fin', 22);
  const noche = new Date(); noche.setHours(23, 30, 0, 0);
  const r = reglas.evaluarInicio({ tag: 'X', equipo, cisterna, ...enGeocerca, ahora: noche });
  assert.equal(r.rechazar, false);
  assert.ok(r.alertas.some(a => a.tipo === 'fuera_de_horario'));
  setParametro('horario_inicio', 0); setParametro('horario_fin', 24);
  assert.deepEqual(reglas.evaluarInicio({ tag: 'X', equipo, cisterna, ...enGeocerca, ahora: noche }).alertas, []);
});
test('dos despachos seguidos que superan el tanque alertan; si caben, no', () => {
  const finAnt = new Date(mediodia.getTime() - 10 * 60000).toISOString();
  const r = reglas.evaluarFin({ equipo, cisterna, litros: 300, fin: mediodia.toISOString(), ultimoDespachoEquipo: { fin: finAnt, litros: 250 } });
  assert.ok(r.alertas.some(a => a.tipo === 'despacho_repetido'));
  const ok = reglas.evaluarFin({ equipo, cisterna, litros: 100, fin: mediodia.toISOString(), ultimoDespachoEquipo: { fin: finAnt, litros: 250 } });
  assert.ok(!ok.alertas.some(a => a.tipo === 'despacho_repetido'));
});
test('sobrellenado ordena corte de válvula', () => {
  const r = reglas.evaluarPulso({ despacho: {}, equipo, cisterna, litros: 460, caudal: 60 });
  assert.equal(r.cortar, true);
  assert.equal(r.alertas[0].tipo, 'sobrellenado');
  const ok = reglas.evaluarPulso({ despacho: {}, equipo, cisterna, litros: 380, caudal: 60 });
  assert.equal(ok.cortar, false);
});
test('caudal fuera de rango del caudalímetro alerta manipulación', () => {
  const alto = reglas.evaluarPulso({ despacho: {}, equipo, cisterna, litros: 50, caudal: 200 });
  assert.ok(alto.alertas.some(a => a.tipo === 'caudal_anomalo'));
  const bajo = reglas.evaluarPulso({ despacho: {}, equipo, cisterna, litros: 50, caudal: 2 });
  assert.ok(bajo.alertas.some(a => a.tipo === 'caudal_anomalo'));
});
test('descuadre entre nivel de cisterna y caudalímetro detecta bypass', () => {
  const r = reglas.evaluarFin({ equipo, cisterna, litros: 200, nivelAntes: 5000, nivelDespues: 4720 });
  assert.ok(r.alertas.some(a => a.tipo === 'descuadre_caudalimetro' && a.severidad === 'alta'));
  assert.ok(Math.abs(r.alertas[0].litros - 80) < 0.01);
  const ok = reglas.evaluarFin({ equipo, cisterna, litros: 200, nivelAntes: 5000, nivelDespues: 4760 }); // 40 L < precisión del sensor (50 L)
  assert.deepEqual(ok.alertas, []);
});
test('consumo L/h muy superior al nominal indica sifoneo', () => {
  const r = reglas.evaluarFin({ equipo, cisterna, litros: 380, nivelAntes: null, nivelDespues: null, horometro: 1008, horometroAnterior: 1000 });
  assert.ok(r.alertas.some(a => a.tipo === 'consumo_anomalo')); // 47.5 L/h vs 25 nominal
  const normal = reglas.evaluarFin({ equipo, cisterna, litros: 200, horometro: 1008, horometroAnterior: 1000 });
  assert.deepEqual(normal.alertas, []);
});
test('caída de nivel sin despacho es robo directo', () => {
  const r = reglas.evaluarNivel({ cisterna, nivelAnterior: 5000, nivelNuevo: 4900, despachoEnCurso: false });
  assert.equal(r.alertas[0].tipo, 'merma_cisterna');
  const durante = reglas.evaluarNivel({ cisterna, nivelAnterior: 5000, nivelNuevo: 4900, despachoEnCurso: true });
  assert.deepEqual(durante.alertas, []);
  const ruido = reglas.evaluarNivel({ cisterna, nivelAnterior: 5000, nivelNuevo: 4960, despachoEnCurso: false });
  assert.deepEqual(ruido.alertas, []);
});
test('balance diario calcula merma', () => {
  const b = reglas.balance(5000, 4000, 6500, 2400);
  assert.equal(b.teorico, 2500);
  assert.equal(b.merma, 100);
});
test('distancia haversine', () => {
  const d = reglas.distanciaM(-16.4090, -71.5375, -16.4090, -71.5275);
  assert.ok(d > 1000 && d < 1100);
});
