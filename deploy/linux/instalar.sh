#!/usr/bin/env bash
# Instala FuelGuard como servicio systemd en Ubuntu/Debian. Ejecutar como root desde la carpeta del proyecto:
#   sudo bash deploy/linux/instalar.sh
set -euo pipefail
DESTINO=/opt/fuelguard
ORIGEN="$(cd "$(dirname "$0")/../.." && pwd)"

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  echo "Instalando Node.js 22 LTS…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

id -u fuelguard >/dev/null 2>&1 || useradd --system --home "$DESTINO" --shell /usr/sbin/nologin fuelguard
mkdir -p "$DESTINO"
rsync -a --delete --exclude data --exclude backups --exclude node_modules --exclude firmware/.pio --exclude .git "$ORIGEN/" "$DESTINO/"
mkdir -p "$DESTINO/data" "$DESTINO/backups"
[ -f "$DESTINO/.env" ] || { cp "$DESTINO/.env.example" "$DESTINO/.env"; sed -i 's/^HOST=.*/HOST=127.0.0.1/; s/^TRUST_PROXY=.*/TRUST_PROXY=1/' "$DESTINO/.env"; echo "Creado $DESTINO/.env — revíselo."; }
chown -R fuelguard:fuelguard "$DESTINO"
chmod 600 "$DESTINO/.env"

install -m 644 "$DESTINO/deploy/linux/fuelguard.service" /etc/systemd/system/fuelguard.service
systemctl daemon-reload
systemctl enable --now fuelguard
sleep 2
systemctl --no-pager status fuelguard | head -5
echo
echo "FuelGuard instalado. Logs: journalctl -u fuelguard -f"
echo "Si la base es nueva, el PIN inicial del admin está en: journalctl -u fuelguard | grep PIN"
echo "Ponga Caddy delante para HTTPS: deploy/Caddyfile"
