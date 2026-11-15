# Funciones compartidas por los scripts de base de datos.

# Prisma acepta parámetros propios en la URL (schema, connection_limit, pool_timeout, pgbouncer)
# que libpq rechaza. Deja solo la base y, si está, sslmode.
libpq_url() {
  local url=$1 base query sslmode=""
  base=${url%%\?*}
  if [[ $url == *\?* ]]; then
    query=${url#*\?}
    sslmode=$(tr '&' '\n' <<< "$query" | grep '^sslmode=' || true)
  fi
  if [[ -n $sslmode ]]; then echo "$base?$sslmode"; else echo "$base"; fi
}

# Cambia el nombre de la base de una URL de PostgreSQL.
with_database() {
  local url=$1 name=$2 base query=""
  base=${url%%\?*}
  [[ $url == *\?* ]] && query="?${url#*\?}"
  echo "${base%/*}/$name$query"
}

# Cantidad de filas de cada tabla de la app, una por línea ("Tabla<TAB>n"), ordenadas por nombre.
table_counts() {
  local url
  url=$(libpq_url "$1")
  local tables
  tables=$(psql "$url" -At -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
  for t in $tables; do
    printf '%s\t%s\n' "$t" "$(psql "$url" -At -c "SELECT count(*) FROM \"$t\"")"
  done
}

# Usa pg_dump, pg_restore y psql de la misma versión mayor que el servidor, si están instalados
# (en Debian y Ubuntu, /usr/lib/postgresql/<versión>/bin). Un pg_dump más nuevo que el servidor
# genera sentencias que el servidor no entiende al restaurar. PG_BIN fuerza una carpeta.
use_matching_pg_tools() {
  local url major
  url=$(libpq_url "$1")
  if [[ -n ${PG_BIN:-} ]]; then
    PATH="$PG_BIN:$PATH"
  else
    major=$(( $(psql "$url" -At -c "SHOW server_version_num") / 10000 ))
    [[ -d /usr/lib/postgresql/$major/bin ]] && PATH="/usr/lib/postgresql/$major/bin:$PATH"
  fi
  export PATH
  local server tools
  server=$(( $(psql "$url" -At -c "SHOW server_version_num") / 10000 ))
  tools=$(pg_dump --version | grep -oE '[0-9]+' | head -1)
  if [[ $tools != "$server" ]]; then
    echo "Aviso: pg_dump $tools y el servidor $server tienen distinta versión mayor; instalá el cliente $server o indicá PG_BIN." >&2
  fi
}
