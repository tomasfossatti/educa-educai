#!/usr/bin/env bash
# Backup lógico de la base (pg_dump, formato custom) con su suma de verificación.
#   DATABASE_URL=... scripts/backup-db.sh [archivo]
# En producción el backup diario lo hace el proveedor; este script sirve para la prueba de
# restauración y para un backup manual antes de una migración. El archivo queda donde se corre:
# los datos reales nunca se copian fuera de producción (regla 7 de CLAUDE.md).
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib-db.sh
. scripts/lib-db.sh

: "${DATABASE_URL:?Falta DATABASE_URL}"
out=${1:-backups/educai-$(date -u +%Y%m%dT%H%M%SZ).dump}
mkdir -p "$(dirname "$out")"
umask 077

pg_dump --format=custom --no-owner --no-privileges --dbname="$(libpq_url "$DATABASE_URL")" --file="$out"
pg_restore --list "$out" > /dev/null # el archivo se puede leer
sha256sum "$out" > "$out.sha256"
echo "Backup listo: $out ($(du -h "$out" | cut -f1))"
