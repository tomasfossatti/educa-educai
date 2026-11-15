# Entornos y despliegue

## Entornos

| Entorno | Base de datos | IA | Datos | Quién despliega |
| --- | --- | --- | --- | --- |
| Local (contenedor) | PostgreSQL con pgvector en el contenedor | Guionada por defecto, real con la clave de desarrollo | Sintéticos, con seed permitido | Claude Code |
| CI | Servicio efímero en cada ejecución | Guionada | Sintéticos | GitHub Actions |
| Staging | PostgreSQL gestionado del proveedor | Real, con la clave de staging | Sintéticos, con seed permitido | Automático al fusionar a `main` |
| Producción | PostgreSQL gestionado, con backups diarios | Real, con la clave de producción | Reales, sin seed | Automático tras aprobación de Tomás |

## Staging

- Proyecto `educai-staging` en Vercel, conectado a este repositorio. Solo se construye `main`: cada fusión despliega staging; las demás ramas no generan despliegues (paso de construcción ignorado).
- Base: Neon `educai-staging` (plan gratuito, región São Paulo `gru1`), conectada al proyecto. Vercel inyecta `DATABASE_URL` (con pooler) para la app y `DATABASE_URL_UNPOOLED` para las migraciones, que corren en el build solo en el entorno `production` del proyecto.
- Funciones en `gru1`, junto a la base. Node 22.
- Contraseña de sitio: `SITE_PASSWORD` (variable sensible del proyecto; copia en `.secrets/staging/SITE_PASSWORD`). El navegador la pide con cualquier usuario. `/api/health` queda abierto para el chequeo. Sin la variable, la app no pide nada (local, CI y producción).
- IA: proveedor guionado hasta cargar la clave del proveedor real.
- Prueba de humo: `npm run test:staging` recorre con la interfaz el flujo docente → material → estudiante con consentimiento → pregunta con cita, y el chequeo de salud. Lee la contraseña de `.secrets/staging/SITE_PASSWORD` o de `STAGING_SITE_PASSWORD`. Crea cuentas sintéticas con correos `@test.educai`.
- Límite propio de Vercel: un pedido no puede superar 4,5 MB, así que en staging el material de la cátedra se sube en archivos de hasta ese tamaño (en local y en producción el límite es 20 MB).

## Producción (propuesta)

Igual que staging, en la misma cuenta: un proyecto `educai` en Vercel y una base Neon `educai-prod` en São Paulo, sin contraseña de sitio y con el proveedor de IA real. Lo único que cambia de fondo es el respaldo de la base: el spec pide backup diario con al menos 14 días de historia. El plan gratuito de Neon guarda un historial de restauración corto, de horas, que no alcanza; los planes pagos lo extienden. Elegir el plan es la decisión de Tomás; el resto (proyecto, variables, migraciones, chequeo de salud y la prueba de restauración) lo hace Claude Code. El despliegue a producción sigue necesitando la aprobación de Tomás.

Alertas de consumo: el webhook se crea en un canal propio (en Discord: configuración del canal → Integraciones → Webhooks → Nuevo webhook → Copiar URL) y se pega como variable sensible `AI_ALERT_WEBHOOK_URL` en el proyecto de Vercel.

## Flujo de cambios

1. Claude Code trabaja en una rama y abre un PR.
2. El CI corre lint, tipos, tests y build. Sin verde no hay fusión (rama `main` protegida).
3. Claude Code fusiona. Staging se despliega solo y aplica las migraciones pendientes.
4. Claude Code corre los flujos de punta a punta contra staging y registra el resultado en `PROGRESO.md`.
5. Para producción se dispara el despliegue desde GitHub. El entorno `production` exige la aprobación de Tomás, que revisa el listado de cambios y las migraciones incluidas antes de aprobar.

## Migraciones

- Siempre con `prisma migrate dev` en local y `prisma migrate deploy` en los demás entornos. Nunca `db push`.
- Cada migración se revisa como código. Las que borran columnas, tablas o datos se separan en dos pasos (primero se deja de usar, después se elimina) y requieren aprobación explícita de Tomás en el PR.
- Antes de aplicar una migración en producción, el proveedor toma un backup, y la etapa 6 deja probado el procedimiento de restauración.
- `render.yaml` se corrige en la etapa 2: sin `db push --accept-data-loss` y sin seed en el build.

## Variables de entorno

`.env.example` es el catálogo. Cada entorno define las mismas variables con sus propios valores. Producción exige además `SESSION_COOKIE_SECURE=true`, un `SESSION_SECRET` propio de al menos 32 bytes y los topes de gasto de IA activados.

## Backups y recuperación

- Backup diario automático en producción, con retención de 14 días como mínimo. Lo hace el proveedor de la base: hay que elegir un plan de PostgreSQL que lo incluya.
- Los backups de producción no salen de producción: ni a GitHub, ni a staging, ni a una computadora del equipo (regla 7 de `CLAUDE.md`).
- `scripts/backup-db.sh` hace un backup lógico (`pg_dump`, formato custom) con suma de verificación. Sirve para un backup manual antes de una migración y para la prueba de restauración.
- `scripts/restore-check.sh` restaura un backup en una base vacía y verifica, sin mostrar contenido: suma de verificación, migraciones al día con el código, cantidad de filas por tabla igual a la de origen (si se pasa `RESTORE_COMPARE_URL`) y que la app arranca con esa base (`/api/health` y `/login`). Al terminar borra la base temporal.
- El CI corre el ciclo completo en cada PR con los datos sintéticos de los tests (job `verificar`, paso "Backup y restauración").
- Si una migración falla en producción, el procedimiento es restaurar el backup previo y reportar a Tomás. Claude Code no ejecuta restauraciones en producción por su cuenta.

### Prueba de restauración en producción (una vez antes del piloto, la hace Tomás)

1. En el panel del proveedor, confirmar que la base de producción tiene backup diario y que la retención es de 14 días o más.
2. Restaurar el backup más reciente en una base nueva del mismo proveedor (opción "restaurar en una instancia nueva" o equivalente). La base nueva queda en la cuenta de producción.
3. Desde la consola del servicio web de producción (shell del proveedor), con la URL de la base nueva:
   `DATABASE_URL=<url de la base restaurada> npx prisma migrate status` tiene que decir que está al día, y
   `DATABASE_URL=<url de la base restaurada> PORT=3400 npm start &` seguido de `curl -s localhost:3400/api/health` tiene que devolver `"ok":true`.
   Si la consola tiene `pg_dump` y el usuario puede crear bases, alcanza con `scripts/backup-db.sh /tmp/prod.dump && RESTORE_ADMIN_URL=<url del servidor con la base postgres> RESTORE_COMPARE_URL=$DATABASE_URL scripts/restore-check.sh /tmp/prod.dump`, y después `rm /tmp/prod.dump*`.
4. Borrar la base restaurada y anotar en `docs/PROGRESO.md` la fecha, cuánto tardó y el resultado.

## Plazos de conservación

Los plazos los deciden Tomás y el abogado (`docs/legal/tratamiento-de-datos.md`). Se cargan como variables `RETENTION_CONVERSATION_DAYS`, `RETENTION_ACCESS_LOG_DAYS` y `RETENTION_AI_USAGE_DAYS` (mínimo 30 días; vacías, no se borra nada). `npm run retention` muestra cuánto se borraría y `npm run retention -- --apply` lo aplica. Mientras no haya un cron en el proveedor, se corre a mano una vez por mes y se anota en `PROGRESO.md`. Un dato borrado sigue en los backups hasta que vencen.

## Observabilidad

- Logs estructurados sin contenido de conversaciones ni datos personales.
- Métricas de uso de IA por estudiante y por cátedra en `AIUsageEvent`, con alerta al llegar al 80% del tope semanal.
- `/api/health` devuelve si la app llega a la base, la última migración aplicada y la versión desplegada (`VERCEL_GIT_COMMIT_SHA` o `RENDER_GIT_COMMIT`), sin datos de nadie. El proveedor la usa como chequeo de salud (`healthCheckPath` en `render.yaml`).

## Lista de verificación antes de abrir el piloto

- [ ] Producción desplegada con backups diarios y restauración probada.
- [ ] Sin usuarios de demo ni contraseñas públicas.
- [ ] Límite de intentos de login activo.
- [ ] Aviso de consentimiento y convenio revisados por un abogado.
- [ ] Revisión de seguridad hecha por una persona.
- [ ] Prueba de carga con 60 estudiantes simulados superada.
- [ ] Topes de costo configurados y alerta probada.
