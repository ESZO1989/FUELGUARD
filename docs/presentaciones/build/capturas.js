// Capturas reales del dashboard y la app del chofer + render de los diagramas SVG a PNG.
// Requiere el servidor en http://localhost:3000 (npm run dev) y Google Chrome instalado.
'use strict';
const puppeteer = require('puppeteer-core');
const path = require('node:path');
const fs = require('node:fs');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.FUELGUARD_URL || 'http://localhost:3000';
const OUT = path.join(__dirname, 'img');
fs.mkdirSync(OUT, { recursive: true });
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function login(page, usuario, pin, claveToken) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
  const token = await page.evaluate(async (u, p) => {
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: u, pin: p, recordar: true }) });
    return (await r.json()).token;
  }, usuario, pin);
  await page.evaluate((k, t) => { localStorage.setItem(k, t); localStorage.setItem('fg_tema', 'dark'); }, claveToken, token);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1'] });
  try {
    if (process.env.SOLO_DIAGRAMAS) { await soloDiagramas(browser); return; }
    // ---- Dashboard (escritorio) ----
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
    await login(page, 'admin', '1234', 'fg_token');
    const vistas = ['panel', 'despachos', 'consumo', 'alertas', 'equipos', 'reportes', 'hardware', 'admin'];
    for (const v of vistas) {
      await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
      await dormir(1500);
      await page.evaluate(async v => { await irA(v); }, v);
      await dormir(v === 'panel' ? 6000 : 2500);
      await page.evaluate(() => { document.querySelectorAll('.toast').forEach(t => t.remove()); window.scrollTo(0, 0); });
      await page.screenshot({ path: path.join(OUT, `dashboard-${v}.png`), fullPage: false });
      console.log('ok dashboard', v);
    }
    // ---- App del chofer (tablet vertical) ----
    const tab = await browser.newPage();
    await tab.setViewport({ width: 800, height: 1280, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
    await login(tab, 'chofer1', '2222', 'fgc_token');
    await tab.goto(BASE + '/chofer/', { waitUntil: 'networkidle2' });
    await dormir(2500);
    // esperar a que haya un despacho en curso o terminado (el simulador genera uno cada ~20 s)
    for (let i = 0; i < 20; i++) { const t = await tab.evaluate(() => document.querySelector('#estado').innerText); if (!/Esperando/.test(t)) break; await dormir(2000); }
    await tab.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
    await tab.screenshot({ path: path.join(OUT, 'chofer-inicio.png') });
    console.log('ok chofer inicio');
    // confirmación con firma dibujada
    await tab.evaluate(async () => { await ir('hoy'); await new Promise(r => setTimeout(r, 1200)); const it = document.querySelector('#lista-hoy .item[data-confirmar]'); if (it) await abrirConfirmar(Number(it.dataset.confirmar)); });
    await dormir(1200);
    await tab.evaluate(() => {
      const c = document.querySelector('#cf-firma'); const r = c.getBoundingClientRect();
      const ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, { clientX: r.left + x, clientY: r.top + y, pointerId: 1, bubbles: true, isPrimary: true }));
      ev('pointerdown', 30, 120); for (let i = 0; i < 80; i++) ev('pointermove', 30 + i * 5, 120 + Math.sin(i / 5) * 45 + (i > 40 ? 20 : 0)); ev('pointerup', 430, 120);
      document.querySelector('#cf-horometro').value = '4321.5';
      document.querySelectorAll('.toast').forEach(t => t.remove());
    });
    await tab.screenshot({ path: path.join(OUT, 'chofer-confirmar.png') });
    console.log('ok chofer confirmar');
    await tab.evaluate(async () => { document.querySelector('#cf-ticket').click(); });
    await dormir(1500);
    await tab.screenshot({ path: path.join(OUT, 'chofer-ticket.png') });
    console.log('ok chofer ticket');
    await tab.evaluate(async () => { ir('recarga'); });
    await dormir(600);
    await tab.screenshot({ path: path.join(OUT, 'chofer-recarga.png') });
    await soloDiagramas(browser);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

async function soloDiagramas(browser) {
  {
    const dia = await browser.newPage();
    await dia.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1.25 });
    for (const f of fs.readdirSync(path.join(__dirname, 'diagramas')).filter(f => f.endsWith('.html'))) {
      await dia.goto('file:///' + path.join(__dirname, 'diagramas', f).replace(/\\/g, '/'), { waitUntil: 'load' });
      const svg = await dia.$('svg');
      await svg.screenshot({ path: path.join(OUT, `diagrama-${f.replace('.html', '')}.png`) });
      console.log('ok diagrama', f);
    }
  }
}
