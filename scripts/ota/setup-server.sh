#!/bin/bash
set -euo pipefail
base=/srv/apps/logic-coin/shared/ota
sudo install -d -o deploy -g deploy -m 700 "$base" "$base/keys"
mkdir -p "$base/storage" "$base/app"
if [ ! -f "$base/keys/private.pem" ]; then
  umask 077
  openssl req -x509 -newkey rsa:3072 -nodes -keyout "$base/keys/private.pem" -out "$base/keys/certificate.pem" -days 3650 -subj '/CN=Logic Coin Updates' -addext 'keyUsage=critical,digitalSignature' >/dev/null 2>&1
fi
chmod 600 "$base/keys/private.pem"
install -m 644 /tmp/logic-coin-ota-server.mjs "$base/app/server.mjs"
sudo install -m 644 /tmp/logic-coin-ota.service /etc/systemd/system/logic-coin-ota.service
sudo systemctl daemon-reload
sudo systemctl enable --now logic-coin-ota.service
curl --fail --silent http://127.0.0.1:8099/updates/health
