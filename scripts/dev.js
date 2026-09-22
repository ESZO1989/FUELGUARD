'use strict';
// Arranca servidor + simulador en un solo comando (npm run dev).
const { spawn } = require('node:child_process');
const path = require('node:path');
const raiz = path.join(__dirname, '..');
const hijos = [];
function lanzar(nombre, archivo, retrasoMs) {
  setTimeout(() => {
    const p = spawn(process.execPath, [archivo], { cwd: raiz, stdio: 'inherit', env: process.env });
    p.on('exit', c => { console.log(`[${nombre}] terminó con código ${c}`); });
    hijos.push(p);
  }, retrasoMs);
}
lanzar('servidor', 'server/index.js', 0);
lanzar('simulador', 'simulator/simulator.js', 1200);
process.on('SIGINT', () => { hijos.forEach(h => h.kill()); process.exit(0); });
