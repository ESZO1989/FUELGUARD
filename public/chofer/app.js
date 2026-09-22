/* FuelGuard – app del chofer (tablet del camión cisterna) */
'use strict';
const S = { token: localStorage.getItem('fgc_token'), usuario: null, cisterna: null, vista: 'inicio', enVivo: null, hoy: [], alertas: [], sse: null, online: navigator.onLine, cola: JSON.parse(localStorage.getItem('fgc_cola') || '[]'), confirmando: null, instalar: null, wake: null };
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = (n, d = 0) => Number(n ?? 0).toLocaleString('es-PE', { maximumFractionDigits: d, minimumFractionDigits: d });
const fmtHora = iso => iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtFecha = iso => iso ? new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const TIPO = { tag_no_autorizado: 'Tag no autorizado', equipo_inactivo: 'Equipo inactivo', fuera_de_horario: 'Fuera de horario', fuera_de_geocerca: 'Fuera de geocerca', despacho_repetido: 'Despacho repetido', sobrellenado: 'Sobrellenado', caudal_anomalo: 'Caudal anómalo', descuadre_caudalimetro: 'Descuadre caudalímetro', consumo_anomalo: 'Consumo anómalo', merma_cisterna: 'Merma en cisterna', recarga_no_registrada: 'Recarga no registrada', recarga_descuadrada: 'Recarga descuadrada', sin_senal: 'Sin señal', despacho_manual: 'Despacho manual' };

// ---------- red ----------
async function api(ruta, opciones = {}) {
  const r = await fetch('/api' + ruta, { ...opciones, headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) }, body: opciones.body ? JSON.stringify(opciones.body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && !ruta.startsWith('/login')) { salir(false); throw new Error('Sesión expirada'); }
  if (!r.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}
function setOnline(v) { S.online = v; const el = $('#conexion'); el.className = 'conexion ' + (v ? 'on' : 'off'); el.querySelector('span').textContent = v ? 'En línea' : 'Sin conexión'; }
window.addEventListener('online', () => { setOnline(true); sincronizar(); });
window.addEventListener('offline', () => setOnline(false));

// Cola de envíos pendientes (confirmaciones, recargas, manuales) para cuando no hay señal.
function encolar(ruta, body, descripcion) { S.cola.push({ ruta, body, descripcion, ts: new Date().toISOString() }); guardarCola(); toast('Guardado sin conexión', descripcion + ' se enviará al recuperar señal', 'warn'); }
function guardarCola() { localStorage.setItem('fgc_cola', JSON.stringify(S.cola)); const n = S.cola.length; $('#n-pendientes').textContent = n; $('#pendientes-card').style.display = n ? '' : 'none'; }
async function sincronizar() {
  if (!S.token || !S.cola.length) return;
  const restantes = [];
  for (const it of S.cola) {
    try { await api(it.ruta, { method: 'POST', body: it.body }); toast('Sincronizado', it.descripcion, 'ok'); }
    catch (e) { if (/Failed to fetch|NetworkError|fetch/i.test(e.message)) restantes.push(it); else toast('Rechazado', `${it.descripcion}: ${e.message}`, 'mal'); }
  }
  S.cola = restantes; guardarCola();
  if (S.vista === 'hoy') cargarHoy();
}
async function enviar(ruta, body, descripcion) {
  if (!S.online) { encolar(ruta, body, descripcion); return null; }
  try { return await api(ruta, { method: 'POST', body }); }
  catch (e) { if (/Failed to fetch|NetworkError/i.test(e.message)) { setOnline(false); encolar(ruta, body, descripcion); return null; } throw e; }
}

// ---------- sesión ----------
$('#form-login').addEventListener('submit', async e => {
  e.preventDefault(); $('#l-error').textContent = '';
  try {
    const r = await api('/login', { method: 'POST', body: { usuario: $('#l-usuario').value, pin: $('#l-pin').value, recordar: $('#l-recordar').checked } });
    if (r.usuario.rol !== 'chofer' && r.usuario.rol !== 'admin') throw new Error('Esta app es para choferes de cisterna');
    S.token = r.token; localStorage.setItem('fgc_token', r.token);
    await iniciar();
  } catch (err) { $('#l-error').textContent = err.message; }
});
function salir(llamar) {
  if (llamar && S.token) api('/logout', { method: 'POST' }).catch(() => {});
  S.token = null; S.usuario = null; localStorage.removeItem('fgc_token');
  if (S.sse) { S.sse.close(); S.sse = null; }
  $('#app').classList.add('hidden'); $('#v-login').classList.remove('hidden');
}
async function iniciar() {
  const me = await api('/me');
  S.usuario = me.usuario;
  if (S.usuario.rol === 'chofer' && !S.usuario.cisterna_id) { $('#l-error').textContent = 'Este chofer no tiene cisterna asignada. Pida al administrador que la asigne.'; salir(true); return; }
  $('#v-login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#c-chofer').textContent = S.usuario.nombre;
  await cargarCisterna();
  conectarSSE(); guardarCola(); sincronizar();
  ir('inicio');
  if (!S.cisterna) toast('Sin cisterna', 'Como administrador puede probar la app, pero los eventos en vivo requieren un chofer con cisterna', 'warn');
}
async function cargarCisterna() {
  const lista = await api('/cisternas');
  S.cisterna = lista.find(c => c.id === S.usuario.cisterna_id) || lista[0] || null;
  if (!S.cisterna) return;
  $('#c-cisterna').textContent = S.cisterna.codigo; $('#c-placa').textContent = S.cisterna.placa;
  pintarNivel(S.cisterna.nivel_actual, S.cisterna.capacidad);
  const enCurso = await api('/despachos/en-curso').catch(() => []);
  if (enCurso.length) { S.enVivo = { ...enCurso[0], caudal: enCurso[0].caudal_actual }; pintarEstadoVivo(); }
  await cargarAlertasContador();
}
function pintarNivel(n, cap) {
  const p = cap ? (n / cap) * 100 : 0;
  $('#n-litros').textContent = `${fmtN(n)} L`; $('#n-pct').textContent = `${p.toFixed(0)} %`; $('#n-cap').textContent = `capacidad ${fmtN(cap)} L`;
  const b = $('#n-barra'); b.style.width = Math.min(100, p).toFixed(1) + '%'; b.className = p < 15 ? 'critico' : p < 30 ? 'bajo' : '';
}

// ---------- navegación ----------
document.addEventListener('click', e => { const b = e.target.closest('[data-ir]'); if (b) ir(b.dataset.ir); });
function ir(v) {
  S.vista = v;
  $$('.vista').forEach(s => s.classList.toggle('hidden', s.id !== 'v-' + v));
  $$('.barra button').forEach(b => b.classList.toggle('active', b.dataset.ir === v));
  window.scrollTo(0, 0);
  ({ hoy: cargarHoy, alertas: cargarAlertas, manual: prepararManual, menu: prepararMenu })[v]?.();
}

// ---------- estado del despacho en vivo ----------
function pintarEstado(clase, icono, titulo, sub, extra = '') {
  const el = $('#estado'); el.className = 'tarjeta estado ' + clase;
  el.innerHTML = `<div class="estado-icono">${icono}</div><div class="estado-titulo">${titulo}</div><div class="estado-sub muted">${sub}</div>${extra}`;
}
function pintarEsperando() { pintarEstado('', '📡', 'Esperando lectura del tag RFID', 'Acerque la pistola al cuello del tanque del equipo'); liberarPantalla(); }
function pintarEstadoVivo() {
  const d = S.enVivo; if (!d) return pintarEsperando();
  const cap = d.capacidad_tanque || 400, p = Math.min(100, (d.litros / cap) * 100), exceso = d.litros > cap;
  pintarEstado('autorizado', '✅', `Despachando a ${esc(d.equipo_codigo)}`, esc(d.equipo_nombre || ''),
    `<div class="litros"><span class="val">${fmtN(d.litros, 1)}</span><small> L</small></div>
     <div class="barra-litros"><i class="${exceso ? 'exceso' : ''}" style="width:${p.toFixed(1)}%"></i></div>
     <div class="detalle"><span>Máx. <b>${fmtN(cap)} L</b></span><span>Caudal <b class="caudal">${d.caudal ? fmtN(d.caudal, 1) + ' L/min' : '—'}</b></span><span>Operador <b>${esc(d.operador || '—')}</b></span><span>Inicio <b>${fmtHora(d.inicio)}</b></span></div>`);
  mantenerPantalla();
}
function actualizarPulso(ev) {
  if (!S.enVivo || S.enVivo.id !== ev.id) return;
  S.enVivo.litros = ev.litros; S.enVivo.caudal = ev.caudal;
  const el = $('#estado'); const val = el.querySelector('.val'); if (!val) return pintarEstadoVivo();
  const cap = S.enVivo.capacidad_tanque || 400;
  val.textContent = fmtN(ev.litros, 1); el.querySelector('.caudal').textContent = ev.caudal ? fmtN(ev.caudal, 1) + ' L/min' : '—';
  const i = el.querySelector('.barra-litros i'); i.style.width = Math.min(100, (ev.litros / cap) * 100).toFixed(1) + '%'; i.classList.toggle('exceso', ev.litros > cap);
}
let timerEstado = null;
function pintarFin(d) {
  clearTimeout(timerEstado);
  const cortado = d.estado === 'cortado';
  pintarEstado('fin', cortado ? '⛔' : '🏁', `${cortado ? 'Despacho cortado' : 'Despacho terminado'}: ${fmtN(d.litros, 1)} L`, `${esc(d.equipo_codigo)} · ${esc(d.operador || '—')}${cortado ? ' · motivo: ' + esc(d.motivo) : ''}`,
    `<div class="botones"><button class="btn grande primario" data-confirmar="${d.id}">✍️ Confirmar con firma</button><button class="btn" data-ticket="${d.id}">🖨 Ticket</button></div>`);
  sonar(cortado ? 'mal' : 'ok'); vibrar(cortado ? [200, 100, 200] : [120]);
  timerEstado = setTimeout(pintarEsperando, 120000);
}
function pintarBloqueo(d) {
  clearTimeout(timerEstado);
  pintarEstado('bloqueado', '🚫', 'DESPACHO BLOQUEADO', esc(d.motivo || 'No autorizado'), `<div class="detalle"><span>Tag <b>${esc(d.tag_rfid || '—')}</b></span><span>${esc(d.equipo_codigo || 'equipo desconocido')}</span></div>`);
  sonar('mal'); vibrar([300, 100, 300, 100, 300]);
  timerEstado = setTimeout(pintarEsperando, 30000);
}
document.addEventListener('click', e => {
  const c = e.target.closest('[data-confirmar]'); if (c) return abrirConfirmar(Number(c.dataset.confirmar));
  const t = e.target.closest('[data-ticket]'); if (t) return abrirTicket(Number(t.dataset.ticket));
});

// ---------- hoy ----------
async function cargarHoy() {
  const desde = new Date(); desde.setHours(0, 0, 0, 0);
  S.hoy = await api(`/despachos?limite=100&desde=${encodeURIComponent(desde.toISOString())}`).catch(() => S.hoy);
  const total = S.hoy.filter(d => d.estado !== 'rechazado').reduce((a, d) => a + d.litros, 0);
  $('#hoy-total').textContent = `· ${S.hoy.length} · ${fmtN(total)} L`;
  $('#lista-hoy').innerHTML = S.hoy.map(d => {
    const badge = d.estado === 'rechazado' ? '<span class="badge mal">Bloqueado</span>' : d.estado === 'en_curso' ? '<span class="badge info">En curso</span>' : d.confirmado === 2 ? '<span class="badge ok">Firmado</span>' : d.confirmado === 1 ? '<span class="badge ok">Confirmado</span>' : '<span class="badge pend">Sin firma</span>';
    const pendiente = S.cola.some(c => c.body && c.body._despacho === d.id) ? ' <span class="badge pend">por enviar</span>' : '';
    return `<div class="item" ${d.estado === 'completado' || d.estado === 'cortado' ? `data-confirmar="${d.id}"` : ''}><div class="t">${esc(d.equipo_codigo || 'Tag ' + (d.tag_rfid || '?'))} <span class="muted small">#${d.id}</span></div><div class="l">${d.estado === 'rechazado' ? '—' : fmtN(d.litros, 1) + ' L'}</div><div class="s">${fmtHora(d.inicio)} · ${esc(d.operador || '—')}${d.motivo === 'manual' ? ' · MANUAL' : ''}${d.n_alertas ? ` · ⚠ ${d.n_alertas}` : ''}</div>${badge}${pendiente}</div>`;
  }).join('') || '<div class="tarjeta muted">Aún no hay despachos hoy</div>';
}

// ---------- confirmación con firma ----------
const lienzo = $('#cf-firma'); let ctx, dibujando = false, hayFirma = false;
function prepararLienzo() {
  const r = lienzo.getBoundingClientRect(); const esc = window.devicePixelRatio || 1;
  lienzo.width = r.width * esc; lienzo.height = r.height * esc;
  ctx = lienzo.getContext('2d'); ctx.scale(esc, esc); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b2a66';
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, r.width, r.height); hayFirma = false;
}
const pos = e => { const r = lienzo.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
lienzo.addEventListener('pointerdown', e => { dibujando = true; lienzo.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); });
lienzo.addEventListener('pointermove', e => { if (!dibujando) return; ctx.lineTo(...pos(e)); ctx.stroke(); hayFirma = true; });
lienzo.addEventListener('pointerup', () => { dibujando = false; }); lienzo.addEventListener('pointercancel', () => { dibujando = false; });
$('#cf-limpiar').addEventListener('click', prepararLienzo);

async function abrirConfirmar(id) {
  let d = S.hoy.find(x => x.id === id);
  try { d = await api(`/despachos/${id}`); } catch { if (!d) return toast('Sin conexión', 'No se pudo cargar el despacho', 'mal'); }
  S.confirmando = d;
  $('#cf-id').textContent = '#' + d.id; $('#cf-operador').textContent = d.operador ? '· ' + d.operador : '';
  $('#cf-resumen').innerHTML = `<div>Equipo<b>${esc(d.equipo_codigo || '—')}</b><span class="muted small">${esc(d.equipo_nombre || '')}</span></div><div>Litros<b>${fmtN(d.litros, 1)} L</b></div><div>Hora<b>${fmtHora(d.inicio)} → ${fmtHora(d.fin)}</b></div><div>Estado<b>${esc(d.estado)}${d.motivo && d.motivo !== 'normal' ? ' · ' + esc(d.motivo) : ''}</b></div>${d.confirmacion ? `<div style="grid-column:1/-1" class="small muted">Ya confirmado el ${fmtFecha(d.confirmacion.ts)}${d.confirmacion.firma ? ' con firma' : ''}. Puede actualizarlo.</div>` : ''}`;
  $('#cf-horometro').value = d.confirmacion?.horometro ?? d.horometro ?? ''; $('#cf-obs').value = d.confirmacion?.observacion || '';
  ir('confirmar'); setTimeout(prepararLienzo, 50);
}
$('#cf-guardar').addEventListener('click', async () => {
  const d = S.confirmando; if (!d) return;
  const body = { _despacho: d.id, horometro: $('#cf-horometro').value || null, observacion: $('#cf-obs').value || null, operador_nombre: d.operador || null, firma: hayFirma ? lienzo.toDataURL('image/png') : null };
  if (!hayFirma && !confirm('No hay firma del operador. ¿Guardar de todos modos?')) return;
  try {
    const r = await enviar(`/despachos/${d.id}/confirmar`, body, `Confirmación del despacho #${d.id}`);
    if (r) { toast('Confirmación guardada', `#${d.id} · ${hayFirma ? 'con firma' : 'sin firma'}${r.alertas?.length ? ' · alerta: ' + r.alertas.map(a => TIPO[a] || a).join(', ') : ''}`, 'ok'); }
    ir('inicio'); pintarEsperando();
  } catch (e) { toast('Error', e.message, 'mal'); }
});
$('#cf-omitir').addEventListener('click', () => { ir('inicio'); });
$('#cf-ticket').addEventListener('click', () => { if (S.confirmando) abrirTicket(S.confirmando.id, hayFirma ? lienzo.toDataURL('image/png') : null); });

// ---------- ticket ----------
async function abrirTicket(id, firmaLocal) {
  let d = S.confirmando && S.confirmando.id === id ? S.confirmando : S.hoy.find(x => x.id === id);
  try { d = await api(`/despachos/${id}`); } catch { if (!d) return toast('Sin conexión', 'No se pudo cargar el despacho', 'mal'); }
  const firma = firmaLocal || d.confirmacion?.firma;
  const linea = '-'.repeat(32);
  $('#ticket').innerHTML = `<h3>${esc(localStorage.getItem('fgc_empresa') || 'FuelGuard')}</h3>COMPROBANTE DE DESPACHO
${linea}
N°        : ${d.id}
Fecha     : ${fmtFecha(d.inicio)}
Cisterna  : ${esc(d.cisterna_codigo)} (${esc(S.cisterna?.placa || '')})
Chofer    : ${esc(d.chofer || S.usuario.nombre)}
Equipo    : ${esc(d.equipo_codigo || '—')}
            ${esc(d.equipo_nombre || '')}
Operador  : ${esc(d.operador || '—')}
${linea}
LITROS    : ${fmtN(d.litros, 1).padStart(12)} L
Caudal    : ${d.caudal_prom ? fmtN(d.caudal_prom, 1) + ' L/min' : '—'}
Horómetro : ${d.confirmacion?.horometro ?? d.horometro ?? '—'}
Estado    : ${esc(d.estado)}${d.motivo && d.motivo !== 'normal' ? ' (' + esc(d.motivo) + ')' : ''}
Nivel cist: ${d.nivel_antes != null ? fmtN(d.nivel_antes) : '—'} → ${d.nivel_despues != null ? fmtN(d.nivel_despues) : '—'} L
${linea}
Hash: ${esc(d.hash || 'pendiente')}
${firma ? `<img src="${firma}" alt="firma">Firma del operador` : 'Sin firma del operador'}
${linea}
Registro automático por caudalímetro.
Verifique en el dashboard con el N° y el hash.`;
  ir('ticket');
}
$('#tk-imprimir').addEventListener('click', () => window.print());
$('#tk-compartir').addEventListener('click', async () => {
  const texto = $('#ticket').innerText;
  if (navigator.share) { try { await navigator.share({ title: 'Comprobante de despacho', text: texto }); } catch {} }
  else { await navigator.clipboard?.writeText(texto); toast('Copiado', 'Texto del ticket copiado al portapapeles', 'ok'); }
});

// ---------- recarga ----------
$('#form-recarga').addEventListener('submit', async e => {
  e.preventDefault();
  const body = { litros: Number($('#r-litros').value), guia: $('#r-guia').value || null, nivel_despues: $('#r-nivel').value || null };
  try {
    const r = await enviar('/recargas', body, `Recarga de ${fmtN(body.litros)} L`);
    if (r) { toast('Recarga registrada', `${fmtN(r.litros)} L · nivel ${fmtN(r.nivel)} L`, 'ok'); pintarNivel(r.nivel, S.cisterna.capacidad); }
    e.target.reset(); ir('inicio');
  } catch (err) { toast('Error', err.message, 'mal'); }
});

// ---------- despacho manual ----------
async function prepararManual() {
  const sel = $('#m-equipo');
  try { const eq = await api('/equipos'); localStorage.setItem('fgc_equipos', JSON.stringify(eq)); } catch {}
  const eq = JSON.parse(localStorage.getItem('fgc_equipos') || '[]');
  sel.innerHTML = '<option value="">— seleccione —</option>' + eq.filter(x => x.activo).map(x => `<option value="${x.id}" data-h="${x.horometro}">${esc(x.codigo)} · ${esc(x.nombre)} (${fmtN(x.capacidad_tanque)} L)</option>`).join('');
  sel.onchange = () => { const o = sel.selectedOptions[0]; if (o?.dataset.h) $('#m-horometro').placeholder = 'último: ' + o.dataset.h; };
}
$('#form-manual').addEventListener('submit', async e => {
  e.preventDefault();
  const body = { equipo_id: Number($('#m-equipo').value), litros: Number($('#m-litros').value), horometro: $('#m-horometro').value || null, motivo: $('#m-motivo').value };
  if (!body.equipo_id) return toast('Falta el equipo', 'Seleccione el equipo que recibió el combustible', 'mal');
  if (!confirm(`¿Registrar ${fmtN(body.litros, 1)} L como despacho MANUAL? Quedará marcado y avisado al supervisor.`)) return;
  try {
    const r = await enviar('/despachos/manual', body, `Despacho manual de ${fmtN(body.litros, 1)} L`);
    if (r) { toast('Despacho manual registrado', `#${r.id} · ${r.equipo_codigo}`, 'ok'); S.hoy.unshift(r); }
    e.target.reset(); ir('inicio');
  } catch (err) { toast('Error', err.message, 'mal'); }
});

// ---------- alertas ----------
async function cargarAlertasContador() {
  try { S.alertas = await api('/alertas?activas=1&limite=50'); } catch { return; }
  const n = S.alertas.length; $('#n-alertas').textContent = n; $('#n-alertas').classList.toggle('hidden', !n);
}
async function cargarAlertas() {
  await cargarAlertasContador();
  $('#lista-alertas').innerHTML = S.alertas.map(a => `<div class="item alerta"><div class="ic">${a.severidad === 'critica' ? '⛔' : a.severidad === 'alta' ? '⚠️' : '🔶'}</div><div class="t">${TIPO[a.tipo] || a.tipo}</div><div class="s">${esc(a.mensaje)}<br><span class="muted">${fmtFecha(a.ts)}</span></div></div>`).join('') || '<div class="tarjeta muted">Sin alertas activas en su cisterna</div>';
}

// ---------- menú ----------
function prepararMenu() {
  $('#menu-info').textContent = `${S.usuario.nombre} · ${S.cisterna ? S.cisterna.codigo : 'sin cisterna'} · pendientes: ${S.cola.length} · v1.1`;
  $('#btn-instalar').style.display = S.instalar ? '' : 'none';
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.instalar = e; });
$('#btn-instalar').addEventListener('click', async () => { if (!S.instalar) return; S.instalar.prompt(); await S.instalar.userChoice; S.instalar = null; prepararMenu(); });
$('#btn-tema').addEventListener('click', () => { const claro = document.documentElement.dataset.theme !== 'light'; document.documentElement.dataset.theme = claro ? 'light' : ''; localStorage.setItem('fgc_tema', claro ? 'light' : 'dark'); });
if (localStorage.getItem('fgc_tema') === 'light') document.documentElement.dataset.theme = 'light';
$('#btn-sincronizar').addEventListener('click', () => { sincronizar(); toast('Sincronizando', `${S.cola.length} pendientes`, 'ok'); });
$('#btn-recargar').addEventListener('click', () => location.reload());
$('#btn-salir').addEventListener('click', () => { if (S.cola.length && !confirm(`Hay ${S.cola.length} registros sin enviar. ¿Cerrar sesión igualmente?`)) return; salir(true); });

// ---------- tiempo real ----------
function conectarSSE() {
  if (S.sse) S.sse.close();
  const es = new EventSource('/api/stream?token=' + encodeURIComponent(S.token)); S.sse = es;
  es.addEventListener('conectado', () => { setOnline(true); sincronizar(); });
  es.onerror = () => setOnline(false);
  es.addEventListener('despacho_inicio', e => { const d = JSON.parse(e.data); if (S.cisterna && d.cisterna_id !== S.cisterna.id) return; clearTimeout(timerEstado); S.enVivo = { ...d, litros: 0, caudal: 0 }; pintarEstadoVivo(); sonar('ok'); vibrar([80]); if (S.vista !== 'inicio' && S.vista !== 'confirmar') ir('inicio'); });
  es.addEventListener('despacho_pulso', e => actualizarPulso(JSON.parse(e.data)));
  es.addEventListener('despacho_fin', e => { const d = JSON.parse(e.data); if (S.cisterna && d.cisterna_id !== S.cisterna.id) return; S.enVivo = null; S.hoy.unshift(d); pintarFin(d); if (d.motivo !== 'manual' && S.vista !== 'confirmar') { ir('inicio'); } if (S.vista === 'hoy') cargarHoy(); });
  es.addEventListener('despacho_rechazado', e => { const d = JSON.parse(e.data); if (S.cisterna && d.cisterna_id !== S.cisterna.id) return; pintarBloqueo(d); if (S.vista !== 'inicio') ir('inicio'); });
  es.addEventListener('nivel', e => { const n = JSON.parse(e.data); if (S.cisterna && n.cisterna_id === S.cisterna.id) pintarNivel(n.nivel, n.capacidad); });
  es.addEventListener('recarga', e => { const r = JSON.parse(e.data); toast('Recarga', `${fmtN(r.litros)} L · guía ${r.guia || 's/n'}`, 'ok'); });
  es.addEventListener('alerta', e => { const a = JSON.parse(e.data); toast(TIPO[a.tipo] || a.tipo, a.mensaje, a.severidad === 'critica' || a.severidad === 'alta' ? 'mal' : 'warn'); cargarAlertasContador(); if (a.severidad === 'critica') { sonar('mal'); vibrar([400, 100, 400]); } });
  es.addEventListener('despacho_confirmado', () => { if (S.vista === 'hoy') cargarHoy(); });
}

// ---------- utilidades de tablet ----------
function toast(titulo, msg, clase = '') { const el = document.createElement('div'); el.className = 'toast ' + clase; el.innerHTML = `<b>${esc(titulo)}</b>${esc(msg)}`; $('#toasts').appendChild(el); setTimeout(() => el.remove(), clase === 'mal' ? 9000 : 5000); while ($('#toasts').children.length > 4) $('#toasts').firstElementChild.remove(); }
function vibrar(p) { try { navigator.vibrate?.(p); } catch {} }
let audioCtx = null;
function sonar(tipo) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const notas = tipo === 'ok' ? [[880, 0.12], [1320, 0.18]] : [[330, 0.25], [220, 0.35]];
    let t = audioCtx.currentTime;
    for (const [f, d] of notas) { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.start(t); o.stop(t + d); t += d; }
  } catch {}
}
async function mantenerPantalla() { try { if (!S.wake && navigator.wakeLock) S.wake = await navigator.wakeLock.request('screen'); } catch {} }
function liberarPantalla() { try { S.wake?.release(); } catch {} S.wake = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.enVivo) mantenerPantalla(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/chofer/sw.js').catch(() => {});
setInterval(() => { if (S.online) sincronizar(); }, 15000);

// ---------- arranque ----------
fetch('/api/publico').then(r => r.json()).then(p => { $('#l-demo').classList.toggle('hidden', !p.modo_demo); if (p.empresa) localStorage.setItem('fgc_empresa', p.empresa); }).catch(() => {});
setOnline(navigator.onLine);
if (S.token) iniciar().catch(() => salir(false));
