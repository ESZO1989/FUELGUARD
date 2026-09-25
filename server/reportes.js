'use strict';
// Reportes de consumo: datos agregados por período + salida en Excel, PDF, texto y HTML (para correo).
const { getDb, paramNum, todosParametros } = require('./db');
const { alcanceDespachos, alcanceAlertas } = require('./alcance');
const { crearXlsx } = require('./xlsx');
const { Pdf } = require('./pdf');

const r1 = n => Math.round(n * 10) / 10;
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('es-PE', { maximumFractionDigits: d, minimumFractionDigits: d });
const fFecha = iso => iso ? new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const fDia = iso => new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const TIPO = { tag_no_autorizado: 'Tag no autorizado', equipo_inactivo: 'Equipo inactivo', fuera_de_horario: 'Fuera de horario', fuera_de_geocerca: 'Fuera de geocerca', despacho_repetido: 'Despacho repetido', sobrellenado: 'Sobrellenado', caudal_anomalo: 'Caudal anómalo', descuadre_caudalimetro: 'Descuadre caudalímetro', consumo_anomalo: 'Consumo anómalo', merma_cisterna: 'Merma en cisterna', recarga_no_registrada: 'Recarga no registrada', recarga_descuadrada: 'Recarga descuadrada', sin_senal: 'Sin señal', despacho_manual: 'Despacho manual' };
const TIPOS_MERMA = "('merma_cisterna','descuadre_caudalimetro','sobrellenado','consumo_anomalo')";

// Rango de fechas por nombre. Devuelve ISO (UTC) a partir de hora local.
function rango(tipo, desdeStr, hastaStr) {
  // 'AAAA-MM-DD' se interpreta como fecha local (new Date la tomaría como UTC y en Chile caería en el día anterior).
  const ini = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d)); const x = m ? new Date(+m[1], m[2] - 1, +m[3]) : new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const sumar = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };   // por días de calendario, no por 24 h (cambio de hora)
  const hoy = ini(new Date()); let desde, hasta, etiqueta;
  switch (tipo) {
    case 'hoy': desde = hoy; hasta = sumar(hoy, 1); etiqueta = `Hoy ${fDia(desde)}`; break;
    case 'ayer': desde = sumar(hoy, -1); hasta = hoy; etiqueta = `Ayer ${fDia(desde)}`; break;
    case 'semana': desde = sumar(hoy, -6); hasta = sumar(hoy, 1); etiqueta = `Últimos 7 días (${fDia(desde)} – ${fDia(hoy)})`; break;
    case 'semana_anterior': { const fin = sumar(hoy, -((hoy.getDay() + 6) % 7)); desde = sumar(fin, -7); hasta = fin; etiqueta = `Semana anterior (${fDia(desde)} – ${fDia(new Date(hasta - 1))})`; break; }
    case 'mes': desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1); hasta = sumar(hoy, 1); etiqueta = `Mes actual (${fDia(desde)} – ${fDia(hoy)})`; break;
    case 'mes_anterior': desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1); hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 1); etiqueta = `Mes anterior (${fDia(desde)} – ${fDia(new Date(hasta - 1))})`; break;
    default: {
      desde = desdeStr ? ini(desdeStr) : sumar(hoy, -6);
      hasta = hastaStr ? sumar(ini(hastaStr), 1) : sumar(hoy, 1);
      if (!(desde < hasta)) throw new Error('Rango de fechas inválido');
      etiqueta = `${fDia(desde)} – ${fDia(new Date(hasta - 1))}`;
    }
  }
  return { desde: desde.toISOString(), hasta: hasta.toISOString(), etiqueta, dias: Math.round((hasta - desde) / 86400e3) };
}

function datos(u, rg) {
  const db = getDb();
  const p = todosParametros(); const precio = Number(p.precio_litro) || 0;
  const ad = alcanceDespachos(u), aa = alcanceAlertas(u);
  const { desde, hasta } = rg;
  const despachos = db.prepare(`
    SELECT d.*, e.codigo AS equipo_codigo, e.nombre AS equipo_nombre, e.tipo AS equipo_tipo, c.codigo AS cisterna_codigo, uo.nombre AS operador, uc.nombre AS chofer,
      (SELECT COUNT(*) FROM alertas a WHERE a.despacho_id = d.id) AS n_alertas,
      (SELECT CASE WHEN firma IS NOT NULL THEN 'firmado' ELSE 'confirmado' END FROM confirmaciones cf WHERE cf.despacho_id = d.id) AS confirmacion,
      (SELECT horometro FROM confirmaciones cf WHERE cf.despacho_id = d.id) AS horometro_tablet
    FROM despachos d LEFT JOIN equipos e ON e.id = d.equipo_id JOIN cisternas c ON c.id = d.cisterna_id
    LEFT JOIN usuarios uo ON uo.id = d.operador_id LEFT JOIN usuarios uc ON uc.id = d.chofer_id
    WHERE d.inicio >= ? AND d.inicio < ? ${ad.sql} ORDER BY d.inicio`).all(desde, hasta, ...ad.params);
  const validos = despachos.filter(d => d.estado === 'completado' || d.estado === 'cortado');
  const litros = validos.reduce((a, d) => a + d.litros, 0);
  const alertas = db.prepare(`SELECT a.*, e.codigo AS equipo_codigo, c.codigo AS cisterna_codigo FROM alertas a LEFT JOIN equipos e ON e.id = a.equipo_id LEFT JOIN cisternas c ON c.id = a.cisterna_id
    WHERE a.ts >= ? AND a.ts < ? ${aa.sql} ORDER BY a.ts`).all(desde, hasta, ...aa.params);
  const mermaL = alertas.filter(a => ['merma_cisterna', 'descuadre_caudalimetro', 'sobrellenado', 'consumo_anomalo'].includes(a.tipo)).reduce((s, a) => s + (a.litros_afectados || 0), 0);
  const porTipo = {}; for (const a of alertas) porTipo[a.tipo] = (porTipo[a.tipo] || 0) + 1;

  // Por equipo
  const eqMap = new Map();
  for (const d of validos) {
    if (!d.equipo_id) continue;
    const e = eqMap.get(d.equipo_id) || { codigo: d.equipo_codigo, nombre: d.equipo_nombre, tipo: d.equipo_tipo, operador: d.operador, litros: 0, despachos: 0, horas: 0, alertas: 0 };
    e.litros += d.litros; e.despachos++; e.alertas += d.n_alertas;
    const h = d.horometro ?? d.horometro_tablet; if (h != null && d.horometro_anterior != null && h > d.horometro_anterior) e.horas += h - d.horometro_anterior;
    eqMap.set(d.equipo_id, e);
  }
  const nominal = Object.fromEntries(db.prepare('SELECT id, consumo_nominal_lph FROM equipos').all().map(e => [e.id, e.consumo_nominal_lph]));
  const equipos = [...eqMap.entries()].map(([id, e]) => ({ ...e, litros: r1(e.litros), horas: r1(e.horas), lph_real: e.horas > 0.5 ? r1(e.litros / e.horas) : null, lph_nominal: nominal[id], desvio_pct: e.horas > 0.5 && nominal[id] ? r1(((e.litros / e.horas - nominal[id]) / nominal[id]) * 100) : null, costo: r1(e.litros * precio) })).sort((a, b) => b.litros - a.litros);

  // Por operador
  const opMap = new Map();
  for (const d of validos) { const k = d.operador || '— sin operador —'; const o = opMap.get(k) || { operador: k, litros: 0, despachos: 0, equipos: new Set(), alertas: 0 }; o.litros += d.litros; o.despachos++; if (d.equipo_codigo) o.equipos.add(d.equipo_codigo); o.alertas += d.n_alertas; opMap.set(k, o); }
  const operadores = [...opMap.values()].map(o => ({ ...o, litros: r1(o.litros), equipos: [...o.equipos].join(', '), costo: r1(o.litros * precio) })).sort((a, b) => b.litros - a.litros);

  // Por cisterna (con comparativa contra el período anterior de igual duración)
  const anteriorDesde = new Date(new Date(desde).getTime() - (new Date(hasta) - new Date(desde))).toISOString();
  const cisternasBase = db.prepare('SELECT id, codigo, placa, capacidad, nivel_actual FROM cisternas ORDER BY codigo').all().filter(c => u.rol !== 'chofer' || c.id === u.cisterna_id);
  const agg = (cid, a, b) => ({
    despachado: db.prepare(`SELECT COALESCE(SUM(litros),0) AS l, COUNT(*) AS n FROM despachos WHERE cisterna_id = ? AND estado IN ('completado','cortado') AND inicio >= ? AND inicio < ?`).get(cid, a, b),
    recargas: db.prepare('SELECT COALESCE(SUM(litros),0) AS l, COUNT(*) AS n FROM recargas WHERE cisterna_id = ? AND ts >= ? AND ts < ?').get(cid, a, b),
    merma: db.prepare(`SELECT COALESCE(SUM(litros_afectados),0) AS l, COUNT(*) AS n FROM alertas WHERE cisterna_id = ? AND ts >= ? AND ts < ? AND tipo IN ${TIPOS_MERMA}`).get(cid, a, b),
    rechazados: db.prepare(`SELECT COUNT(*) AS n FROM despachos WHERE cisterna_id = ? AND estado = 'rechazado' AND inicio >= ? AND inicio < ?`).get(cid, a, b).n,
  });
  const cisternas = cisternasBase.map(c => {
    const act = agg(c.id, desde, hasta), ant = agg(c.id, anteriorDesde, desde);
    const pct = act.despachado.l ? r1((act.merma.l / act.despachado.l) * 100) : 0, pctAnt = ant.despachado.l ? r1((ant.merma.l / ant.despachado.l) * 100) : 0;
    return { cisterna: c.codigo, placa: c.placa, capacidad: c.capacidad, nivel_actual: c.nivel_actual, despachado_l: r1(act.despachado.l), despachos_n: act.despachado.n, recargas_l: r1(act.recargas.l), recargas_n: act.recargas.n,
      merma_l: r1(act.merma.l), merma_pct: pct, eventos_merma: act.merma.n, rechazados: act.rechazados, costo_merma: r1(act.merma.l * precio),
      ant_despachado_l: r1(ant.despachado.l), ant_merma_l: r1(ant.merma.l), ant_merma_pct: pctAnt, variacion_merma_l: r1(act.merma.l - ant.merma.l), variacion_pct_puntos: r1(pct - pctAnt) };
  });
  const totalAnt = cisternas.reduce((s, c) => s + c.ant_merma_l, 0), totalAntDesp = cisternas.reduce((s, c) => s + c.ant_despachado_l, 0);

  // Diario
  const porDia = new Map();
  for (const d of validos) { const k = fDia(d.inicio); porDia.set(k, (porDia.get(k) || 0) + d.litros); }
  const diario = [...porDia].map(([dia, l]) => ({ dia, litros: r1(l), costo: r1(l * precio) }));

  return {
    empresa: p.empresa, moneda: p.moneda, precio, periodo: rg, generado: new Date().toISOString(), usuario: u.nombre, alcance: u.rol,
    resumen: { litros: r1(litros), despachos: validos.length, costo: r1(litros * precio), rechazados: despachos.filter(d => d.estado === 'rechazado').length, cortados: despachos.filter(d => d.estado === 'cortado').length, manuales: despachos.filter(d => d.motivo === 'manual').length,
      firmados: validos.filter(d => d.confirmacion === 'firmado').length, alertas: alertas.length, criticas: alertas.filter(a => a.severidad === 'critica').length, merma_l: r1(mermaL), merma_pct: litros ? r1((mermaL / litros) * 100) : 0, costo_merma: r1(mermaL * precio),
      ant_merma_l: r1(totalAnt), ant_merma_pct: totalAntDesp ? r1((totalAnt / totalAntDesp) * 100) : 0, promedio_diario: r1(litros / Math.max(1, rg.dias)) },
    equipos, operadores, cisternas, despachos, alertas, alertasPorTipo: Object.entries(porTipo).map(([tipo, n]) => ({ tipo, nombre: TIPO[tipo] || tipo, n })).sort((a, b) => b.n - a.n), diario,
  };
}

function nombreArchivo(d, ext) { return `fuelguard-consumo-${d.periodo.desde.slice(0, 10)}_${new Date(new Date(d.periodo.hasta) - 1).toISOString().slice(0, 10)}.${ext}`; }

// ---------- Excel ----------
function aExcel(d) {
  const m = d.moneda;
  return crearXlsx([
    { nombre: 'Resumen', columnas: [{ titulo: 'Indicador', ancho: 42 }, { titulo: 'Valor', ancho: 22 }], filas: [
      ['Empresa', d.empresa], ['Período', d.periodo.etiqueta], ['Generado', new Date(d.generado)], ['Generado por', d.usuario],
      ['Litros despachados', d.resumen.litros], ['Despachos', d.resumen.despachos], [`Costo (${m})`, d.resumen.costo], ['Promedio diario (L)', d.resumen.promedio_diario],
      ['Despachos bloqueados', d.resumen.rechazados], ['Despachos cortados', d.resumen.cortados], ['Despachos manuales', d.resumen.manuales], ['Despachos firmados en tablet', d.resumen.firmados],
      ['Alertas', d.resumen.alertas], ['Alertas críticas', d.resumen.criticas],
      ['Merma detectada (L)', d.resumen.merma_l], ['Merma detectada (% del despacho)', d.resumen.merma_pct / 100], [`Costo de la merma (${m})`, d.resumen.costo_merma],
      ['Merma período anterior (L)', d.resumen.ant_merma_l], ['Merma período anterior (%)', d.resumen.ant_merma_pct / 100], [`Precio por litro (${m})`, d.precio],
    ].map((f, i) => i === 15 || i === 18 ? f : f) },
    { nombre: 'Equipos', columnas: [{ titulo: 'Equipo', ancho: 10 }, { titulo: 'Nombre', ancho: 28 }, { titulo: 'Tipo', ancho: 14 }, { titulo: 'Operador', ancho: 20 }, { titulo: 'Despachos', ancho: 11 }, { titulo: 'Litros', ancho: 11 }, { titulo: 'Horas', ancho: 9 }, { titulo: 'L/h real', ancho: 10 }, { titulo: 'L/h nominal', ancho: 11 }, { titulo: 'Desvío %', ancho: 10 }, { titulo: 'Alertas', ancho: 9 }, { titulo: `Costo ${m}`, ancho: 12 }],
      filas: d.equipos.map(e => [e.codigo, e.nombre, e.tipo, e.operador, e.despachos, e.litros, e.horas, e.lph_real, e.lph_nominal, e.desvio_pct, e.alertas, e.costo]) },
    { nombre: 'Operadores', columnas: [{ titulo: 'Operador', ancho: 24 }, { titulo: 'Equipos', ancho: 24 }, { titulo: 'Despachos', ancho: 11 }, { titulo: 'Litros', ancho: 11 }, { titulo: 'Alertas', ancho: 9 }, { titulo: `Costo ${m}`, ancho: 12 }],
      filas: d.operadores.map(o => [o.operador, o.equipos, o.despachos, o.litros, o.alertas, o.costo]) },
    { nombre: 'Cisternas y merma', columnas: [{ titulo: 'Cisterna', ancho: 10 }, { titulo: 'Placa', ancho: 10 }, { titulo: 'Despachos', ancho: 11 }, { titulo: 'Despachado L', ancho: 13 }, { titulo: 'Recargas L', ancho: 11 }, { titulo: 'Merma L', ancho: 10 }, { titulo: 'Merma %', ancho: 9, formato: 'pct' }, { titulo: 'Eventos', ancho: 9 }, { titulo: 'Bloqueados', ancho: 11 }, { titulo: `Costo merma ${m}`, ancho: 15 }, { titulo: 'Anterior despachado L', ancho: 19 }, { titulo: 'Anterior merma L', ancho: 16 }, { titulo: 'Anterior merma %', ancho: 16, formato: 'pct' }, { titulo: 'Variación merma L', ancho: 16 }, { titulo: 'Nivel actual L', ancho: 13 }],
      filas: d.cisternas.map(c => [c.cisterna, c.placa, c.despachos_n, c.despachado_l, c.recargas_l, c.merma_l, c.merma_pct / 100, c.eventos_merma, c.rechazados, c.costo_merma, c.ant_despachado_l, c.ant_merma_l, c.ant_merma_pct / 100, c.variacion_merma_l, c.nivel_actual]) },
    { nombre: 'Despachos', columnas: [{ titulo: 'N°', ancho: 7 }, { titulo: 'Inicio', ancho: 17 }, { titulo: 'Fin', ancho: 17 }, { titulo: 'Cisterna', ancho: 10 }, { titulo: 'Chofer', ancho: 18 }, { titulo: 'Equipo', ancho: 10 }, { titulo: 'Operador', ancho: 18 }, { titulo: 'Litros', ancho: 9 }, { titulo: 'Pulsos', ancho: 9, formato: 'entero' }, { titulo: 'Caudal L/min', ancho: 12 }, { titulo: 'Horómetro', ancho: 11 }, { titulo: 'Horóm. anterior', ancho: 14 }, { titulo: 'Nivel antes', ancho: 11 }, { titulo: 'Nivel después', ancho: 13 }, { titulo: 'Estado', ancho: 11 }, { titulo: 'Motivo', ancho: 14 }, { titulo: 'Confirmación', ancho: 12 }, { titulo: 'Alertas', ancho: 8 }, { titulo: 'Tag RFID', ancho: 16 }, { titulo: 'Hash', ancho: 26 }],
      filas: d.despachos.map(x => [x.id, new Date(x.inicio), x.fin ? new Date(x.fin) : null, x.cisterna_codigo, x.chofer, x.equipo_codigo, x.operador, x.litros, x.pulsos, x.caudal_prom, x.horometro ?? x.horometro_tablet, x.horometro_anterior, x.nivel_antes, x.nivel_despues, x.estado, x.motivo, x.confirmacion, x.n_alertas, x.tag_rfid, x.hash]) },
    { nombre: 'Alertas', columnas: [{ titulo: 'Fecha', ancho: 17 }, { titulo: 'Tipo', ancho: 22 }, { titulo: 'Severidad', ancho: 10 }, { titulo: 'Cisterna', ancho: 10 }, { titulo: 'Equipo', ancho: 10 }, { titulo: 'Litros afectados', ancho: 15 }, { titulo: 'Mensaje', ancho: 90 }, { titulo: 'Resuelta', ancho: 9 }, { titulo: 'Nota', ancho: 30 }, { titulo: 'Despacho', ancho: 9 }],
      filas: d.alertas.map(a => [new Date(a.ts), TIPO[a.tipo] || a.tipo, a.severidad, a.cisterna_codigo, a.equipo_codigo, a.litros_afectados, a.mensaje, a.resuelta ? 'sí' : 'no', a.nota, a.despacho_id]) },
    { nombre: 'Diario', columnas: [{ titulo: 'Día', ancho: 12 }, { titulo: 'Litros', ancho: 11 }, { titulo: `Costo ${m}`, ancho: 12 }], filas: d.diario.map(x => [x.dia, x.litros, x.costo]) },
  ]);
}

// ---------- PDF ----------
function aPdf(d) {
  const m = d.moneda;
  const pdf = new Pdf({ titulo: `Reporte de consumo ${d.periodo.etiqueta}`, horizontal: true });
  pdf.pie((p, n, total) => { p.texto(p.margen, 22, `${d.empresa} · FuelGuard · Reporte de consumo de combustible · ${d.periodo.etiqueta}`, { size: 7, color: '0.45 0.45 0.45' }); p.texto(p.ancho - p.margen, 22, `Página ${n} de ${total}`, { size: 7, color: '0.45 0.45 0.45', alinear: 'der' }); });
  pdf.titulo1(`Reporte de consumo de combustible — ${d.empresa}`);
  pdf.parrafo(`Período: ${d.periodo.etiqueta}. Generado el ${fFecha(d.generado)} por ${d.usuario}. Fuente: caudalímetros y sensores de las cisternas (registro automático con hash de integridad).`);
  const r = d.resumen;
  pdf.indicadores([
    { etiqueta: 'Litros despachados', valor: `${fmt(r.litros)} L`, sub: `${r.despachos} despachos · ${fmt(r.promedio_diario)} L/día` },
    { etiqueta: `Costo (${m})`, valor: fmt(r.costo), sub: `a ${m} ${fmt(d.precio, 2)} por litro` },
    { etiqueta: 'Merma detectada', valor: `${fmt(r.merma_l)} L · ${fmt(r.merma_pct, 1)} %`, sub: `${m} ${fmt(r.costo_merma)} · anterior ${fmt(r.ant_merma_pct, 1)} %`, color: r.merma_pct > 2 ? '0.99 0.9 0.9' : '0.9 0.97 0.9' },
    { etiqueta: 'Alertas', valor: `${r.alertas} (${r.criticas} críticas)`, sub: `${r.rechazados} bloqueados · ${r.cortados} cortados · ${r.manuales} manuales` },
    { etiqueta: 'Firmados en tablet', valor: `${r.firmados} / ${r.despachos}`, sub: r.despachos ? `${fmt((r.firmados / r.despachos) * 100)} % con firma del operador` : '' },
  ]);
  pdf.titulo2('Comparativa de merma por cisterna (vs. período anterior de igual duración)');
  pdf.tabla([{ titulo: 'Cisterna', ancho: 1 }, { titulo: 'Despachado L', ancho: 1.1, alinear: 'der' }, { titulo: 'Recargas L', ancho: 1, alinear: 'der' }, { titulo: 'Merma L', ancho: 0.9, alinear: 'der' }, { titulo: 'Merma %', ancho: 0.8, alinear: 'der', formato: 'pct' }, { titulo: 'Eventos', ancho: 0.7, alinear: 'der' }, { titulo: 'Bloqueados', ancho: 0.8, alinear: 'der' }, { titulo: `Costo merma ${m}`, ancho: 1.1, alinear: 'der' }, { titulo: 'Anterior merma L', ancho: 1.1, alinear: 'der' }, { titulo: 'Anterior %', ancho: 0.8, alinear: 'der', formato: 'pct' }, { titulo: 'Variación', ancho: 1.2 }],
    d.cisternas.map(c => [c.cisterna, c.despachado_l, c.recargas_l, c.merma_l, c.merma_pct, c.eventos_merma, c.rechazados, c.costo_merma, c.ant_merma_l, c.ant_merma_pct, `${c.variacion_merma_l >= 0 ? '+' : ''}${fmt(c.variacion_merma_l)} L (${c.variacion_pct_puntos >= 0 ? '+' : ''}${fmt(c.variacion_pct_puntos, 1)} pts)`]));
  pdf.titulo2('Consumo por equipo');
  pdf.tabla([{ titulo: 'Equipo', ancho: 0.8 }, { titulo: 'Nombre', ancho: 2 }, { titulo: 'Operador', ancho: 1.4 }, { titulo: 'Despachos', ancho: 0.8, alinear: 'der' }, { titulo: 'Litros', ancho: 0.9, alinear: 'der' }, { titulo: 'Horas', ancho: 0.7, alinear: 'der', formato: 'dec' }, { titulo: 'L/h real', ancho: 0.8, alinear: 'der', formato: 'dec' }, { titulo: 'L/h nominal', ancho: 0.9, alinear: 'der' }, { titulo: 'Desvío %', ancho: 0.8, alinear: 'der', formato: 'dec' }, { titulo: 'Alertas', ancho: 0.7, alinear: 'der' }, { titulo: `Costo ${m}`, ancho: 0.9, alinear: 'der' }],
    d.equipos.map(e => [e.codigo, e.nombre, e.operador, e.despachos, e.litros, e.horas, e.lph_real, e.lph_nominal, e.desvio_pct, e.alertas, e.costo]));
  pdf.titulo2('Consumo por operador');
  pdf.tabla([{ titulo: 'Operador', ancho: 1.5 }, { titulo: 'Equipos', ancho: 2 }, { titulo: 'Despachos', ancho: 0.8, alinear: 'der' }, { titulo: 'Litros', ancho: 0.9, alinear: 'der' }, { titulo: 'Alertas', ancho: 0.7, alinear: 'der' }, { titulo: `Costo ${m}`, ancho: 0.9, alinear: 'der' }],
    d.operadores.map(o => [o.operador, o.equipos, o.despachos, o.litros, o.alertas, o.costo]));
  if (d.alertasPorTipo.length) {
    pdf.titulo2('Alertas del período');
    pdf.tabla([{ titulo: 'Tipo', ancho: 2 }, { titulo: 'Cantidad', ancho: 1, alinear: 'der' }], d.alertasPorTipo.map(a => [a.nombre, a.n]));
    const graves = d.alertas.filter(a => a.severidad === 'critica' || a.severidad === 'alta').slice(0, 60);
    if (graves.length) pdf.tabla([{ titulo: 'Fecha', ancho: 1 }, { titulo: 'Tipo', ancho: 1.3 }, { titulo: 'Sev.', ancho: 0.5 }, { titulo: 'Cist.', ancho: 0.6 }, { titulo: 'Equipo', ancho: 0.6 }, { titulo: 'Litros', ancho: 0.6, alinear: 'der' }, { titulo: 'Detalle', ancho: 5 }, { titulo: 'Resuelta', ancho: 0.6 }],
      graves.map(a => [fFecha(a.ts), TIPO[a.tipo] || a.tipo, a.severidad, a.cisterna_codigo || '', a.equipo_codigo || '', a.litros_afectados || 0, a.mensaje, a.resuelta ? 'sí' : 'no']), { size: 7, altoFila: 12 });
  }
  pdf.titulo2(`Detalle de despachos (${d.despachos.length})`);
  const lista = d.despachos.slice(0, 600);
  pdf.tabla([{ titulo: 'N°', ancho: 0.5, alinear: 'der' }, { titulo: 'Inicio', ancho: 1.1 }, { titulo: 'Cist.', ancho: 0.6 }, { titulo: 'Equipo', ancho: 0.7 }, { titulo: 'Operador', ancho: 1.3 }, { titulo: 'Litros', ancho: 0.7, alinear: 'der', formato: 'dec' }, { titulo: 'L/min', ancho: 0.6, alinear: 'der', formato: 'dec' }, { titulo: 'Horóm.', ancho: 0.7, alinear: 'der', formato: 'dec' }, { titulo: 'Nivel antes > después', ancho: 1.3 }, { titulo: 'Estado', ancho: 0.8 }, { titulo: 'Conf.', ancho: 0.7 }, { titulo: 'Al.', ancho: 0.4, alinear: 'der' }, { titulo: 'Hash', ancho: 1.2 }],
    lista.map(x => [x.id, fFecha(x.inicio), x.cisterna_codigo, x.equipo_codigo || x.tag_rfid || '', x.operador || '', x.litros, x.caudal_prom, x.horometro ?? x.horometro_tablet, `${x.nivel_antes != null ? fmt(x.nivel_antes) : '—'} > ${x.nivel_despues != null ? fmt(x.nivel_despues) : '—'}`, x.estado + (x.motivo && x.motivo !== 'normal' ? ` (${x.motivo})` : ''), x.confirmacion || '', x.n_alertas, x.hash ? x.hash.slice(0, 12) : '']), { size: 7, altoFila: 12 });
  if (d.despachos.length > 600) pdf.parrafo(`Se muestran los primeros 600 de ${d.despachos.length} despachos. El archivo Excel contiene el detalle completo.`);
  return pdf.salida();
}

// ---------- Texto y HTML para el correo ----------
function aTexto(d) {
  const r = d.resumen, m = d.moneda;
  const lineas = [`REPORTE DE CONSUMO DE COMBUSTIBLE — ${d.empresa}`, `Período: ${d.periodo.etiqueta}`, '',
    `Litros despachados: ${fmt(r.litros)} L en ${r.despachos} despachos (${fmt(r.promedio_diario)} L/día)`, `Costo: ${m} ${fmt(r.costo)}`,
    `Merma detectada: ${fmt(r.merma_l)} L (${fmt(r.merma_pct, 1)} %) = ${m} ${fmt(r.costo_merma)} · período anterior ${fmt(r.ant_merma_l)} L (${fmt(r.ant_merma_pct, 1)} %)`,
    `Alertas: ${r.alertas} (${r.criticas} críticas) · bloqueados ${r.rechazados} · cortados ${r.cortados} · manuales ${r.manuales}`, '', 'Por cisterna:'];
  for (const c of d.cisternas) lineas.push(`  ${c.cisterna}: ${fmt(c.despachado_l)} L despachados, merma ${fmt(c.merma_l)} L (${fmt(c.merma_pct, 1)} %), variación ${c.variacion_merma_l >= 0 ? '+' : ''}${fmt(c.variacion_merma_l)} L`);
  lineas.push('', 'Mayores consumos por equipo:');
  for (const e of d.equipos.slice(0, 8)) lineas.push(`  ${e.codigo} ${e.nombre}: ${fmt(e.litros)} L${e.lph_real ? `, ${fmt(e.lph_real, 1)} L/h (nominal ${e.lph_nominal})` : ''}`);
  lineas.push('', 'Adjuntos: detalle completo en Excel y PDF.', 'Generado automáticamente por FuelGuard.');
  return lineas.join('\n');
}
function aHtml(d) {
  const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const r = d.resumen, m = d.moneda;
  const ficha = (l, v, s = '', color = '#f1f5fb') => `<td style="padding:10px 12px;background:${color};border-radius:8px;vertical-align:top"><div style="font-size:11px;color:#555">${l}</div><div style="font-size:18px;font-weight:700">${v}</div><div style="font-size:11px;color:#666">${s}</div></td>`;
  const fila = cs => `<tr>${cs.map((c, i) => `<td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;${i > 0 ? 'text-align:right' : ''}">${esc(c)}</td>`).join('')}</tr>`;
  const cab = cs => `<tr>${cs.map(c => `<th style="padding:6px 8px;background:#1c5cab;color:#fff;text-align:left">${esc(c)}</th>`).join('')}</tr>`;
  return `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#111;max-width:760px">
  <h2 style="margin:0 0 4px">Reporte de consumo de combustible</h2><div style="color:#555">${esc(d.empresa)} · ${esc(d.periodo.etiqueta)}</div>
  <table cellspacing="6" style="margin:14px 0;width:100%"><tr>${ficha('Litros despachados', `${fmt(r.litros)} L`, `${r.despachos} despachos · ${fmt(r.promedio_diario)} L/día`)}${ficha(`Costo ${m}`, fmt(r.costo))}${ficha('Merma detectada', `${fmt(r.merma_l)} L · ${fmt(r.merma_pct, 1)} %`, `${m} ${fmt(r.costo_merma)} · anterior ${fmt(r.ant_merma_pct, 1)} %`, r.merma_pct > 2 ? '#fdecec' : '#e8f7e8')}${ficha('Alertas', `${r.alertas} (${r.criticas} críticas)`, `${r.rechazados} bloqueados · ${r.manuales} manuales`)}</tr></table>
  <h3 style="margin:14px 0 6px">Merma por cisterna</h3><table cellspacing="0" style="width:100%;border-collapse:collapse">${cab(['Cisterna', 'Despachado L', 'Merma L', 'Merma %', 'Anterior %', 'Variación L'])}${d.cisternas.map(c => fila([c.cisterna, fmt(c.despachado_l), fmt(c.merma_l), fmt(c.merma_pct, 1) + ' %', fmt(c.ant_merma_pct, 1) + ' %', (c.variacion_merma_l >= 0 ? '+' : '') + fmt(c.variacion_merma_l)])).join('')}</table>
  <h3 style="margin:14px 0 6px">Consumo por equipo</h3><table cellspacing="0" style="width:100%;border-collapse:collapse">${cab(['Equipo', 'Despachos', 'Litros', 'L/h real', 'Nominal', 'Desvío %', `Costo ${m}`])}${d.equipos.slice(0, 15).map(e => fila([`${e.codigo} · ${e.nombre}`, e.despachos, fmt(e.litros), e.lph_real != null ? fmt(e.lph_real, 1) : '—', e.lph_nominal, e.desvio_pct != null ? fmt(e.desvio_pct, 1) : '—', fmt(e.costo)])).join('')}</table>
  ${d.alertasPorTipo.length ? `<h3 style="margin:14px 0 6px">Alertas</h3><table cellspacing="0" style="border-collapse:collapse">${cab(['Tipo', 'Cantidad'])}${d.alertasPorTipo.map(a => fila([a.nombre, a.n])).join('')}</table>` : ''}
  <p style="color:#666;font-size:12px;margin-top:18px">El detalle completo va adjunto en Excel y PDF. Generado automáticamente por FuelGuard el ${fFecha(d.generado)}.</p></div>`;
}

module.exports = { rango, datos, aExcel, aPdf, aTexto, aHtml, nombreArchivo };
