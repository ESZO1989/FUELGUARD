# FuelGuard · Control automatizado de combustible

Aplicación para controlar el despacho de combustible desde **camiones cisterna a equipos de obra/mina**, detectar robos automáticamente y ver el consumo **en tiempo real por usuario**.

- **Sin dependencias externas**: solo Node.js ≥ 22.13 (usa SQLite integrado y Server‑Sent Events).
- **Hardware emulado**: `simulator/` reproduce el controlador del camión (RFID, caudalímetro, sensor de nivel, GPS) e inyecta escenarios de robo para probar las reglas.
- **Firmware real**: [firmware/](firmware/README.md) para ESP32 con módem 4G SIM7600 (o WiFi), con lista blanca local y cola de eventos sin cobertura.
- **Documento de hardware y costos**: [docs/HARDWARE_Y_COSTOS.md](docs/HARDWARE_Y_COSTOS.md) (también dentro del dashboard, con calculadora de retorno editable).
- **Lista de compra del piloto** con proveedores y precios verificados: [docs/LISTA_DE_COMPRA_PILOTO.md](docs/LISTA_DE_COMPRA_PILOTO.md).

## Arranque rápido

```bash
npm run dev
```

Levanta el servidor en <http://localhost:3000> y el simulador de dos cisternas. Por separado: `npm start` (servidor) y `npm run simulador`. `npm run reset` borra la base para regenerar los datos demo. `npm test` ejecuta las pruebas del motor de reglas.

### Usuarios de demostración

| Usuario | PIN | Rol | Qué ve |
|---|---|---|---|
| `admin` | 1234 | Administrador | Todo + usuarios, parámetros, auditoría |
| `supervisor` | 1111 | Supervisor | Todo, resuelve alertas |
| `chofer1` / `chofer2` | 2222 / 3333 | Chofer | Solo su cisterna |
| `jtorres`, `aflores`, `pmamani`, `rhuaman`, `dsalas`, `jvargas` | 4444…9999 | Operador | Solo el consumo de sus equipos |

## Qué hace

| Módulo | Función |
|---|---|
| **Panel** | KPIs del día y del mes, stock de cada cisterna, despachos en curso con litros y caudal en vivo, alertas recientes, gráficos por hora y por día |
| **Despachos** | Historial completo con pulsos, caudal, horómetro, nivel de cisterna antes/después, estado, alertas y hash de integridad; exportación CSV |
| **Consumo** | Litros, horas y L/h real vs nominal por equipo; consumo por operador; balance por cisterna (recargas − despachos vs nivel real = merma) |
| **Alertas** | 13 tipos de eventos con severidad; resolución con nota y auditoría |
| **Equipos** | Catálogo con tag RFID, operador, capacidad, horómetro; estado de cada cisterna/dispositivo |
| **Reportes** | Consumo por equipo, operador y cisterna, comparativa de merma con el período anterior, alertas y detalle de despachos; descarga en Excel y PDF; envío por correo manual y automático (diario, semanal, mensual) |
| **Hardware y costos** | Explicación del funcionamiento, arquitectura, tabla de componentes con precios editables y calculadora CAPEX/OPEX/ROI con gráfico |
| **Administración** | Usuarios y roles, cisternas y claves de dispositivo, parámetros de las reglas, respaldos, auditoría |
| **App del chofer** (`/chofer/`) | Aplicación instalable para la tablet del camión: despacho en vivo, bloqueos, confirmación con horómetro y firma del operador, ticket imprimible, recargas del proveedor, despacho manual de contingencia y cola sin conexión |

## Reglas antirrobo (server/rules.js)

| Regla | Cuándo | Acción |
|---|---|---|
| Tag no autorizado / equipo inactivo | al leer RFID | bloquea válvula |
| Fuera de geocerca GPS | al leer RFID | bloquea válvula (crítica) |
| Fuera de horario | al leer RFID | alerta |
| Sobrellenado (> capacidad ×1.10) | durante el despacho | corta válvula (crítica) |
| Caudal fuera de rango del caudalímetro | durante el despacho | alerta (manipulación/bypass) |
| Descuadre nivel cisterna vs caudalímetro | al terminar | alerta alta (bypass o fuga) |
| Consumo L/h muy superior al nominal | al terminar | alerta alta (sifoneo) |
| Dos despachos seguidos que exceden el tanque | al terminar | alerta alta (recipiente externo) |
| Caída de nivel sin despacho | lectura periódica | alerta crítica (robo directo) |
| Recarga menor que la guía del proveedor | al recargar | alerta |
| Pérdida de señal durante despacho | vigilante 90 s | cierra y alerta |
| Integridad | siempre | cadena de hashes + auditoría |

Los umbrales se editan en **Administración → Parámetros** (tolerancias, precisión del sensor de nivel, horario, geocerca, factores).

## Estructura

```
server/index.js     API REST + telemetría de dispositivos + SSE + estáticos
server/rules.js     motor de reglas antirrobo (puro, probado)
server/db.js        esquema SQLite, migraciones, datos semilla y respaldos
server/reportes.js  reportes por período (datos, Excel, PDF, correo)
server/xlsx.js      generador .xlsx sin dependencias · server/pdf.js generador PDF · server/smtp.js cliente SMTP
simulator/          emulador del controlador de cisterna (mismo protocolo que el firmware)
firmware/           firmware real del controlador (ESP32 + SIM7600, PlatformIO) — ver firmware/README.md
public/             dashboard (HTML/CSS/JS, Chart.js por CDN)
public/chofer/      app del chofer (PWA: manifest + service worker, sin dependencias)
docs/               hardware, costos y funcionamiento
tests/              pruebas del motor de reglas y de la API (node --test)
deploy/             Caddyfile, servicio systemd, instalador Windows; Dockerfile y docker-compose en la raíz
```

## Protocolo del dispositivo

Cabecera `x-device-key: <clave de la cisterna>`.

| Método | Ruta | Cuerpo |
|---|---|---|
| GET | `/api/dispositivo/whitelist` | — → tags autorizados, horómetros, parámetros |
| POST | `/api/dispositivo/heartbeat` | `{lat,lng}` |
| POST | `/api/dispositivo/despacho/inicio` | `{tag,lat,lng,nivel,horometro,ts?}` → `{autorizado,despacho_id,max_litros}` |
| POST | `/api/dispositivo/despacho/pulso` | `{despacho_id,litros,pulsos,caudal}` → `{cortar}` |
| POST | `/api/dispositivo/despacho/fin` | `{despacho_id,litros,pulsos,nivel,caudal_prom,motivo,ts?}` → `{hash,alertas}` |
| POST | `/api/dispositivo/nivel` | `{nivel,lat,lng,ts?}` |

`ts` (ISO‑8601) es opcional: lo envía el controlador al reenviar eventos guardados sin cobertura y el servidor conserva esa hora si es verosímil (últimos 30 días).
| POST | `/api/dispositivo/recarga` | `{litros,guia,nivel_despues}` |

## Puesta en producción

Guía completa en [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) (Linux con systemd + Caddy, Docker, o Windows como tarea programada). Resumen:

1. Copie `.env.example` a `.env` con `FUELGUARD_SEED=minimo` (base sin datos de prueba, solo admin) y arranque con `npm run start:prod`.
2. Cree las cisternas en Administración → Cisternas: cada una entrega su clave de dispositivo para el firmware. Cambie el PIN del admin.
3. Ponga HTTPS con Caddy ([deploy/Caddyfile](deploy/Caddyfile)) o `TLS_CERT`/`TLS_KEY`.
4. Arranque automático: `deploy/linux/instalar.sh` (systemd) o `deploy/windows/instalar-servicio.ps1`.
5. Respaldos: automáticos a diario, `npm run backup`, o el botón en Administración. `GET /api/salud` para monitoreo.
6. Reportes por correo: configure `SMTP_*` en `.env` y los destinatarios y horario en Administración → Parámetros.

Incluido de serie: bloqueo por intentos de PIN, cabeceras de seguridad (CSP, HSTS), auditoría y hash encadenado de despachos.
