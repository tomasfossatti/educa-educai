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
