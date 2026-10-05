# Educai — MVP

Plataforma de inteligencia educativa que convierte la evidencia que los estudiantes generan al aprender
(conversaciones con un tutor de IA y actividades estructuradas) en información **trazable** para estudiantes
y docentes.

El MVP existe para validar una hipótesis:

> ¿Educai puede convertir evidencia educativa real en información suficientemente útil, trazable y confiable como para cambiar una decisión docente?

Implementa el loop **Experience → Evidence → Interpretation → Feedback/Action → New Experience** y mantiene
separadas las capas **Declarado → Observado → Inferido → Evaluado**, en el modelo de datos y en la interfaz.

- Arquitectura y decisiones: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Qué quedó implementado y qué es de fases posteriores: [`docs/SCOPE.md`](docs/SCOPE.md)

---

## Stack

| Capa | Elección |
| --- | --- |
| Aplicación | Next.js 16 (App Router, Server Components, Server Actions, Route Handlers) + React 19 + TypeScript estricto |
| Base de datos | PostgreSQL 16 + Prisma 6 (migraciones versionadas en `prisma/migrations`) |
| Autenticación | Propia: contraseñas con scrypt, sesiones en base de datos (cookie httpOnly con token aleatorio; en la base solo su SHA‑256) |
| Validación | Zod en todas las acciones del servidor y en todas las salidas de IA |
| IA | Claude (Anthropic SDK oficial) detrás de una interfaz `LLMProvider`; structured outputs validados por schema |
| UI | Tailwind CSS 4, componentes propios mínimos |
| Tests | Vitest (unitarios de dominio + integración del pipeline contra PostgreSQL) |

## Requisitos

- Node.js ≥ 20.9 (probado con Node 26)
- PostgreSQL 16 (incluido `docker-compose.yml`, o cualquier Postgres: Supabase, Neon, RDS…)
- Una API key de Anthropic para usar el tutor y el Interpretation Engine reales

## Instalación

```bash
npm install
```

> npm 11 bloquea los scripts de instalación por defecto. `package.json` ya incluye `allowScripts` para Prisma y esbuild
> (necesarios para descargar el motor de Prisma). Si cambiás de versión de Prisma, aprobá los scripts con
> `npm install-scripts approve prisma @prisma/client @prisma/engines`.

```bash
cp .env.example .env
```

Editá `.env` (ver tabla de variables). Para levantar Postgres local con Docker:

```bash
docker compose up -d
```

Aplicá las migraciones y cargá el escenario de demostración:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

Levantá la aplicación:

```bash
npm run dev
```

Abrí http://localhost:3000.

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Conexión PostgreSQL. |
| `ANTHROPIC_API_KEY` | Para IA real | Clave del servidor. Nunca se expone al cliente. Sin clave, la app funciona pero muestra el estado "IA no configurada": se guardan conversaciones y entregas, y su análisis queda como fallido con opción de reintentar. |
| `AI_PROVIDER` | No | `anthropic` (por defecto) o `scripted` (proveedor determinista solo para desarrollo/tests; bloqueado en producción). |
| `AI_MODEL` | No | Modelo para todas las operaciones. Por defecto `claude-opus-5-5`. |
| `AI_MODEL_<OPERACION>` | No | Sobrescribe el modelo de una operación, p. ej. `AI_MODEL_TUTOR_REPLY=claude-sonnet-5-5` o `AI_MODEL_INTERPRET_OBSERVE=...`. |
| `AI_DAILY_TUTOR_MESSAGES` | No | Límite diario de mensajes al tutor por estudiante (control de costo). Por defecto 150. |
| `SESSION_COOKIE_SECURE` | Producción | `true` detrás de HTTPS. |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Producción multi‑instancia | Clave estable para Server Actions si hay más de una instancia. |
| `TEST_DATABASE_URL` | Tests de integración | Base PostgreSQL **separada** (se vacía en cada corrida). |

## Usuarios de demostración

Después de `npm run db:seed` (contraseña para todos: `educai-demo-2026`):

| Rol | Email | Qué muestra |
| --- | --- | --- |
| Docente | `docente@demo.educai.test` | Attention Queue con patrón de curso, brecha comprensión/aplicación, contradicción, seguimiento post‑intervención, inferencias pendientes, métricas |
| Estudiante | `lucia@demo.educai.test` | Evolución completa: dificultad → conversación con guía → intervención → práctica en otro contexto (mejora + primera señal de transferencia); contraste con lo declarado ("me cuestan los datos") |
| Estudiante | `valentina@demo.educai.test` | Señales contradictorias en segmentación, su respuesta "falta contexto", práctica pendiente propuesta por la docente |
| Estudiante | `mateo@demo.educai.test` | Dificultad en problema vs. solución (prioridad alta), feedback sin leer |
| Estudiante | `joaquin@`, `camila@`, `sofia@` | Mejora parcial; revisión "falta contexto"; evidencia consistente en dos contextos |
| Estudiante | `martin@`, `julieta@` | Sin evidencia todavía (Julieta sin consentimiento de análisis) |

Código de la materia demo: `DEMO26`. Todo lo creado por el seed queda marcado con `origin: "seed"` en su provenance
y la interfaz lo muestra como "Dato de demostración".

## Recorrido del MVP (criterios de aceptación)

1. Registrate como docente → **Crear materia**.
2. En **Currícula**, pegá el programa (o subí PDF/TXT/MD) → **Proponer mapeo curricular con IA**.
3. Revisá: aceptá, editá, descartá o agregá ítems → **Confirmar currícula**.
4. En **Actividades**, creá y publicá un challenge con consignas y criterios.
5. En **Estudiantes**, compartí el código o invitá por email.
6. Registrate como estudiante (otra ventana privada) → onboarding (consentimiento, contexto, intereses, objetivos, autopercepción, código).
7. En **Materia**, iniciá una sesión con el tutor, conversá y **Terminar sesión y generar evidencia**.
8. En **Actividades**, respondé el challenge (declarando la ayuda usada) → **Entregar**.
9. Educai procesa en segundo plano (estado visible paso a paso) y muestra feedback, inferencias, evaluación por criterio, evidencia y próximos pasos.
10. Como docente: **Curso** / **Atención** → abrí un insight → inspeccioná la evidencia → **revisá** la inferencia (confirmar / parcialmente / incorrecto / falta contexto) → **registrá una intervención** (con mensaje o actividad para los estudiantes).
11. El estudiante ve el próximo paso de su docente; su nueva evidencia queda relacionada con la intervención (seguimiento en el insight y en la cola).
12. **Desarrollo** muestra el snapshot por dimensión (con su evidencia) y el historial.

En cualquier conclusión, el enlace **"¿Por qué Educai cree esto?"** abre la cadena completa: evidencia → señales → inferencia → respaldo → contradicciones → revisión humana.

## Modo de prueba sin API key

```bash
AI_PROVIDER=scripted npm run dev
```

Usa `ScriptedProvider`: salidas deterministas y válidas contra cada schema, que citan texto real del estudiante.
Sirve para recorrer la interfaz y probar el pipeline sin costo. **No interpreta**: la interfaz muestra un aviso
permanente y el servidor lo rechaza en producción.

## Tests

Unitarios (política de respaldo, guardas de texto, snapshot):

```bash
npm run test:unit
```

Suite completa, incluida la integración del Interpretation Engine contra una base real (se vacía):

```bash
TEST_DATABASE_URL="postgresql://educai:educai@localhost:5432/educai_test" npm test
```

Con el `docker-compose.yml` incluido, la base `educai_test` se crea automáticamente. Aplicale las migraciones una vez:

```bash
DATABASE_URL="postgresql://educai:educai@localhost:5432/educai_test" npx prisma migrate deploy
```

Otros chequeos:

```bash
npm run typecheck
```

```bash
npm run lint
```

## Métricas del piloto

En la app: **Curso → Métricas del piloto**. Por consola (todas las materias o una, con período en días):

```bash
npm run metrics
```

## Producción

```bash
npm run build
```

```bash
npm run db:migrate && npm run start
```

Configurá `SESSION_COOKIE_SECURE=true`, `ANTHROPIC_API_KEY` y, con varias instancias, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.
El análisis de evidencia corre con `after()` en el mismo proceso: en plataformas serverless conviene configurar
`maxDuration` suficiente o mover la ejecución a una cola (ver `docs/ARCHITECTURE.md`).

## Estructura

```
prisma/
  schema.prisma          Modelo de datos (capas declarado/observado/inferido/evaluado)
  migrations/            Migraciones SQL versionadas
  seed/                  Escenario de demostración (separado de la lógica real)
src/
  domain/                Lógica pura: política de respaldo, snapshot, guardas de texto, etiquetas
  server/
    ai/                  Interfaz de proveedor, Anthropic, ScriptedProvider, precios, prompts por responsabilidad
    engine/              Interpretation Engine (pipeline, disparador, snapshot)
    services/            Lecturas: atención, desarrollo, currícula, métricas, privacidad
    actions/             Server Actions (auth, estudiante, docente) con validación y autorización
    auth/                Contraseñas, sesiones y guards de autorización
  app/
    (auth)/              Ingreso y registro
    s/                   Producto del estudiante (Inicio, Materia, Actividades, Desarrollo, Tu contexto)
    t/                   Producto del docente (Curso, Atención, Estudiantes, Actividades, Currícula)
    api/tutor/           Streaming del tutor
  components/            UI mínima y componentes de dominio
tests/                   Unitarios e integración
scripts/                 Métricas por consola
```
