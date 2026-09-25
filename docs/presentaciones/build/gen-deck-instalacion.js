// Genera los archivos del deck "Guía de instalación" para el tipo Slides de Claude (formato de sección con estilos inline).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = process.argv[2];
const OUT = path.join(ROOT, 'project', 'slides');
fs.mkdirSync(OUT, { recursive: true });

const IMG = {
  choferInicio: '/_blob/97a53a0baf1de841ead94e35606604ee', choferTicket: '/_blob/7550ca141bf4ce3c1116c9bfd9d4cd3e', admin: '/_blob/2176e7f0b82aeb3c672069eaa64a9ea6', equipos: '/_blob/ef2a969bc2a7e15b8dd2636a83e1c72e',
  linea: '/_blob/f9f6ad0898330fc490b8816432275efa', cableado: '/_blob/c92051a52cb187f259dfba61e4d21b28', mesa: '/_blob/1d325a0b94384a46099b5201cc767f1f',
};
const V = {
  ao42PLgavdo: { t: 'Cómo instalar PlatformIO en VS Code para ESP32', c: 'Yamir TV', th: '/_blob/65fcd8aea56a3953046e54f82a4344ae', qr: '/_blob/4e01708e33fac95319bb6f9e8d8baa73' },
  qz8jcXVtNuY: { t: 'SIM7600G-H 4G LTE con ESP32, placa LILYGO T-SIM7600G-H', c: 'Electronic Clinic', th: '/_blob/feee4e0c7fec72f0516f6497074c3a23', qr: '/_blob/c67ffd793da9d3d593446741f6845427' },
  l8RDbHd1cak: { t: 'Lectores RFID RDM6300 y RDM630 con Arduino', c: 'Michael Schoeffler', th: '/_blob/cd0a4596db128e13db2a9e9f94199d92', qr: '/_blob/c20ed191c1adb42b1b16808cd854cc9c' },
  PkwhzUWP8uE: { t: 'Caudalímetros digitales para combustible, por Piusi', c: 'Piusi', th: '/_blob/7e18f85b33661743479f8277ab8b46f9', qr: '/_blob/e419257af0ba205577e12916f4db9d40' },
  OSs0oUbmIqM: { t: 'Piusi K600 Pulser: limpieza de los engranajes', c: 'Piusi', th: '/_blob/70dc0790bf343fbd2a8489182b58c047', qr: '/_blob/1b44f7c9b61e4f02db6994ae05b709a0' },
  vkLoBfkcm_U: { t: 'Cómo comprobar una electroválvula paso a paso', c: 'Jorge Román', th: '/_blob/27da102839b10f902d66dae92e087c35', qr: '/_blob/6032e8fd1e6fb87665ca579642a34d31' },
  oMFeT2PzwG0: { t: 'Transmisores de nivel sumergibles: manual de instalación', c: 'Holykell', th: '/_blob/fb24c7c1664f7b85b8b789902bcc8b27', qr: '/_blob/f1f0c6fd4259b66985cd1d9601cc0489' },
  f8mnRFkr7Nc: { t: 'B.SMART IdentiTank: tag en el tanque y lector en la pistola', c: 'Piusi', th: '/_blob/436e78d7d048d0650e08034ce0080a95', qr: '/_blob/9f0ffb0d691831cef637588c05f9370e' },
  N6mRTJTVEbY: { t: 'B.SMART demo kit presentado por Piusi', c: 'Piusi', th: '/_blob/ac371f4696b0e3586f3cc5fc3914aa11', qr: '/_blob/e507682b6466d5e3a860ebc4c60c2f46' },
  'QuZk-UYsifQ': { t: 'Piusi B.SMART: cableado eléctrico', c: 'Piusi', th: '/_blob/b2034a26fafe918d9910263d8014833f', qr: '/_blob/998dc3638a623d6d6b233fd099b38d8e' },
  V94yF1DhnUU: { t: 'Cómo instalar cualquier GPS en un automóvil o camioneta', c: 'Weby Servicios', th: '/_blob/2edbc3c198a1cbef34b23b016ed18a84', qr: '/_blob/56350966086d923eb0f7aafc8af3c019' },
  qcmB7YRpoFw: { t: 'Cómo funciona una electroválvula o válvula de solenoide', c: 'Luis Carlos Galán', th: '/_blob/46628a59275986c83bc945e0a18656b5', qr: '/_blob/6053d38a59abf5e1b85119d2c27d87d3' },
  DmYBOnf2ark: { t: 'Piusi K600: calibración', c: 'Piusi', th: '/_blob/4b2f7016a0d288fc3ce8e9458e031508', qr: '/_blob/bbb2766d3f15adba82122927b1920ae6' },
  Ks_KHxz97NM: { t: 'Piusi K600: calibración del medidor de combustible', c: 'Centre Tank Services', th: '/_blob/3253e83d1160872d870a0d9ceb04df01', qr: '/_blob/2e620f78d65035590d2ec78d57b08e44' },
};

const C = { dark: '#14213D', dark2: '#1B2A50', light: '#F6F5F0', card: '#FDFCF9', line: '#E3E1D8', ink: '#14213D', body: '#4A5568', muted: '#6A7179', acc: '#E8843C', accDark: '#B5532C', accSoft: '#FFF1E6', accLine: '#F0B48A', green: '#1F6B3A', greenSoft: '#E6F2EA', greenLine: '#BFDCCB', ice: '#C9D8F2' };
const FONT = "'IBM Plex Sans', Arial, sans-serif";
const HEAD = "'Rubik', Arial, sans-serif";
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function seccion(id, inner, { bg = C.light, color = C.ink, gap = 36, footer = true, extra = '' } = {}) {
  const pad = footer ? '128px 128px 160px' : '128px';
  return `<section id="${id}" data-transition="fade" style="background:${bg}; color:${color}; font-family:${FONT}; padding:${pad}; display:flex; flex-direction:column; gap:${gap}px${extra}">\n${inner}${footer ? `\n  <p style="position:absolute; left:128px; bottom:64px; font-size:24px; color:${C.muted}">FuelGuard · Guía de instalación</p>` : ''}\n</section>\n`;
}
const cab = (kicker, titulo) => `  <div style="display:flex; flex-direction:column; gap:12px">
    <p style="font-size:24px; font-weight:600; letter-spacing:3px; color:${C.acc}; text-transform:uppercase">${esc(kicker)}</p>
    <h2 style="font-family:${HEAD}; font-size:64px; font-weight:600; line-height:1.1">${esc(titulo)}</h2>
  </div>`;
const tarjeta = ({ titulo, items, texto, bg = C.card, border = C.line, colorTitulo = C.ink, colorTexto = C.body, flex = 'flex:1', size = 26, numero }) =>
  `<div style="${flex}; background:${bg}; border:1px solid ${border}; border-radius:20px; padding:36px; display:flex; flex-direction:column; gap:16px">
${numero != null ? `      <div style="width:64px; height:64px; border-radius:50%; background:${colorTitulo}; display:flex; align-items:center; justify-content:center"><p style="font-family:${HEAD}; font-size:32px; font-weight:600; color:${C.light}">${numero}</p></div>\n` : ''}${titulo ? `      <h3 style="font-family:${HEAD}; font-size:34px; font-weight:600; color:${colorTitulo}">${esc(titulo)}</h3>\n` : ''}${items ? `      <ul style="font-size:${size}px; line-height:1.45; color:${colorTexto}; padding:0 0 0 30px">\n${items.map(i => `        <li>${esc(i)}</li>`).join('\n')}\n      </ul>\n` : ''}${texto ? `      <p style="font-size:${size}px; line-height:1.45; color:${colorTexto}">${esc(texto)}</p>\n` : ''}    </div>`;
const video = (id, queMirar) => { const v = V[id]; const url = 'https://youtu.be/' + id; return `<div style="flex:1; background:${C.card}; border:1px solid ${C.line}; border-radius:20px; padding:20px; display:flex; flex-direction:column; gap:12px">
      <img src="${v.th}" alt="Miniatura del video ${esc(v.t)}" style="width:472px; height:240px; object-fit:cover; border-radius:12px">
      <p style="font-size:26px; font-weight:600; line-height:1.25; color:${C.ink}"><a href="${url}">${esc(v.t)}</a></p>
      <p style="font-size:24px; color:${C.muted}">${esc(v.c)} · YouTube</p>
      <div style="display:flex; gap:16px; align-items:flex-start">
        <p style="flex:1; font-size:24px; line-height:1.35; color:${C.body}"><b>Qué mirar:</b> ${esc(queMirar)}</p>
        <img src="${v.qr}" alt="Código QR con el enlace al video" style="width:128px; height:128px">
      </div>
    </div>`; };
const filaVideos = (kicker, titulo, lista, id, extraCard) => seccion(id, `${cab(kicker, titulo)}
  <div style="display:flex; gap:64px">
    ${lista.map(([vid, q]) => video(vid, q)).join('\n    ')}${extraCard ? '\n    ' + extraCard : ''}
  </div>`);
const separador = (id, letra, titulo, sub, datos) => seccion(id, `  <div style="display:flex; gap:64px; align-items:center">
    <div style="width:260px; height:260px; border-radius:50%; background:${C.acc}; display:flex; align-items:center; justify-content:center"><p style="font-family:${HEAD}; font-size:160px; font-weight:600; color:${C.light}; line-height:1">${letra}</p></div>
    <div style="flex:1; display:flex; flex-direction:column; gap:24px">
      <h1 style="font-family:${HEAD}; font-size:96px; font-weight:600; line-height:1.05">${esc(titulo)}</h1>
      <p style="font-size:32px; line-height:1.4; color:${C.ice}; width:1100px">${esc(sub)}</p>
    </div>
  </div>
  <div style="display:flex; gap:32px">
    ${datos.map(([k, v]) => `<div style="background:${C.dark}; border:1px solid #2C3B66; border-radius:16px; padding:24px 32px; display:flex; flex-direction:column; gap:6px; width:380px"><p style="font-size:24px; color:${C.ice}">${esc(k)}</p><p style="font-family:${HEAD}; font-size:36px; font-weight:600; color:${C.light}">${esc(v)}</p></div>`).join('\n    ')}
  </div>`, { bg: C.dark2, color: C.light, gap: 64, footer: false, extra: '; justify-content:center' });
const marco = (etiqueta, sub) => `<div style="flex:1; border:2px dashed #9AA3B2; border-radius:20px; padding:36px; display:flex; flex-direction:column; gap:8px; align-items:center; justify-content:center"><p style="font-size:26px; font-weight:600; text-align:center">${esc(etiqueta)}</p><p style="font-size:24px; color:${C.muted}; text-align:center">${esc(sub)}</p></div>`;

const S = {};

S.portada = `<section id="portada" data-transition="fade" style="background:${C.dark}; color:${C.light}; font-family:${FONT}; padding:128px; display:flex; flex-direction:row; gap:64px; align-items:center">
  <div style="width:900px; display:flex; flex-direction:column; gap:32px">
    <p style="font-size:24px; font-weight:600; letter-spacing:4px; color:${C.acc}; text-transform:uppercase">Guía de instalación</p>
    <h1 style="font-family:${HEAD}; font-size:96px; font-weight:600; line-height:1.05">Instalación del kit FuelGuard en la cisterna</h1>
    <p style="font-size:32px; line-height:1.4; color:${C.ice}">Paso a paso mecánico, eléctrico y de puesta en marcha, con videos de referencia para cada etapa. Un día de trabajo para dos personas.</p>
    <p style="font-size:24px; color:#8FA3C7">FuelGuard · septiembre de 2026</p>
  </div>
  <div style="flex:1; display:flex; justify-content:center">
    <img src="${IMG.choferInicio}" alt="App del chofer en la tablet mostrando un despacho en curso" style="width:400px; height:640px; object-fit:cover; border-radius:24px; box-shadow:0 24px 64px rgba(0,0,0,0.5)">
  </div>
</section>
`;

S.resumen = seccion('resumen', `${cab('Resumen', 'Cinco etapas, un día de trabajo')}
  <div style="display:flex; gap:24px">
    ${[['A', 'Preparación y prueba en mesa', 'Oficina · 2 a 3 h', 'Técnico', '#3B6BC4'], ['B', 'Montaje mecánico', 'Camión · 2 a 3 h', 'Mecánico', C.acc], ['C', 'Montaje eléctrico', 'Camión · 2 a 3 h', 'Electricista', C.acc], ['D', 'Tags en los equipos', 'Faena · 5 min por equipo', 'Técnico', C.green], ['E', 'Calibración y prueba final', 'Camión · 1 a 2 h', 'Técnico y chofer', '#3B6BC4']].map(e => `<div style="flex:1; background:${C.card}; border:1px solid ${C.line}; border-radius:20px; padding:28px; display:flex; flex-direction:column; gap:14px; align-items:center">
      <div style="width:96px; height:96px; border-radius:50%; background:${e[4]}; display:flex; align-items:center; justify-content:center"><p style="font-family:${HEAD}; font-size:48px; font-weight:600; color:${C.light}">${e[0]}</p></div>
      <p style="font-size:26px; font-weight:600; text-align:center; line-height:1.25">${esc(e[1])}</p>
      <p style="font-size:24px; color:${C.muted}; text-align:center; line-height:1.3">${esc(e[2])}<br>${esc(e[3])}</p>
    </div>`).join('\n    ')}
  </div>
  <div style="display:flex; gap:32px">
    ${tarjeta({ titulo: 'Quién hace qué', items: ['Mecánico o gásfiter industrial: línea de combustible y sensor de nivel', 'Electricista o técnico automotriz: caja, cableado y antenas', 'Técnico FuelGuard: firmware, tags, calibración y capacitación'], size: 24 })}
    ${tarjeta({ titulo: 'Antes de ir al camión', items: ['Kit recibido y verificado: K-factor, tensión de bobina, rango del sensor', 'Cisterna creada en el dashboard con su clave de dispositivo', 'Prueba en mesa aprobada: tag, despacho y cierre'], bg: C.greenSoft, border: C.greenLine, colorTitulo: C.green, size: 24 })}
  </div>`);

S.kit = seccion('kit', `${cab('Materiales', 'Kit estándar por cisterna')}
  <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:28px">
    ${tarjeta({ titulo: 'Línea de combustible', items: ['Caudalímetro de pulsos 1½" (Piusi K600/4) con hoja de K-factor', 'Electroválvula NC 1½", 12/24 V, sello Viton', 'Pistola automática si la actual no lo es', 'Niples, uniones, teflón y sellador para hidrocarburos'], bg: C.accSoft, border: C.accLine, colorTitulo: C.accDark, size: 24, flex: '' })}
    ${tarjeta({ titulo: 'Electrónica', items: ['Controlador ESP32 con 4G y GPS (LILYGO T-SIM7600G-H)', 'Lector RFID RDM6300 y bobina de antena', 'Sensor de nivel hidrostático 4 a 20 mA', 'Relé 5 V, fuente DC-DC 24 a 5 V, shunt 150 Ω, antenas, SIM M2M, caja IP67'], size: 24, flex: '' })}
    ${tarjeta({ titulo: 'Por equipo', items: ['Tag RFID anti-metal de 125 kHz', 'Desengrasante y resina epóxica'], bg: C.greenSoft, border: C.greenLine, colorTitulo: C.green, size: 24, flex: '' })}
    ${tarjeta({ titulo: 'Herramientas', items: ['Llaves de tubo, cortatubos, terraja 1½"', 'Multímetro, crimpadora, etiquetadora', 'Recipiente patrón de 20 L', 'Notebook con PlatformIO y cable USB'], size: 24, flex: '' })}
  </div>`);

S.secA = separador('secA', 'A', 'Preparación y prueba en mesa', 'Todo lo que se puede validar en la oficina antes de tocar el camión.', [['Dónde', 'Oficina'], ['Tiempo', '2 a 3 horas'], ['Quién', 'Técnico']]);

S.a1 = seccion('a1', `${cab('Etapa A · Preparación', 'Dar de alta la cisterna y los equipos')}
  <div style="display:flex; gap:40px">
    <div style="width:1080px; background:#0E1626; border-radius:20px; padding:16px; box-shadow:0 16px 48px rgba(20,33,61,0.25)"><img src="${IMG.admin}" alt="Administración del dashboard: usuarios, cisternas y claves de dispositivo" style="width:1048px; height:655px; object-fit:cover; border-radius:10px"></div>
    <div style="flex:1; display:flex; flex-direction:column; gap:20px">
      <h3 style="font-family:${HEAD}; font-size:32px; font-weight:600">Pasos</h3>
      <ol style="font-size:26px; line-height:1.45; color:${C.body}; padding:0 0 0 34px">
        <li>Cisternas: nueva cisterna. Anote la clave de dispositivo, se muestra una sola vez.</li>
        <li>Equipos: código, capacidad del tanque y consumo nominal en litros por hora.</li>
        <li>Usuarios: chofer asignado a la cisterna y operadores de cada equipo.</li>
        <li>Parámetros: geocerca, horario y precio del litro.</li>
      </ol>
    </div>
  </div>`);

S.a2 = seccion('a2', `${cab('Etapa A · Preparación', 'Configurar y grabar el firmware')}
  <div style="display:flex; gap:40px">
    <div style="width:1000px; background:#0E1626; border-radius:20px; padding:36px; display:flex; flex-direction:column; gap:6px">
      ${['// firmware/include/config.h', '#define DEVICE_KEY  "dev-cist-01-8f3a…"   // del dashboard', '#define SERVER_HOST "combustible.miempresa.com"', '#define SERVER_PORT 443', '#define SERVER_TLS  1', '#define GSM_APN     "m2m.entel.cl"        // según la SIM', '#define K_FACTOR_PULSES_PER_L  100.0f   // hoja del medidor', '#define TANK_CAPACITY_L        10000.0f', '#define LEVEL_TABLE {{0,0},{50,5000},{100,10000}}', ' ', '// grabar y ver el monitor', 'pio run -e esp32-sim7600 -t upload', 'pio device monitor -b 115200'].map(l => `<p style="font-family:'Courier New', monospace; font-size:26px; line-height:1.3; color:${l.startsWith('//') ? '#8C93A0' : l.startsWith('pio') ? '#9BE79B' : '#E8E8E8'}">${esc(l)}</p>`).join('\n      ')}
    </div>
    ${tarjeta({ titulo: 'Qué comprobar en el monitor serie', items: ['"heartbeat ok, señal N": el controlador llegó al servidor', 'La cisterna pasa a "en línea" en el dashboard, con posición GPS', 'LED: parpadeo lento en línea, rápido sin señal', 'Si no conecta: revisar la clave, el APN y la antena LTE'], size: 24 })}
  </div>`);

S.a3 = seccion('a3', `${cab('Etapa A · Preparación', 'Prueba en mesa: el sistema completo sin el camión')}
  <div style="display:flex; gap:40px">
    <div style="width:1100px; background:${C.card}; border:1px solid ${C.line}; border-radius:20px; padding:20px"><img src="${IMG.mesa}" alt="Banco de pruebas: pulsador, potenciómetro, lector RFID y relé conectados al ESP32 y a la PC con FuelGuard" style="width:1060px; height:410px; object-fit:contain"></div>
    ${tarjeta({ titulo: 'Probar los tags anti-metal aquí', items: ['Pegar uno sobre una plancha de acero', 'Lectura estable a 2 o 3 cm y pérdida en menos de un segundo al alejar la antena', 'Si falla: tag más grande o antena reubicada, antes de comprar el lote'], bg: C.accSoft, border: C.accLine, colorTitulo: C.accDark, size: 24 })}
  </div>
  <p style="font-size:28px; font-weight:600; color:${C.green}">Si esto funciona en la mesa, el 80 % del riesgo de la instalación quedó resuelto.</p>`);

S.videosA = filaVideos('Etapa A · Videos de referencia', 'Programación, placa 4G y lector RFID', [
  ['ao42PLgavdo', 'instalación de PlatformIO y primera grabación de un ESP32. En FuelGuard el proyecto ya está listo: solo se edita config.h'],
  ['qz8jcXVtNuY', 'la placa del piloto: dónde va la SIM, las antenas LTE y GPS y cómo se alimenta'],
  ['l8RDbHd1cak', 'cómo se conecta el lector RDM6300 y cómo entrega el número del tag por serie'],
], 'videosA');

S.secB = separador('secB', 'B', 'Montaje mecánico', 'Caudalímetro y electroválvula en la línea, sonda de nivel en el tanque, antena RFID en la pistola.', [['Dónde', 'Camión'], ['Tiempo', '2 a 3 horas'], ['Quién', 'Mecánico']]);

S.b1 = seccion('b1', `${cab('Etapa B · Montaje mecánico', 'Dónde va cada pieza')}
  <div style="background:${C.card}; border:1px solid ${C.line}; border-radius:20px; padding:16px"><img src="${IMG.linea}" alt="Diagrama de la línea: tanque, bomba, filtro, caudalímetro nuevo, electroválvula nueva, carrete, pistola con antena RFID, tanque del equipo con tag y caja del controlador" style="width:1632px; height:560px; object-fit:contain"></div>`);

S.b2 = seccion('b2', `${cab('Etapa B · Montaje mecánico', 'Los tres puntos delicados')}
  <div style="display:flex; gap:32px">
    ${marco('Foto 1 del piloto', 'Corte e inserción en la línea')}
    ${marco('Foto 2 del piloto', 'Sonda de nivel por la boca')}
    ${marco('Foto 3 del piloto', 'Antena RFID en la boquilla')}
  </div>
  <div style="display:flex; gap:32px">
    ${tarjeta({ numero: 1, texto: 'Tramo recto y accesible después del filtro. Respetar la flecha de flujo. Sellar con teflón o sellador para hidrocarburos. Fijar al chasis, nunca colgado de la manguera.', size: 24 })}
    ${tarjeta({ numero: 2, texto: 'Introducir la sonda hasta apoyar en el fondo y fijar el cable con prensaestopas en el tapón. Sin perforar ni soldar. Anotar el compartimento si hay rompeolas.', size: 24 })}
    ${tarjeta({ numero: 3, texto: 'Bobina a 2 o 3 cm de la punta con abrazadera plástica, cubierta con resina epóxica. Cable en espiral protector junto a la manguera.', size: 24 })}
  </div>
  <p style="font-size:24px; color:${C.muted}">Prueba de fugas obligatoria antes de la etapa C: bomba encendida con la pistola cerrada, revisar todas las uniones.</p>`);

S.videosB1 = filaVideos('Etapa B · Videos de referencia', 'Caudalímetro y electroválvula', [
  ['PkwhzUWP8uE', 'la familia K600, la salida de pulsos y su ubicación en la línea después de la bomba'],
  ['OSs0oUbmIqM', 'cómo se abre el K600 Pulser y cómo son los engranajes ovales; sirve para el mantenimiento anual'],
  ['vkLoBfkcm_U', 'cómo comprobar con multímetro y alimentación que la bobina abre y cierra; hágalo antes de roscarla'],
], 'videosB1');

S.videosB2 = filaVideos('Etapa B · Videos de referencia', 'Sensor de nivel y RFID en la pistola', [
  ['oMFeT2PzwG0', 'cómo se instala y conecta una sonda sumergible 4 a 20 mA: cable ventilado, posición en el fondo y lazo'],
  ['f8mnRFkr7Nc', 'el concepto que replica FuelGuard: tag en el cuello del tanque y lector en la pistola'],
  ['N6mRTJTVEbY', 'demostración del kit: distancia de lectura y qué pasa al retirar la pistola'],
], 'videosB2');

S.secC = separador('secC', 'C', 'Montaje eléctrico', 'Caja del controlador, alimentación protegida, ocho cables etiquetados y antenas en el techo.', [['Dónde', 'Camión'], ['Tiempo', '2 a 3 horas'], ['Quién', 'Electricista']]);

S.c1 = seccion('c1', `${cab('Etapa C · Montaje eléctrico', 'Conexiones al controlador')}
  <div style="background:${C.card}; border:1px solid ${C.line}; border-radius:20px; padding:16px"><img src="${IMG.cableado}" alt="Diagrama de cableado: caudalímetro a GPIO27, electroválvula por relé a GPIO26, sensor de nivel a GPIO34, lector RFID a GPIO16, zumbador, fuente 5 V, antenas LTE y GPS, SIM y USB" style="width:1632px; height:560px; object-fit:contain"></div>`);

S.c2 = seccion('c2', `${cab('Etapa C · Montaje eléctrico', 'Caja, alimentación y antenas')}
  <div style="display:flex; gap:32px">
    ${marco('Foto 4 del piloto', 'Caja IP67 montada, prensaestopas hacia abajo')}
    ${marco('Foto 5 del piloto', 'Interior cableado y etiquetado')}
    ${marco('Video propio 2', 'Encendido y primera conexión al dashboard')}
  </div>
  <div style="display:flex; gap:32px">
    ${tarjeta({ titulo: 'Alimentación', items: ['12 o 24 V del vehículo con fusible de 3 A y supresor de transitorios', 'Convertidor DC-DC a 5 V; negativo común al chasis', 'La bobina de la válvula se alimenta de 12 o 24 V a través del relé, con diodo'], size: 24 })}
    ${tarjeta({ titulo: 'Antenas y señal', items: ['LTE y GPS en el techo de la cabina, con vista al cielo y fuera del metal', 'Cables de señal apantallados, malla a tierra solo en la caja', 'SIM M2M insertada y APN cargado en config.h'], size: 24 })}
  </div>`);

S.videosC = filaVideos('Etapa C · Videos de referencia', 'Cableado en el vehículo', [
  ['QuZk-UYsifQ', 'cableado de un sistema de control de combustible: alimentación, pulsos del contador y válvula, los mismos circuitos del kit'],
  ['V94yF1DhnUU', 'cómo tomar 12 o 24 V con fusible, dónde fijar la caja y cómo tender la antena de un rastreador'],
  ['qcmB7YRpoFw', 'cómo funciona una electroválvula y por qué la bobina se conecta por relé con diodo de protección'],
], 'videosC');

S.secD = separador('secD', 'D', 'Tags en los equipos', 'Un tag anti-metal en el cuello del tanque de cada máquina, registrado en el dashboard.', [['Dónde', 'Faena'], ['Tiempo', '5 min por equipo'], ['Quién', 'Técnico']]);

S.d1 = seccion('d1', `${cab('Etapa D · Tags en los equipos', 'Pegar, leer y registrar')}
  <div style="display:flex; gap:40px">
    <div style="width:1080px; background:#0E1626; border-radius:20px; padding:16px; box-shadow:0 16px 48px rgba(20,33,61,0.25)"><img src="${IMG.equipos}" alt="Pantalla de equipos con el tag RFID de cada máquina" style="width:1048px; height:655px; object-fit:cover; border-radius:10px"></div>
    <div style="flex:1; display:flex; flex-direction:column; gap:20px">
      <h3 style="font-family:${HEAD}; font-size:32px; font-weight:600">Por cada máquina</h3>
      <ol style="font-size:26px; line-height:1.45; color:${C.body}; padding:0 0 0 34px">
        <li>Desengrasar y pegar el tag anti-metal donde apoya la boquilla, o fijarlo con abrazadera. Resina si recibe golpes.</li>
        <li>Leerlo con el lector: aparece en el monitor serie o como "tag no autorizado" en el dashboard.</li>
        <li>Equipos, editar, tag RFID. Carga corta de prueba.</li>
      </ol>
    </div>
  </div>`);

S.secE = separador('secE', 'E', 'Calibración y prueba final', 'Diez minutos que definen la precisión de todo el sistema, y el primer despacho real con el chofer.', [['Dónde', 'Camión'], ['Tiempo', '1 a 2 horas'], ['Quién', 'Técnico y chofer']]);

S.e1 = seccion('e1', `${cab('Etapa E · Calibración', 'Caudalímetro y sensor de nivel')}
  <div style="display:flex; gap:32px">
    ${tarjeta({ titulo: 'Caudalímetro', items: ['Despachar tres veces a un recipiente patrón de 20 L', 'Si el sistema promedia 19,4 L: K nuevo = K actual × 19,4 / 20', 'Regrabar config.h y anotar el K-factor en la cisterna del dashboard', 'Objetivo: error menor al 0,5 %'], bg: C.accSoft, border: C.accLine, colorTitulo: C.accDark, size: 26 })}
    ${tarjeta({ titulo: 'Sensor de nivel', items: ['Con el tanque a un nivel conocido anotar los litros reportados', 'Repetir en dos o tres niveles y cargar los puntos en la tabla de aforo', 'Tanque cilíndrico horizontal: tabla no lineal, al menos siete puntos', 'Ajustar la precisión del sensor en Parámetros'], size: 26 })}
  </div>
  ${tarjeta({ titulo: 'Geocerca, horario y precio', texto: 'En Administración, Parámetros: coordenadas del proyecto y radio (3 km por defecto), horario permitido y precio por litro. Con la precisión del sensor bien configurada, las conciliaciones no generan falsas alarmas.', bg: C.greenSoft, border: C.greenLine, colorTitulo: C.green, size: 26, flex: '' })}`);

S.videosE = filaVideos('Etapa E · Videos de referencia', 'Calibración del K600', [
  ['DmYBOnf2ark', 'el procedimiento oficial con recipiente patrón; anote la cifra y aplique la fórmula del K-factor'],
  ['Ks_KHxz97NM', 'la misma calibración explicada por un distribuidor, con consejos de caudal estable y purga de aire'],
], 'videosE', tarjeta({ titulo: 'Regla del 0,5 %', items: ['Tres despachos de 20 L, no uno', 'Caudal normal de trabajo, sin aire en la línea', 'Mismo combustible que en operación', 'Repetir tras cambiar manguera o bomba', 'Anotar K-factor y fecha en la carpeta del vehículo'], bg: C.greenSoft, border: C.greenLine, colorTitulo: C.green, size: 24 }));

S.e2 = seccion('e2', `${cab('Etapa E · Prueba final', 'El despacho completo con el chofer')}
  <div style="display:flex; gap:40px; align-items:flex-start">
    <img src="${IMG.choferInicio}" alt="Tablet mostrando un despacho en curso" style="width:360px; height:576px; object-fit:cover; border-radius:16px; box-shadow:0 12px 32px rgba(20,33,61,0.25)">
    <img src="${IMG.choferTicket}" alt="Ticket de despacho con hash y firma" style="width:360px; height:576px; object-fit:cover; border-radius:16px; box-shadow:0 12px 32px rgba(20,33,61,0.25)">
    <div style="flex:1; background:${C.card}; border:1px solid ${C.line}; border-radius:20px; padding:36px; display:flex; flex-direction:column; gap:16px">
      <h3 style="font-family:${HEAD}; font-size:32px; font-weight:600">Secuencia de aceptación</h3>
      <ol style="font-size:26px; line-height:1.4; color:${C.body}; padding:0 0 0 34px">
        <li>Leer tag: la tablet muestra "autorizado" y los litros suben en vivo</li>
        <li>Retirar la pistola: cierre automático</li>
        <li>Confirmar con horómetro y firma, imprimir el ticket</li>
        <li>Verificar registro y hash en el dashboard</li>
        <li>Tag desconocido: válvula bloqueada y alerta</li>
        <li>Sin antena LTE: despacho con lista local; al reconectar se sincroniza con su hora original</li>
        <li>Registrar una recarga desde la tablet</li>
      </ol>
    </div>
  </div>`);

S.problemas = seccion('problemas', `${cab('Soporte', 'Dónde suele complicarse y cómo resolverlo')}
  <table style="font-size:24px; color:${C.ink}">
    <tr style="background:${C.dark}"><th style="width:30%; color:${C.light}; text-align:left">Problema</th><th style="width:30%; color:${C.light}; text-align:left">Causa habitual</th><th style="width:40%; color:${C.light}; text-align:left">Solución</th></tr>
    ${[['El tag no se lee o se pierde al mover la pistola', 'Tag común sobre metal; antena mal orientada', 'Tag anti-metal de 30 a 50 mm; antena paralela al tag a 2 o 3 cm; probar en mesa'], ['La válvula no abre aunque el relé cierra', 'Válvula servoasistida con bomba de baja presión; bobina de otra tensión', 'Válvula de acción directa; bobina de 12 o 24 V según el camión'], ['Litros erráticos o pulsos con la bomba apagada', 'Ruido eléctrico del vehículo', 'Cable apantallado con malla a tierra solo en la caja; antirrebote más alto; optoacoplador'], ['Nivel que oscila 50 L', 'Combustible en movimiento con el motor en marcha', 'Normal: el sistema tolera la precisión configurada; conciliar con el camión detenido'], ['Sin cobertura 4G en el tajo', 'Zona sin señal', 'Despacha con lista local y sincroniza al recuperar señal; WiFi en el punto de recarga'], ['El dashboard no ve la cisterna', 'Clave de dispositivo o APN incorrectos', 'Revisar la clave y el APN en config.h; el monitor serie muestra el error exacto']].map((f, i) => `<tr style="background:${i % 2 ? '#F1EFE8' : C.card}">${f.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('\n    ')}
  </table>`);

S.checklist = seccion('checklist', `${cab('Aceptación', 'Lista de entrega')}
  <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:20px">
    ${['Cisterna en línea en el dashboard con posición GPS', 'Tres despachos de calibración con error menor al 0,5 %', 'Tabla de aforo cargada y nivel coherente con la varilla', 'Todos los equipos con tag registrado y leídos al menos una vez', 'Bloqueo con tag desconocido comprobado', 'Despacho sin señal sincronizado correctamente', 'Chofer capacitado: despacho, firma, ticket, recarga, manual de contingencia', 'Supervisor capacitado: alertas, reportes, cierre de alertas con nota', 'Copia de config.h, K-factor y aforo en la carpeta del vehículo'].map(t => `<div style="background:${C.card}; border:1px solid ${C.line}; border-radius:16px; padding:20px 28px; display:flex; gap:20px; align-items:center"><div style="width:40px; height:40px; border:3px solid ${C.ink}; border-radius:8px; background:${C.light}"></div><p style="flex:1; font-size:26px; line-height:1.3">${esc(t)}</p></div>`).join('\n    ')}
  </div>`);

S.registro = seccion('registro', `${cab('Documentación', 'Registro fotográfico y en video del piloto')}
  <div style="display:flex; gap:32px">
    ${tarjeta({ titulo: 'Fotos, una por marco de esta guía', items: ['Corte e inserción del caudalímetro y la válvula en la línea', 'Sonda de nivel entrando por la boca de inspección', 'Antena RFID fijada en la boquilla', 'Caja IP67 montada en el camión', 'Interior de la caja cableado y etiquetado', 'Tag pegado en el cuello del tanque de un equipo'], size: 26 })}
    ${tarjeta({ titulo: 'Videos propios, de 1 a 3 minutos', items: ['Prueba en mesa: tag, pulsador, cierre', 'Encendido y primera conexión al dashboard', 'Calibración con recipiente patrón de 20 L', 'Despacho completo con firma y ticket, para capacitar choferes', 'Bloqueo con tag desconocido, para mostrar al cliente', 'Subirlos a un canal de YouTube no listado y reemplazar los videos de referencia'], bg: C.accSoft, border: C.accLine, colorTitulo: C.accDark, size: 26 })}
  </div>`);

S.cierre = `<section id="cierre" data-transition="fade" style="background:${C.dark}; color:${C.light}; font-family:${FONT}; padding:128px; display:flex; flex-direction:column; justify-content:center; gap:32px">
  <p style="font-size:24px; font-weight:600; letter-spacing:4px; color:${C.acc}; text-transform:uppercase">Soporte</p>
  <h1 style="font-family:${HEAD}; font-size:96px; font-weight:600; line-height:1.05; width:1400px">¿Dudas durante la instalación?</h1>
  <p style="font-size:32px; line-height:1.4; color:${C.ice}; width:1300px">Guía detallada en docs/INSTALACION_PASO_A_PASO.md. Conexiones y calibración en firmware/README.md.</p>
  <p style="font-size:26px; color:#8FA3C7">Edison Zavala · [correo] · [teléfono]</p>
</section>
`;

const order = ['portada', 'resumen', 'kit', 'secA', 'a1', 'a2', 'a3', 'videosA', 'secB', 'b1', 'b2', 'videosB1', 'videosB2', 'secC', 'c1', 'c2', 'videosC', 'secD', 'd1', 'secE', 'e1', 'videosE', 'e2', 'problemas', 'checklist', 'registro', 'cierre'];
for (const id of order) { if (!S[id]) throw new Error('falta ' + id); fs.writeFileSync(path.join(OUT, id + '.html'), S[id], 'utf8'); }
const deck = {
  v: 4, createdOnFiles: { v: 1, at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') }, title: 'FuelGuard · Guía de instalación', cover: 'portada', order,
  sections: { s1: { description: 'Resumen de las cinco etapas y el kit de materiales', start: 'portada' }, s2: { description: 'Etapa A: alta en el dashboard, firmware y prueba en mesa', start: 'secA' }, s3: { description: 'Etapa B: montaje mecánico en la línea de combustible', start: 'secB' }, s4: { description: 'Etapa C: cableado, caja y antenas', start: 'secC' }, s5: { description: 'Etapa D: tags en los equipos', start: 'secD' }, s6: { description: 'Etapa E: calibración, prueba final, soporte y aceptación', start: 'secE' } },
  faces: { rubik: { family: 'Rubik', href: 'https://fonts.googleapis.com/css2?family=Rubik:wght@400..700&display=swap' }, 'ibm-plex-sans': { family: 'IBM Plex Sans', href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap' } },
  designSystems: [],
};
fs.writeFileSync(path.join(ROOT, 'project', 'deck.json'), JSON.stringify(deck, null, 2), 'utf8');
console.log('slides', order.length);
