'use strict';
// Simulador del controlador embarcado en cada camión cisterna.
// Emula exactamente lo que haría el hardware real:
//   1. Lector RFID en la pistola lee el tag del equipo → pide autorización al servidor (o usa lista blanca offline).
//   2. Si está autorizado, abre la electroválvula y cuenta pulsos del caudalímetro (K-factor 100 pulsos/L).
//   3. Reporta el avance cada segundo, cierra al retirar la pistola / llenar el tanque / recibir orden de corte.
//   4. Reporta nivel del tanque de la cisterna (sensor de nivel) y posición GPS periódicamente.
// Con SIMULAR_ANOMALIAS=1 (por defecto) inyecta escenarios de robo para probar las reglas.

const SERVER = process.env.FUELGUARD_URL || 'http://localhost:3000';
const ESCALA = Number(process.env.ESCALA_TIEMPO || 8);      // 1 s real = ESCALA s simulados dentro del despacho
const ANOMALIAS = process.env.SIMULAR_ANOMALIAS !== '0';
const PAUSA_MIN = Number(process.env.PAUSA_MIN_S || 6), PAUSA_MAX = Number(process.env.PAUSA_MAX_S || 18);

const CISTERNAS = [
  { codigo: 'CIST-01', key: 'dev-cist-01-k9', capacidad: 10000, nivel: 7800, lat: -16.4085, lng: -71.5370, caudalNominal: 65 },
  { codigo: 'CIST-02', key: 'dev-cist-02-k9', capacidad: 5000, nivel: 3900, lat: -16.4102, lng: -71.5388, caudalNominal: 55 },
];
const K_FACTOR = 100;
const GEO = { lat: -16.4090, lng: -71.5375 };

const dormir = ms => new Promise(r => setTimeout(r, ms));
const azar = (a, b) => a + Math.random() * (b - a);
const elegir = arr => arr[Math.floor(Math.random() * arr.length)];
const log = (c, msg) => console.log(`${new Date().toLocaleTimeString()} [${c}] ${msg}`);

async function api(c, metodo, ruta, cuerpo) {
  const r = await fetch(SERVER + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', 'x-device-key': c.key }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || r.statusText), { status: r.status, data });
  return data;
}

// Horómetros simulados por tag (en la realidad vienen del CAN bus / GPS del equipo o del último valor conocido).
const horometros = new Map();

async function cicloCisterna(c) {
  let whitelist = [];
  // Ruido del sensor de nivel: ±0.3 % de la capacidad (sensor capacitivo/ultrasónico típico).
  const leerNivel = () => Math.round(c.nivel + azar(-1, 1) * c.capacidad * 0.002);

  for (;;) {
    try {
      const wl = await api(c, 'GET', '/api/dispositivo/whitelist');
      whitelist = wl.equipos;
      for (const e of whitelist) if (!horometros.has(e.tag)) horometros.set(e.tag, e.horometro || 0);
      const hb = await api(c, 'POST', '/api/dispositivo/heartbeat', { lat: c.lat, lng: c.lng });
      // El nivel físico real es el último que conoce el servidor (el simulador no "rellena" la cisterna al reiniciar).
      if (hb.cisterna && Number.isFinite(hb.cisterna.nivel_actual)) { c.nivel = hb.cisterna.nivel_actual; c.capacidad = hb.cisterna.capacidad; }
      break;
    } catch (e) { log(c.codigo, `Servidor no disponible (${e.message}), reintentando…`); await dormir(3000); }
  }
  log(c.codigo, `En línea. ${whitelist.length} tags autorizados en lista blanca local.`);

  for (;;) {
    // Recarga automática cuando el stock es bajo (llegada del proveedor).
    if (c.nivel < c.capacidad * 0.18) {
      const litros = Math.round(c.capacidad * 0.8 - c.nivel);
      await dormir(2000);
      c.nivel += litros;
      await api(c, 'POST', '/api/dispositivo/recarga', { litros, guia: 'GR-' + Math.floor(Math.random() * 90000 + 10000), nivel_despues: leerNivel() }).catch(() => {});
      log(c.codigo, `Recarga de ${litros} L registrada.`);
    }

    // Movimiento leve del camión dentro del proyecto.
    c.lat += azar(-0.0006, 0.0006); c.lng += azar(-0.0006, 0.0006);

    // ---- Escenarios ----
    const dado = Math.random();
    let escenario = 'normal';
    if (ANOMALIAS) {
      if (dado < 0.06) escenario = 'tag_desconocido';
      else if (dado < 0.11) escenario = 'robo_cisterna';
      else if (dado < 0.16) escenario = 'bypass_caudalimetro';
      else if (dado < 0.20) escenario = 'sobrellenado';
      else if (dado < 0.24) escenario = 'consumo_anomalo';
      else if (dado < 0.27) escenario = 'fuera_geocerca';
    }

    if (escenario === 'robo_cisterna') {
      // Alguien extrae combustible de la cisterna estacionada: el nivel cae sin despacho.
      const robado = Math.round(azar(60, 160));
      c.nivel -= robado;
      log(c.codigo, `⚠ Simulando extracción directa de ${robado} L de la cisterna (sin despacho).`);
      await api(c, 'POST', '/api/dispositivo/nivel', { nivel: leerNivel(), lat: c.lat, lng: c.lng }).catch(e => log(c.codigo, e.message));
      await dormir(azar(PAUSA_MIN, PAUSA_MAX) * 1000);
      continue;
    }

    // Lectura de nivel periódica (cada ciclo) como haría el sensor.
    await api(c, 'POST', '/api/dispositivo/nivel', { nivel: leerNivel(), lat: c.lat, lng: c.lng }).catch(e => log(c.codigo, e.message));

    // ---- Lectura RFID ----
    let tag, cap = 400, lph = 20;
    if (escenario === 'tag_desconocido') tag = 'FFFF' + Math.random().toString(16).slice(2, 12).toUpperCase();
    else { const e = elegir(whitelist); tag = e.tag; cap = e.capacidad; lph = e.lph || 20; }

    const hAnt = horometros.get(tag) ?? null;
    const horasTrab = azar(3, 9);
    let horometro = hAnt != null ? hAnt + horasTrab : null; // null → el servidor usa el último conocido
    const posicion = escenario === 'fuera_geocerca' ? { lat: GEO.lat + 0.09, lng: GEO.lng + 0.05 } : { lat: c.lat, lng: c.lng };

    let inicio;
    try {
      inicio = await api(c, 'POST', '/api/dispositivo/despacho/inicio', { tag, lat: posicion.lat, lng: posicion.lng, nivel: leerNivel(), horometro });
    } catch (e) { log(c.codigo, `Error inicio: ${e.message}`); await dormir(4000); continue; }

    if (!inicio.autorizado) {
      log(c.codigo, `✖ Válvula BLOQUEADA para tag ${tag}: ${inicio.motivo}`);
      await dormir(azar(PAUSA_MIN, PAUSA_MAX) * 1000);
      continue;
    }

    // ---- Despacho: pulsos del caudalímetro ----
    const eq = inicio.equipo;
    // Lo consumido de verdad: horas trabajadas × consumo nominal (±15 %), sin superar el tanque.
    let objetivo = Math.round(Math.min(cap, lph * horasTrab * azar(0.85, 1.15)));
    if (escenario === 'sobrellenado') objetivo = Math.round(cap * 1.4);       // intento de llenar bidones tras el tanque
    if (escenario === 'consumo_anomalo') objetivo = Math.round(cap * 0.98);   // tanque "vacío" tras pocas horas → sifoneo
    log(c.codigo, `▶ Despacho #${inicio.despacho_id} a ${eq.codigo} (${eq.operador}). Objetivo ${objetivo} L${escenario !== 'normal' ? ' — escenario: ' + escenario : ''}`);

    let litros = 0, pulsos = 0, cortado = false, motivo = 'normal', sumCaudal = 0, nCaudal = 0;
    const caudal = c.caudalNominal * azar(0.85, 1.1); // L/min
    const t0 = Date.now();
    while (litros < objetivo) {
      await dormir(1000);
      const lpm = caudal * azar(0.93, 1.07); sumCaudal += lpm; nCaudal++;
      const avance = (lpm / 60) * ESCALA;
      litros = Math.min(objetivo, litros + avance);
      pulsos = Math.round(litros * K_FACTOR);
      let r;
      try { r = await api(c, 'POST', '/api/dispositivo/despacho/pulso', { despacho_id: inicio.despacho_id, litros: Math.round(litros * 10) / 10, pulsos, caudal: Math.round(lpm * 10) / 10 }); }
      catch (e) { log(c.codigo, `Error pulso: ${e.message}`); break; }
      if (r.cortar) { cortado = true; motivo = 'corte_servidor'; log(c.codigo, `■ Orden de CORTE recibida a los ${Math.round(litros)} L. Electroválvula cerrada.`); break; }
    }

    // El nivel de la cisterna baja lo despachado (más una fuga/bypass si el escenario lo indica).
    let caida = litros;
    if (escenario === 'bypass_caudalimetro') { caida += azar(70, 160); log(c.codigo, `⚠ Simulando bypass: la cisterna baja ${Math.round(caida)} L pero el caudalímetro midió ${Math.round(litros)} L.`); }
    c.nivel = Math.max(0, c.nivel - caida);

    if (escenario === 'consumo_anomalo') horometro = (hAnt ?? 0) + azar(0.6, 1.5); // el equipo casi no trabajó
    horometros.set(tag, horometro);

    try {
      const fin = await api(c, 'POST', '/api/dispositivo/despacho/fin', { despacho_id: inicio.despacho_id, litros: Math.round(litros * 10) / 10, pulsos, nivel: leerNivel(), motivo, caudal_prom: nCaudal ? Math.round(sumCaudal / nCaudal * 10) / 10 : null });
      const seg = Math.round((Date.now() - t0) / 1000);
      log(c.codigo, `■ Fin #${inicio.despacho_id}: ${fin.litros} L en ${seg}s (${fin.estado})${fin.alertas.length ? ' → alertas: ' + fin.alertas.join(', ') : ''}. Hash ${fin.hash}`);
    } catch (e) { log(c.codigo, `Error fin: ${e.message}`); }

    await dormir(azar(PAUSA_MIN, PAUSA_MAX) * 1000);
  }
}

console.log(`Simulador FuelGuard → ${SERVER}  (escala x${ESCALA}, anomalías ${ANOMALIAS ? 'ON' : 'OFF'})`);
Promise.all(CISTERNAS.map((c, i) => dormir(i * 2500).then(() => cicloCisterna(c)))).catch(e => { console.error(e); process.exit(1); });
