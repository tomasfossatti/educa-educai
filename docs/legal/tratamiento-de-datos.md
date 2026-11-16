# Tratamiento de datos personales en el piloto de Educai

15 de noviembre de 2026 · Descripción de lo que hace la app, verificada contra el código del repositorio

## Finalidad

Educai permite que un estudiante converse con una IA sobre una materia y sobre su proyecto personal, con respuestas que citan el material de la cátedra. Si el estudiante da su consentimiento, sus conversaciones se analizan para detectar dudas por tema del programa, que el estudiante confirma o descarta, y el docente de esa materia ve el resultado para ajustar sus clases. El docente ve primero a la clase en conjunto (porcentajes con su denominador) y puede abrir la ficha de un estudiante con nombre.

El piloto es una cátedra de una materia, con 20 a 60 estudiantes, durante un cuatrimestre.

## Qué datos se guardan

| Categoría | Datos | De quién |
| --- | --- | --- |
| Cuenta | Nombre, correo, contraseña (solo su hash scrypt, nunca el texto), rol, fechas de alta | Estudiantes, docentes, administrador |
| Perfil | Carrera, año, descripción corta del proyecto personal, trabajo actual (opcional), de cuál de los dos quiere que salgan los ejemplos, y el contexto que declara de sí mismo (intereses, objetivos, fortalezas, dificultades, forma de trabajar) | Estudiantes |
| Consentimiento | Fecha de aceptación, versión del aviso, fecha de retiro | Estudiantes |
| Cursada | Inscripción a la cátedra; invitaciones (correo invitado y fecha de aceptación) | Estudiantes |
| Conversaciones | Mensajes del chat de cada carpeta, hilos sobre fragmentos, y conversaciones de otra IA que el estudiante sube (texto de hasta 2 MB) | Estudiantes |
| Resultados del análisis | Fragmentos textuales de las conversaciones usados como evidencia, dudas detectadas por tema con su nivel de confianza, conclusiones por tema, confirmaciones y respuestas del estudiante, revisiones y acciones del docente | Estudiantes (y docentes, sus revisiones) |
| Contexto de carpeta | Registro de actividad de la carpeta, hechos que la IA aprendió del estudiante en esa materia (cada uno con su fuente) y un resumen corto que cruza carpetas | Estudiantes |
| Práctica | Intentos de quiz y dominio por tema | Estudiantes |
| Registro de accesos | Quién abrió la ficha o la evidencia de qué estudiante, en qué cátedra y cuándo | Docentes que abren, estudiantes abiertos |
| Uso de la IA | Tokens y costo estimado de cada llamada, atribuidos al estudiante y a la cátedra; alertas de consumo | Estudiantes |
| Métricas de uso | Eventos como "completó el onboarding" o "el docente abrió un tema", sin contenido de conversaciones | Estudiantes y docentes |
| Seguridad | Sesiones (solo el hash del token, vencen a los 30 días) e intentos fallidos de login (correo e IP, se borran a las 24 horas) | Todos |

El material de la cátedra (programa, apuntes, presentaciones) lo carga el docente y no contiene, en principio, datos de estudiantes.

## Quién ve qué

| Quién | Qué ve | Regla y test |
| --- | --- | --- |
| El estudiante | Todo lo suyo: conversaciones, dudas detectadas, ficha (idéntica a la del docente), contexto de cada carpeta y la lista de quién abrió su ficha y cuándo | V7, V9 |
| El docente de la cátedra | Si el estudiante dio consentimiento: vista de la clase, ficha del estudiante con nombre, conversaciones de la carpeta de esa materia, dudas confirmadas (o de confianza alta sin respuesta en 7 días), perfil, y de la carpeta del proyecto solo lo que la IA vinculó con temas de su materia. Cada apertura de ficha o evidencia queda registrada | V1 a V6 |
| El docente de otra materia | Nada de lo de esta materia | V3, V4, V12 |
| Otro estudiante | Nada | V8, V13 |
| El administrador del piloto | Cuentas, cátedras y material. No ve conversaciones | V14 |
| La universidad | No tiene acceso a datos individuales en el piloto | V15 |
| Personas con acceso técnico a producción (hoy, Tomás) | Técnicamente pueden leer la base de producción. No hay otra persona con esas credenciales; el agente que construye el código trabaja sin ellas y solo con datos sintéticos | Reglas 6 y 7 de `CLAUDE.md` |

Cada regla V1 a V15 está escrita en `docs/SPEC.md` y tiene un test automático que corre en cada cambio del código. Todas las consultas a datos de estudiantes pasan por una sola capa de permisos (`src/server/auth/guards.ts`).

## Proveedores que reciben datos

| Proveedor | Qué recibe | Dónde | Estado |
| --- | --- | --- | --- |
| Anthropic (API de Claude) | En cada respuesta del chat: la pregunta, los últimos 12 mensajes de esa conversación, los fragmentos del material que correspondan y el resumen y los hechos de contexto del estudiante. En cada análisis: la conversación completa y los temas del programa | Estados Unidos | Falta revisar sus términos comerciales vigentes (retención de lo enviado y uso para entrenamiento) y si corresponde un acuerdo de procesamiento de datos |
| DeepSeek (API, uso provisorio en lugar de Anthropic) | Lo mismo que Anthropic, si se elige con `AI_PROVIDER=deepseek` | China, según su política de privacidad | Hoy solo con datos sintéticos (desarrollo y staging). Usarlo con estudiantes reales requiere resolver la transferencia internacional |
| Google, API de Gemini en plan gratuito (uso provisorio) | Lo mismo que Anthropic, si se elige con `AI_PROVIDER=gemini` | Servidores de Google | Solo datos sintéticos: en el plan gratuito Google puede usar lo enviado para mejorar sus productos |
| Groq y OpenRouter, planes gratuitos (cadena de respaldo provisoria) | Lo mismo que Anthropic, si se elige con `AI_PROVIDER=fallback` | Estados Unidos; OpenRouter reenvía a proveedores de modelos de distintos países | Solo datos sintéticos: los planes gratuitos pueden registrar o usar lo enviado |
| Proveedor de hosting y base de datos (Render u otro) | Toda la base, sus backups diarios y los logs de la app | A definir al crear producción; los centros de datos disponibles suelen estar fuera de Argentina | Cuenta por crear |
| Webhook de alertas de consumo (Slack o Discord, opcional) | Id interno del estudiante y montos de consumo, sin nombre ni contenido | Según el servicio | Opcional |
| GitHub | Solo el código. El CI usa datos sintéticos | Estados Unidos | Activo |

Hoy la app no manda correos: las invitaciones son por enlace o por una lista CSV que carga el docente.

## Cuánto tiempo se guardan

Lo que la app hace hoy:

- Sesiones: vencen a los 30 días.
- Intentos fallidos de login: se borran a las 24 horas.
- Backups de producción: 14 días como mínimo, según el plan del proveedor.
- Todo lo demás se guarda hasta que el estudiante lo borra (conversaciones, hechos de contexto o la cuenta entera) o indefinidamente. No hay borrado automático al terminar la cursada. Un dato borrado sigue en los backups hasta que vencen (14 días).

Propuesta para que decidan Tomás y el abogado. El mecanismo ya existe (`src/server/services/retention.ts`): cada plazo es una variable de entorno, vacía por defecto, y `npm run retention` muestra qué se borraría antes de aplicarlo con `--apply`. Borra las conversaciones vencidas con todo lo derivado, los quizzes y el dominio, y el registro de accesos, y desvincula el costo de IA de la persona:

| Datos | Plazo propuesto | Qué pasa al vencer |
| --- | --- | --- |
| Conversaciones, resultados del análisis, contexto de carpeta, quizzes | 6 meses después del cierre del cuatrimestre | Se borran |
| Registro de accesos | Igual que lo anterior | Se borra |
| Uso de la IA y métricas de uso | 24 meses | Se desvinculan del estudiante (quedan sin id) |
| Cuenta y perfil | Hasta que el estudiante pida la baja, o 6 meses sin actividad después del cuatrimestre | Se borran |

## Seguridad

- Contraseñas con scrypt; el token de sesión se guarda solo como hash; cookies `httpOnly` y seguras en producción.
- Límite de intentos de login: 5 fallos por correo o 20 por IP en 15 minutos.
- Capa única de permisos con un test por regla de visibilidad, y registro de cada apertura de ficha.
- Los datos reales no salen de producción: desarrollo, CI y staging usan solo datos sintéticos.
- Los logs no incluyen contenido de conversaciones; las alertas de consumo identifican al estudiante solo por id.
- La salida del modelo se valida y la decisión final de qué se muestra la toma código determinístico.
- Antes del piloto hay una revisión de seguridad hecha por una persona, con foco en permisos (`docs/seguridad/`).

## Derechos del titular y cómo se ejercen

| Derecho (Ley 25.326) | Cómo se ejerce hoy |
| --- | --- |
| Acceso (art. 14) | Desde la app: su ficha, sus conversaciones, sus dudas, el contexto de cada carpeta y la lista de accesos a su ficha. Desde "Tu contexto" descarga una copia completa en JSON (perfil, carpetas, conversaciones, dudas, conclusiones, quizzes, dominio y quién abrió su ficha) |
| Rectificación (art. 16) | Edita su perfil y los hechos de contexto de cada carpeta; confirma o descarta cada duda detectada; responde a una conclusión o marca que falta contexto |
| Supresión (art. 16) | Borra cada conversación, con todo lo derivado de ella (evidencia, dudas, conclusiones, hechos de contexto), y los porcentajes se recalculan; borra hechos de contexto. También puede borrar su cuenta completa desde "Tu contexto", escribiendo su correo para confirmar: se borran la cuenta, el perfil, las conversaciones, todo lo derivado, los accesos registrados y las métricas de uso. También se borran las invitaciones con su correo. El registro de costo de IA queda sin vínculo con la persona |
| Oposición al análisis | No acepta el consentimiento o lo retira cuando quiera; desde ese momento no se analiza nada nuevo y el docente pierde acceso |

## Brechas conocidas

1. Los plazos de conservación no están fijados. El mecanismo está listo y apagado (`npm run retention`, variables `RETENTION_*`): cuando el abogado y Tomás decidan los plazos, se cargan en el proveedor y se aplica.
2. El aviso de consentimiento no menciona a los proveedores ni la transferencia internacional (ver `aviso-de-consentimiento.md`).
3. Al retirar el consentimiento, lo ya analizado se conserva para el estudiante. El docente deja de verlo, pero sigue en la base hasta que el estudiante lo borre.
