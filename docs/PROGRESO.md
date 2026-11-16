# Progreso

Claude Code actualiza este archivo al terminar cada sesión. Tomás lo lee una vez por etapa.

## Estado actual

- Etapa en curso: 6, y en paralelo la simplificación del panel del estudiante (pedido de Tomás del 2026-11-16). Abiertas: 2 (prueba con IA real) y 6 (producción). La 1, la 3, la 4 y la 5 están cerradas. En la 6, Tomás descartó el abogado y la revisión de seguridad externa.
- Staging: https://educai-staging.vercel.app (Vercel + Neon, con contraseña de sitio). IA real con la cadena de respaldo gratuita (Groq y OpenRouter); `npm run test:staging` en verde con IA real.
- IA real: cadena de proveedores gratuitos (`AI_PROVIDER=fallback`: Groq, Gemini, OpenRouter). DeepSeek queda en la cadena para cuando tenga saldo. Planes gratuitos: solo datos sintéticos.
- Asistente del LMS (pedido de Tomás, fuera del spec original): docente y estudiante conectan Canvas o Moodle y piden por chat "crea la materia «Costos de proyectos»"; Educai la arma y baja módulos y lecturas. Para Canvas sin tokens (Siglo 21) hay una extensión de navegador que se vincula con un código y mantiene la sesión. Primera prueba real de Tomás con «Costos de proyectos»: se conectó y bajó las 16 lecturas, pero como texto; corregido para que baje el PDF y confirmado por Tomás en staging (ver `DECISIONES.md`, 2026-11-16).
- Pasos que dependen de Tomás:
  1. Decidir si el docente debe ver las dudas sin confirmar o descartadas. Hoy el detalle de una evidencia (`getEvidenceDetail`, `src/server/services/development.ts`) las lista todas, y las estadísticas de la clase (`getCourseOverview`, `src/server/services/attention.ts`) las cuentan todas. Los porcentajes de la vista macro y la ficha ya cuentan solo lo que llega al docente (`countsForTeacher`). No se tocó porque es del panel del docente; la frase del consentimiento quedó escrita para que sea verdadera con el comportamiento actual.
  2. Producción: decidir el plan de la base (ver `ENTORNOS_Y_DESPLIEGUE.md`, "Producción"). Claude Code arma el proyecto igual que staging.

## Etapas

### Etapa 1: especificación en el repositorio
- [x] `docs/SPEC.md` exportado en el repositorio
- [x] `CLAUDE.md` con las reglas
- [x] Lista de entidades nuevas y cambios al esquema, revisada por Tomás (escrita en `DECISIONES.md`; Tomás la dio por revisada el 2026-11-16)

### Etapa 2: auditoría de educa-educai
- [x] La app corre en local y en un entorno de prueba con PostgreSQL (staging en Vercel con Neon; `npm run test:staging` pasa el flujo completo)
- [x] `render.yaml` usa migraciones, sin `db push --accept-data-loss` ni seed en cada build
- [x] Sin usuarios de demo con contraseña pública fuera del entorno local (#7)
- [x] Límite de intentos de login (#7)
- [ ] Tests existentes en verde y prueba real de punta a punta con Claude
- [x] Informe de qué se conserva, qué se corrige y qué se descarta (`docs/informes/etapa-2.md`)

### Etapa 3: cátedra, material y carpetas
- [x] El docente crea la cátedra, carga material, aprueba temas e invita estudiantes
- [x] El estudiante da o rechaza el consentimiento y recibe sus dos carpetas
- [x] El chat de la carpeta cita archivo y página, y avisa cuando no hay fuente
- [x] Subida de .txt o texto pegado asignada a una carpeta
- [x] Tests de V7, V8, V10, V11 y V13

Cómo se comprobó (etapa 3): tests de integración contra Postgres (`visibility-stage3`, `material`, `folder-chat`) y un recorrido con Playwright sobre el build de producción. En ese recorrido, el docente sube PDF y PPTX y quedan indexados. Una estudiante nueva se registra, elige "Acepto" (no viene premarcado) y ve sus dos carpetas. Pregunta y recibe "[1] programa.pdf, pág. 2"; pregunta algo fuera del material y se le avisa "Sin fuente"; sube una conversación pegada. Todo con el proveedor guionado. La prueba con Claude real queda junto con la de la etapa 2 (falta la clave).

### Etapa 4: motor y panel del docente
- [x] Detección de dudas por tema con confirmación del estudiante
- [x] Vista macro con porcentajes, denominador y participación
- [x] Ficha por estudiante con evidencia y registro en `AccessLog`
- [x] Mi ficha idéntica a la del docente, con la lista de accesos
- [x] Tests de V1 a V6, V9, V12, V14 y V15
- [x] 30 conversaciones etiquetadas, al menos 80% de las dudas detectadas son correctas. Medición preliminar con Gemini (`gemini-3.5-flash-lite`): **precisión 95,8%, cobertura 100%** (`docs/informes/precision-preliminar-gemini.md`). Tomás dio por revisada la muestra de `docs/informes/etiquetas-muestra.md` el 2026-11-16.

### Etapa 5: quiz, dominio, contexto y slides
- [x] Quiz por tema con cálculo de dominio
- [x] Contexto de carpeta en tres capas, visible y editable
- [x] Pregunta sobre un fragmento seleccionado
- [x] Slides del tema con citas, editables y exportables a PowerPoint

Cómo se comprobó (etapa 5): cada función tiene tests unitarios y de integración, y un flujo de Playwright en `tests/e2e` que corre en el CI (job `e2e`) sobre el build de producción con datos sintéticos:
- `quiz.spec.ts`: quiz con fuente, respuestas ocultas hasta entregar y dominio con tope.
- `context.spec.ts`: hechos y resumen, corrección, historial y borrado.
- `fragment.spec.ts`: selección de texto, hilo lateral y conversación principal intacta.
- `slides.spec.ts`: generación, edición, aprobación, PowerPoint con fuentes y próxima clase en el inicio del estudiante.
Todo con el proveedor guionado; la calidad de los textos del modelo real queda para cuando haya clave.

### Etapa 6: preparación del piloto
- [ ] Producción con backups diarios y restauración probada (scripts y procedimiento listos, restauración probada en local y en el CI con datos sintéticos: `docs/informes/restauracion-local.md`; falta crear producción, activar el backup diario y hacer la prueba allá, ver `ENTORNOS_Y_DESPLIEGUE.md`)
- [~] Aviso de consentimiento y convenio revisados por un abogado (Ley 25.326): descartado por decisión de Tomás (2026-11-15, ver `DECISIONES.md`). Los documentos de `docs/legal/` quedan como referencia.
- [~] Revisión de seguridad hecha por una persona: descartada por decisión de Tomás (2026-11-15, ver `DECISIONES.md`). El paquete de `docs/seguridad/` queda como referencia.
- [x] Tope de costo por estudiante y alerta de consumo (2 USD por semana y estudiante, aviso al 80%, alertas por log y webhook; falta que Tomás cree el webhook y lo cargue en `AI_ALERT_WEBHOOK_URL`)
- [x] Prueba de carga con 60 estudiantes simulados (`docs/informes/carga-etapa-6.md`: sin errores ni pérdida de datos; con 2 CPU cumple todos los criterios, con 1 CPU el login simultáneo de los 60 tarda 7 s)

### Simplificación del panel del estudiante
Pedido de Tomás del 2026-11-16 (ver `DECISIONES.md`). Hay un PR en borrador por paso, con las ramas encadenadas (#60 a #71, sin fusionar). Informe: `docs/informes/panel-simple-qa.md`.
- [x] 1. Docs y decisión: `DECISIONES.md`, `SPEC.md` (Panel del estudiante) y esta etapa
- [x] 2. Fuera datos inventados en la página de la materia, con un test que falla si reaparecen
- [x] 3. Textos del panel simple centralizados y test de jerga prohibida
- [x] 4. Un solo chat (el de la carpeta de la materia), sin perder conversaciones y con las URLs viejas redirigidas
- [x] 5. Inicio = chat de la materia actual, con selector arriba
- [x] 6. Navegación con 3 destinos y Mis datos (barra inferior en el celular, lateral en la computadora)
- [x] 7. Practicar: temas y quiz con un solo resultado y "Seguir"
- [x] 8. Mi avance: semáforo con umbrales fijos y tests de los bordes
- [x] 9. Dudas dentro del chat con "Sí" y "No"
- [x] 10. Mis datos en una sola página, con V7, V9, V10 y V11 probados desde ahí
- [x] 11. Consentimiento en una pantalla y alta mínima con perfil progresivo
- [x] 12. QA de punta a punta, capturas a 375 y 1280 px e informe

Criterios de cierre:
- [x] Los 3 destinos y Mis datos son lo único en la navegación del estudiante
- [x] Del login a la primera pregunta enviada, 2 toques como máximo
- [x] Ninguna función del spec quedó inalcanzable y V1 a V15 están en verde sin modificar
- [x] Ningún dato inventado en pantalla y ninguna palabra de la lista de jerga
- [x] La frase de consentimiento es verdadera respecto de lo que ve el docente (verificada contra `development.ts`, `attention.ts`, `student-file.ts` y `doubts.ts`; ver `docs/legal/aviso-de-consentimiento.md`)
- [x] Los e2e del estudiante pasan en el CI sobre el build de producción

## Bitácora de sesiones

Una entrada por sesión, la más reciente arriba: fecha, qué se hizo, qué falta, gasto de IA de la sesión.

- 2026-11-16 (continuación) · Arranca la simplificación del panel del estudiante (decisión de Tomás). PR 1: relevamiento de rutas, chats, acciones y tests; spec, decisiones y etapa nueva. Hallazgo: las vistas del docente muestran y cuentan dudas sin confirmar (en "Pasos que dependen de Tomás"). PR 2: la página de la materia queda solo con datos reales; se borran el tablero de clase de relleno y el tutor flotante, que llamaba a una ruta inexistente. PR 3: bloque `TEXT.student` y test de jerga, con una lista de transición que se vacía en el PR 12. PR 4: un solo chat en `/s/c/[id]`, migración `unificar_chat` y redirecciones. PR 5: el inicio es el chat de la materia actual, con selector arriba, código si no hay materia e invitaciones con «Unirme». PR 6: navegación con Preguntar, Practicar y Mi avance (barra inferior en el celular, lateral en la computadora) y Mis datos arriba a la derecha. PR 7: Practicar con un botón por tema, el resultado en una pantalla con «Seguir» y las tareas del docente al pie. PR 8: Mi avance con un semáforo por tema (umbral de verde 0,8, en código) que abre una práctica al tocarlo. PR 9: las dudas se confirman en el chat con tarjetas «Sí» y «No»; la regla de 7 días no cambia. PR 10: Mis datos en una sola página con secciones plegables; V7, V9, V10 y V11 probados desde ahí. PR 11: alta en una pantalla de consentimiento más el código; carrera, año, proyecto y foco de a uno en el chat con «Saltar» (migración aditiva `perfil_progresivo`). PR 12: tareas sin jerga, recorrido completo a 375 y 1280 px, capturas e informe (`docs/informes/panel-simple-qa.md`); 39 e2e y 453 tests en verde, la lista de jerga quedó vacía. La etapa queda completa, con los PR en borrador esperando a Tomás. Gasto de IA: 0 USD.
- 2026-11-16 (continuación) · El estudiante que ya tenía una materia no encontraba cómo sumarse a otra (pregunta de Tomás). «Unirme a otra materia» queda siempre en la barra lateral y en el inicio; la barra muestra la materia de la página abierta. Se corrigió también que el menú lateral se cerraba solo al abrirlo después de navegar por la barra de arriba. Tests en `tests/e2e/barra-lateral.spec.ts`. Gasto de IA: 0 USD.
- 2026-11-16 (continuación) · La barra lateral del estudiante solo mostraba «Asistente» (reporte de Tomás). Ahora lleva Inicio, Asistente, la materia con Materia, Actividades, Desarrollo y Mi ficha, sus carpetas (incluidas las traídas del LMS) y Tu contexto; sin materias, ofrece sumarse con un código. Las carpetas que falten se crean al armar la barra, porque el layout se arma antes que el inicio. Test de punta a punta en `tests/e2e/barra-lateral.spec.ts`. Gasto de IA: 0 USD.
- 2026-11-16 (continuación) · Ronda de QA en local con datos sintéticos (`docs/informes/qa-local-2026-11-16.md`): suites en verde y recorrido completo con Playwright. Seis hallazgos, cada uno con su PR: la ficha contaba dudas sin confirmar (#50), un estudiante quitado volvía solo con el código (#51), la lista de estudiantes ocultaba a quien no dio consentimiento (#52), la ficha sin consentimiento mostraba cuántas conversaciones había (#53), errores internos a la vista del estudiante (#54) y plurales (#55). Gasto de IA: 0 USD.
- 2026-11-16 (continuación) · Tomás dio por hechos la rotación de las claves de Groq y OpenRouter, la revisión de la muestra de etiquetas (cierra la etapa 4) y la revisión de la lista de esquema (cierra la etapa 1). También confirmó en staging los temas propuestos de «Taller de innovación». Gasto de IA: 0 USD.
- 2026-11-16 (continuación) · «Taller de innovación» quedó en «Procesando programa»: la propuesta de temas corría al final de la importación y podía pasarse del tope de 5 minutos de Vercel. Ahora corre en su propio pedido, la que se corta pasa a «con error» a los 6 minutos y «Currícula» tiene un botón para proponer los temas con el material. Gasto de IA: 0 USD.
- 2026-11-16 (continuación) · La importación del LMS propone los temas con las lecturas cuando la cátedra no tiene programa (pedido de Tomás: «Currícula sin cargar» después de traer «Costos de proyectos»). Quedan en revisión para que el docente los confirme. Gasto de IA: 0 USD en los tests (proveedor guionado).
- 2026-11-16 (continuación) · Tomás confirmó en staging «Costos de proyectos» con 12 PDF y 4 textos, todos con título. Los archivos sin páginas (TXT, MD, DOCX) citan "sección" en vez de "pág." en toda la interfaz y en lo que recibe la IA. Gasto de IA: 0 USD.
- 2026-11-16 (continuación) · Lecturas de Siglo 21 con su PDF. La prueba real de Tomás bajó las 16 lecturas de «Costos de proyectos» como texto: las lecturas de meca no eran Articulate Rise. Se verificó contra las 16 lecturas reales (contenido completo y en el orden correcto; los 4 PDF del módulo 1 son escaneados). Ahora se baja el PDF si tiene texto, con el título real, se avisa cuando entra como texto y la nueva importación reemplaza la anterior. Gasto de IA: 0 USD.
- 2026-11-16 (continuación) · Extensión de navegador para Canvas sin tokens: vinculación por código de un solo uso, sesión al día y prueba de punta a punta con la extensión real cargada en Chromium. Gasto de IA: 0 USD.
- 2026-11-16 · Inicio sin datos inventados (#41). Asistente del LMS para docente y estudiante: conexión cifrada con Canvas o Moodle, chat que entiende "crea la materia «…»", importación de módulos y lecturas (incluido el formato de Siglo 21 portado de mcp-siglo) a la cátedra o a una carpeta privada del estudiante, con LMS de mentira para los tests de integración y de punta a punta. La barra lateral del estudiante dejó de mostrar "Clase 4 de 8". Falta la prueba con el Canvas real de Tomás. Gasto de IA: 0 USD en los tests (proveedor guionado).

- 2026-11-15 (continuación) · Staging en Vercel con Neon, contraseña de sitio y despliegue automático desde `main` (#32); prueba de humo por la interfaz en verde contra staging (#34); DeepSeek como proveedor provisorio, probado con la API simulada y con la API real hasta donde lo permite una cuenta sin saldo (#33). Tomás descartó el abogado y la revisión de seguridad externa. Gasto de IA: 0 USD.

- 2026-11-15 (continuación) · Endurecimiento previo a la revisión de seguridad (#28): test estático de cobertura de permisos (lo pedía `PRUEBAS.md`), intentos de acceso por URL con Playwright, control propio en `/s/join` y `/t/new`, límite de 200 MB descomprimidos para DOCX y PPTX, y borrado de invitaciones al borrar la cuenta. Descarga de los datos propios y corrección de un texto que decía que las conversaciones las veía solo el estudiante (#29). Mecanismo de plazos de conservación, apagado hasta que se fijen (#30). Propuesta de aviso para el abogado (#31). Staging quedó a un clic: la cuenta de Vercel tiene la integración de Neon, pero crear la base pide autorización en el panel. Gasto de IA: 0 USD.

- 2026-11-15 · Etapa 6, todo lo que no depende de Tomás: análisis con Sonnet 5.5 (#21), tope semanal de IA por estudiante con alertas (#22), prueba de carga con 60 estudiantes (#23), backups y prueba de restauración en local y en el CI (#24), documentos para el abogado (#25), corrección de permisos (#26) y paquete de seguridad (#27). Hallazgos: el docente podía seguir leyendo evidencia y mensajes de origen de un estudiante que retiró el consentimiento en las vistas heredadas (V11, corregido con test); con carga, `refresh()` mostraba una página de error después de cerrar una conversación (corregido); el `pg_dump` del CI era más nuevo que el servidor (corregido). Se marcaron dos casillas de la etapa 2 que #7 ya cumplía. Gasto de IA: 0 USD (solo proveedor guionado).

- 2026-11-15 · Etapa 5 completa: quiz y dominio portado de DeepTutor (#17), contexto de carpeta en tres capas (#18), pregunta sobre un fragmento (#19) y slides con PowerPoint. Playwright en el repo y en el CI. Bugs corregidos: el proceso de contexto podía archivar un hecho que el estudiante acababa de editar, y pedidos simultáneos podían duplicar carpetas. Gasto de IA: 0 USD (solo proveedor guionado).
- 2026-11-15 · Etapa 2: `render.yaml` con migraciones (#6), login con límite de intentos y seed solo local (#7), informe (#8), descarte de PageLM/DeepStudent/Get It, que llamaban a la IA sin sesión, y de Gemini (#9), formularios con `method="post"` (#11; la contraseña quedaba en la URL). Etapa 3 completa: esquema, permisos y tests V7, V8, V10, V11 y V13 (#10), material con archivo y página (#12), chat con citas, subidas, consentimiento explícito e invitaciones por enlace o CSV. Falta la prueba con Claude real (sin clave). Gasto de IA: 0 USD (solo proveedor guionado).
- 2026-11-15 · Kit de autonomía instalado (#1), lint en verde (#3: 45 errores corregidos, `packages/canvas-mcp` borrado, `.agents/**` fuera del lint), CI con tests de integración. Etapa 1: `bootstrap.sh` corregido y probado (idempotente, migraciones y seed local ok), lista de esquema escrita para revisión. Gasto de IA: 0 USD (solo proveedor guionado).
