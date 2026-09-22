/* FuelGuard – dashboard en tiempo real */
'use strict';

// ------------------------------------------------------------------ estado
const S = {
  token: localStorage.getItem('fg_token') || null,
  usuario: null, params: null, vista: 'panel', dias: 7, filtroAlertas: 'activas',
  enVivo: new Map(), charts: {}, equipos: [], sse: null, kit: 'estandar',
};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = (n, d = 0) => Number(n ?? 0).toLocaleString('es-PE', { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtL = (n, d = 0) => `${fmtN(n, d)} L`;
const fmtMoneda = n => `${S.params?.moneda || 'USD'} ${fmtN(n, 0)}`;
const fmtHora = iso => iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtFecha = iso => iso ? new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const relativo = iso => {
  if (!iso) return 'nunca';
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return `hace ${Math.round(s)} s`; if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`; return `hace ${Math.round(s / 86400)} d`;
};
const ROL_NOMBRE = { admin: 'Administrador', supervisor: 'Supervisor', chofer: 'Chofer de cisterna', operador: 'Operador de equipo' };
const TIPO_ALERTA = {
  tag_no_autorizado: 'Tag no autorizado', equipo_inactivo: 'Equipo inactivo', fuera_de_horario: 'Fuera de horario', fuera_de_geocerca: 'Fuera de geocerca',
  despacho_repetido: 'Despacho repetido', sobrellenado: 'Sobrellenado', caudal_anomalo: 'Caudal anómalo', descuadre_caudalimetro: 'Descuadre caudalímetro',
  consumo_anomalo: 'Consumo anómalo', merma_cisterna: 'Merma en cisterna', recarga_no_registrada: 'Recarga no registrada', recarga_descuadrada: 'Recarga descuadrada', sin_senal: 'Sin señal',
};
const ICONO = { critica: '⛔', alta: '⚠️', media: '🔶', info: 'ℹ️' };
const ESTADO = { completado: ['ok', 'Completado'], en_curso: ['info', 'En curso'], rechazado: ['critica', 'Rechazado'], cortado: ['alta', 'Cortado'] };
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// ------------------------------------------------------------------ API
async function api(ruta, opciones = {}) {
  const r = await fetch('/api' + ruta, { ...opciones, headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}), ...(opciones.headers || {}) }, body: opciones.body ? JSON.stringify(opciones.body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && !ruta.startsWith('/login')) { cerrarSesion(false); throw new Error('Sesión expirada'); }
  if (!r.ok) throw new Error(data.error || 'Error de servidor');
  return data;
}

// ------------------------------------------------------------------ login
$('#demo-users').addEventListener('click', e => {
  const b = e.target.closest('button[data-u]'); if (!b) return;
  $('#usuario').value = b.dataset.u; $('#pin').value = b.dataset.p; $('#form-login').requestSubmit();
});
$('#form-login').addEventListener('submit', async e => {
  e.preventDefault(); $('#login-error').textContent = '';
  try {
    const r = await api('/login', { method: 'POST', body: { usuario: $('#usuario').value, pin: $('#pin').value } });
    S.token = r.token; localStorage.setItem('fg_token', r.token);
    await iniciar();
  } catch (err) { $('#login-error').textContent = err.message; }
});
$('#btn-logout').addEventListener('click', () => cerrarSesion(true));
function cerrarSesion(llamar) {
  if (llamar && S.token) api('/logout', { method: 'POST' }).catch(() => {});
  S.token = null; S.usuario = null; localStorage.removeItem('fg_token');
  if (S.sse) { S.sse.close(); S.sse = null; }
  $('#app').classList.add('hidden'); $('#login').classList.remove('hidden');
}

async function iniciar() {
  const me = await api('/me');
  S.usuario = me.usuario; S.params = me.parametros;
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#who-nombre').textContent = S.usuario.nombre; $('#who-rol').textContent = ROL_NOMBRE[S.usuario.rol] + (S.usuario.cisterna_codigo ? ' · ' + S.usuario.cisterna_codigo : '');
  $('#avatar').textContent = S.usuario.nombre.split(' ').map(p => p[0]).slice(0, 2).join('');
  $('#empresa').textContent = S.params.empresa;
  const admin = S.usuario.rol === 'admin';
  $$('.solo-admin').forEach(el => el.classList.toggle('hidden', !admin));
  const operador = S.usuario.rol === 'operador';
  $('#nav-consumo-label').textContent = operador ? 'Mi consumo' : 'Consumo';
  $('#card-balance').classList.toggle('hidden', operador);
  $('#card-cisternas-detalle').classList.toggle('hidden', operador);
  conectarSSE();
  irA('panel');
}

// ------------------------------------------------------------------ navegación
const TITULOS = {
  panel: ['Panel', 'Estado en tiempo real del despacho de combustible'], despachos: ['Despachos', 'Cada registro proviene del caudalímetro, no de un vale manual'],
  consumo: ['Consumo', 'Litros, horas y rendimiento por equipo y por usuario'], alertas: ['Alertas', 'Eventos detectados por el motor de reglas antirrobo'],
  equipos: ['Equipos y cisternas', 'Catálogo, tags RFID y estado de los dispositivos'], hardware: ['Hardware y costos', 'Cómo funciona y cuánto cuesta implementarlo'], admin: ['Administración', 'Usuarios, parámetros y auditoría'],
};
$('#nav').addEventListener('click', e => { const b = e.target.closest('button[data-vista]'); if (b) irA(b.dataset.vista); });
document.addEventListener('click', e => { const b = e.target.closest('[data-ir]'); if (b) irA(b.dataset.ir); });
async function irA(v) {
  S.vista = v;
  $$('.nav button').forEach(b => b.classList.toggle('active', b.dataset.vista === v));
  $$('.vista').forEach(s => s.classList.toggle('hidden', s.id !== 'vista-' + v));
  const [t, st] = TITULOS[v]; $('#titulo-vista').textContent = S.usuario.rol === 'operador' && v === 'consumo' ? 'Mi consumo' : t; $('#subtitulo-vista').textContent = S.usuario.rol === 'operador' && v === 'consumo' ? 'Solo los equipos asignados a ti' : st;
  try { await ({ panel: cargarPanel, despachos: cargarDespachos, consumo: cargarConsumo, alertas: cargarAlertas, equipos: cargarEquipos, hardware: cargarHardware, admin: cargarAdmin })[v](); }
  catch (e) { toast('Error', e.message, 'critica'); }
}

// ------------------------------------------------------------------ Chart.js base
function chartBase() {
  Chart.defaults.color = cssVar('--text-2'); Chart.defaults.borderColor = cssVar('--border'); Chart.defaults.font.family = cssVar('--font');
}
function grafico(id, cfg) {
  chartBase();
  if (S.charts[id]) S.charts[id].destroy();
  const ctx = document.getElementById(id); if (!ctx) return;
  const o = cfg.options || {};
  const tooltip = { padding: 10, backgroundColor: cssVar('--surface-2'), titleColor: cssVar('--text'), bodyColor: cssVar('--text-2'), borderColor: cssVar('--border'), borderWidth: 1, ...(o.plugins?.tooltip || {}) };
  cfg.options = { responsive: true, maintainAspectRatio: false, animation: { duration: 400 }, ...o,
    plugins: { ...(o.plugins || {}), legend: { display: false, ...(o.plugins?.legend || {}) }, tooltip },
    scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } }, y: { beginAtZero: true, grid: { color: cssVar('--border') }, border: { display: false }, ticks: { callback: v => fmtN(v) } }, ...(o.scales || {}) } };
  S.charts[id] = new Chart(ctx, cfg);
}

// ------------------------------------------------------------------ PANEL
let panelResumen = null;
async function cargarPanel() {
  const [res, hora, dias, alertas, ultimos] = await Promise.all([api('/resumen'), api('/consumo/por-hora'), api('/consumo/por-dia?dias=14'), api('/alertas?activas=1&limite=6'), api('/despachos?limite=8')]);
  panelResumen = res;
  renderKPIs(res); renderCisternas(res.cisternas);
  S.enVivo.clear(); res.en_curso.forEach(d => S.enVivo.set(d.id, { ...d, litros: d.litros, caudal: d.caudal_actual })); renderEnVivo();
  renderAlertasRecientes(alertas);
  $('#tabla-ultimos').innerHTML = ultimos.map(filaUltimo).join('') || `<tr><td colspan="7" class="muted">Sin despachos</td></tr>`;
  grafico('ch-hora', { type: 'bar', data: { labels: hora.map(h => `${String(h.hora).padStart(2, '0')}h`), datasets: [{ data: hora.map(h => h.litros), backgroundColor: cssVar('--series-1'), borderRadius: 4, maxBarThickness: 22 }] },
    options: { plugins: { tooltip: { callbacks: { label: c => fmtL(c.raw) } } } } });
  grafico('ch-dias', { type: 'line', data: { labels: dias.map(d => d.dia.slice(5).replace('-', '/')), datasets: [{ data: dias.map(d => d.litros), borderColor: cssVar('--series-1'), backgroundColor: 'rgba(57,135,229,0.12)', borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, fill: true, tension: 0.25 }] },
    options: { interaction: { mode: 'index', intersect: false }, plugins: { tooltip: { callbacks: { label: c => fmtL(c.raw) } } } } });
}
function renderKPIs(r) {
  const varHoy = r.litros_ayer ? ((r.litros_hoy - r.litros_ayer) / r.litros_ayer) * 100 : null;
  const k = [
    { l: 'Litros despachados hoy', v: fmtN(r.litros_hoy), u: 'L', s: `${r.despachos_hoy} despachos${varHoy != null ? ` · ${varHoy >= 0 ? '+' : ''}${fmtN(varHoy)}% vs ayer` : ''}` },
    { l: 'Últimos 30 días', v: fmtN(r.litros_mes), u: 'L', s: `${fmtMoneda(r.costo_mes)} · ${r.despachos_mes} despachos` },
    { l: 'Alertas activas', v: r.alertas_activas, s: `${r.alertas_criticas} críticas · ${r.rechazados_hoy} despachos bloqueados hoy`, c: r.alertas_criticas ? 'alert' : r.alertas_activas ? 'warn' : 'ok' },
    { l: 'Merma detectada · 30 días', v: fmtN(r.merma_mes_l), u: 'L', s: `${fmtN(r.merma_mes_pct, 1)}% del despacho · ${fmtMoneda(r.merma_mes_costo)}`, c: r.merma_mes_pct > 2 ? 'alert' : r.merma_mes_pct > 0.5 ? 'warn' : 'ok' },
  ];
  if (S.usuario.rol !== 'operador') k.push({ l: 'Stock en cisternas', v: fmtN(r.cisternas.reduce((a, c) => a + c.nivel_actual, 0)), u: 'L', s: `${r.cisternas.filter(c => c.en_linea).length}/${r.cisternas.length} cisternas en línea` });
  $('#kpis').innerHTML = k.map(x => `<div class="kpi ${x.c || ''}"><div class="label">${x.l}</div><div class="value">${x.v}${x.u ? `<small>${x.u}</small>` : ''}</div><div class="sub">${x.s}</div></div>`).join('');
  $('#nav-alertas').textContent = r.alertas_activas; $('#nav-alertas').classList.toggle('hidden', !r.alertas_activas);
}
function renderCisternas(lista) {
  $('#cisternas').innerHTML = lista.map(c => {
    const p = (c.nivel_actual / c.capacidad) * 100;
    return `<div class="cisterna" data-cid="${c.id}"><div class="top"><b>${esc(c.codigo)} <span class="muted small">${esc(c.placa)}</span></b><span class="estado-linea ${c.en_linea ? 'on' : ''}">${c.en_linea ? 'en línea' : 'sin señal'}</span></div>
      <div class="gauge ${p < 15 ? 'critico' : p < 30 ? 'bajo' : ''}"><i style="width:${p.toFixed(1)}%"></i></div>
      <div class="meta"><span class="nivel mono">${fmtL(c.nivel_actual)} · ${p.toFixed(0)}%</span><span>de ${fmtL(c.capacidad)}</span></div>
      <div class="meta small" style="margin-top:6px"><span>Chofer: ${esc(c.chofer || '—')}</span><span>${c.despacho_en_curso ? '<span class="badge info">despachando</span>' : `<span class="muted">${relativo(c.ultima_lectura)}</span>`}</span></div></div>`;
  }).join('');
}
function actualizarNivel(ev) {
  const el = document.querySelector(`.cisterna[data-cid="${ev.cisterna_id}"]`); if (!el) return;
  const p = (ev.nivel / ev.capacidad) * 100;
  const g = el.querySelector('.gauge'); g.className = `gauge ${p < 15 ? 'critico' : p < 30 ? 'bajo' : ''}`; g.querySelector('i').style.width = p.toFixed(1) + '%';
  el.querySelector('.nivel').textContent = `${fmtL(ev.nivel)} · ${p.toFixed(0)}%`;
  el.querySelector('.estado-linea').className = 'estado-linea on'; el.querySelector('.estado-linea').textContent = 'en línea';
}
function renderEnVivo() {
  const lista = [...S.enVivo.values()];
  $('#n-en-vivo').textContent = lista.length;
  if (!lista.length) { $('#en-vivo').innerHTML = `<div class="vacio">Ninguna cisterna está despachando ahora. Los despachos aparecerán aquí al leer un tag RFID.</div>`; return; }
  $('#en-vivo').innerHTML = lista.map(d => {
    const cap = d.capacidad_tanque || 400; const p = Math.min(100, (d.litros / cap) * 100); const exceso = d.litros > cap;
    return `<div class="despacho-vivo" data-did="${d.id}"><div class="fila"><div><b>${esc(d.equipo_codigo || d.tag_rfid)}</b> <span class="muted">${esc(d.equipo_nombre || '')}</span></div><span class="badge info">#${d.id} · ${esc(d.cisterna_codigo)}</span></div>
      <div class="fila"><div class="litros"><span class="val">${fmtN(d.litros, 1)}</span><small> L de ${fmtN(cap)} L</small></div><div class="mono caudal">${d.caudal ? fmtN(d.caudal, 1) + ' L/min' : ''}</div></div>
      <div class="barra"><i class="${exceso ? 'exceso' : ''}" style="width:${p.toFixed(1)}%"></i></div>
      <div class="detalle"><span>Operador: <b>${esc(d.operador || '—')}</b></span><span>Chofer: <b>${esc(d.chofer || '—')}</b></span><span>Inicio: <b>${fmtHora(d.inicio)}</b></span><span>Nivel cisterna al inicio: <b>${fmtL(d.nivel_antes)}</b></span></div></div>`;
  }).join('');
}
function actualizarPulso(ev) {
  const d = S.enVivo.get(ev.id);
  if (!d) { if (S.vista === 'panel') cargarPanel(); return; }
  d.litros = ev.litros; d.caudal = ev.caudal;
  const el = document.querySelector(`.despacho-vivo[data-did="${ev.id}"]`); if (!el) return renderEnVivo();
  const cap = d.capacidad_tanque || 400;
  el.querySelector('.val').textContent = fmtN(ev.litros, 1); el.querySelector('.caudal').textContent = ev.caudal ? fmtN(ev.caudal, 1) + ' L/min' : '';
  const i = el.querySelector('.barra i'); i.style.width = Math.min(100, (ev.litros / cap) * 100).toFixed(1) + '%'; i.classList.toggle('exceso', ev.litros > cap);
}
function filaUltimo(d) {
  const [cl, tx] = ESTADO[d.estado] || ['neutro', d.estado];
  return `<tr data-did="${d.id}"><td class="mono">${fmtHora(d.inicio)}</td><td>${esc(d.cisterna_codigo)}</td><td><b>${esc(d.equipo_codigo || d.tag_rfid || '—')}</b></td><td>${esc(d.operador || '—')}</td><td class="num mono">${fmtN(d.litros, 1)}</td><td class="num mono">${d.caudal_prom ? fmtN(d.caudal_prom, 1) : '—'}</td><td><span class="badge ${cl}">${tx}</span>${d.n_alertas ? ` <span class="badge alta">${d.n_alertas} ⚠</span>` : ''}</td></tr>`;
}
function renderAlertasRecientes(lista) {
  $('#alertas-recientes').innerHTML = lista.length ? lista.map(alertaHTML).join('') : `<div class="vacio">Sin alertas activas. Todo en orden.</div>`;
}
function alertaHTML(a, conAcciones = false) {
  const puede = conAcciones && !a.resuelta && ['admin', 'supervisor'].includes(S.usuario.rol);
  return `<div class="alerta ${a.resuelta ? 'resuelta' : ''}" data-aid="${a.id}"><div class="icono ${a.severidad}">${ICONO[a.severidad] || '•'}</div>
    <div><div class="msg"><span class="badge ${a.severidad}">${TIPO_ALERTA[a.tipo] || a.tipo}</span> ${esc(a.mensaje)}</div>
    <div class="meta"><span>${fmtFecha(a.ts)}</span>${a.cisterna_codigo ? `<span>${esc(a.cisterna_codigo)}</span>` : ''}${a.equipo_codigo ? `<span>${esc(a.equipo_codigo)}</span>` : ''}${a.litros_afectados ? `<span>${fmtL(a.litros_afectados)} afectados</span>` : ''}${a.despacho_id ? `<span>despacho #${a.despacho_id}</span>` : ''}${a.resuelta ? `<span>✔ resuelta por ${esc(a.resuelta_por_nombre || '—')}${a.nota ? ': ' + esc(a.nota) : ''}</span>` : ''}</div></div>
    <div>${puede ? `<button class="btn small" data-resolver="${a.id}">Resolver</button>` : ''}</div></div>`;
}

// ------------------------------------------------------------------ DESPACHOS
async function cargarDespachos() {
  if (!S.equipos.length) S.equipos = await api('/equipos');
  const sel = $('#f-equipo'); if (sel.options.length <= 1) sel.innerHTML = '<option value="">Todos los equipos</option>' + S.equipos.map(e => `<option value="${e.id}">${esc(e.codigo)} · ${esc(e.nombre)}</option>`).join('');
  const qs = new URLSearchParams({ limite: 300 }); if ($('#f-estado').value) qs.set('estado', $('#f-estado').value); if (sel.value) qs.set('equipo_id', sel.value);
  const lista = await api('/despachos?' + qs); S.ultimaListaDespachos = lista;
  $('#tabla-despachos').innerHTML = lista.map(filaDespacho).join('') || `<tr><td colspan="14" class="muted">Sin resultados</td></tr>`;
}
function filaDespacho(d) {
  const [cl, tx] = ESTADO[d.estado] || ['neutro', d.estado];
  return `<tr data-did="${d.id}"><td class="mono muted">${d.id}</td><td class="mono">${fmtFecha(d.inicio)}</td><td>${esc(d.cisterna_codigo)}</td><td><b>${esc(d.equipo_codigo || '—')}</b>${!d.equipo_codigo ? `<div class="small muted mono">${esc(d.tag_rfid)}</div>` : ''}</td><td>${esc(d.operador || '—')}</td><td>${esc(d.chofer || '—')}</td>
    <td class="num mono">${fmtN(d.litros, 1)}</td><td class="num mono muted">${fmtN(d.pulsos)}</td><td class="num mono">${d.caudal_prom ? fmtN(d.caudal_prom, 1) : '—'}</td><td class="num mono">${d.horometro != null ? fmtN(d.horometro, 1) : '—'}</td>
    <td class="num mono">${d.nivel_antes != null ? fmtN(d.nivel_antes) : '—'} → ${d.nivel_despues != null ? fmtN(d.nivel_despues) : '—'}</td><td><span class="badge ${cl}">${tx}</span>${d.motivo && d.estado !== 'completado' ? `<div class="small muted">${esc(d.motivo)}</div>` : ''}</td>
    <td>${d.n_alertas ? `<span class="badge alta">${d.n_alertas}</span> ` : ''}${d.confirmado === 2 ? '<span class="badge ok" title="Firmado por el operador en la tablet">✍ firmado</span>' : d.confirmado === 1 ? '<span class="badge neutro">confirmado</span>' : ''}${d.motivo === 'manual' ? ' <span class="badge media">manual</span>' : ''}</td><td class="mono small muted" title="${esc(d.hash || '')}">${d.hash ? d.hash.slice(0, 8) + '…' : ''}</td></tr>`;
}
// Detalle de un despacho (clic en la fila): alertas, confirmación y firma del operador.
document.addEventListener('click', async e => {
  const tr = e.target.closest('#tabla-despachos tr[data-did], #tabla-ultimos tr[data-did]'); if (!tr || e.target.closest('button')) return;
  try {
    const d = await api(`/despachos/${tr.dataset.did}`);
    const [cl, tx] = ESTADO[d.estado] || ['neutro', d.estado];
    modal(`<h2>Despacho #${d.id} <span class="badge ${cl}">${tx}</span></h2>
      <div class="form-grid" style="margin-top:12px;font-size:13px">
        <div><div class="muted small">Equipo</div><b>${esc(d.equipo_codigo || d.tag_rfid || '—')}</b><div class="small">${esc(d.equipo_nombre || '')}</div></div>
        <div><div class="muted small">Litros</div><b>${fmtN(d.litros, 1)} L</b><div class="small muted">${fmtN(d.pulsos)} pulsos · ${d.caudal_prom ? fmtN(d.caudal_prom, 1) + ' L/min' : '—'}</div></div>
        <div><div class="muted small">Cisterna / chofer</div><b>${esc(d.cisterna_codigo)}</b><div class="small">${esc(d.chofer || '—')}</div></div>
        <div><div class="muted small">Operador</div><b>${esc(d.operador || '—')}</b></div>
        <div><div class="muted small">Inicio → fin</div><b>${fmtFecha(d.inicio)}</b><div class="small">${fmtFecha(d.fin)}</div></div>
        <div><div class="muted small">Horómetro</div><b>${d.horometro != null ? fmtN(d.horometro, 1) : '—'}</b><div class="small muted">anterior ${d.horometro_anterior != null ? fmtN(d.horometro_anterior, 1) : '—'}</div></div>
        <div><div class="muted small">Nivel cisterna</div><b>${d.nivel_antes != null ? fmtN(d.nivel_antes) : '—'} → ${d.nivel_despues != null ? fmtN(d.nivel_despues) : '—'} L</b></div>
        <div><div class="muted small">Hash</div><span class="mono small">${esc(d.hash || '—')}</span></div>
      </div>
      ${d.alertas.length ? `<h3 style="margin:14px 0 6px">Alertas</h3><div class="alertas-lista">${d.alertas.map(a => alertaHTML(a)).join('')}</div>` : ''}
      <h3 style="margin:14px 0 6px">Confirmación en la tablet</h3>
      ${d.confirmacion ? `<div class="small">Por <b>${esc(d.confirmacion.chofer_nombre || '—')}</b> el ${fmtFecha(d.confirmacion.ts)}${d.confirmacion.horometro != null ? ` · horómetro <b>${fmtN(d.confirmacion.horometro, 1)}</b>` : ''}${d.confirmacion.observacion ? ` · "${esc(d.confirmacion.observacion)}"` : ''}</div>
        ${d.confirmacion.firma ? `<img src="${d.confirmacion.firma}" alt="firma" style="background:#fff;border-radius:8px;max-width:100%;max-height:160px;margin-top:8px">` : '<div class="small muted">Sin firma del operador</div>'}` : '<div class="small muted">Sin confirmar en la tablet</div>'}`, async () => {});
    $('#modal-root .btn.primary').textContent = 'Cerrar';
  } catch (err) { toast('Error', err.message, 'critica'); }
});
$('#f-estado').addEventListener('change', cargarDespachos); $('#f-equipo').addEventListener('change', cargarDespachos);
$('#btn-csv').addEventListener('click', () => {
  const cols = ['id', 'inicio', 'fin', 'cisterna_codigo', 'equipo_codigo', 'tag_rfid', 'operador', 'chofer', 'litros', 'pulsos', 'caudal_prom', 'horometro', 'horometro_anterior', 'nivel_antes', 'nivel_despues', 'estado', 'motivo', 'n_alertas', 'hash'];
  const csv = [cols.join(';'), ...(S.ultimaListaDespachos || []).map(d => cols.map(c => `"${String(d[c] ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = `despachos_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
});

// ------------------------------------------------------------------ CONSUMO
$('#periodo').addEventListener('click', e => { const b = e.target.closest('button[data-dias]'); if (!b) return; S.dias = Number(b.dataset.dias); $$('#periodo button').forEach(x => x.classList.toggle('active', x === b)); cargarConsumo(); });
async function cargarConsumo() {
  const precio = S.params.precio_litro;
  const [eq, us, balance] = await Promise.all([api(`/consumo/por-equipo?dias=${S.dias}`), api(`/consumo/por-usuario?dias=${S.dias}`), S.usuario.rol === 'operador' ? Promise.resolve([]) : api(`/balance?dias=${S.dias}`)]);
  $('#consumo-titulo').textContent = `Consumo por equipo · últimos ${S.dias} días`;
  const conDatos = eq.filter(e => e.litros > 0);
  grafico('ch-equipos', { type: 'bar', data: { labels: conDatos.map(e => e.codigo), datasets: [{ label: 'Litros', data: conDatos.map(e => e.litros), backgroundColor: conDatos.map(e => e.lph_real && e.lph_real > e.consumo_nominal_lph * 1.35 ? cssVar('--critical') : cssVar('--series-1')), borderRadius: 4, maxBarThickness: 34 }] },
    options: { plugins: { tooltip: { callbacks: { label: c => { const e = conDatos[c.dataIndex]; return [`${fmtL(e.litros)} en ${e.despachos} despachos`, e.lph_real ? `${fmtN(e.lph_real, 1)} L/h real vs ${e.consumo_nominal_lph} nominal` : 'sin horas registradas']; } } } } } });
  $('#tabla-equipos-consumo').innerHTML = eq.map(e => {
    const desv = e.lph_real ? ((e.lph_real - e.consumo_nominal_lph) / e.consumo_nominal_lph) * 100 : null;
    return `<tr><td><b>${esc(e.codigo)}</b><div class="small muted">${esc(e.nombre)}</div></td><td>${esc(e.tipo)}</td><td>${esc(e.operador || '—')}</td><td class="num mono">${e.despachos}</td><td class="num mono">${fmtN(e.litros)}</td><td class="num mono">${fmtN(e.horas, 1)}</td><td class="num mono">${e.lph_real != null ? fmtN(e.lph_real, 1) : '—'}</td><td class="num mono muted">${e.consumo_nominal_lph}</td>
      <td class="num">${desv == null ? '—' : `<span class="badge ${desv > 35 ? 'critica' : desv > 15 ? 'media' : 'ok'}">${desv >= 0 ? '+' : ''}${fmtN(desv)}%</span>`}</td><td class="num mono">${fmtMoneda(e.litros * precio)}</td></tr>`;
  }).join('');
  grafico('ch-usuarios', { type: 'bar', data: { labels: us.map(u => u.nombre.split(' ')[0] + ' ' + (u.nombre.split(' ')[1] || '').slice(0, 1) + '.'), datasets: [{ data: us.map(u => u.litros), backgroundColor: cssVar('--series-3'), borderRadius: 4, maxBarThickness: 34 }] },
    options: { indexAxis: 'y', scales: { x: { beginAtZero: true, grid: { color: cssVar('--border') }, ticks: { callback: v => fmtN(v) } }, y: { grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: c => fmtL(c.raw) } } } } });
  $('#tabla-usuarios-consumo').innerHTML = us.map(u => `<tr><td><b>${esc(u.nombre)}</b></td><td class="num mono">${u.equipos}</td><td class="num mono">${u.despachos}</td><td class="num mono">${fmtN(u.litros)}</td><td class="num">${u.alertas ? `<span class="badge alta">${u.alertas}</span>` : '<span class="muted">0</span>'}</td></tr>`).join('');
  $('#tabla-balance').innerHTML = balance.map(b => `<tr><td><b>${esc(b.cisterna)}</b><div class="small muted">desde ${fmtFecha(b.desde)} · ${b.despachos_n} despachos · ${b.recargas_n} recargas</div></td><td class="num mono">${fmtN(b.stock_inicial)}</td><td class="num mono">${fmtN(b.recargas_l)}</td><td class="num mono">${fmtN(b.despachado_l)}</td><td class="num mono">${fmtN(b.teorico)}</td><td class="num mono">${fmtN(b.stock_final)}</td><td class="num mono">${fmtN(b.merma_l)}</td><td class="num"><span class="badge ${b.merma_pct > 2 ? 'critica' : b.merma_pct > 0.5 ? 'media' : 'ok'}">${fmtN(b.merma_pct, 1)}%</span></td><td class="num mono">${fmtN(b.merma_detectada_l)} <span class="muted small">(${b.eventos_merma} ev.)</span></td></tr>`).join('');
}

// ------------------------------------------------------------------ ALERTAS
$('#filtro-alertas').addEventListener('click', e => { const b = e.target.closest('button[data-f]'); if (!b) return; S.filtroAlertas = b.dataset.f; $$('#filtro-alertas button').forEach(x => x.classList.toggle('active', x === b)); cargarAlertas(); });
async function cargarAlertas() {
  const lista = await api(`/alertas?${S.filtroAlertas === 'activas' ? 'activas=1&' : ''}limite=300`);
  $('#alertas-lista').innerHTML = lista.length ? lista.map(a => alertaHTML(a, true)).join('') : `<div class="vacio">No hay alertas ${S.filtroAlertas === 'activas' ? 'activas' : 'registradas'}.</div>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-resolver]'); if (!b) return;
  const nota = prompt('Nota de resolución (qué se verificó / qué acción se tomó):'); if (nota === null) return;
  try { await api(`/alertas/${b.dataset.resolver}/resolver`, { method: 'POST', body: { nota } }); toast('Alerta resuelta', nota || 'Sin nota', 'ok'); cargarAlertas(); }
  catch (err) { toast('Error', err.message, 'critica'); }
});

// ------------------------------------------------------------------ EQUIPOS
async function cargarEquipos() {
  const [eq, cis] = await Promise.all([api('/equipos'), S.usuario.rol === 'operador' ? Promise.resolve([]) : api('/cisternas')]);
  S.equipos = eq; const admin = S.usuario.rol === 'admin';
  $('#tabla-equipos').innerHTML = eq.map(e => `<tr><td><b>${esc(e.codigo)}</b></td><td>${esc(e.nombre)}</td><td>${esc(e.tipo)}</td><td class="mono small">${esc(e.tag_rfid || '—')}</td><td>${esc(e.operador || '—')}</td><td class="num mono">${fmtN(e.capacidad_tanque)}</td><td class="num mono">${e.consumo_nominal_lph}</td><td class="num mono">${fmtN(e.horometro, 1)}</td>
    <td>${e.ultimo_despacho ? `${fmtFecha(e.ultimo_despacho)} <span class="muted">· ${fmtL(e.ultimos_litros)}</span>` : '—'}</td><td class="num">${e.alertas_activas ? `<span class="badge alta">${e.alertas_activas}</span>` : '<span class="muted">0</span>'}</td><td><span class="badge ${e.activo ? 'ok' : 'neutro'}">${e.activo ? 'Activo' : 'Inactivo'}</span></td>
    <td class="solo-admin ${admin ? '' : 'hidden'}"><button class="btn small" data-editar-equipo="${e.id}">Editar</button></td></tr>`).join('');
  $('#tabla-cisternas').innerHTML = cis.map(c => `<tr><td><b>${esc(c.codigo)}</b></td><td>${esc(c.placa)}</td><td>${esc(c.chofer || '—')}</td><td class="num mono">${fmtN(c.capacidad)}</td><td class="num mono">${fmtN(c.nivel_actual)} <span class="muted">(${fmtN(c.nivel_actual / c.capacidad * 100)}%)</span></td><td class="num mono">${c.k_factor} p/L</td><td class="num mono">${c.caudal_min}–${c.caudal_max}</td><td class="mono small">${c.lat ? `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}` : '—'}</td><td>${relativo(c.ultima_lectura)}</td><td><span class="estado-linea ${c.en_linea ? 'on' : ''}">${c.en_linea ? 'en línea' : 'sin señal'}</span></td></tr>`).join('');
}
$('#btn-nuevo-equipo').addEventListener('click', () => modalEquipo(null));
document.addEventListener('click', e => { const b = e.target.closest('[data-editar-equipo]'); if (b) modalEquipo(S.equipos.find(x => x.id === Number(b.dataset.editarEquipo))); });
async function modalEquipo(e) {
  const usuarios = await api('/usuarios').catch(() => []);
  const ops = usuarios.filter(u => u.rol === 'operador' && u.activo);
  modal(`<h2>${e ? 'Editar equipo ' + esc(e.codigo) : 'Nuevo equipo'}</h2>
    <div class="form-grid" style="margin-top:12px">
      ${e ? '' : '<div class="field"><label>Código</label><input name="codigo" required placeholder="EX-03"></div>'}
      <div class="field"><label>Nombre</label><input name="nombre" required value="${esc(e?.nombre || '')}"></div>
      <div class="field"><label>Tipo</label><input name="tipo" value="${esc(e?.tipo || '')}" placeholder="Excavadora"></div>
      <div class="field"><label>Capacidad tanque (L)</label><input name="capacidad_tanque" type="number" required value="${e?.capacidad_tanque || ''}"></div>
      <div class="field"><label>Consumo nominal (L/h)</label><input name="consumo_nominal_lph" type="number" step="0.1" value="${e?.consumo_nominal_lph || 20}"></div>
      <div class="field"><label>Horómetro actual</label><input name="horometro" type="number" step="0.1" value="${e?.horometro || 0}"></div>
      <div class="field"><label>Tag RFID (EPC)</label><input name="tag_rfid" class="mono" value="${esc(e?.tag_rfid || '')}" placeholder="E200341A1B2C13"></div>
      <div class="field"><label>Operador</label><select name="operador_id"><option value="">— sin asignar —</option>${ops.map(o => `<option value="${o.id}" ${e?.operador_id === o.id ? 'selected' : ''}>${esc(o.nombre)}</option>`).join('')}</select></div>
      ${e ? `<div class="field"><label>Estado</label><select name="activo"><option value="1" ${e.activo ? 'selected' : ''}>Activo</option><option value="0" ${!e.activo ? 'selected' : ''}>Inactivo (bloquea despachos)</option></select></div>` : ''}
    </div>`, async datos => {
    if ('activo' in datos) datos.activo = Number(datos.activo);
    if (datos.operador_id === '') datos.operador_id = null; else datos.operador_id = Number(datos.operador_id);
    await api(e ? `/equipos/${e.id}` : '/equipos', { method: e ? 'PUT' : 'POST', body: datos });
    toast('Equipo guardado', datos.nombre, 'ok'); cargarEquipos();
  });
}

// ------------------------------------------------------------------ ADMIN
const PARAM_LABELS = { empresa: 'Nombre del proyecto/empresa', modo_demo: 'Modo demo (1 = muestra usuarios de prueba en el login)', backup_hora: 'Hora del respaldo automático (0-23)', moneda: 'Moneda', precio_litro: 'Precio por litro', tolerancia_descuadre_pct: 'Tolerancia descuadre (%)', tolerancia_descuadre_l: 'Tolerancia descuadre (L)', merma_umbral_l: 'Umbral merma cisterna (L)', horario_inicio: 'Hora inicio despachos', horario_fin: 'Hora fin despachos', geocerca_lat: 'Geocerca latitud', geocerca_lng: 'Geocerca longitud', geocerca_radio_m: 'Radio geocerca (m)', factor_sobrellenado: 'Factor sobrellenado (1.10 = +10%)', minutos_entre_despachos: 'Minutos mínimos entre despachos', factor_consumo_anomalo: 'Factor consumo anómalo (1.35 = +35%)', precision_nivel_pct: 'Precisión sensor de nivel (% capacidad)' };
async function cargarAdmin() {
  const [us, params, aud, cis, resp] = await Promise.all([api('/usuarios'), api('/parametros'), api('/auditoria'), api('/cisternas'), api('/respaldos').catch(() => null)]);
  S.cisternasAdmin = cis;
  $('#tabla-cisternas-admin').innerHTML = cis.map(c => `<tr><td><b>${esc(c.codigo)}</b></td><td>${esc(c.placa)}</td><td>${esc(c.chofer || '—')}</td><td class="num mono">${fmtN(c.capacidad)} L</td><td class="num mono">${c.k_factor} p/L</td><td class="num mono">${c.caudal_min}–${c.caudal_max}</td><td class="mono small">${esc(c.device_key || '')}</td><td><span class="estado-linea ${c.en_linea ? 'on' : ''}">${c.en_linea ? 'en línea' : 'sin señal'}</span></td>
    <td style="white-space:nowrap"><button class="btn small" data-editar-cisterna="${c.id}">Editar</button> <button class="btn small" data-rotar-clave="${c.id}">Rotar clave</button></td></tr>`).join('') || '<tr><td colspan="9" class="muted">Sin cisternas. Cree la primera para obtener la clave del controlador.</td></tr>';
  if (resp) {
    $('#respaldos-info').textContent = `Carpeta: ${resp.dir} · se conservan los últimos ${resp.conservar || 14} · automático a las ${params.backup_hora || 2}:00`;
    $('#tabla-respaldos').innerHTML = resp.archivos.map(a => `<tr><td class="mono small">${esc(a.nombre)}</td><td class="num mono">${fmtN(a.bytes / 1024)} KB</td><td class="small">${fmtFecha(a.fecha)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Aún no hay respaldos</td></tr>';
  }
  $('#tabla-usuarios').innerHTML = us.map(u => `<tr><td><b>${esc(u.nombre)}</b></td><td class="mono">${esc(u.usuario)}</td><td><span class="badge neutro">${ROL_NOMBRE[u.rol]}</span></td><td class="small">${esc(u.cisterna || u.equipos || '—')}</td><td><span class="badge ${u.activo ? 'ok' : 'neutro'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td><td><button class="btn small" data-editar-usuario="${u.id}">Editar</button></td></tr>`).join('');
  S.usuariosAdmin = us;
  $('#form-params').innerHTML = Object.entries(PARAM_LABELS).map(([k, l]) => `<div class="field"><label>${l}</label><input name="${k}" value="${esc(params[k] ?? '')}"></div>`).join('');
  $('#tabla-auditoria').innerHTML = aud.map(a => `<tr><td class="mono small">${fmtFecha(a.ts)}</td><td>${esc(a.nombre || '—')}</td><td><span class="badge neutro">${esc(a.accion)}</span></td><td class="small muted">${esc(a.detalle || '')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sin registros</td></tr>';
}
$('#btn-guardar-params').addEventListener('click', async () => {
  const datos = Object.fromEntries($$('#form-params input').map(i => [i.name, i.value]));
  try { await api('/parametros', { method: 'PUT', body: datos }); S.params = { ...S.params, empresa: datos.empresa, moneda: datos.moneda, precio_litro: Number(datos.precio_litro) }; $('#empresa').textContent = datos.empresa; toast('Parámetros guardados', 'Las reglas usan los nuevos valores de inmediato', 'ok'); }
  catch (e) { toast('Error', e.message, 'critica'); }
});
$('#btn-respaldar').addEventListener('click', async () => { try { const r = await api('/respaldos', { method: 'POST' }); toast('Respaldo creado', r.archivo, 'ok'); cargarAdmin(); } catch (e) { toast('Error', e.message, 'critica'); } });
$('#btn-nueva-cisterna').addEventListener('click', () => modalCisterna(null));
document.addEventListener('click', async e => {
  const ed = e.target.closest('[data-editar-cisterna]'); if (ed) return modalCisterna(S.cisternasAdmin.find(c => c.id === Number(ed.dataset.editarCisterna)));
  const ro = e.target.closest('[data-rotar-clave]'); if (!ro) return;
  const c = S.cisternasAdmin.find(x => x.id === Number(ro.dataset.rotarClave));
  if (!confirm(`¿Rotar la clave de ${c.codigo}? El controlador dejará de reportar hasta que se regrabe con la nueva clave.`)) return;
  try { const r = await api(`/cisternas/${c.id}/rotar-clave`, { method: 'POST' }); mostrarClave(r.codigo, r.device_key); cargarAdmin(); } catch (err) { toast('Error', err.message, 'critica'); }
});
function mostrarClave(codigo, clave) {
  modal(`<h2>Clave del dispositivo · ${esc(codigo)}</h2><p class="small muted">Cópiela ahora en <code>DEVICE_KEY</code> (firmware/include/config.h). No volverá a mostrarse completa.</p>
    <div class="field"><label>device_key</label><input class="mono" value="${esc(clave)}" readonly onclick="this.select()"></div>`, async () => {});
  $('#modal-root .btn.primary').textContent = 'Entendido';
}
async function modalCisterna(c) {
  const usuarios = await api('/usuarios').catch(() => []);
  const choferes = usuarios.filter(u => u.rol === 'chofer' && u.activo);
  modal(`<h2>${c ? 'Editar cisterna ' + esc(c.codigo) : 'Nueva cisterna'}</h2><div class="form-grid" style="margin-top:12px">
    ${c ? '' : '<div class="field"><label>Código</label><input name="codigo" required placeholder="CIST-03"></div>'}
    <div class="field"><label>Placa</label><input name="placa" required value="${esc(c?.placa || '')}"></div>
    <div class="field"><label>Capacidad (L)</label><input name="capacidad" type="number" required value="${c?.capacidad || ''}"></div>
    <div class="field"><label>Nivel actual (L)</label><input name="nivel_actual" type="number" value="${c?.nivel_actual ?? 0}"></div>
    <div class="field"><label>Chofer</label><select name="chofer_id"><option value="">— sin asignar —</option>${choferes.map(u => `<option value="${u.id}" ${c?.chofer_id === u.id ? 'selected' : ''}>${esc(u.nombre)}</option>`).join('')}</select></div>
    <div class="field"><label>K-factor (pulsos/L)</label><input name="k_factor" type="number" step="0.01" value="${c?.k_factor || 100}"></div>
    <div class="field"><label>Caudal mínimo (L/min)</label><input name="caudal_min" type="number" value="${c?.caudal_min || 10}"></div>
    <div class="field"><label>Caudal máximo (L/min)</label><input name="caudal_max" type="number" value="${c?.caudal_max || 120}"></div></div>`,
    async datos => {
      for (const k of ['capacidad', 'nivel_actual', 'k_factor', 'caudal_min', 'caudal_max']) if (k in datos) datos[k] = Number(datos[k]);
      datos.chofer_id = datos.chofer_id ? Number(datos.chofer_id) : null;
      const r = await api(c ? `/cisternas/${c.id}` : '/cisternas', { method: c ? 'PUT' : 'POST', body: datos });
      toast('Cisterna guardada', datos.placa, 'ok'); cargarAdmin();
      if (!c) setTimeout(() => mostrarClave(r.codigo, r.device_key), 50);
    });
}
$('#btn-nuevo-usuario').addEventListener('click', () => modalUsuario(null));
document.addEventListener('click', e => { const b = e.target.closest('[data-editar-usuario]'); if (b) modalUsuario(S.usuariosAdmin.find(x => x.id === Number(b.dataset.editarUsuario))); });
function modalUsuario(u) {
  modal(`<h2>${u ? 'Editar usuario' : 'Nuevo usuario'}</h2><div class="form-grid" style="margin-top:12px">
    <div class="field"><label>Nombre completo</label><input name="nombre" required value="${esc(u?.nombre || '')}"></div>
    ${u ? '' : '<div class="field"><label>Usuario (login)</label><input name="usuario" required></div>'}
    <div class="field"><label>Rol</label><select name="rol">${Object.entries(ROL_NOMBRE).map(([k, v]) => `<option value="${k}" ${u?.rol === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="field"><label>PIN ${u ? '(dejar vacío para no cambiar)' : ''}</label><input name="pin" inputmode="numeric" ${u ? '' : 'required'} placeholder="4 a 8 dígitos"></div>
    ${u ? `<div class="field"><label>Estado</label><select name="activo"><option value="1" ${u.activo ? 'selected' : ''}>Activo</option><option value="0" ${!u.activo ? 'selected' : ''}>Inactivo</option></select></div>` : ''}</div>`,
    async datos => { if (!datos.pin) delete datos.pin; if ('activo' in datos) datos.activo = Number(datos.activo); await api(u ? `/usuarios/${u.id}` : '/usuarios', { method: u ? 'PUT' : 'POST', body: datos }); toast('Usuario guardado', datos.nombre, 'ok'); cargarAdmin(); });
}

// ------------------------------------------------------------------ HARDWARE Y COSTOS
const COMPONENTES = [
  // clave, nombre, para qué, unidad (cisterna|equipo|global|mes_cisterna|mes_equipo|mes_global), costo, kits en los que aplica
  { k: 'caudalimetro', n: 'Caudalímetro de pulsos 1½"–2" para diésel (engranaje oval/turbina, 20–200 L/min, salida de pulsos ~100 p/L)', p: 'Mide cada litro despachado sin intervención humana', u: 'cisterna', c: 850, kits: ['basico', 'estandar', 'completo'] },
  { k: 'valvula', n: 'Electroválvula NC 1½" para combustible + relé y cableado', p: 'Solo abre con tag autorizado; corta ante sobrellenado', u: 'cisterna', c: 260, kits: ['basico', 'estandar', 'completo'] },
  { k: 'lector', n: 'Lector RFID UHF/LF IP67 con antena en la boquilla de la pistola', p: 'Identifica el equipo al acercar la pistola al tanque', u: 'cisterna', c: 320, kits: ['basico', 'estandar', 'completo'] },
  { k: 'controlador', n: 'Controlador IoT industrial (4G/LTE-M, GPS, entrada de pulsos, salida a válvula, buffer offline, 12/24 V, IP67)', p: 'Cerebro del camión: autoriza, cuenta pulsos, transmite', u: 'cisterna', c: 650, kits: ['basico', 'estandar', 'completo'] },
  { k: 'nivel_cist', n: 'Sensor de nivel para la cisterna (ultrasónico/capacitivo/presión hidrostática, 4–20 mA, ±0.3 %)', p: 'Concilia el nivel con lo medido: detecta robo directo y bypass', u: 'cisterna', c: 380, kits: ['estandar', 'completo'] },
  { k: 'tablet', n: 'Tablet rugerizada 8" para el chofer (app de despacho)', p: 'Muestra autorización, litros en vivo, firma del operador', u: 'cisterna', c: 280, kits: ['estandar', 'completo'] },
  { k: 'impresora', n: 'Impresora térmica Bluetooth de tickets', p: 'Comprobante físico con hash del despacho', u: 'cisterna', c: 150, kits: ['estandar', 'completo'] },
  { k: 'inst_cist', n: 'Instalación, calibración del caudalímetro y puesta en marcha por cisterna', p: 'Mano de obra especializada, pruebas con recipiente patrón', u: 'cisterna', c: 600, kits: ['basico', 'estandar', 'completo'] },
  { k: 'tag', n: 'Tag RFID pasivo industrial (anillo de cuello de tanque o tag on-metal, IP68, resistente a diésel)', p: 'Identidad única e intransferible del equipo', u: 'equipo', c: 18, kits: ['basico', 'estandar', 'completo'] },
  { k: 'inst_tag', n: 'Instalación y alta del tag en el sistema', p: '', u: 'equipo', c: 15, kits: ['basico', 'estandar', 'completo'] },
  { k: 'nivel_eq', n: 'Sensor de nivel capacitivo para tanque del equipo (tipo DUT-E, ±1 %)', p: 'Detecta sifoneo: nivel cae con motor apagado', u: 'equipo', c: 260, kits: ['completo'] },
  { k: 'tracker', n: 'Rastreador GPS 4G con lectura CAN J1939 / horómetro', p: 'Horas reales de trabajo → L/h real por equipo', u: 'equipo', c: 190, kits: ['completo'] },
  { k: 'inst_eq', n: 'Instalación de sensor + tracker en el equipo', p: '', u: 'equipo', c: 120, kits: ['completo'] },
  { k: 'servidor_setup', n: 'Implementación de software, configuración y capacitación (una vez)', p: 'Puesta en producción de FuelGuard, carga de equipos y usuarios', u: 'global', c: 1500, kits: ['basico', 'estandar', 'completo'] },
  { k: 'sim_cist', n: 'Plan de datos 4G por cisterna', p: '', u: 'mes_cisterna', c: 8, kits: ['basico', 'estandar', 'completo'] },
  { k: 'sim_eq', n: 'Plan de datos 4G por equipo', p: '', u: 'mes_equipo', c: 5, kits: ['completo'] },
  { k: 'nube', n: 'Servidor en la nube + respaldos (VPS 2 vCPU/4 GB)', p: '', u: 'mes_global', c: 40, kits: ['basico', 'estandar', 'completo'] },
  { k: 'soporte', n: 'Soporte y mantenimiento de software', p: '', u: 'mes_global', c: 80, kits: ['basico', 'estandar', 'completo'] },
];
const costos = Object.fromEntries(COMPONENTES.map(c => [c.k, c.c]));
const UNIDAD = { cisterna: 'por cisterna', equipo: 'por equipo', global: 'una vez', mes_cisterna: 'mes · cisterna', mes_equipo: 'mes · equipo', mes_global: 'mes' };
const RECUPERACION_KIT = { basico: 60, estandar: 80, completo: 90 }; // % de la pérdida que suele recuperar cada nivel
$('#opciones-kit').addEventListener('click', e => { const o = e.target.closest('.opcion'); if (!o) return; S.kit = o.dataset.kit; $$('.opcion').forEach(x => x.classList.toggle('active', x === o)); $('#c-recupera').value = RECUPERACION_KIT[S.kit]; calcular(); });
$('#calc-params').addEventListener('input', calcular);
$('#tabla-costos').addEventListener('input', e => { if (e.target.dataset.k) { costos[e.target.dataset.k] = Number(e.target.value) || 0; calcular(false); } });
function cargarHardware() { if (S.params?.precio_litro) $('#c-precio').value = S.params.precio_litro; if (panelResumen?.litros_mes > 1000) $('#c-litros').value = Math.round(panelResumen.litros_mes / 1000) * 1000; $('#c-cisternas').value = panelResumen?.cisternas?.length || 2; $('#c-equipos').value = S.equipos.length || 12; calcular(); }
function calcular(redibujarTabla = true) {
  const nC = Number($('#c-cisternas').value) || 0, nE = Number($('#c-equipos').value) || 0, litros = Number($('#c-litros').value) || 0, precio = Number($('#c-precio').value) || 0;
  const perdida = Number($('#c-perdida').value) / 100 || 0, recupera = Number($('#c-recupera').value) / 100 || 0;
  const activos = COMPONENTES.filter(c => c.kits.includes(S.kit));
  const cant = u => ({ cisterna: nC, equipo: nE, global: 1, mes_cisterna: nC, mes_equipo: nE, mes_global: 1 })[u];
  let capex = 0, opex = 0;
  const filas = activos.map(c => { const q = cant(c.u), sub = q * costos[c.k]; if (c.u.startsWith('mes')) opex += sub; else capex += sub; return { ...c, q, sub }; });
  const contingencia = capex * 0.10; const capexTotal = capex + contingencia;
  const gastoMensual = litros * precio, perdidaMensual = gastoMensual * perdida, recuperado = perdidaMensual * recupera, ahorroNeto = recuperado - opex;
  const payback = ahorroNeto > 0 ? capexTotal / ahorroNeto : Infinity;
  const roi12 = ahorroNeto > 0 ? ((ahorroNeto * 12 - capexTotal) / capexTotal) * 100 : -100;
  if (redibujarTabla) {
    $('#tabla-costos tbody').innerHTML = filas.map(f => `<tr><td style="max-width:360px">${esc(f.n)}</td><td class="small muted">${esc(f.p)}</td><td class="small">${UNIDAD[f.u]}</td><td class="num mono">${f.q}</td><td class="num"><input class="costo-input mono" type="number" data-k="${f.k}" value="${costos[f.k]}" min="0"></td><td class="num mono sub" data-sub="${f.k}">${fmtN(f.sub)}</td></tr>`).join('')
      + `<tr><td colspan="5" style="text-align:right"><b>Inversión inicial (CAPEX)</b> <span class="muted small">equipos + instalación</span></td><td class="num mono"><b>${fmtN(capex)}</b></td></tr>
         <tr><td colspan="5" style="text-align:right">Contingencia 10 % (fletes, repuestos, imprevistos)</td><td class="num mono">${fmtN(contingencia)}</td></tr>
         <tr><td colspan="5" style="text-align:right"><b>CAPEX total</b></td><td class="num mono"><b>USD ${fmtN(capexTotal)}</b></td></tr>
         <tr><td colspan="5" style="text-align:right"><b>Costo operativo mensual (OPEX)</b> <span class="muted small">datos + nube + soporte</span></td><td class="num mono"><b>USD ${fmtN(opex)}</b>/mes</td></tr>`;
  } else { filas.forEach(f => { const el = document.querySelector(`[data-sub="${f.k}"]`); if (el) el.textContent = fmtN(f.sub); }); setTimeout(() => calcular(true), 0); return; }
  const R = [
    { l: 'Gasto mensual en combustible', v: 'USD ' + fmtN(gastoMensual) },
    { l: `Pérdida actual (${fmtN(perdida * 100, 1)} %)`, v: 'USD ' + fmtN(perdidaMensual) + '/mes', c: 'malo', s: `${fmtL(litros * perdida)} al mes` },
    { l: 'Recuperado con el sistema', v: 'USD ' + fmtN(recuperado) + '/mes', c: 'bueno' },
    { l: 'Ahorro neto mensual (− OPEX)', v: 'USD ' + fmtN(ahorroNeto) + '/mes', c: ahorroNeto > 0 ? 'bueno' : 'malo' },
    { l: 'Inversión inicial', v: 'USD ' + fmtN(capexTotal), s: `${fmtN(capexTotal / Math.max(nE, 1))} por equipo controlado` },
    { l: 'Retorno de la inversión', v: payback === Infinity ? 'no se recupera' : `${fmtN(payback, 1)} meses`, c: payback < 6 ? 'bueno' : payback < 12 ? '' : 'malo' },
    { l: 'ROI a 12 meses', v: `${roi12 >= 0 ? '+' : ''}${fmtN(roi12)} %`, c: roi12 > 0 ? 'bueno' : 'malo' },
    { l: 'Ahorro acumulado a 24 meses', v: 'USD ' + fmtN(ahorroNeto * 24 - capexTotal), c: ahorroNeto * 24 - capexTotal > 0 ? 'bueno' : 'malo' },
  ];
  $('#calc-resultado').innerHTML = R.map(r => `<div class="resultado ${r.c || ''}"><div class="label">${r.l}</div><div class="value">${r.v}</div>${r.s ? `<div class="small muted">${r.s}</div>` : ''}</div>`).join('');
  $('#calc-nota').innerHTML = `<b>Supuestos:</b> pérdidas típicas por robo y desvío en flotas sin control automatizado están entre 5 % y 15 % del combustible comprado; los sistemas con RFID + caudalímetro + conciliación suelen recuperar 70–90 % de esa pérdida. El kit <b>${S.kit}</b> cubre ${activos.filter(c => !c.u.startsWith('mes')).length} componentes. El precio del litro proviene de los parámetros del sistema (${S.params?.moneda || 'USD'}); ajuste tipo de cambio si cotiza en otra moneda. Los precios son referenciales de mercado 2026 y varían según marca (Piusi, Macnaught, Technoton, Teltonika, etc.) y proveedor local.`;
  const meses = Array.from({ length: 25 }, (_, i) => i);
  grafico('ch-roi', { type: 'line', data: { labels: meses.map(m => m === 0 ? 'Inicio' : `M${m}`), datasets: [
    { label: 'Flujo acumulado con FuelGuard', data: meses.map(m => -capexTotal + ahorroNeto * m), borderColor: cssVar('--series-3'), borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0.1 },
    { label: 'Pérdida acumulada sin control', data: meses.map(m => -perdidaMensual * m), borderColor: cssVar('--critical'), borderWidth: 2, borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 5, tension: 0.1 }] },
    options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } }, tooltip: { callbacks: { label: c => `${c.dataset.label}: USD ${fmtN(c.raw)}` } } }, scales: { y: { beginAtZero: false, grid: { color: cssVar('--border') }, ticks: { callback: v => fmtN(v / 1000) + 'k' } } } } });
}

// ------------------------------------------------------------------ SSE tiempo real
let refrescoPendiente = null;
function refrescarSuave() { clearTimeout(refrescoPendiente); refrescoPendiente = setTimeout(() => { if (S.vista === 'panel') api('/resumen').then(r => { panelResumen = r; renderKPIs(r); renderCisternas(r.cisternas); }).catch(() => {}); else if (S.vista === 'consumo') cargarConsumo(); else if (S.vista === 'despachos') cargarDespachos(); else if (S.vista === 'alertas') cargarAlertas(); else if (S.vista === 'equipos') cargarEquipos(); }, 800); }
function conectarSSE() {
  if (S.sse) S.sse.close();
  const es = new EventSource('/api/stream?token=' + encodeURIComponent(S.token)); S.sse = es;
  es.addEventListener('conectado', () => { $('#live').classList.add('on'); $('#live-text').textContent = 'En vivo'; });
  es.onerror = () => { $('#live').classList.remove('on'); $('#live-text').textContent = 'Reconectando…'; };
  es.addEventListener('despacho_inicio', e => { const d = JSON.parse(e.data); S.enVivo.set(d.id, { ...d, litros: 0, caudal: 0 }); if (S.vista === 'panel') renderEnVivo(); toast(`Despacho iniciado · ${d.cisterna_codigo}`, `${d.equipo_codigo} ${d.equipo_nombre || ''} · operador ${d.operador || '—'}`, 'info'); refrescarSuave(); });
  es.addEventListener('despacho_pulso', e => actualizarPulso(JSON.parse(e.data)));
  es.addEventListener('despacho_fin', e => {
    const d = JSON.parse(e.data); S.enVivo.delete(d.id); if (S.vista === 'panel') { renderEnVivo(); const tb = $('#tabla-ultimos'); tb.querySelector(`tr[data-did="${d.id}"]`)?.remove(); tb.insertAdjacentHTML('afterbegin', filaUltimo(d)); tb.firstElementChild.classList.add('nueva'); if (tb.children.length > 8) tb.lastElementChild.remove(); }
    if (S.vista === 'despachos') { const tb = $('#tabla-despachos'); tb.querySelector(`tr[data-did="${d.id}"]`)?.remove(); tb.insertAdjacentHTML('afterbegin', filaDespacho(d)); tb.firstElementChild.classList.add('nueva'); }
    toast(`Despacho #${d.id} ${d.estado}`, `${d.equipo_codigo || d.tag_rfid}: ${fmtL(d.litros, 1)} desde ${d.cisterna_codigo}`, d.estado === 'completado' ? 'ok' : 'alta'); refrescarSuave();
  });
  es.addEventListener('despacho_rechazado', e => { const d = JSON.parse(e.data); toast('Despacho BLOQUEADO', `${d.cisterna_codigo}: ${d.equipo_codigo || 'tag ' + d.tag_rfid} · ${d.motivo}`, 'critica'); if (S.vista === 'despachos') { const tb = $('#tabla-despachos'); tb.insertAdjacentHTML('afterbegin', filaDespacho(d)); tb.firstElementChild.classList.add('nueva'); } refrescarSuave(); });
  es.addEventListener('alerta', e => {
    const a = JSON.parse(e.data); toast(`${ICONO[a.severidad]} ${TIPO_ALERTA[a.tipo] || a.tipo}`, a.mensaje, a.severidad);
    if (S.vista === 'panel') { const l = $('#alertas-recientes'); if (l.querySelector('.vacio')) l.innerHTML = ''; l.insertAdjacentHTML('afterbegin', alertaHTML(a)); l.firstElementChild.classList.add('nueva'); if (l.children.length > 6) l.lastElementChild.remove(); }
    if (S.vista === 'alertas') { const l = $('#alertas-lista'); if (l.querySelector('.vacio')) l.innerHTML = ''; l.insertAdjacentHTML('afterbegin', alertaHTML(a, true)); l.firstElementChild.classList.add('nueva'); }
    refrescarSuave();
  });
  es.addEventListener('alerta_resuelta', () => refrescarSuave());
  es.addEventListener('nivel', e => actualizarNivel(JSON.parse(e.data)));
  es.addEventListener('recarga', e => { const r = JSON.parse(e.data); toast(`Recarga en ${r.codigo}`, `${fmtL(r.litros)} · guía ${r.guia || 's/n'} · nivel ${fmtL(r.nivel)}`, 'info'); refrescarSuave(); });
  es.addEventListener('catalogo', () => { S.equipos = []; refrescarSuave(); });
}

// ------------------------------------------------------------------ UI utilidades
function toast(titulo, msg, clase = 'info') {
  const el = document.createElement('div'); el.className = `toast ${clase}`; el.innerHTML = `<b>${esc(titulo)}</b>${esc(msg)}`;
  $('#toasts').appendChild(el); setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; setTimeout(() => el.remove(), 400); }, clase === 'critica' ? 9000 : 5000);
  while ($('#toasts').children.length > 5) $('#toasts').firstElementChild.remove();
}
function modal(html, onGuardar) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-fondo"><form class="modal">${html}<div class="error" id="modal-error"></div><div class="acciones"><button type="button" class="btn" data-cerrar>Cancelar</button><button type="submit" class="btn primary">Guardar</button></div></form></div>`;
  const cerrar = () => { root.innerHTML = ''; };
  root.querySelector('[data-cerrar]').onclick = cerrar; root.querySelector('.modal-fondo').addEventListener('click', e => { if (e.target === e.currentTarget) cerrar(); });
  root.querySelector('form').onsubmit = async e => { e.preventDefault(); const datos = Object.fromEntries(new FormData(e.target)); try { await onGuardar(datos); cerrar(); } catch (err) { $('#modal-error').textContent = err.message; } };
}
$('#btn-tema').addEventListener('click', () => {
  const claro = document.documentElement.dataset.theme !== 'light';
  document.documentElement.dataset.theme = claro ? 'light' : ''; localStorage.setItem('fg_tema', claro ? 'light' : 'dark');
  $('#btn-tema').textContent = claro ? 'Tema oscuro' : 'Tema claro'; irA(S.vista);
});
if (localStorage.getItem('fg_tema') === 'light') { document.documentElement.dataset.theme = 'light'; $('#btn-tema').textContent = 'Tema oscuro'; }

// arranque: el listado de usuarios demo solo se muestra si el servidor está en modo demo
fetch('/api/publico').then(r => r.json()).then(p => { $('#demo-users').classList.toggle('hidden', !p.modo_demo); if (p.empresa) $('#empresa').textContent = p.empresa; }).catch(() => $('#demo-users').classList.add('hidden'));
if (S.token) iniciar().catch(() => cerrarSesion(false));
