# Progreso

Claude Code actualiza este archivo al terminar cada sesión. Tomás lo lee una vez por etapa.

## Estado actual

- Etapa en curso: 1
- Último PR fusionado: ninguno
- Bloqueos que necesitan a Tomás: ver checklist de `CUENTAS_Y_SECRETOS.md`

## Etapas

### Etapa 1: especificación en el repositorio
- [ ] `docs/SPEC.md` exportado en el repositorio
- [ ] `CLAUDE.md` con las reglas
- [ ] Lista de entidades nuevas y cambios al esquema, revisada por Tomás

### Etapa 2: auditoría de educa-educai
- [ ] La app corre en local y en un entorno de prueba con PostgreSQL
- [ ] `render.yaml` usa migraciones, sin `db push --accept-data-loss` ni seed en cada build
- [ ] Sin usuarios de demo con contraseña pública fuera del entorno local
- [ ] Límite de intentos de login
- [ ] Tests existentes en verde y prueba real de punta a punta con Claude
- [ ] Informe de qué se conserva, qué se corrige y qué se descarta

### Etapa 3: cátedra, material y carpetas
- [ ] El docente crea la cátedra, carga material, aprueba temas e invita estudiantes
- [ ] El estudiante da o rechaza el consentimiento y recibe sus dos carpetas
- [ ] El chat de la carpeta cita archivo y página, y avisa cuando no hay fuente
- [ ] Subida de .txt o texto pegado asignada a una carpeta
- [ ] Tests de V7, V8, V10, V11 y V13

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

- (vacío)
