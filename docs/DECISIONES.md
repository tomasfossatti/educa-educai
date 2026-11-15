# Decisiones

Registro de decisiones que el spec no definía o que lo cambian. Una entrada por decisión, la más reciente arriba.

## Formato

```
### AAAA-MM-DD · Título corto
Contexto: qué había que resolver.
Alternativas: qué se evaluó.
Decisión: qué se eligió y por qué.
Consecuencias: qué cambia en el código, los datos o el spec.
```

## Decisiones de la construcción

### 2026-11-15 · Descartar PageLM, DeepStudent, Get It y Gemini
Las tres herramientas no figuran en el spec y sus acciones llamaban a la IA sin exigir sesión. Gemini está fuera del stack del spec. Sin `AI_PROVIDER`, el proveedor por defecto pasa a ser Anthropic.

### 2026-11-15 · Etapa 1: entidades nuevas y cambios al esquema (pendiente de revisión de Tomás)
Contexto: el spec pide comparar `prisma/schema.prisma` con "Modelo de datos" y listar los cambios antes de implementarlos (se implementan en la etapa 3 y siguientes).

Consentimiento hoy: está en un solo lugar, `StudentProfile.consentAnalysisAt` + `consentVersion` (lo escribe `src/server/actions/student.ts` y lo lee `src/server/engine/trigger.ts` antes de analizar). `privacy.ts` no guarda consentimiento: solo hace el borrado en cascada y el resumen de datos. Aparte existe `shareContextWithTeachers` (compartir el contexto declarado) y `CourseInvite.acceptedAt` (aceptar la invitación, no es consentimiento de análisis). Decisión: el consentimiento queda en `StudentProfile`; se agrega `consentWithdrawnAt` para V11 y se documenta que `CourseInvite.acceptedAt` no es consentimiento.

Entidades nuevas:
- `Folder`: `userId` → `User`, `kind` (SUBJECT | PROJECT), `name`, `createdBy` (LMS | MANUAL | SYSTEM), `courseId?` → `Course` (solo SUBJECT). Único (`userId`, `courseId`) para SUBJECT.
- `FolderContext`: `folderId` → `Folder` (cascade), `layer` (TRACE | FACTS | SUMMARY), `content`, `sourceIds` (String[] de evidencias/conversaciones), `editedByStudent` Boolean, `archivedAt?` (el proceso archiva, no borra).
- `Material`: `courseId` → `Course`, `fileName`, `mimeType`, `version`, `uploadedById`, `status`.
- `MaterialChunk`: `materialId` → `Material` (cascade), `page`, `text`, `embedding vector(N)` vía `Unsupported("vector")` + extensión `pgvector` en una migración.
- `MasteryRecord`: (`userId`, `curriculumItemId`) único, `score` Float 0..1, `attempts`, `lastEvidenceAt`. Más `QuizAttempt` para guardar los intentos que alimentan la fórmula (el spec pide "registro de intentos").
- `ClassSession`: `courseId` → `Course`, `date`, `slidesDraft` Json?, `approvedAt?`, relación N a N con `CurriculumItem` (tabla `ClassSessionItem`).
- `AccessLog`: `viewerId` → `User`, `subjectStudentId` → `StudentProfile`, `courseId?`, `view` (STUDENT_FILE | EVIDENCE | …), `createdAt`.

Cambios a entidades existentes:
- `AIConversation.folderId` → `Folder` (obligatorio tras migrar; las existentes se asignan a la carpeta SUBJECT de su `courseId`). `origin` (CHAT | UPLOAD) para las subidas de otra IA. `courseId` pasa a opcional (la carpeta PROJECT no tiene cátedra).
- `Experience.courseId` opcional por el mismo motivo.
- `Role`: se agrega `ADMIN` para el administrador del piloto (V14).
- `Signal`: estado de confirmación del estudiante (PENDING | CONFIRMED | DISCARDED) y `confirmedAt`, para el paso 4 del motor (si no alcanza con `StudentResponse`).
- `StudentProfile`: `consentWithdrawnAt`, `career`, `year`, `projectDescription` (primer ingreso del spec).
- Borrado de conversación: ya cascadea evidencia, señales e inferencias vía `Experience`; se suma `FolderContext` derivado.

Alternativas: usar `Experience` como carpeta (descartado: una carpeta agrupa muchas experiencias y la PROJECT no tiene cátedra); guardar embeddings fuera de Postgres (descartado: el spec fija pgvector).
Consecuencias: requiere la imagen con pgvector en todos los entornos (el CI y el devcontainer ya la usan). Ninguna migración es destructiva: solo agrega columnas y tablas, y vuelve opcionales dos columnas.

### 2026-11-15 · bootstrap.sh exporta .env.local
Prisma solo lee `.env`, así que `db:migrate` corría sin `DATABASE_URL`. El script ahora exporta `.env.local` antes de `npm ci` y de las migraciones.

### 2026-11-15 · Borrar packages/canvas-mcp
Código viejo de Firestore/heatmap que nada de `src/` importaba; borrarlo era preferible a tipar sus `any`. Se quitaron también los scripts `mcp:*`.

### 2026-11-15 · Excluir .agents/** del lint
Skills de terceros versionados (ver `skills-lock.json`); editarlos se pierde en cada actualización. Las reglas de lint no se cambiaron.

### 2026-11-15 · setState fuera del cuerpo sincrónico de los efectos
Carga de `localStorage` aplicada en `queueMicrotask`, `useSyncExternalStore` en el selector de tema y un ref a la última `sendQuestion` en el tutor flotante, para cumplir las reglas de React sin desactivarlas.

### 2026-11-15 · Tests de integración en CI
El CI define `TEST_DATABASE_URL` para que `tests/integration` corra contra el Postgres del servicio en vez de saltearse.

## Decisiones previas a la construcción

### Repositorio propio sobre educa-educai
DeepTutor se usa como especificación de la experiencia del estudiante y como fuente de piezas puntuales (fórmula de dominio, modelo de contexto en tres capas), con atribución Apache 2.0. No se usa como base del código ni como fork. Evitar PyMuPDF por su licencia AGPL.

### Visibilidad con nombre y consentimiento explícito
El docente ve la clase a nivel macro y puede abrir la ficha de cada estudiante inscripto. Todo se identifica por nombre, hay consentimiento explícito, registro de cada acceso y el estudiante ve la misma ficha que el docente.

### Piloto acotado
Una cátedra de una materia, una universidad que paga, alta por invitación o CSV, sin LMS. La segunda cátedra se suma cuando el piloto funcione.
