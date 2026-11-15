@AGENTS.md

# Educai: reglas para Claude Code

Educai es una app para que estudiantes conversen con una IA organizada en carpetas por materia y para que el docente vea a su clase por tema, con detalle por estudiante, consentimiento explícito y registro de accesos. Este repositorio lo construye Claude Code de punta a punta. Tomás Fossatti decide el producto y aprueba los pasos que figuran en `docs/AUTONOMIA.md`.

## Antes de tocar nada

1. Leé `docs/SPEC.md` completo. Es la fuente de verdad del producto. Si algo no figura ahí, no lo implementes sin preguntar.
2. Leé `docs/PROGRESO.md` para saber en qué etapa estás y qué quedó pendiente.
3. Leé `docs/AUTONOMIA.md` para saber qué podés hacer solo y qué necesita a Tomás.

## Cómo se trabaja

- Una etapa por vez, en el orden de `docs/SPEC.md`. Una etapa se cierra cuando se cumplen todos sus criterios y los tests están en verde. Marcá las casillas en `docs/PROGRESO.md`, no en el spec.
- Una rama y un pull request por función, con descripción de qué cambia y cómo se probó. Nunca se commitea a `main` directo.
- Antes de abrir un PR corré `npm run lint`, `npm run typecheck` y `npm test`. Si falla algo, se arregla antes de seguir.
- Cada decisión que no estaba en el spec va a `docs/DECISIONES.md` con fecha, alternativas y motivo, en pocas líneas.
- Next.js 16 cambia APIs respecto de lo que sabés. Leé la guía correspondiente en `node_modules/next/dist/docs/` antes de escribir código de rutas, caché o servidor.

## Reglas que no se negocian

1. Toda consulta a datos de estudiantes pasa por `src/server/auth/guards.ts`. Ningún componente ni acción consulta Prisma directo para datos de otro usuario.
2. Cada regla de visibilidad V1 a V15 tiene su test. Un cambio que rompe uno de esos tests no se fusiona.
3. La salida del modelo es evidencia. Se valida con zod y la decisión final la toma código determinístico.
4. Toda respuesta que use el material cita archivo y página. Si no hay fuente suficiente, la IA lo dice y no inventa.
5. Nunca `prisma db push` ni seeds fuera del entorno local. Siempre migraciones versionadas.
6. Ninguna credencial en el código, en los logs ni en los mensajes de commit. Secretos solo en `.env.local`, en `.secrets/` o en las variables del proveedor.
7. Datos reales de estudiantes nunca salen de producción. En local, en CI y en staging se usan solo datos sintéticos generados por las fábricas de `tests/support`.
8. Textos de la interfaz en español rioplatense, centralizados en un solo módulo para poder traducirlos.
9. Cada llamada a la IA registra tokens y costo en `AIUsageEvent`, por estudiante y por cátedra.
10. Si un test de permisos falla y no sabés por qué, parás y lo registrás en `docs/PROGRESO.md`. No se baja la regla para que el test pase.

## Comandos útiles

- `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`
- `npm run db:migrate:dev` para crear una migración nueva en local, `npm run db:migrate` para aplicarlas
- `npm run db:seed` y `npm run db:reset` solo en local o en la base de pruebas
- `scripts/bootstrap.sh` arma el entorno local desde cero

## Dónde está cada cosa

- `docs/SPEC.md`: qué se construye. `docs/ETAPAS_PROMPTS.md`: cómo arrancar cada etapa.
- `docs/AUTONOMIA.md`: permisos y puertas humanas. `docs/CUENTAS_Y_SECRETOS.md`: cuentas, tokens y contraseñas.
- `docs/PRUEBAS.md`: estrategia de tests y datos sintéticos. `docs/ENTORNOS_Y_DESPLIEGUE.md`: entornos, migraciones y despliegue.
