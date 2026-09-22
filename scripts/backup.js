'use strict';
// Respaldo manual de la base de datos (copia consistente con VACUUM INTO). Uso: npm run backup
// Variables: FUELGUARD_DB (origen), BACKUP_DIR (destino, por defecto ./backups), BACKUP_KEEP (cuántos conservar, 14).
const path = require('node:path');
const { respaldar } = require('../server/db');
const dir = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const destino = respaldar(dir, Number(process.env.BACKUP_KEEP || 14));
console.log('Respaldo creado:', destino);
