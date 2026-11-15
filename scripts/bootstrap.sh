#!/usr/bin/env bash
# Arma el entorno local de Educai desde cero. Se puede correr las veces que haga falta.
set -euo pipefail
cd "$(dirname "$0")/.."

faltan=0
for f in docs/SPEC.md docs/AUTONOMIA.md docs/PROGRESO.md; do
  if [ ! -f "$f" ]; then echo "Falta $f"; faltan=1; fi
done
if [ "$faltan" = 1 ]; then
  echo "Copiá el kit completo y exportá la especificación a docs/SPEC.md (menú Exportar, Markdown) antes de seguir."
  exit 1
fi

for bin in node npm git; do
  command -v "$bin" >/dev/null || { echo "Falta $bin en el PATH"; exit 1; }
done

node_major=$(node -p "process.versions.node.split('.')[0]")
if [ "$node_major" -lt 22 ]; then echo "Se necesita Node 22 o superior, tenés $node_major"; exit 1; fi

mkdir -p .secrets/local .secrets/staging .secrets/prod

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  # Secreto de sesión propio para este entorno, generado en el momento y nunca commiteado.
  printf '\nSESSION_SECRET="%s"\n' "$(openssl rand -hex 32)" >> .env.local
  echo "Creé .env.local desde .env.example. Completá ANTHROPIC_API_KEY si querés usar la IA real."
fi

if command -v docker >/dev/null && [ -f docker-compose.yml ]; then
  docker compose up -d db || echo "No pude levantar la base con docker compose; usá la que tengas en DATABASE_URL."
fi

npm ci
npx prisma generate
npm run db:migrate
echo "Entorno listo. Para datos de prueba locales: npm run db:seed"
