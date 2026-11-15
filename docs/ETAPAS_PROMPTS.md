# Prompts para arrancar cada etapa

Cada bloque se pega tal cual en una sesión nueva de Claude Code, dentro del contenedor. Las etapas son las de `docs/SPEC.md`.

## Antes de la primera sesión (Tomás)

1. Copiar el kit al repositorio de educa-educai o a uno nuevo con su contenido.
2. Exportar la especificación a `docs/SPEC.md` desde el menú Exportar del documento, en formato Markdown.
3. Completar el checklist de `docs/CUENTAS_Y_SECRETOS.md`.

## Etapa 1: especificación en el repositorio

```
Leé CLAUDE.md, docs/AUTONOMIA.md y docs/SPEC.md. Verificá que el kit esté completo:
CLAUDE.md, .claude/settings.json, .devcontainer, .github/workflows/ci.yml, scripts/bootstrap.sh y los
documentos de docs/. Corré scripts/bootstrap.sh y arreglá lo que impida que el entorno quede en pie.
Después compará el esquema de Prisma con la sección "Modelo de datos" del spec y escribí en
docs/DECISIONES.md la lista de entidades nuevas y los cambios al esquema, incluyendo dónde está hoy el
consentimiento (StudentProfile o privacy.ts). No implementes cambios de esquema todavía. Marcá la etapa 1
en docs/PROGRESO.md y avisame cuando la lista esté lista para mi revisión.
```

## Etapa 2: auditoría de educa-educai

```
Etapa 2 del spec. Empezá levantando la app en local y en el CI con PostgreSQL. Corregí render.yaml para
que use migraciones sin db push ni seed. Eliminá los usuarios de demo con contraseña pública fuera del
entorno local, agregá límite de intentos de login y corré una prueba real de punta a punta con la clave
de desarrollo de Claude. Revisá packages/canvas-mcp y las versiones con Firestore. Entregá un informe en
docs/informes/etapa-2.md con tres listas: qué se conserva, qué se corrige y qué se descarta, con el motivo
de cada ítem. Trabajá con PRs chicos. Cerrá la etapa solo si se cumplen todos los criterios del spec.
```

## Etapa 3: cátedra, material y carpetas

```
Etapa 3 del spec. Implementá las entidades Folder, FolderContext, Material y MaterialChunk con
migraciones, la carga de material (PDF, DOCX, PPTX) con indexación por archivo y página en pgvector, la
aprobación de temas por el docente, las invitaciones, el consentimiento, la creación de las dos carpetas
por estudiante, el chat de carpeta con citas y la subida de .txt. Escribí primero los tests de V7, V8,
V10, V11 y V13 con las fábricas de tests/support, y después el código. Todo acceso a datos de otros
usuarios pasa por src/server/auth/guards.ts. Cerrá la etapa con los criterios del spec cumplidos y
registrá cómo lo comprobaste.
```

## Etapa 4: motor y panel del docente

```
Etapa 4 del spec. Implementá el flujo por conversación (cierre, evidencia, señales, confirmación,
agregado), la vista macro con porcentajes y denominador, la ficha por estudiante con AccessLog y
Mi ficha idéntica a la del docente. Escribí los tests de V1 a V6, V9, V12, V14 y V15 antes del código.
Armá las 30 conversaciones etiquetadas en tests/fixtures/dudas y dejá listo un script que mida la
precisión con el modelo real usando la clave de staging. Pedime que revise una muestra de 10 etiquetas
antes de correr la medición. Cerrá la etapa cuando la precisión sea de al menos 80%.
```

## Etapa 5: quiz, dominio, contexto y slides

```
Etapa 5 del spec. Implementá el quiz por tema con la fórmula de dominio (portada de DeepTutor con
atribución Apache 2.0 en THIRD_PARTY_NOTICES.md), el contexto de carpeta en tres capas visible y editable
por el estudiante, la pregunta sobre un fragmento seleccionado y los slides del tema con citas,
editables y exportables a PowerPoint. El proceso de contexto archiva y nunca borra, y respeta lo que
editó el estudiante. Cubrí cada función con tests y con un flujo de Playwright.
```

## Etapa 6: preparación del piloto

```
Etapa 6 del spec. Dejá producción lista para que Tomás la despliegue con aprobación: backups diarios con
restauración probada, topes de costo con alerta, prueba de carga con 60 estudiantes simulados y los
documentos para el abogado (aviso de consentimiento y descripción de qué datos se tratan, con quién y
cuánto tiempo). Preparé un paquete de revisión de seguridad para una persona externa, con el mapa de
permisos y los tests V1 a V15. No cierres esta etapa: las firmas del abogado y de la revisión de
seguridad las confirma Tomás.
```

## Prompt de retomar una sesión

```
Leé CLAUDE.md, docs/PROGRESO.md y docs/DECISIONES.md. Decime en tres líneas en qué etapa estamos, qué quedó
a medias y cuál es el próximo paso, y seguí con ese paso.
```
