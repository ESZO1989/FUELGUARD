'use strict';
// Motor de reglas antirrobo. Cada función recibe el contexto del evento y devuelve
// { rechazar: bool, cortar: bool, alertas: [{tipo, severidad, mensaje, litros}] }.
// Las reglas son deterministas y auditable: cada alerta indica el dato que la disparó.
const { paramNum } = require('./db');

const R = 6371000; // radio terrestre en metros
function distanciaM(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => v == null || !Number.isFinite(v))) return null;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nuevoResultado() { return { rechazar: false, cortar: false, alertas: [] }; }

// --- Regla 1-4: al leer el tag RFID e intentar abrir la válvula ---
// ctx: { tag, equipo|null, cisterna, lat, lng, ahora(Date), ultimoDespachoEquipo|null }
function evaluarInicio(ctx) {
  const res = nuevoResultado();
  const { tag, equipo, cisterna, lat, lng } = ctx;
  const ahora = ctx.ahora || new Date();

  if (!equipo) {
    res.rechazar = true;
    res.alertas.push({ tipo: 'tag_no_autorizado', severidad: 'alta',
      mensaje: `Intento de despacho con tag RFID desconocido (${tag || 'sin tag'}) desde ${cisterna.codigo}. Válvula bloqueada.` });
    return res;
  }
  if (!equipo.activo) {
    res.rechazar = true;
    res.alertas.push({ tipo: 'equipo_inactivo', severidad: 'alta',
      mensaje: `Intento de despacho a ${equipo.codigo}, equipo dado de baja / inactivo. Válvula bloqueada.` });
  }

  const hIni = paramNum('horario_inicio', 5), hFin = paramNum('horario_fin', 22);
  const h = ahora.getHours() + ahora.getMinutes() / 60;
  if (h < hIni || h >= hFin) {
    res.alertas.push({ tipo: 'fuera_de_horario', severidad: 'media',
      mensaje: `Despacho a ${equipo.codigo} fuera del horario permitido (${hIni}:00–${hFin}:00).` });
  }

  const gLat = paramNum('geocerca_lat', NaN), gLng = paramNum('geocerca_lng', NaN), radio = paramNum('geocerca_radio_m', 3000);
  const dist = distanciaM(lat, lng, gLat, gLng);
  if (dist != null && dist > radio) {
    res.rechazar = true;
    res.alertas.push({ tipo: 'fuera_de_geocerca', severidad: 'critica',
      mensaje: `${cisterna.codigo} intentó despachar a ${equipo.codigo} a ${Math.round(dist / 100) / 10} km del proyecto (geocerca ${radio / 1000} km). Válvula bloqueada.` });
  }

  return res;
}

// Tolerancia de conciliación de nivel: lo mayor entre el mínimo en litros, el % del volumen y la precisión del sensor de la cisterna.
function toleranciaNivel(cisterna, litros) {
  const tolPct = paramNum('tolerancia_descuadre_pct', 2), tolL = paramNum('tolerancia_descuadre_l', 10), prec = paramNum('precision_nivel_pct', 0.5);
  return Math.max(tolL, (litros || 0) * tolPct / 100, (cisterna.capacidad || 0) * prec / 100);
}

// --- Regla 5-6: durante el despacho (cada pulso reportado) ---
// ctx: { despacho, equipo, cisterna, litros, caudal }
function evaluarPulso(ctx) {
  const res = nuevoResultado();
  const { despacho, equipo, cisterna, litros, caudal } = ctx;
  const factor = paramNum('factor_sobrellenado', 1.10);
  if (equipo && litros > equipo.capacidad_tanque * factor) {
    res.cortar = true;
    if (!despacho._alertaSobrellenado) {
      res.alertas.push({ tipo: 'sobrellenado', severidad: 'critica', litros: litros - equipo.capacidad_tanque,
        mensaje: `Despacho a ${equipo.codigo} superó la capacidad del tanque (${equipo.capacidad_tanque} L): ${Math.round(litros)} L. Válvula cerrada automáticamente.` });
    }
  }
  if (caudal != null && caudal > 0) {
    if (caudal > cisterna.caudal_max * 1.15 && !despacho._alertaCaudal) {
      res.alertas.push({ tipo: 'caudal_anomalo', severidad: 'media',
        mensaje: `Caudal de ${Math.round(caudal)} L/min en ${cisterna.codigo} excede el máximo del caudalímetro (${cisterna.caudal_max}). Posible manipulación del sensor.` });
    } else if (caudal < cisterna.caudal_min * 0.5 && litros > 20 && !despacho._alertaCaudal) {
      res.alertas.push({ tipo: 'caudal_anomalo', severidad: 'media',
        mensaje: `Caudal muy bajo (${Math.round(caudal)} L/min) en ${cisterna.codigo} con válvula abierta. Posible bypass parcial del caudalímetro.` });
    }
  }
  return res;
}

// --- Regla 7-8: al cerrar el despacho ---
// ctx: { despacho, equipo, cisterna, litros, nivelAntes, nivelDespues, horometro, horometroAnterior, consumoNominal }
function evaluarFin(ctx) {
  const res = nuevoResultado();
  const { equipo, cisterna, litros, nivelAntes, nivelDespues } = ctx;

  // Dos despachos seguidos al mismo equipo que en conjunto superan su tanque: el excedente fue a otro lado.
  const minEntre = paramNum('minutos_entre_despachos', 30);
  const ult = ctx.ultimoDespachoEquipo;
  if (equipo && ult && ult.fin) {
    const minutos = (new Date(ctx.fin || Date.now()) - new Date(ult.fin)) / 60000;
    const factor = paramNum('factor_sobrellenado', 1.10);
    if (minutos >= 0 && minutos < minEntre && ult.litros + litros > equipo.capacidad_tanque * factor) {
      res.alertas.push({ tipo: 'despacho_repetido', severidad: 'alta', litros: ult.litros + litros - equipo.capacidad_tanque,
        mensaje: `${equipo.codigo} recibió ${Math.round(ult.litros)} L hace ${Math.round(minutos)} min y ahora ${Math.round(litros)} L: en conjunto superan su tanque de ${equipo.capacidad_tanque} L. Posible carga a recipiente externo.` });
    }
  }

  if (nivelAntes != null && nivelDespues != null) {
    const caida = nivelAntes - nivelDespues;
    const dif = caida - litros;
    const tolerancia = toleranciaNivel(cisterna, litros);
    if (dif > tolerancia) {
      res.alertas.push({ tipo: 'descuadre_caudalimetro', severidad: 'alta', litros: dif,
        mensaje: `${cisterna.codigo} bajó ${Math.round(caida)} L pero el caudalímetro midió ${Math.round(litros)} L (diferencia ${Math.round(dif)} L) en despacho a ${equipo ? equipo.codigo : '—'}. Posible bypass o fuga.` });
    } else if (dif < -tolerancia) {
      res.alertas.push({ tipo: 'descuadre_caudalimetro', severidad: 'media', litros: -dif,
        mensaje: `El caudalímetro de ${cisterna.codigo} midió ${Math.round(litros)} L pero el nivel solo bajó ${Math.round(caida)} L. Revisar calibración (aire en línea / K-factor).` });
    }
  }

  if (equipo && ctx.horometro != null && ctx.horometroAnterior != null) {
    const horas = ctx.horometro - ctx.horometroAnterior;
    if (horas > 0.5) {
      const lph = litros / horas;
      const factor = paramNum('factor_consumo_anomalo', 1.35);
      if (lph > equipo.consumo_nominal_lph * factor) {
        res.alertas.push({ tipo: 'consumo_anomalo', severidad: 'alta', litros: litros - equipo.consumo_nominal_lph * horas,
          mensaje: `${equipo.codigo} consumió ${lph.toFixed(1)} L/h en las últimas ${horas.toFixed(1)} h (nominal ${equipo.consumo_nominal_lph} L/h). Posible sifoneo del tanque del equipo.` });
      }
    } else if (horas <= 0 && litros > 30) {
      res.alertas.push({ tipo: 'consumo_anomalo', severidad: 'alta', litros,
        mensaje: `${equipo.codigo} recibió ${Math.round(litros)} L sin haber acumulado horas de trabajo desde el último despacho. Posible sifoneo.` });
    }
  }
  return res;
}

// --- Regla 9: lectura periódica del sensor de nivel de la cisterna ---
// ctx: { cisterna, nivelAnterior, nivelNuevo, despachoEnCurso, minutosDesdeUltima }
function evaluarNivel(ctx) {
  const res = nuevoResultado();
  const { cisterna, nivelAnterior, nivelNuevo, despachoEnCurso } = ctx;
  if (nivelAnterior == null || despachoEnCurso) return res;
  const caida = nivelAnterior - nivelNuevo;
  const umbral = Math.max(paramNum('merma_umbral_l', 15), (cisterna.capacidad || 0) * paramNum('precision_nivel_pct', 0.5) / 100);
  if (caida > umbral) {
    res.alertas.push({ tipo: 'merma_cisterna', severidad: 'critica', litros: caida,
      mensaje: `Caída de nivel de ${Math.round(caida)} L en ${cisterna.codigo} sin despacho en curso. Posible robo directo de la cisterna.` });
  } else if (caida < -umbral * 3) {
    res.alertas.push({ tipo: 'recarga_no_registrada', severidad: 'media', litros: -caida,
      mensaje: `${cisterna.codigo} subió ${Math.round(-caida)} L sin recarga registrada. Verificar guía de remisión.` });
  }
  return res;
}

// --- Regla 10: balance diario por cisterna (stock inicial + recargas − despachos − stock final) ---
function balance(stockInicial, recargas, despachos, stockFinal) {
  const teorico = stockInicial + recargas - despachos;
  const merma = teorico - stockFinal;
  const base = recargas + stockInicial || 1;
  return { teorico, merma, mermaPct: (merma / base) * 100 };
}

module.exports = { evaluarInicio, evaluarPulso, evaluarFin, evaluarNivel, balance, distanciaM, toleranciaNivel };
