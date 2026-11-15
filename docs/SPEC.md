# Especificación técnica: piloto de Educai

15 de noviembre de 2026 · Tomás

## Propósito y alcance

Este documento traduce la definición de producto de Educai a una especificación que Claude Code pueda construir de punta a punta, y está acotado al primer piloto: una cátedra de una materia. Si el piloto funciona, se suma otra materia con otra cátedra, y así de a una.

### Qué entra en el piloto

- Una institución, una materia, una cátedra con uno o dos docentes y sus estudiantes inscriptos.
- Para cada estudiante, la carpeta de la materia del piloto y la carpeta de su proyecto personal.
- Chat con la IA dentro de cada carpeta, con el material de la cátedra citado por archivo y página.
- Subida opcional de una conversación de otra IA, como .txt o texto pegado.
- Detección de dudas por tema del programa, confirmada por el estudiante.
- Panel del docente con vista macro, ficha por estudiante con evidencia y slides del tema del día.
- Consentimiento explícito, ficha propia visible para el estudiante y registro de cada apertura de una ficha.

### Supuestos del piloto

- La cátedra tiene entre 20 y 60 estudiantes y dura un cuatrimestre.
- El alta de estudiantes se hace por invitación o CSV, sin LMS.
- La universidad que paga autoriza el uso de datos en el convenio del piloto, y cada estudiante da su consentimiento.
- El modelo de datos admite varias cátedras desde el inicio, aunque la interfaz muestre una sola.

## Decisión de arquitectura

Educai se construye sobre educa-educai como núcleo propio, y DeepTutor funciona como especificación de la experiencia del estudiante y fuente de piezas puntuales. No se usa DeepTutor como base del código.

La razón principal es que todo lo construye Claude Code. Un agente trabaja bien en un repositorio que puede recorrer entero, con contratos claros y tests, y trabaja mal en un fork de casi un millón de líneas que cambia varias veces por semana. Además, DeepTutor guarda los datos de cada usuario en su propia carpeta, y el centro de Educai es cruzar los datos de una cátedra para el docente.

### Qué se toma de cada fuente

| Pieza | Fuente | Cómo se usa |
| --- | --- | --- |
| Usuarios, cátedras, inscripciones, consentimiento, evidencia, motor de interpretación, cola de atención | educa-educai | Código base, auditado y corregido antes de sumar funciones |
| Carpetas por materia con contexto, material citado, práctica, dominio por tema y memoria visible | DeepTutor | Especificación de la experiencia, reimplementada en el núcleo |
| Fórmula de dominio con tope por falta de evidencia | DeepTutor, `learning/mastery.py` | Portada con atribución (Apache 2.0) |
| Regla "la IA aporta evidencia, el sistema decide" | DeepTutor y educa-educai | Principio obligatorio del motor |
| Material de la cátedra, asistente docente, herramienta de aula, cliente de Canvas | mcp-siglo | Módulos portados al núcleo |
| Rúbrica de aplicación al proyecto y revisor que pregunta sin recomendar | innovation-decision-studio | Diseño para TPs (después del piloto) |
| Memoria con ciclo de vida y curado sin borrar | hermes-agent y Study-Mate | Referencia de diseño del contexto de carpetas |
| Búsqueda en el material | LlamaIndex o pgvector | Librería estándar, la misma familia que usa DeepTutor |

### Qué de DeepTutor entra en el piloto

Entra en el piloto: carpetas con contexto propio, respuestas que citan archivo y página del material, pregunta sobre un fragmento seleccionado (su "Little Tutor"), quiz corto por tema con registro de intentos, dominio por tema y memoria del estudiante visible y corregible.

Queda para después: libros generados desde el material, lectura inmersiva de video y audio, repetición espaciada con calendario, tablero de tareas, grafo de memoria y exportación a Anki.

Queda afuera: partners en mensajería, agentes externos, ejecución de código, generación de video e investigación científica.

### Estudio de usuario opcional

Mientras se construyen las etapas 1 y 2, se puede montar DeepTutor sin modificar para cinco a diez estudiantes y observar cómo usan las carpetas y el chat. No se conecta con Educai y se descarta al terminar.

## Stack y reglas para Claude Code

Se mantiene el stack de educa-educai y se suma solo lo necesario para buscar en el material.

| Capa | Elección |
| --- | --- |
| App web | Next.js 16 y React 19, un solo repositorio para los dos paneles |
| Datos | PostgreSQL con Prisma 6 y migraciones versionadas |
| Búsqueda en el material | pgvector en la misma base, con fragmentos que guardan archivo y página |
| IA | `@anthropic-ai/sdk` detrás de la capa `src/server/ai`, con el proveedor guionado para tests |
| Validación | zod en cada entrada y en cada salida del modelo |
| Tests | Vitest para unidades e integración, y Playwright para los flujos de punta a punta |
| Despliegue | Render u otro servicio con PostgreSQL gestionado, con migraciones en lugar de `db push` |

### Contenido del CLAUDE.md del repositorio

1. Leer `docs/SPEC.md` (este documento exportado) antes de cada tarea y no implementar nada que no figure ahí sin preguntar.
2. Trabajar por etapas. Una etapa se cierra solo con sus criterios de aceptación cumplidos y los tests en verde.
3. Cambios chicos: un pull request por función, con descripción de qué cambia y cómo se probó.
4. Toda consulta a datos de estudiantes pasa por la capa de permisos. Ningún componente ni acción consulta Prisma directo para datos de otro usuario.
5. Cada regla de visibilidad tiene su test. Un cambio que rompe uno de esos tests no se fusiona.
6. La salida del modelo es evidencia. Se valida con zod y la decisión final la toma código determinístico.
7. Toda respuesta que use el material cita archivo y página. Si no hay fuente suficiente, la IA lo dice y no inventa.
8. Nunca `db push --accept-data-loss` ni seeds en producción. Siempre migraciones.
9. Sin credenciales en el código ni usuarios de demo con contraseña pública fuera del entorno local.
10. Textos de la interfaz en español rioplatense, centralizados para poder traducirlos después.
11. Registrar uso de IA por estudiante y por cátedra para controlar costos.

## Modelo de datos

Se reutiliza el esquema de educa-educai y se agregan seis entidades para carpetas, material, dominio, accesos y clases. Todo dato de estudiante cuelga de un `User` y, cuando corresponde, de un `Course`, que en Educai representa una cátedra.

### Entidades existentes que se usan

| Entidad | Uso en el piloto |
| --- | --- |
| `Institution`, `User`, `Session` | Universidad del piloto, cuentas y sesiones |
| `StudentProfile`, `TeacherProfile` | Perfil del estudiante (carrera, año, proyecto) y del docente |
| `Course`, `Enrollment`, `CourseInvite` | Cátedra, inscriptos y alta por invitación |
| `CurriculumItem` | Temas del programa de la cátedra, aprobados por el docente |
| `AIConversation`, `Message` | Conversaciones dentro de una carpeta o subidas de otra IA |
| `InterpretationRun`, `EvidenceObject`, `Signal`, `Inference` | Motor de interpretación: evidencia, señales de duda e inferencias por tema |
| `TeacherReview`, `StudentResponse` | Revisión del docente y respuesta del estudiante a una conclusión |
| `SuggestedAction`, `Intervention` | Acciones sugeridas al docente y lo que hizo en clase |
| `AIUsageEvent`, `ProductEvent` | Costo de IA y métricas del piloto |

Antes de usarlas hay que confirmar si el consentimiento ya está modelado en `StudentProfile` o en `privacy.ts`, y unificarlo en un solo lugar.

### Entidades nuevas

| Entidad | Campos principales | Relaciones |
| --- | --- | --- |
| `Folder` | `kind` (SUBJECT o PROJECT), `name`, `createdBy` (LMS, MANUAL o SYSTEM) | Pertenece a un `User`. Si es SUBJECT, apunta opcionalmente a un `Course` |
| `FolderContext` | `layer` (TRACE, FACTS o SUMMARY), `content`, `sourceIds`, `editedByStudent` | Pertenece a una `Folder`. Cada hecho enlaza a su evidencia |
| `Material`, `MaterialChunk` | Archivo, versión, texto del fragmento, `page`, `embedding` | Pertenece a un `Course`. Cada fragmento conoce su archivo y página |
| `MasteryRecord` | `score` de 0 a 1, `attempts`, `lastEvidenceAt` | Une `User` y `CurriculumItem` |
| `ClassSession` | Fecha, tema del día, `slidesDraft`, `approvedAt` | Pertenece a un `Course` y apunta a uno o más `CurriculumItem` |
| `AccessLog` | Quién, a quién, qué vista, cuándo | Registra cada apertura de una ficha o de una evidencia |

### Decisiones del modelo

- Una conversación pertenece siempre a una carpeta, sea del chat propio o subida.
- La carpeta del proyecto personal no tiene `Course`. Lo que de ella llega al docente se decide en la capa de permisos.
- Las carpetas creadas a mano que no apuntan a una cátedra del piloto no alimentan ningún panel docente.
- Borrar una conversación borra en cascada su evidencia, señales, inferencias y hechos de contexto derivados.

## Reglas de visibilidad y permisos

Cada regla es un caso verificable y tiene que existir como test antes de cerrar la etapa que la toca. Un error acá es el más grave del producto.

| # | Quién | Qué intenta | Resultado esperado |
| --- | --- | --- | --- |
| V1 | Docente de la cátedra A | Ver la vista macro de A | Permitido |
| V2 | Docente de la cátedra A | Abrir la ficha de un inscripto en A | Permitido y registrado en `AccessLog` |
| V3 | Docente de la cátedra A | Abrir la ficha de un estudiante no inscripto en A | Rechazado |
| V4 | Docente de la cátedra A | Ver la carpeta de una materia B del mismo estudiante | Rechazado |
| V5 | Docente de la cátedra A | Ver la carpeta del proyecto personal | Solo los fragmentos y hechos que la IA vinculó a temas de A, con su evidencia |
| V6 | Docente de la cátedra A | Ver conversaciones de un estudiante que no dio consentimiento | Rechazado, y ese estudiante no cuenta en los porcentajes |
| V7 | Estudiante | Ver su propia ficha | Permitido, con el mismo contenido que ve el docente |
| V8 | Estudiante | Ver datos de otro estudiante | Rechazado |
| V9 | Estudiante | Ver quién abrió su ficha y cuándo | Permitido |
| V10 | Estudiante | Borrar una conversación | Se borran la conversación y todo lo derivado, y los porcentajes se recalculan |
| V11 | Estudiante | Retirar el consentimiento | Se deja de analizar desde ese momento y el docente pierde acceso a sus conversaciones |
| V12 | Chat del docente | Pedir datos de un estudiante de otra cátedra | La herramienta lo rechaza aunque el pedido esté bien formulado |
| V13 | Chat del estudiante | Consultar datos de otro estudiante | La herramienta lo rechaza |
| V14 | Administrador del piloto | Ver conversaciones | Rechazado. Solo gestiona cuentas, cátedras y material |
| V15 | Universidad | Acceder a conversaciones individuales | No existe ese acceso en el piloto |

### Cómo se implementa

- Una sola capa de permisos en `src/server/auth/guards.ts`, con funciones del tipo `canViewStudent(viewer, student, course)`.
- Las herramientas de los chats reciben un contexto ya filtrado por esa capa, nunca el cliente de base de datos.
- Los tests de V1 a V15 corren con usuarios y cátedras de prueba creados en cada ejecución.

## Panel del estudiante

El estudiante entra a sus carpetas, conversa con la IA sobre la materia y su proyecto, y ve lo mismo que su docente ve sobre él.

### Primer ingreso

1. Acepta la invitación de la cátedra y crea su cuenta.
2. Lee el aviso de consentimiento, que explica qué ve el docente (conversaciones, dudas detectadas, perfil y proyecto) y qué no ve nadie más. Acepta o rechaza. Si rechaza, puede usar el chat y el material, pero nada se analiza ni llega al docente.
3. Completa carrera, año y una descripción corta de su proyecto. El cuestionario completo por carrera y la promesa del cursado quedan para después del piloto.
4. Se crean dos carpetas: la de la materia del piloto y la de su proyecto personal.

### Pantalla de inicio

- Sus carpetas, con la última conversación de cada una.
- La próxima clase: tema y objetivo, tomados de la `ClassSession` aprobada por el docente.
- Sus temas con más dudas y una sugerencia de repaso para cada uno.

### Dentro de una carpeta

- **Chat con la IA.** Responde usando el material de la cátedra y cita archivo y página. Si no encuentra fuente, lo dice.
- **Pregunta sobre un fragmento.** Al seleccionar texto de una respuesta o del material, abre un hilo corto sobre ese fragmento sin perder la conversación principal.
- **Quiz por tema.** Tres a cinco preguntas generadas desde el material. Cada intento actualiza su dominio del tema.
- **Subir una conversación externa.** Archivo .txt o texto pegado, hasta 2 MB, que se asigna a esta carpeta.
- **Contexto de la carpeta.** Lo que la IA sabe de él en esta materia, en lenguaje claro. Puede corregir o borrar cualquier hecho.

### Después de cada conversación

El estudiante ve las dudas detectadas, cada una con su tema y el fragmento que la respalda, y puede confirmarla, descartarla o borrar la conversación. Lo confirmado alimenta su resumen y el panel del docente.

### Mi ficha

Muestra exactamente lo que ve el docente: estado por tema, perfil, actividad reciente y evidencia. El estudiante puede responder a una conclusión o marcar que falta contexto, y ve la lista de accesos a su ficha.

## Panel del docente

El docente entra a la carpeta de su cátedra, ve primero la clase completa y baja al detalle de un estudiante solo cuando lo necesita.

### Preparación de la cátedra

1. Carga el programa y los archivos de la materia (PDF, DOCX, PPTX). El sistema los indexa con archivo y página.
2. La IA propone la lista de temas del programa. El docente la edita y la aprueba, y desde ahí queda fija para medir dudas.
3. Carga las fechas de clase y el tema de cada una, o acepta la propuesta de la IA.
4. Invita a los estudiantes por enlace o CSV.

### Vista macro

- **Participación.** Cuántos estudiantes dieron consentimiento y cuántos conversaron esta semana.
- **Temas que no se entienden.** Lista ordenada con frases del tipo "El 40% de la clase no entiende \[tema\]", siempre con el denominador ("8 de 20 estudiantes que conversaron sobre este tema").
- **Dominio por tema.** Distribución de la clase en cada tema del programa.
- **Alertas.** Estudiantes sin actividad o con dudas que se repiten, tomadas de la cola de atención de educa-educai.
- **Tema de hoy.** El de la próxima `ClassSession`, con un botón para generar los slides.

### Ficha por estudiante

Se abre desde un tema, una alerta o la lista de la clase, y cada apertura queda registrada.

- Estado por tema: dominio y dudas confirmadas.
- Perfil y proyecto, y lo que de la carpeta personal se vincula con la materia.
- Actividad reciente: conversaciones, quizzes y subidas.
- Evidencia: cada conclusión enlaza al fragmento de conversación que la respalda.
- Respuestas del estudiante a las conclusiones.

### Slides y herramientas de aula

Desde un tema, el sistema arma un borrador con explicación breve, analogía, ejercicio de cinco minutos y pregunta de chequeo, usando el material de la cátedra y los temas con más dudas. Cada slide cita archivo y página. El docente edita, aprueba y exporta a PowerPoint.

### Chat del docente

Responde preguntas como "¿qué no entendieron esta semana?" o "armame los slides de hoy" usando las mismas vistas del panel, sujeto a las reglas V1 a V6 y V12.

## Motor de análisis y contexto de carpetas

El motor convierte cada conversación en evidencia y señales por tema, y el código decide qué se muestra. La IA nunca marca un tema como entendido por su cuenta.

### Flujo por conversación

1. **Cierre.** Una conversación del chat se procesa al quedar inactiva 20 minutos o al cerrarla. Una subida se procesa al recibirla.
2. **Evidencia.** El modelo extrae fragmentos relevantes y los vincula a temas del programa aprobado, nunca a temas nuevos. Salida validada con zod.
3. **Señales.** Por tema, una señal de duda con confianza (baja, media, alta) y el fragmento que la respalda. Se descartan las de confianza baja.
4. **Confirmación.** El estudiante confirma o descarta. Solo lo confirmado, o lo no respondido en 7 días con confianza alta, entra en los porcentajes del docente.
5. **Agregado.** Por tema y por semana: estudiantes con duda sobre estudiantes que conversaron sobre ese tema.

### Dominio por tema

Se porta la fórmula de DeepTutor: promedio ponderado de los últimos cinco intentos de quiz, con más peso a los recientes, y un tope cuando hay pocos intentos.

```latex
\text{dominio} = \min\left(\frac{\sum_i w_i c_i}{\sum_i w_i},\ \text{tope}(n)\right), \quad w = (0{,}5;\ 0{,}7;\ 0{,}85;\ 0{,}95;\ 1)
```

Donde c es el acierto de cada intento entre 0 y 1, n la cantidad de intentos, y el tope vale 0,5 con un intento, 0,8 con dos y 1 desde tres. Las dudas confirmadas no bajan el puntaje, pero se muestran junto a él.

### Contexto de cada carpeta

Sigue el modelo de tres capas de DeepTutor, guardado en `FolderContext`:

| Capa | Qué guarda | Quién escribe | Entra al prompt |
| --- | --- | --- | --- |
| Traza | Eventos de la carpeta: conversaciones, quizzes, subidas | El sistema, solo agrega | No |
| Hechos | Lo que la IA aprendió del estudiante en esa materia, cada hecho con su evidencia | Un proceso en segundo plano al cerrar cada conversación | Sí |
| Resumen | Perfil corto que cruza carpetas: carrera, proyecto, forma de aprender | El mismo proceso, una vez por día | Sí |

El proceso nunca borra: archiva hechos viejos o contradichos, y respeta lo que el estudiante editó. El prompt de cada carpeta lleva el resumen, los hechos de esa carpeta, los temas del programa y los fragmentos del material que correspondan.

### Costos

Cada llamada registra tokens y costo en `AIUsageEvent`. Se fija un tope semanal por estudiante, y la extracción de evidencia usa un modelo más económico que el chat.

## Etapas de construcción

Seis etapas en orden, y cada una se cierra cuando se cumplen todos sus criterios. Las casillas sirven para marcar el avance.

### Etapa 1: especificación en el repositorio

- [ ] Este documento exportado a `docs/SPEC.md` en el repo de educa-educai.
- [ ] `CLAUDE.md` con las reglas de la sección de stack.
- [ ] Lista de entidades nuevas y cambios al esquema, revisada por Tomás.

### Etapa 2: auditoría de educa-educai

- [ ] La app corre en local y en un entorno de prueba con PostgreSQL.
- [ ] `render.yaml` usa migraciones, sin `db push --accept-data-loss` ni seed en cada build.
- [ ] Sin usuarios de demo con contraseña pública fuera del entorno local.
- [ ] Límite de intentos de login.
- [ ] Tests existentes en verde y una prueba real de punta a punta con Claude, no solo con el proveedor guionado.
- [ ] Informe de qué se conserva, qué se corrige y qué se descarta (por ejemplo, las versiones con Firestore).

### Etapa 3: cátedra, material y carpetas

- [ ] El docente crea la cátedra, carga material, aprueba los temas e invita estudiantes.
- [ ] El estudiante da o rechaza el consentimiento y recibe sus dos carpetas.
- [ ] El chat de la carpeta responde citando archivo y página, y avisa cuando no hay fuente.
- [ ] Subida de .txt o texto pegado asignada a una carpeta.
- [ ] Tests de las reglas V7, V8, V10, V11 y V13.

### Etapa 4: motor y panel del docente

- [ ] Detección de dudas por tema con confirmación del estudiante.
- [ ] Vista macro con porcentajes, denominador y participación.
- [ ] Ficha por estudiante con evidencia, y registro en `AccessLog`.
- [ ] Mi ficha del estudiante idéntica a la del docente, con la lista de accesos.
- [ ] Tests de las reglas V1 a V6, V9, V12, V14 y V15.
- [ ] Prueba con 30 conversaciones etiquetadas a mano: al menos 80% de las dudas detectadas son correctas.

### Etapa 5: quiz, dominio, contexto y slides

- [ ] Quiz por tema con cálculo de dominio.
- [ ] Contexto de carpeta en tres capas, visible y editable por el estudiante.
- [ ] Pregunta sobre un fragmento seleccionado.
- [ ] Slides del tema con citas, editables y exportables a PowerPoint.

### Etapa 6: preparación del piloto

- [ ] Despliegue en producción con backups diarios.
- [ ] Aviso de consentimiento y convenio revisados por un abogado (Ley 25.326).
- [ ] Revisión de seguridad hecha por una persona, con foco en permisos.
- [ ] Tope de costo por estudiante configurado y alerta de consumo.
- [ ] Prueba de carga con 60 estudiantes simulados conversando a la vez.

## Fuera de alcance y expansión

El piloto deja afuera todo lo que no hace falta para probar que el docente cambie su clase con el dato, y el modelo queda listo para sumar cátedras de a una.

### Fuera del piloto

- Integración con Canvas o Moodle por LTI, SSO institucional y creación automática de carpetas desde el LMS.
- Cuestionario de onboarding por carrera, perfiles de la clase y promesa del cursado.
- TPs con rúbrica de aplicación al proyecto y feedback de la IA antes de entregar.
- Roadmap de clases con entregables por tema.
- Libros, lectura inmersiva de video y audio, repetición espaciada y calendario.
- Panel por universidad y comparación entre cátedras.
- Aplicación móvil nativa. El piloto es web adaptable al celular.

### Cómo se suma la segunda cátedra

1. Se crea otro `Course` con su docente, material y temas. No hace falta cambiar el modelo.
2. Los estudiantes que cursan las dos materias reciben una carpeta más, y su resumen cruzado se comparte entre ambas.
3. La regla V5 se vuelve importante: cada docente ve solo lo que la carpeta personal vincula con su materia. Antes de habilitar la segunda cátedra se prueba con estudiantes que cursen las dos.
4. Cada cátedra nueva repite la preparación: material, temas aprobados, consentimiento e invitaciones.

### Cuándo sumar lo que quedó afuera

- **LTI con Canvas o Moodle:** cuando haya tres o más cátedras, porque el alta manual deja de escalar.
- **Onboarding por carrera y perfiles:** cuando haya estudiantes de más de una carrera en la misma cátedra.
- **TPs con rúbrica:** cuando el docente del piloto pida evaluar desde la app.
