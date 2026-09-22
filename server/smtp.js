'use strict';
// Cliente SMTP mínimo sin dependencias: STARTTLS o SMTPS, AUTH LOGIN/PLAIN, adjuntos MIME.
// enviarCorreo({ host, port, secure, user, pass, from, to: [], subject, text, html, adjuntos: [{ nombre, contenido: Buffer, tipo }] })
const net = require('node:net');
const tls = require('node:tls');
const crypto = require('node:crypto');

const b64 = s => Buffer.from(s).toString('base64');
const codificarAsunto = s => /^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
const lineas76 = b => b.toString('base64').replace(/(.{76})/g, '$1\r\n');

function configDesdeEntorno() {
  const e = process.env;
  if (!e.SMTP_HOST) return null;
  return { host: e.SMTP_HOST, port: Number(e.SMTP_PORT || 587), secure: e.SMTP_SECURE === '1' || e.SMTP_PORT === '465', user: e.SMTP_USER || '', pass: e.SMTP_PASS || '', from: e.SMTP_FROM || e.SMTP_USER, rechazarNoAutorizado: e.SMTP_TLS_INSECURE !== '1' };
}

function construirMensaje({ from, to, subject, text, html, adjuntos = [] }) {
  const frontera = 'fg-' + crypto.randomBytes(12).toString('hex');
  const cab = [`From: ${from}`, `To: ${to.join(', ')}`, `Subject: ${codificarAsunto(subject)}`, `Date: ${new Date().toUTCString()}`, `Message-ID: <${crypto.randomUUID()}@fuelguard>`, 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${frontera}"`, ''];
  const partes = [];
  if (html) {
    const alt = 'alt-' + crypto.randomBytes(8).toString('hex');
    partes.push(`--${frontera}\r\nContent-Type: multipart/alternative; boundary="${alt}"\r\n\r\n--${alt}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${lineas76(Buffer.from(text || ''))}\r\n--${alt}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${lineas76(Buffer.from(html))}\r\n--${alt}--`);
  } else {
    partes.push(`--${frontera}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${lineas76(Buffer.from(text || ''))}`);
  }
  for (const a of adjuntos) {
    partes.push(`--${frontera}\r\nContent-Type: ${a.tipo || 'application/octet-stream'}; name="${a.nombre}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${a.nombre}"\r\n\r\n${lineas76(a.contenido)}`);
  }
  return cab.join('\r\n') + '\r\n' + partes.join('\r\n') + `\r\n--${frontera}--\r\n`;
}

function enviarCorreo(cfg) {
  return new Promise((resolve, reject) => {
    const { host, port = 587, secure = false, user, pass, from, to, timeoutMs = 20000 } = cfg;
    if (!to || !to.length) return reject(new Error('Sin destinatarios'));
    let socket, buffer = '', esperando = null, terminado = false;
    const log = [];
    const fallar = e => { if (terminado) return; terminado = true; try { socket && socket.destroy(); } catch {} reject(Object.assign(e, { log })); };
    const temporizador = setTimeout(() => fallar(new Error('SMTP: tiempo de espera agotado')), timeoutMs);

    const conectarDatos = s => {
      socket = s;
      socket.setEncoding('latin1');
      socket.on('data', d => { buffer += d; procesar(); });
      socket.on('error', fallar);
      socket.on('close', () => { if (!terminado) fallar(new Error('SMTP: conexión cerrada')); });
    };
    const procesar = () => {
      let idx;
      while ((idx = buffer.indexOf('\r\n')) >= 0) {
        const linea = buffer.slice(0, idx); buffer = buffer.slice(idx + 2); log.push('< ' + linea);
        if (/^\d{3} /.test(linea)) { const cb = esperando; esperando = null; if (cb) cb(Number(linea.slice(0, 3)), linea); }
      }
    };
    const cmd = (texto, esperado) => new Promise((res, rej) => {
      esperando = (codigo, linea) => (esperado.includes(codigo) ? res(linea) : rej(new Error(`SMTP ${codigo}: ${linea.slice(4)}`)));
      if (texto != null) { log.push('> ' + (texto.startsWith('AUTH') || /^[A-Za-z0-9+/=]+$/.test(texto) ? '[credenciales]' : texto.slice(0, 200))); socket.write(texto + '\r\n'); }
    });
    const ehlo = async () => { const r = await cmd(`EHLO fuelguard.local`, [250]); return log.filter(l => l.startsWith('< 250')).map(l => l.slice(6).toUpperCase()); };

    (async () => {
      const inicial = secure ? tls.connect({ host, port, servername: host, rejectUnauthorized: cfg.rechazarNoAutorizado !== false }) : net.connect({ host, port });
      conectarDatos(inicial);
      await cmd(null, [220]);
      let ext = await ehlo();
      if (!secure && ext.some(l => l.includes('STARTTLS'))) {
        await cmd('STARTTLS', [220]);
        const plano = socket; plano.removeAllListeners('data'); plano.removeAllListeners('close');
        const seguro = tls.connect({ socket: plano, servername: host, rejectUnauthorized: cfg.rechazarNoAutorizado !== false });
        await new Promise((res, rej) => { seguro.once('secureConnect', res); seguro.once('error', rej); });
        buffer = ''; conectarDatos(seguro);
        log.length = 0; ext = await ehlo();
      }
      if (user) {
        if (ext.some(l => l.includes('AUTH') && l.includes('PLAIN'))) await cmd(`AUTH PLAIN ${b64(`\0${user}\0${pass}`)}`, [235]);
        else { await cmd('AUTH LOGIN', [334]); await cmd(b64(user), [334]); await cmd(b64(pass), [235]); }
      }
      await cmd(`MAIL FROM:<${(from.match(/<([^>]+)>/) || [, from])[1]}>`, [250]);
      for (const d of to) await cmd(`RCPT TO:<${(d.match(/<([^>]+)>/) || [, d.trim()])[1]}>`, [250, 251]);
      await cmd('DATA', [354]);
      const mensaje = construirMensaje({ ...cfg, from, to }).replace(/\r\n\./g, '\r\n..');
      const r = await cmd(mensaje + '\r\n.', [250]);
      await cmd('QUIT', [221]).catch(() => {});
      terminado = true; clearTimeout(temporizador); socket.end();
      resolve({ ok: true, respuesta: r, destinatarios: to });
    })().catch(e => { clearTimeout(temporizador); fallar(e); });
  });
}

module.exports = { enviarCorreo, construirMensaje, configDesdeEntorno };
