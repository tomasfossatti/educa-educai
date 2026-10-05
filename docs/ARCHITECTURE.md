# Educai — Arquitectura y decisiones

## 1. Visión general

Un monolito Next.js full‑stack con PostgreSQL. Sin microservicios: la complejidad está en el dominio (evidencia,
interpretación, trazabilidad), no en la infraestructura.

```
Navegador ──► Server Components (lectura) ──► services/ ──► Prisma ──► PostgreSQL
          ──► Server Actions (escritura) ──► guards + Zod ──► Prisma
          ──► /api/tutor/[id] (streaming) ──► ai/ (LLMProvider) ──► Claude
                       after() ─────────────► engine/pipeline ──► ai/ + domain/ ──► Prisma
```

- **`src/domain/`** — lógica pura y testeable, sin base de datos ni IA: política de respaldo, cálculo del snapshot,
  guardas de texto, etiquetas.
- **`src/server/ai/`** — el único lugar que conoce proveedores de LLM. El dominio solo ve `LLMProvider`,
  `generateStructured` y `streamChat`. Cada llamada registra un `AIUsageEvent`.
- **`src/server/engine/`** — Interpretation Engine: orquesta prompts separados, aplica guardas deterministas y persiste.
- **`src/server/services/`** — consultas de lectura (Attention Queue, desarrollo, métricas, privacidad).
- **`src/server/actions/`** — mutaciones. Cada acción autentica, autoriza (dueño/inscripción) y valida con Zod.

## 2. Del modelo conceptual al modelo de datos

| Concepto (documentos) | Tabla(s) | Notas |
| --- | --- | --- |
| User / StudentProfile / TeacherProfile | `User`, `StudentProfile`, `TeacherProfile`, `Session` | Rol fijo por usuario. |
| Institución | `Institution` | Cada docente pertenece a una; cada materia también. |
| **Declared Context** | `StudentProfile.declared*` | Campos con prefijo `declared`: nunca se usan como evidencia. |
| Course / Enrollment | `Course`, `Enrollment`, `CourseInvite` | Ingreso por código o invitación que el estudiante acepta. |
| CurriculumItem / LearningObjective / Competency | `CurriculumItem` con `kind` = CONCEPT, OBJECTIVE, COMPETENCY, CRITERION | Un solo árbol (`parentId`) facilita vincular señales con cualquier tipo de ítem. Incluye `origin`, `status` y `sourceExcerpt` (provenance de la extracción). |
| Experience | `Experience` | Instancia por estudiante: una sesión de tutor o un intento de actividad. |
| AIConversation / Message | `AIConversation`, `Message` | |
| Activity / Challenge / Submission | `Activity` (consignas estructuradas en JSON validado), `Submission` (producción original inmutable al entregar, con asistencia y confianza declaradas) | |
| **Evidence Object** | `EvidenceObject` (+ `EvidenceCurriculumItem`) | estudiante, timestamp, experiencia, fuente, contenido literal, observación neutral, contexto, materia, ítems curriculares, nivel y fuente de asistencia, `provenance` (corrida, modelo, versión de prompt, mensajes/consignas de origen, verificación de cita). |
| Signal | `Signal` | Dimensión (comprensión, aplicación, transferencia, autonomía), polaridad, ítem curricular, descripción y fundamento. |
| **Inference** | `Inference` + `InferenceSupport` | Toda inferencia apunta a señales y Evidence Objects concretos, a favor (`SUPPORTS`) o en contra (`CONTRADICTS`). Guarda el respaldo propuesto por el modelo y el final tras la política, con las notas del ajuste. Versionado con `supersedesId`/`state`. |
| **Evaluation** | `Evaluation` + `EvaluationEvidence` | Comparación con un criterio explícito (CRITERION), separada de la inferencia. |
| TeacherReview | `TeacherReview` | Historial de veredictos; el último se refleja en `Inference.reviewStatus`. |
| Respuesta del estudiante | `StudentResponse` | Agencia del estudiante: puede decir "no estoy de acuerdo" o "falta contexto". |
| Intervention | `Intervention` + `InterventionTarget` | Vinculable a inferencia, insight de curso (`insightKey`), ítem y actividad. `followUpEvidenceAt` cierra el loop. |
| DevelopmentSnapshot / DevelopmentDimension | `DevelopmentSnapshot`, `DevelopmentDimension` | Inmutables: cada análisis agrega uno (historial). Cada dimensión guarda `signalIds`/`evidenceIds`. |
| SuggestedAction | `SuggestedAction` | Para estudiante o docente, originada por el motor o por el docente. |
| Feedback | `Feedback` | Feedback al estudiante por corrida, con las inferencias y evidencias que lo respaldan y `viewedAt`. |
| AIUsageEvent | `AIUsageEvent` | Operación, proveedor, modelo, tokens (incl. caché), costo estimado, latencia, éxito, estudiante, materia y corrida. |
| Eventos de producto | `ProductEvent` | Con `dedupeKey` para "primera vez" y recurrencia diaria. |
| Corrida de interpretación | `InterpretationRun` | Estado, pasos (para la UI de procesamiento), áreas sin evidencia suficiente, error, versión de prompts, origen (`engine`/`seed`). |

## 3. Interpretation Engine

`src/server/engine/pipeline.ts`. Se dispara al terminar una sesión con el tutor o al entregar una actividad
(`engine/trigger.ts`), corre con `after()` después de responder al usuario y la UI muestra el progreso paso a paso.

| Paso | Qué hace | Cómo |
| --- | --- | --- |
| 1. Recibir | Carga la experiencia y la currícula aceptada con refs cortas (C1, O2, R1…). | Determinista |
| 1b. Precheck | Conversaciones muy breves o entregas vacías → `INSUFFICIENT` **sin llamar a la IA**. | Determinista |
| 2. Observar | Qué hizo el estudiante, sin juicios, con cita literal y nivel de asistencia. | Prompt `interpret.observe` |
| — Guarda | La cita debe aparecer literalmente en lo que escribió el **estudiante** (no el tutor). Si no coincide se usa el texto fuente y se marca `excerptVerified: false`; sin mensaje del estudiante, la observación se descarta. | `domain/text-guards.ts` |
| 3. Señales | Características por dimensión/polaridad, vinculadas a la currícula. Refs inválidas se descartan. | Prompt `interpret.signals` |
| 4. Evaluar | Solo entregas con criterios: resultado por criterio con evidencia citada; sin evidencia → `INSUFFICIENT_EVIDENCE`. | Prompt `interpret.evaluate` |
| 5. Historial | Señales previas del estudiante sobre los mismos ítems, inferencias activas con la última revisión docente, y **posibles contradicciones** precalculadas (misma dimensión e ítem, polaridad opuesta). | Determinista |
| 6. Inferir | Hipótesis tentativas con versión para docente y para estudiante, señales a favor/en contra, respaldo propuesto, prioridad, acción docente, inferencia previa que actualiza, y áreas sin evidencia suficiente. | Prompt `interpret.infer` |
| 7. Política de respaldo | Ajusta (nunca sube) el respaldo propuesto: sin evidencia → insuficiente; evidencia opuesta → contradictoria; consistente exige ≥2 evidencias en ≥2 experiencias; conversación sola no demuestra aplicación/transferencia; asistencia alta limita afirmaciones de autonomía. Define qué requiere revisión docente. | `domain/support-policy.ts` |
| 8. Feedback | Feedback breve, contraste respetuoso con lo declarado y 1–3 próximos pasos. Guarda contra falsa precisión: reintento y luego eliminación de oraciones con porcentajes o puntajes sobre la persona. | Prompt `interpret.feedback` |
| 9. Persistir | Todo en **una transacción**: evidencia, señales, evaluaciones, inferencias (+soportes), acciones sugeridas, feedback. | Prisma `$transaction` |
| 10. Después | Snapshot nuevo, eventos de activación, próximos pasos cumplidos, y **cierre del loop**: si hay una intervención previa sobre ese estudiante y tema (o esa actividad), se registra la evidencia posterior. | Determinista |

Propiedades:
- **Structured output**: `client.beta.messages.parse` + `zodOutputFormat(schema)` (validación por schema en el SDK).
  Ninguna salida se parsea de texto libre.
- **Prompts separados por responsabilidad** (`src/server/ai/prompts/*`), con versión registrada en la provenance.
- **Refs cortas** en lugar de IDs: el modelo solo puede citar refs presentes en el mensaje y el código las resuelve;
  lo que no resuelve se descarta. Así ninguna inferencia queda sin evidencia real.
- **Idempotencia**: la corrida se "reclama" con un `updateMany` de `QUEUED → RUNNING`.
- **Fallas**: la corrida queda `FAILED` con el mensaje; el estudiante puede reintentar (crea una corrida nueva).
- **Prompt injection**: los prompts tratan el texto del estudiante como material a analizar, no instrucciones; las
  guardas deterministas (citas literales, refs válidas, política de respaldo, revisión docente) limitan el impacto.

### Estados cualitativos

`CONSISTENT` (evidencia consistente), `PARTIAL` (evidencia parcial), `INSUFFICIENT` (evidencia insuficiente),
`CONTRADICTORY` (señales contradictorias). No hay porcentajes. "Todavía no hay evidencia suficiente" aparece como
estado del snapshot, como `insufficientAreas` de cada corrida y como estado de corrida.

## 4. Development Snapshot

`src/domain/snapshot.ts` — **determinista, sin IA**, para que cada estado se pueda explicar exactamente.

- Agrupa señales vigentes (excluye las que solo respaldan inferencias marcadas como incorrectas por el docente) por
  dimensión e ítem curricular, y ordena por experiencia.
- Por ítem: misma dirección en ≥2 experiencias → consistente; una experiencia → parcial; dificultad → fortaleza →
  mejora; fortaleza → dificultad → contradictoria (señal a examinar); ida y vuelta → contradictoria.
- **Comprensión, Aplicación, Transferencia, Autonomía**: a partir de señales (autonomía suma la distribución de
  asistencia observada/declarada y su tendencia por experiencia, con un criterio conservador).
- **Consistencia**: patrones que se repiten sin cambiar en ≥2 experiencias.
- **Evolución**: mejoras y retrocesos por ítem.
- Cada dimensión guarda las señales y evidencias que la sostienen; la UI permite abrirlas.
- Los snapshots son inmutables: la tabla de historial compara señales nuevas con anteriores.

## 5. Attention Queue

`src/server/services/attention.ts` — determinista sobre inferencias activas (no descartadas por el docente):

1. **Brecha comprensión/aplicación** por ítem: estudiantes con fortaleza en comprensión y dificultad en
   aplicación/transferencia.
2. **Patrón del curso**: ≥2 estudiantes con dificultad en el mismo ítem (alta prioridad con ≥3 o ≥30 %).
3. **Contradicciones** pendientes de revisión.
4. **Dificultades individuales** de prioridad alta.
5. **Seguimiento**: intervenciones con evidencia nueva posterior (últimos 14 días).
6. **Sin evidencia** todavía.

Los ítems con intervención registrada bajan en la cola y muestran si ya hay evidencia posterior. Los insights de
curso se calculan al vuelo con una clave estable (`gap:<ítem>`, `pattern:<ítem>`), así nunca quedan desactualizados.

## 6. Tutor

- Contexto mínimo: materia, conceptos y objetivos aceptados, foco elegido, actividad en curso (que no debe resolver),
  contexto declarado (solo para relevancia de ejemplos, alternando contextos para transferencia) y **solo** las
  inferencias activas sobre el foco de la sesión.
- Pedagogía: preguntas antes de explicaciones, pistas graduales, una idea por mensaje, pedir aplicación.
- Streaming por `ReadableStream` de texto; el mensaje del tutor se persiste al terminar; errores con marcador en el
  stream. Límite diario configurable; protección CSRF por origen; historial acotado.
- **Conversación ≠ evidencia**: la evidencia se genera recién al terminar la sesión, y la política de respaldo impide
  que una conversación sola "demuestre" aplicación.

## 7. Privacidad y permisos

- **Autorización** en `src/server/auth/guards.ts`, usada por toda página y toda acción (no basta con ocultar la UI):
  - estudiante: solo sus datos y materias con inscripción activa;
  - docente: solo sus materias y estudiantes con inscripción activa en ellas;
  - recurso ajeno → 404 (no revela existencia).
- **Separación por institución/materia**: toda evidencia, señal, inferencia y snapshot está anclada a `courseId`.
- **Consentimiento** en el onboarding y editable: sin consentimiento las experiencias se guardan pero la corrida queda
  `SKIPPED` (no se envía nada al modelo para análisis).
- **Minimización**: el docente ve fragmentos convertidos en evidencia y los mensajes referenciados, nunca la
  conversación completa. El contexto declarado solo se comparte si el estudiante lo autoriza. Los comentarios del
  docente no se muestran al estudiante (solo el veredicto). El tutor recibe solo la evidencia previa necesaria.
- **Provenance** en cada Evidence Object, inferencia (corrida, versión de prompts) e ítem curricular (cita del programa).
- **Corrección**: el estudiante edita su contexto y responde a inferencias; el docente las revisa. Una inferencia
  marcada "incorrecta" deja de mostrarse al estudiante y de contar para el snapshot.
- **Eliminación**: borrar una conversación borra en cascada su evidencia, señales, inferencias, feedback y las
  inferencias que queden sin respaldo, y recalcula el snapshot (los anteriores se descartan porque podían resumir
  evidencia eliminada). Borrar la cuenta elimina todos los datos del estudiante.
- **Separación declaraciones/inferencias**: en el modelo (campos `declared*` vs. tablas de evidencia/inferencia) y en
  la UI (etiquetas de capa: Declarado, Observado, Inferido por IA, Evaluado, Docente).
- **Secretos**: la clave de IA solo existe en el servidor (`server-only` en todos los módulos de servidor).

## 8. IA desacoplada y costo

- `LLMProvider` (`src/server/ai/types.ts`) con dos implementaciones: `AnthropicProvider` y `ScriptedProvider`
  (desarrollo/tests). Agregar otro proveedor es implementar la interfaz y registrarlo en `ai/index.ts`.
- Modelo por defecto `claude-opus-5-5`, configurable globalmente o por operación; esfuerzo de razonamiento por
  operación (`ai/config.ts`); caché de prompt en los system prompts; fallback del lado del servidor ante rechazos
  de clasificadores (`server-side-fallback-2026-07-01`).
- Cada llamada (éxito o falla) crea un `AIUsageEvent` con tokens y costo estimado (`ai/pricing.ts`). Con eso se
  calcula **Cost‑Active Students** (estudiantes con costo > 0 en el período) y costo por CAS.

## 9. Instrumentación

Eventos (`src/server/events.ts`): onboarding completado, primera evidencia, feedback visto, día activo (recurrencia),
próximo paso realizado, currícula configurada, primera actividad analizada, insight abierto, inferencia revisada,
intervención registrada, insight → acción, acción → evidencia, corrida terminada. Las métricas de calidad se calculan
desde las tablas (estados de revisión y respaldo), no desde contadores. Vista: **Curso → Métricas del piloto**;
consola: `npm run metrics`.

## 10. Decisiones tomadas donde los documentos no definían

| Decisión | Por qué |
| --- | --- |
| Next.js + PostgreSQL + Prisma, monolito | Lo más simple que sostiene un SaaS con auth, transacciones y JSON. Compatible con Supabase. |
| Auth propia (scrypt + sesiones en DB) | Sin dependencias externas ni proveedores de identidad para un piloto; revocable desde la base. |
| LearningObjective y Competency como `kind` de `CurriculumItem` | Un solo árbol simplifica vincular señales, criterios y actividades con cualquier ítem. |
| La conversación se interpreta al **terminar la sesión** (acción explícita) | Consentimiento visible, costo controlado y una unidad clara de experiencia. |
| El docente ve fragmentos, no conversaciones completas | Minimización y principio de no vigilancia; la trazabilidad se preserva con los mensajes referenciados. |
| Snapshot determinista (sin IA) | Explicabilidad total y costo cero; la IA queda en observar/inferir. |
| Insights de curso calculados al vuelo | No hay estado que se desincronice; siempre reflejan inferencias y revisiones actuales. |
| Política de respaldo en código, separada del modelo | El modelo propone; reglas auditables deciden. Se guardan ambos valores y las notas. |
| Revisión "incorrecta" excluye la inferencia del estudiante y del snapshot | La corrección humana prevalece sobre la inferencia. |
| Comentarios del docente no visibles al estudiante | Pueden contener contexto personal (p. ej. "entregó desde el celular en el trabajo"). |
| El estudiante puede responder a una inferencia | Principio de agencia del estudiante; el docente ve la respuesta junto a la inferencia. |
| Un docente por materia | Suficiente para el piloto "un docente, una materia". |
| Procesamiento con `after()` en el mismo proceso | Evita infraestructura de colas en el MVP; la corrida tiene estados y reintento. |
| `ScriptedProvider` explícito y bloqueado en producción | Permite probar el producto sin clave sin simular features en producción. |
| Tendencia de asistencia conservadora (cambio > 1 nivel) | Evita afirmar "más/menos ayuda" por diferencias menores. |

## 11. Limitaciones conocidas

- La ejecución en segundo plano con `after()` no sobrevive a un reinicio del proceso. Las corridas que quedan en
  curso más de 10 minutos se marcan como fallidas y el estudiante puede reintentarlas, pero no se reencolan solas.
  A escala conviene una cola persistente (p. ej. pg-boss).
- No hay rate limiting de login ni de acciones fuera del límite diario del tutor.
- La extracción curricular desde PDF no guarda el texto del PDF (solo nombre y citas por ítem).
- Las salidas reales de Claude no se ejercitaron en este entorno de desarrollo (no había una clave del proyecto);
  el pipeline se verificó con el `ScriptedProvider`, tests de integración y tipado contra el SDK.
