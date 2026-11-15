# Progreso

Claude Code actualiza este archivo al terminar cada sesión. Tomás lo lee una vez por etapa.

## Estado actual

- Etapa en curso: 4. Abiertas: 1 (falta la revisión de Tomás de la lista de esquema) y 2 (falta la prueba con Claude real y staging). La 3 está cerrada.
- Último PR fusionado: #12 (material de la cátedra)
- Bloqueos que necesitan a Tomás: revisar la lista de entidades y cambios al esquema en `DECISIONES.md`; checklist de `CUENTAS_Y_SECRETOS.md` (clave de Anthropic de desarrollo para la prueba real de la etapa 2, cuenta y token de staging, protección de `main`)

## Etapas

### Etapa 1: especificación en el repositorio
- [x] `docs/SPEC.md` exportado en el repositorio
- [x] `CLAUDE.md` con las reglas
- [ ] Lista de entidades nuevas y cambios al esquema, revisada por Tomás (escrita en `DECISIONES.md`, espera revisión)

### Etapa 2: auditoría de educa-educai
- [ ] La app corre en local y en un entorno de prueba con PostgreSQL
- [x] `render.yaml` usa migraciones, sin `db push --accept-data-loss` ni seed en cada build
- [ ] Sin usuarios de demo con contraseña pública fuera del entorno local
- [ ] Límite de intentos de login
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
- [ ] Detección de dudas por tema con confirmación del estudiante
- [ ] Vista macro con porcentajes, denominador y participación
- [ ] Ficha por estudiante con evidencia y registro en `AccessLog`
- [ ] Mi ficha idéntica a la del docente, con la lista de accesos
- [ ] Tests de V1 a V6, V9, V12, V14 y V15
- [ ] 30 conversaciones etiquetadas, al menos 80% de las dudas detectadas son correctas

### Etapa 5: quiz, dominio, contexto y slides
- [ ] Quiz por tema con cálculo de dominio
- [ ] Contexto de carpeta en tres capas, visible y editable
- [ ] Pregunta sobre un fragmento seleccionado
- [ ] Slides del tema con citas, editables y exportables a PowerPoint

### Etapa 6: preparación del piloto
- [ ] Producción con backups diarios y restauración probada
- [ ] Aviso de consentimiento y convenio revisados por un abogado (Ley 25.326)
- [ ] Revisión de seguridad hecha por una persona
- [ ] Tope de costo por estudiante y alerta de consumo
- [ ] Prueba de carga con 60 estudiantes simulados

## Bitácora de sesiones

Una entrada por sesión, la más reciente arriba: fecha, qué se hizo, qué falta, gasto de IA de la sesión.

- 2026-11-15 · Etapa 2: `render.yaml` con migraciones (#6), login con límite de intentos y seed solo local (#7), informe (#8), descarte de PageLM/DeepStudent/Get It, que llamaban a la IA sin sesión, y de Gemini (#9), formularios con `method="post"` (#11; la contraseña quedaba en la URL). Etapa 3 completa: esquema, permisos y tests V7, V8, V10, V11 y V13 (#10), material con archivo y página (#12), chat con citas, subidas, consentimiento explícito e invitaciones por enlace o CSV. Falta la prueba con Claude real (sin clave). Gasto de IA: 0 USD (solo proveedor guionado).
- 2026-11-15 · Kit de autonomía instalado (#1), lint en verde (#3: 45 errores corregidos, `packages/canvas-mcp` borrado, `.agents/**` fuera del lint), CI con tests de integración. Etapa 1: `bootstrap.sh` corregido y probado (idempotente, migraciones y seed local ok), lista de esquema escrita para revisión. Gasto de IA: 0 USD (solo proveedor guionado).
