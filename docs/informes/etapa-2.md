# Informe de la etapa 2: auditoría de educa-educai

15 de noviembre de 2026 · Claude Code

## Resumen

La base de educa-educai sirve para el piloto. Tiene un modelo de datos sólido para cátedras, inscripciones, evidencia e inferencias, el motor separa "la IA aporta evidencia" de "el código decide" y registra el costo de cada llamada. Lo que hubo que corregir fue de despliegue y seguridad: `db push` con borrado de datos y seed en cada build, usuarios de demo con contraseña pública, sin límite de intentos de login y 45 errores de lint. Lo que se descarta son experimentos que no figuran en el spec: el servidor MCP con Firestore y tres herramientas de estudio que llaman a la IA sin pasar por la capa de permisos.

## Criterios del spec

| Criterio | Estado | Cómo se comprobó |
| --- | --- | --- |
| La app corre en local y en un entorno de prueba con PostgreSQL | Local y CI: sí. Staging: falta la cuenta del proveedor | `scripts/bootstrap.sh` en limpio; build de producción con Postgres 16; el CI levanta pgvector y corre migraciones, tests y build en cada PR |
| `render.yaml` usa migraciones, sin `db push --accept-data-loss` ni seed en cada build | Hecho (#6) | Build `npm ci && npm run db:migrate && npm run build` probado contra una base vacía |
| Sin usuarios de demo con contraseña pública fuera del entorno local | Hecho (#7) | El seed se niega en producción y contra bases no locales; la contraseña se genera en cada corrida. Tests de `seedBlockReason` |
| Límite de intentos de login | Hecho (#7) | 5 fallos por email o 20 por IP en 15 minutos. Tests unitarios y de integración, y prueba con Playwright: el sexto intento queda bloqueado aun con la contraseña correcta |
| Tests existentes en verde y prueba real de punta a punta con Claude | Tests: sí (57/57). Prueba con Claude: falta la clave de desarrollo | Ver "Pendiente" |
| Informe de qué se conserva, qué se corrige y qué se descarta | Este documento | |

## Qué se conserva

- **Modelo de datos de Prisma** (`Institution`, `User`, `Course`, `Enrollment`, `CourseInvite`, `CurriculumItem`, `AIConversation`, `Message`, motor de interpretación, revisiones, acciones e instrumentación). Cubre las entidades existentes que lista el spec y admite varias cátedras. Los agregados van en `docs/DECISIONES.md` (etapa 1).
- **Capa de IA `src/server/ai`** con proveedor de Anthropic, proveedor guionado para tests y registro de tokens y costo en `AIUsageEvent` por estudiante y por cátedra en cada llamada (`recordUsage`). Cumple las reglas 3 y 9 del `CLAUDE.md`.
- **Motor de interpretación** (`src/server/engine`): salidas validadas con zod, decisión final en código (`src/domain/support-policy.ts`, `snapshot.ts`), consentimiento verificado antes de analizar (`trigger.ts`). Tiene test de integración contra base real.
- **Borrado en cascada** de una experiencia y todo lo derivado (`privacy.ts`), base de V10.
- **Sesiones**: token aleatorio en cookie `httpOnly`, solo el SHA-256 en la base. Contraseñas con hash (`password.ts`).
- **`src/domain/mastery.ts`** con sus tests, como punto de partida para la fórmula de dominio de la etapa 5.
- **Extracción del programa con IA** y aprobación de temas por el docente (`curriculum.ts`, página de currícula): es el paso 2 de "Preparación de la cátedra".
- **Cola de atención** (`attention.ts`), que el spec reutiliza para las alertas de la vista macro.

## Qué se corrige

| Ítem | Motivo | Estado |
| --- | --- | --- |
| `render.yaml` con `db push --accept-data-loss` y seed en el build | Podía borrar datos en cada despliegue y recrear usuarios de demo en producción | Corregido (#6) |
| Script `db:push` en `package.json` | Misma razón; ya estaba prohibido en `.claude/settings.json` | Eliminado (#6) |
| Seed con contraseña fija `educai-demo-2026` y sin guardia de entorno | Contraseña pública en el repositorio; el seed podía correr contra cualquier base | Corregido (#7) |
| Login sin límite de intentos | Fuerza bruta sin freno | Corregido (#7) |
| 45 errores de lint, entre ellos reglas de React (`setState` en efectos, variable usada antes de declararse) | El CI no podía pasar | Corregido (#3) |
| `bootstrap.sh` no cargaba `.env.local` y `docker-compose.yml` no tenía pgvector ni el servicio `db` | El entorno local no quedaba en pie | Corregido (#4) |
| CI sin `TEST_DATABASE_URL` | Los tests de integración se salteaban sin avisar | Corregido (#1) |
| Acciones del docente que consultan Prisma directo con filtros de dueño (`teacher.ts`, `student.ts`) | La regla 1 pide que todo acceso a datos de otro usuario pase por `guards.ts`. Hoy los filtros son correctos, pero están repartidos | Se centraliza en las etapas 3 y 4, junto con los tests V1 a V15 |
| Consentimiento: `consentAnalysisAt` sin fecha de retiro | V11 pide dejar de analizar desde el retiro y quitarle al docente el acceso a las conversaciones | Se agrega `consentWithdrawnAt` en la etapa 3 |
| `defaultModel()` cae a Gemini si hay `GEMINI_API_KEY`, y `DEFAULT_MODEL` es Gemini | El spec fija `@anthropic-ai/sdk`; el modelo no debería depender de qué variables existen | Se corrige con el descarte de Gemini (ver abajo) |
| Textos de la interfaz repartidos en cada componente | La regla 8 pide un solo módulo | Se centralizan a medida que se tocan las pantallas en las etapas 3 a 5 |

## Qué se descarta

| Ítem | Motivo |
| --- | --- |
| `packages/canvas-mcp` (servidor MCP de Canvas con Firestore y heatmap) | Código viejo con Firestore que nada de `src/` usaba. Borrado en #3 |
| Herramientas PageLM, DeepStudent y Get It (`src/app/s/(app)/{pagelm,deep-student,get-it}`, sus componentes y `src/server/actions/{pagelm,deepstudent,getit}.ts`) | No figuran en el spec. Sus acciones del servidor llaman a la IA sin exigir sesión (`getSessionUser()` solo se usa para atribuir el costo, si hay usuario) y sin pasar por `guards.ts` ni por una cátedra: cualquiera que invoque la acción, aun sin cuenta, gasta IA sin que el costo quede atribuido. Guardan datos solo en `localStorage`. El quiz y la pregunta sobre un fragmento del spec se construyen en la etapa 5 sobre las carpetas |
| Estilos "obsidian" y hojas de CSS de rediseños sucesivos (`src/app/styles/*`, `src/components/obsidian`) | Restos de tres rediseños (uno revertido). Se revisan al rehacer las pantallas; se borra lo que quede sin uso |
| Proveedor de Gemini (`src/server/ai/google.ts`) | Fuera del stack del spec. Mantenerlo duplica pruebas y precios sin aportar al piloto |

El descarte de las herramientas de estudio y de Gemini va en un PR aparte, para que se pueda revisar y revertir solo.

## Pendiente

- **Prueba real de punta a punta con Claude.** El entorno de la nube no acepta claves para los hosts de Anthropic como secreto de red, así que hace falta que Tomás cargue la clave de desarrollo como variable `ANTHROPIC_API_KEY` del entorno `educa-educai`. Con eso se corre el flujo completo (programa → temas → conversación → evidencia → panel) con el modelo real y se anota el costo.
- **Staging con PostgreSQL gestionado.** Necesita la cuenta del proveedor y un token limitado a staging (checklist de `CUENTAS_Y_SECRETOS.md`).
- **Base actual de Render.** Si el servicio `educai-mvp` tiene una base creada con `db push`, necesita una línea base de migraciones antes del próximo despliegue (detalle en #6).
