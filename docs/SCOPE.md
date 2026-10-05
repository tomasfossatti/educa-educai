# Educai — Alcance del MVP

## Implementado

### Estudiante
- Registro, ingreso y cierre de sesión.
- Onboarding en 5 pasos: consentimiento y "quién ve qué" → contexto → intereses y objetivos → autopercepción → materia (código o invitación).
- Contexto declarado editable, separado y etiquetado como "Declarado".
- Ingreso a materias por código o aceptando invitaciones; selector de materia actual.
- **Inicio**: Ahora (feedback nuevo, actividades pendientes, análisis en curso o fallidos, invitaciones), Tu desarrollo, Próximo paso, Evidencia, Tu contexto.
- **Materia**: qué trabaja la materia (currícula confirmada) y sesiones con el tutor (con foco opcional).
- **Tutor de IA** con streaming, contextualizado por materia, currícula, actividad, contexto declarado y evidencia previa mínima; no resuelve actividades evaluadas; límite diario.
- **Terminar sesión** → evidencia → feedback; eliminar conversación y todo lo derivado.
- **Actividades**: responder consignas estructuradas, declarar asistencia y confianza, borrador, entregar, nuevo intento; producción original inmutable.
- Resultado de cada experiencia: estado del análisis paso a paso, feedback, contraste con lo declarado, inferencias, áreas sin evidencia suficiente, comparación con criterios, evidencia y próximos pasos.
- **Desarrollo**: snapshot con 6 dimensiones (comprensión, aplicación, transferencia, autonomía, consistencia, evolución), cada una con su evidencia; historial de snapshots; conclusiones; evidencia.
- **"¿Por qué Educai cree esto?"** en toda conclusión: evidencia a favor y en contra, señales, respaldo y ajustes, historia de la conclusión, revisión docente.
- Responder a una inferencia (de acuerdo / no de acuerdo / falta contexto).
- Próximos pasos con acción concreta (practicar con el tutor, ir a la actividad, marcar como hecho, descartar).
- Privacidad: qué sabe Educai, de dónde salió, quién lo ve; consentimiento y compartir contexto; eliminar cuenta.

### Docente
- Registro con institución; crear materias con código de ingreso.
- **Currícula**: pegar programa o subir PDF/TXT/MD → mapeo propuesto por IA (conceptos, objetivos, competencias, criterios con cita del programa) → aceptar, editar, descartar, agregar → confirmar. Reprocesar sin perder lo aceptado.
- **Actividades**: crear, editar, publicar y cerrar challenges/prácticas con consignas estructuradas, ítems curriculares y criterios; seguimiento de entregas.
- **Estudiantes**: código, invitaciones por email, lista con estado de onboarding/consentimiento/evidencia, quitar de la materia.
- **Curso** (home): primeros pasos, Requiere atención, Cambios recientes, Brechas, Estudiantes que podrían necesitar intervención, Inferencias pendientes.
- **Atención**: Attention Queue completa y filtros de inferencias (pendientes, contradicciones, falta contexto, todas).
- **Insight de curso** (patrón o brecha): descripción, estudiantes afectados, evidencia, experiencia de origen, concepto, contexto, señales, contradicciones, estado de respaldo, acción sugerida, revisión en línea, intervenciones y seguimiento.
- **Inferencia**: trazabilidad completa, respuesta del estudiante, revisión (confirmar / parcialmente correcto / incorrecto / falta contexto, con comentario obligatorio para incorrecto o falta de contexto), acción sugerida, intervención.
- **Vista de estudiante**: contexto declarado (si lo comparte), snapshot, inferencias, evidencia, entregas, intervenciones.
- **Entrega**: producción original, asistencia declarada, evaluaciones, inferencias y evidencia.
- **Intervenciones**: tipo, descripción, fecha, mensaje a estudiantes (aparece como próximo paso), actividad propuesta; seguimiento de evidencia posterior.
- **Métricas del piloto**.

### Sistema
- Interpretation Engine real con 5 prompts separados y structured outputs; guardas deterministas; persistencia atómica; procesamiento en segundo plano con estados, reintento y expiración de corridas colgadas.
- Development Snapshot determinista e inmutable (historial).
- Attention Queue determinista.
- Autorización por rol, dueño e inscripción; 404 ante recursos ajenos; CSRF en el streaming; secretos solo en servidor.
- AIUsageEvent por llamada con costo estimado; Cost‑Active Students.
- Eventos de producto para activación, engagement, calidad y loop; reporte web y por consola.
- Seed de demostración coherente y separado (`prisma/seed`), con provenance `seed`.
- 31 tests (unitarios + integración contra PostgreSQL).

## Criterios de aceptación

| # | Criterio | Dónde |
| --- | --- | --- |
| 1 | Docente crea una materia | `/t/new` |
| 2 | Carga su programa | Currícula → texto o archivo |
| 3 | IA propone curriculum mapping | Extracción en segundo plano (`curriculum.extract`) |
| 4 | Docente lo revisa | Aceptar / editar / descartar / agregar / confirmar |
| 5 | Estudiante se incorpora | Código o invitación |
| 6 | Completa onboarding | `/s/onboarding` |
| 7 | Conversa con IA en la materia | Materia → Nueva sesión |
| 8 | La conversación genera evidencia | Terminar sesión y generar evidencia |
| 9 | Completa una actividad | Actividades → Entregar |
| 10 | La actividad genera nueva evidencia | Pipeline con evaluación por criterio |
| 11 | Señales e inferencias | Resultados de la experiencia / Desarrollo |
| 12 | Docente ve un problema en la Attention Queue | Curso / Atención |
| 13 | Abre el insight | Insight de curso o inferencia |
| 14 | Inspecciona la evidencia | Evidencia, señales, fuente y provenance |
| 15 | Revisa la inferencia | Formulario de revisión |
| 16 | Registra una intervención | Formulario de intervención |
| 17 | Estudiante recibe feedback/próximo paso | Inicio → Próximo paso ("De tu docente") |
| 18 | Nueva evidencia se relaciona con la anterior | Historial del pipeline, `supersedes`, seguimiento de intervención, Cambios recientes |
| 19 | El snapshot refleja el historial | Desarrollo → Snapshot e Historial |

Verificado en esta implementación: los pasos 1–19 se recorrieron en la interfaz con el `ScriptedProvider`; el seed
cubre el escenario completo; el pipeline está cubierto por tests de integración.

## Fases posteriores (fuera de este MVP)

Según el roadmap del documento de producto, quedan para después de validar el núcleo:

- **Más fuentes de evidencia** e integraciones (LMS, repositorios, documentos externos).
- **Development Map longitudinal completo** entre materias y años; competency graph; transferencia entre materias.
- **Personalización profunda**: challenges adaptativos, dificultad y ayuda ajustadas por evidencia, recommendation engine.
- **Calibración con correcciones docentes**: hoy las revisiones se guardan y se pasan al motor como contexto; falta
  medir y ajustar sistemáticamente (evals, comparación por versión de prompt).
- **Herramientas de reflexión** del estudiante más allá de responder a inferencias.
- **Institutional analytics** y administración institucional (varios docentes por materia, roles de coordinación).
- **Portfolio verificable** basado en evidencia.
- **Infraestructura de escala**: cola persistente para el motor, rate limiting, observabilidad, exportación de datos
  del estudiante, políticas de retención configurables, SSO institucional.
- **Pricing y facturación** por alumno activo (la instrumentación de CAS ya está; el cobro no).

Deliberadamente **no** se construyó: LMS, videoclases, asistencia, ERP, marketplace, red social, sistema de exámenes,
gestor de proyectos, portfolio laboral, chatbot generalista ni score universal de estudiantes.
