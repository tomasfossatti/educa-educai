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
