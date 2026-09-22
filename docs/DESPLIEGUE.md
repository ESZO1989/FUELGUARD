# Guía de despliegue en producción

FuelGuard es un solo proceso Node.js con una base SQLite. Para producción hacen falta cuatro cosas: **arrancar sin datos de demostración**, **HTTPS**, **arranque automático** y **respaldos**. Esta guía cubre las tres formas habituales de desplegarlo.

## 0. Antes de empezar: lista de verificación de seguridad

| Punto | Cómo |
|---|---|
| Base nueva sin usuarios de prueba | `FUELGUARD_SEED=minimo` en `.env` antes del primer arranque. Crea solo `admin` con el PIN de `FUELGUARD_ADMIN_PIN` (o uno aleatorio impreso en el log) |
| Cambiar el PIN del admin | Administración → Usuarios → Editar |
| Claves de dispositivo únicas por cisterna | Administración → Cisternas → Nueva cisterna (la clave se muestra una sola vez) o Rotar clave |
| Modo demo apagado | Parámetro `modo_demo = 0` (oculta los usuarios de prueba del login). En base mínima ya viene en 0 |
| Solo HTTPS hacia afuera | Caddy/Nginx con certificado (sección 2) o `TLS_CERT`/`TLS_KEY` nativos |
| Servidor no expuesto directamente | `HOST=127.0.0.1` cuando hay proxy delante; firewall solo 80/443 |
| Bloqueo de fuerza bruta | Incluido: 5 PIN incorrectos por IP y usuario → 15 min de bloqueo, registrado en auditoría |
| Cabeceras de seguridad | Incluidas (CSP, nosniff, sin iframes, HSTS con TLS o proxy) |
| Respaldos | Automático diario (parámetro `backup_hora`) + `npm run backup` + botón en Administración |
| Base fuera de carpetas sincronizadas | Nunca en OneDrive/Dropbox: bloquean el archivo SQLite |

## 1. Servidor Linux (VPS Ubuntu 22.04/24.04) — recomendado

```bash
git clone https://github.com/ESZO1989/FUELGUARD.git fuelguard
cd fuelguard
sudo bash deploy/linux/instalar.sh
```

El script instala Node 22 si falta, copia el proyecto a `/opt/fuelguard`, crea el usuario de sistema `fuelguard`, genera `.env` (con `HOST=127.0.0.1` y `TRUST_PROXY=1`) e instala y arranca el servicio systemd.

```bash
sudo nano /opt/fuelguard/.env          # FUELGUARD_EMPRESA, FUELGUARD_ADMIN_PIN, BACKUP_KEEP…
sudo systemctl restart fuelguard
journalctl -u fuelguard -f              # ver PIN inicial y actividad
```

### HTTPS con Caddy

```bash
sudo apt install -y caddy
sudo cp /opt/fuelguard/deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile          # su dominio
sudo systemctl reload caddy
```

Caddy obtiene y renueva el certificado solo. El dominio debe apuntar a la IP del servidor y los puertos 80 y 443 estar abiertos. La configuración incluida desactiva el buffer para que los eventos en tiempo real (SSE) lleguen sin retraso.

### Actualizar

```bash
cd ~/fuelguard && git pull
sudo bash deploy/linux/instalar.sh      # vuelve a copiar y reinicia; conserva data/, backups/ y .env
```

## 2. Docker (cualquier sistema)

```bash
cp .env.example .env                    # opcional, compose ya define lo esencial
nano deploy/Caddyfile                   # dominio; reverse_proxy fuelguard:3000
docker compose up -d
docker compose logs fuelguard | grep PIN
```

Datos y respaldos quedan en los volúmenes `fuelguard-data` y `fuelguard-backups`. Actualizar: `git pull && docker compose up -d --build`.

## 3. PC o servidor Windows en la oficina

Adecuado cuando el dashboard solo se usa en la red local de la obra y los controladores llegan por WiFi o por una VPN.

1. Instale Node.js 22 LTS desde nodejs.org.
2. Copie el proyecto a una carpeta local, por ejemplo `C:\FuelGuard` (no en OneDrive).
3. Copie `.env.example` a `.env` y ajuste `FUELGUARD_SEED=minimo`, `FUELGUARD_EMPRESA` y el PIN.
4. En PowerShell como administrador:

```bash
powershell -ExecutionPolicy Bypass -File deploy\windows\instalar-servicio.ps1
```

Queda registrada la tarea programada **FuelGuard** que arranca con el equipo, se reinicia sola si falla y escribe en `logs\fuelguard.log`. Para quitarla: `deploy\windows\desinstalar-servicio.ps1`.

5. Abra el puerto en el firewall si otros equipos accederán:

```bash
New-NetFirewallRule -DisplayName FuelGuard -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

**HTTPS en Windows**: instale Caddy para Windows (`caddy.exe run --config deploy\Caddyfile`) o use un certificado interno con `TLS_CERT`/`TLS_KEY` en `.env` y puerto 443. Sin dominio público, Caddy puede emitir certificados internos con `tls internal` en el Caddyfile.

## 4. Conectividad de los controladores

- Los controladores hablan HTTP(S) al mismo dominio/puerto que el dashboard; solo necesitan las rutas `/api/dispositivo/*` con su `x-device-key`.
- Con SIM 4G y servidor en la nube: use HTTPS (Caddy). Con TinyGSM 0.12 el SIM7600 no hace TLS: contrate un **APN privado** con el operador o un túnel; o cambie a la rama de TinyGSM con SSL.
- Con servidor en la oficina y controladores fuera: exponga solo el puerto 443 vía Caddy, o una VPN (WireGuard) entre el módem y la oficina.

## 5. Respaldos y restauración

- Automático: cada día a la hora del parámetro `backup_hora` (por defecto 02:00), en `BACKUP_DIR` (`./backups`), conservando `BACKUP_KEEP` copias (14). Usa `VACUUM INTO`, seguro con el servidor en marcha.
- Manual: `npm run backup` o Administración → Respaldos → *Respaldar ahora*.
- Copie la carpeta `backups/` fuera del servidor (rclone a un bucket, robocopy a un NAS, etc.).
- **Restaurar**: detenga el servicio, sustituya `data/fuelguard.db` por la copia (borre `fuelguard.db-wal` y `fuelguard.db-shm` si existen) y arranque.

## 6. Reportes por correo

1. En `.env` defina el servidor SMTP de su proveedor de correo:

| Proveedor | SMTP_HOST | SMTP_PORT | Nota |
|---|---|---|---|
| Google Workspace / Gmail | smtp.gmail.com | 587 | Use una "contraseña de aplicación" (requiere verificación en dos pasos) |
| Microsoft 365 / Outlook | smtp.office365.com | 587 | Habilite "SMTP autenticado" en el buzón |
| Servidor propio | su host | 587 (STARTTLS) o 465 (`SMTP_SECURE=1`) | `SMTP_TLS_INSECURE=1` solo con certificado autofirmado |

2. En Administración → Parámetros indique los destinatarios (separados por coma), la hora de envío y qué reportes automáticos quiere: diario (día anterior), semanal (lunes, semana anterior) y mensual (día 1, mes anterior).
3. Pruebe desde la pestaña Reportes con "Enviar reporte del período". El estado del último envío y el último error se muestran ahí mismo y en la auditoría.

Cada correo lleva un resumen en HTML y los adjuntos Excel (todas las hojas: resumen, equipos, operadores, cisternas y merma, despachos, alertas, diario) y PDF.

## 7. Supervisión

- `GET /api/salud` sin autenticación devuelve versión, tiempo activo, cisternas en línea y último respaldo. Úselo en UptimeRobot, Zabbix o el healthcheck de Docker.
- Auditoría (Administración) registra ingresos, bloqueos por PIN, cambios de catálogo, parámetros y respaldos.

## 8. Escalado

SQLite atiende sin problema decenas de cisternas y cientos de miles de despachos. Si la operación crece a varias obras con decenas de cisternas, o se exige alta disponibilidad, el paso es PostgreSQL: las consultas de `server/index.js` son SQL estándar y la capa de acceso está concentrada en `server/db.js`.
