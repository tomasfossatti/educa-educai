# Progreso

Claude Code actualiza este archivo al terminar cada sesión. Tomás lo lee una vez por etapa.

## Estado actual

- Etapa en curso: 6. Abiertas por pasos que dependen de Tomás: 1 (revisar la lista de esquema), 2 (prueba con Claude real y staging), 4 (medición de precisión con modelo real) y 6 (producción, abogado y revisión de seguridad). La 3 y la 5 están cerradas.
- Último PR fusionado: #27 (paquete para la revisión de seguridad).
- Bloqueos que necesitan a Tomás: revisar la lista de esquema en `DECISIONES.md`; checklist de `CUENTAS_Y_SECRETOS.md` (clave de Anthropic, cuenta y token de staging, protección de `main`); revisar la muestra de `docs/informes/etiquetas-muestra.md`; crear producción con backup diario y hacer la prueba de restauración (`ENTORNOS_Y_DESPLIEGUE.md`); webhook de alertas de consumo; revisión del abogado (`docs/legal/`) y revisión de seguridad (`docs/seguridad/`).

## Etapas

### Etapa 1: especificación en el repositorio
- [x] `docs/SPEC.md` exportado en el repositorio
- [x] `CLAUDE.md` con las reglas
- [ ] Lista de entidades nuevas y cambios al esquema, revisada por Tomás (escrita en `DECISIONES.md`, espera revisión)

### Etapa 2: auditoría de educa-educai
- [ ] La app corre en local y en un entorno de prueba con PostgreSQL
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
- [ ] 30 conversaciones etiquetadas, al menos 80% de las dudas detectadas son correctas (las 30 están en `tests/fixtures/dudas` y el script en `npm run eval:dudas`; falta que Tomás revise la muestra de `docs/informes/etiquetas-muestra.md` y la clave de Anthropic para medir)

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
- [ ] Aviso de consentimiento y convenio revisados por un abogado (Ley 25.326) (documentos listos en `docs/legal/`, con seis preguntas para el abogado; falta la revisión y la firma)
- [ ] Revisión de seguridad hecha por una persona (paquete listo en `docs/seguridad/`: mapa de permisos, V1 a V15 con sus tests y puntos a revisar; al prepararlo apareció y se corrigió una brecha de V11 en vistas heredadas; falta la revisión y la firma)
- [x] Tope de costo por estudiante y alerta de consumo (2 USD por semana y estudiante, aviso al 80%, alertas por log y webhook; falta que Tomás cree el webhook y lo cargue en `AI_ALERT_WEBHOOK_URL`)
- [x] Prueba de carga con 60 estudiantes simulados (`docs/informes/carga-etapa-6.md`: sin errores ni pérdida de datos; con 2 CPU cumple todos los criterios, con 1 CPU el login simultáneo de los 60 tarda 7 s)

## Bitácora de sesiones

Una entrada por sesión, la más reciente arriba: fecha, qué se hizo, qué falta, gasto de IA de la sesión.

- 2026-11-15 · Etapa 6, todo lo que no depende de Tomás: análisis con Sonnet 5.5 (#21), tope semanal de IA por estudiante con alertas (#22), prueba de carga con 60 estudiantes (#23), backups y prueba de restauración en local y en el CI (#24), documentos para el abogado (#25), corrección de permisos (#26) y paquete de seguridad (#27). Hallazgos: el docente podía seguir leyendo evidencia y mensajes de origen de un estudiante que retiró el consentimiento en las vistas heredadas (V11, corregido con test); con carga, `refresh()` mostraba una página de error después de cerrar una conversación (corregido); el `pg_dump` del CI era más nuevo que el servidor (corregido). Se marcaron dos casillas de la etapa 2 que #7 ya cumplía. Gasto de IA: 0 USD (solo proveedor guionado).

- 2026-11-15 · Etapa 5 completa: quiz y dominio portado de DeepTutor (#17), contexto de carpeta en tres capas (#18), pregunta sobre un fragmento (#19) y slides con PowerPoint. Playwright en el repo y en el CI. Bugs corregidos: el proceso de contexto podía archivar un hecho que el estudiante acababa de editar, y pedidos simultáneos podían duplicar carpetas. Gasto de IA: 0 USD (solo proveedor guionado).
- 2026-11-15 · Etapa 2: `render.yaml` con migraciones (#6), login con límite de intentos y seed solo local (#7), informe (#8), descarte de PageLM/DeepStudent/Get It, que llamaban a la IA sin sesión, y de Gemini (#9), formularios con `method="post"` (#11; la contraseña quedaba en la URL). Etapa 3 completa: esquema, permisos y tests V7, V8, V10, V11 y V13 (#10), material con archivo y página (#12), chat con citas, subidas, consentimiento explícito e invitaciones por enlace o CSV. Falta la prueba con Claude real (sin clave). Gasto de IA: 0 USD (solo proveedor guionado).
- 2026-11-15 · Kit de autonomía instalado (#1), lint en verde (#3: 45 errores corregidos, `packages/canvas-mcp` borrado, `.agents/**` fuera del lint), CI con tests de integración. Etapa 1: `bootstrap.sh` corregido y probado (idempotente, migraciones y seed local ok), lista de esquema escrita para revisión. Gasto de IA: 0 USD (solo proveedor guionado).
