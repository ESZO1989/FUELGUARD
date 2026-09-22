'use strict';
// Qué puede ver cada rol. Devuelve fragmentos SQL sobre los alias d (despachos) y a (alertas).
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
module.exports = { alcanceDespachos, alcanceAlertas };
