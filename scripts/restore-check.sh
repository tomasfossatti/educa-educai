#!/usr/bin/env bash
# Prueba de restauración: restaura un backup en una base vacía y verifica que la app arranca con
# esos datos (etapa 6 y docs/ENTORNOS_Y_DESPLIEGUE.md).
#
#   RESTORE_ADMIN_URL=postgresql://usuario:clave@host:5432/postgres scripts/restore-check.sh backup.dump
#
# Variables:
#   RESTORE_ADMIN_URL   conexión con permiso para crear bases en el servidor de destino (obligatoria)
#   RESTORE_COMPARE_URL base de origen: si está, la cantidad de filas de cada tabla tiene que coincidir
#   KEEP_RESTORED_DB=1  no borra la base restaurada al terminar
#   RESTORE_PORT        puerto para levantar la app (3400)
# Requiere `npm run build` hecho antes. No imprime contenido de ninguna tabla, solo cantidades.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib-db.sh
. scripts/lib-db.sh

dump=${1:?Uso: scripts/restore-check.sh archivo.dump}
admin=${RESTORE_ADMIN_URL:?Falta RESTORE_ADMIN_URL}
port=${RESTORE_PORT:-3400}
[ -f .next/BUILD_ID ] || { echo "Falta el build: corré npm run build antes."; exit 1; }

if [ -f "$dump.sha256" ]; then
  sha256sum --check --quiet "$dump.sha256"
  echo "1/5 Suma de verificación del backup: ok"
else
  echo "1/5 Suma de verificación del backup: no hay archivo .sha256 (se sigue igual)"
fi

use_matching_pg_tools "$admin"
name="educai_restore_$(date -u +%Y%m%d%H%M%S)"
target=$(with_database "$admin" "$name")
app_pid=""
cleanup() {
  # La app corre en su propio grupo de procesos: se mata el grupo para no dejar un next-server huérfano.
  [ -n "$app_pid" ] && kill -- "-$app_pid" 2>/dev/null || true
  if [ "${KEEP_RESTORED_DB:-}" != "1" ]; then
    psql "$(libpq_url "$admin")" -q -c "DROP DATABASE IF EXISTS \"$name\" WITH (FORCE)" >/dev/null || true
  fi
}
trap cleanup EXIT

started=$(date +%s)
psql "$(libpq_url "$admin")" -q -c "CREATE DATABASE \"$name\""
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$(libpq_url "$target")" "$dump"
echo "2/5 Restaurado en la base vacía $name en $(( $(date +%s) - started )) s"

DATABASE_URL="$target" npx prisma migrate status > /tmp/educai-restore-migrate.log 2>&1 || {
  cat /tmp/educai-restore-migrate.log
  echo "Las migraciones de la base restaurada no coinciden con las del código."
  exit 1
}
echo "3/5 Migraciones: la base restaurada está al día con el código"

if [ -n "${RESTORE_COMPARE_URL:-}" ]; then
  diff <(table_counts "$RESTORE_COMPARE_URL") <(table_counts "$target") > /tmp/educai-restore-diff.txt || {
    cat /tmp/educai-restore-diff.txt
    echo "La cantidad de filas no coincide con la base de origen."
    exit 1
  }
  echo "4/5 Filas por tabla: iguales a la base de origen ($(table_counts "$target" | awk -F'\t' '{s+=$2} END {print s}') filas en $(table_counts "$target" | wc -l) tablas)"
else
  echo "4/5 Filas por tabla (sin base de origen para comparar):"
  table_counts "$target" | sed 's/^/      /'
fi

# Si el puerto ya responde, el chequeo podría validar otro servidor conectado a otra base.
if curl -s -o /dev/null "http://localhost:$port/"; then echo "El puerto $port ya está en uso: elegí otro con RESTORE_PORT."; exit 1; fi
DATABASE_URL="$target" NODE_ENV=production setsid node_modules/.bin/next start -p "$port" > /tmp/educai-restore-app.log 2>&1 &
app_pid=$!
for _ in $(seq 1 60); do
  if health=$(curl -fsS "http://localhost:$port/api/health" 2>/dev/null); then break; fi
  sleep 1
done
[ -n "${health:-}" ] || { tail -20 /tmp/educai-restore-app.log; echo "La app no arrancó con la base restaurada."; exit 1; }
grep -q '"ok":true' <<< "$health" || { echo "La app arrancó pero no llega a la base: $health"; exit 1; }
curl -fsS -o /dev/null "http://localhost:$port/login" || { echo "La página de login no responde."; exit 1; }
echo "5/5 La app arranca con la base restaurada: $health"
echo "Restauración probada en $(( $(date +%s) - started )) s."
