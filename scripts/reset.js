'use strict';
// Borra la base de datos para regenerar los datos de demostración en el próximo arranque.
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '..', 'data');
for (const f of ['fuelguard.db', 'fuelguard.db-wal', 'fuelguard.db-shm']) {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log('eliminado', f); }
}
console.log('Base de datos reiniciada. Ejecute npm start para regenerar los datos demo.');
