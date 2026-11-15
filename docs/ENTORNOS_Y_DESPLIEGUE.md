# Entornos y despliegue

## Entornos

| Entorno | Base de datos | IA | Datos | Quién despliega |
| --- | --- | --- | --- | --- |
| Local (contenedor) | PostgreSQL con pgvector en el contenedor | Guionada por defecto, real con la clave de desarrollo | Sintéticos, con seed permitido | Claude Code |
| CI | Servicio efímero en cada ejecución | Guionada | Sintéticos | GitHub Actions |
| Staging | PostgreSQL gestionado del proveedor | Real, con la clave de staging | Sintéticos, con seed permitido | Automático al fusionar a `main` |
| Producción | PostgreSQL gestionado, con backups diarios | Real, con la clave de producción | Reales, sin seed | Automático tras aprobación de Tomás |

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

- Backup diario automático en producción, con retención de 14 días como mínimo.
- Una vez antes del piloto se restaura un backup en una base vacía y se verifica que la app arranca con esos datos.
- Si una migración falla en producción, el procedimiento es restaurar el backup previo y reportar a Tomás. Claude Code no ejecuta restauraciones en producción por su cuenta.

## Observabilidad

- Logs estructurados sin contenido de conversaciones ni datos personales.
- Métricas de uso de IA por estudiante y por cátedra en `AIUsageEvent`, con alerta al llegar al 80% del tope semanal.
- Una página de estado interna que muestre versión desplegada, migración aplicada y resultado de la última verificación.

## Lista de verificación antes de abrir el piloto

- [ ] Producción desplegada con backups diarios y restauración probada.
- [ ] Sin usuarios de demo ni contraseñas públicas.
- [ ] Límite de intentos de login activo.
- [ ] Aviso de consentimiento y convenio revisados por un abogado.
- [ ] Revisión de seguridad hecha por una persona.
- [ ] Prueba de carga con 60 estudiantes simulados superada.
- [ ] Topes de costo configurados y alerta probada.
