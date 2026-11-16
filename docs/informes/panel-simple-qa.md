# QA del panel simple del estudiante

16 de noviembre de 2026 · Claude Code, con datos sintéticos y la IA guionada.

Cierra la etapa "Simplificación del panel del estudiante" (decisión de Tomás del 2026-11-16, ver `DECISIONES.md`). Son doce PR en borrador encadenados (del #60 al #71), sin fusionar.

## Resultado

El chat es la app. El estudiante entra y ya está en el chat de su materia. La navegación tiene solo tres destinos, Preguntar, Practicar y Mi avance, más "Mis datos" arriba a la derecha. Ninguna función del spec quedó afuera y las reglas V1 a V15 siguen en verde sin cambios en sus tests.

## Criterios de cierre

| Criterio | Cómo se comprobó | Estado |
| --- | --- | --- |
| Los 3 destinos y Mis datos son lo único en la navegación | `navegacion.spec.ts` a 1280 px (lateral: Preguntar, Practicar, Mi avance, Mis datos) y a 375 px (barra inferior con los tres). Comprueba que no aparezcan Inicio, Asistente, Materia, Actividades, Desarrollo, Mi ficha, Tu contexto ni la lista de carpetas | Cumplido |
| Del login a la primera pregunta enviada, 2 toques como máximo | `recorrido-simple.spec.ts`, en los dos tamaños: después del login la caja "Tu pregunta" ya tiene el foco, se escribe y se toca "Preguntar". Es 1 toque y el test falla si pasa de 2 | Cumplido |
| Ninguna función del spec inalcanzable | Tabla "Dónde quedó cada función", abajo. Las direcciones viejas redirigen y cada redirección tiene su test | Cumplido |
| V1 a V15 en verde sin modificar | `visibility-stage3/4`, `visibility-consent-teacher-views`, `roster` y `guard-coverage` sin cambios desde la base (80fd55c). En `permisos.spec.ts` solo cambió cómo Ana crea su charla; las aserciones son las mismas | Cumplido |
| Ningún dato inventado | `tests/unit/no-placeholder.test.ts` (falla si reaparece el relleno) y `inicio.spec.ts` | Cumplido |
| Ninguna palabra de la jerga | `tests/unit/student-jargon.test.ts` recorre `TEXT.student`, cada bloque de `TEXT` que usan las pantallas y las acciones del estudiante, y los archivos de `src/app/s`, `src/components/student` y `src/components/lms`. La lista de transición quedó vacía | Cumplido |
| La frase de consentimiento es verdadera | Verificada contra `development.ts`, `attention.ts`, `student-file.ts` y `doubts.ts`. El detalle está en `docs/legal/aviso-de-consentimiento.md` | Cumplido |
| Los e2e del estudiante pasan en el CI sobre el build de producción | El job `e2e` de `ci.yml` corrió en verde en los PR 1 a 11. Este PR suma `recorrido-simple.spec.ts` | Cumplido |

## Dónde quedó cada función

| Función del spec | Antes | Ahora |
| --- | --- | --- |
| Chat con citas de archivo y página, "sin fuente" | `/s/folders/[f]/c/[c]` (y un tutor sin citas) | Preguntar (`/s`, `/s/c/[id]`) |
| Pregunta sobre un fragmento seleccionado | Chat de carpeta | Igual, en el chat único |
| Quiz por tema y dominio | Página de la carpeta | Practicar |
| Dominio por tema | Badges con porcentaje | Mi avance (semáforo) |
| Dudas detectadas: confirmar o descartar | Lista al pie de la charla | Tarjeta "¿Es así?" con Sí y No en el chat; historial en Mis datos |
| Lo que la IA sabe de mí (contexto de la carpeta) | Página de la carpeta | Mis datos, "Lo que la IA sabe de mí" |
| Mi ficha (V7) y accesos (V9) | `/s/courses/[id]/ficha` | Mis datos, "Lo que ve mi docente sobre mí" |
| Responder a una conclusión | Desarrollo → conclusión | Mis datos → "Responder" |
| Consentimiento: ver y retirar (V11) | Tu contexto | Mis datos, "Mi consentimiento" |
| Borrar una conversación (V10) | Página de cada charla | Mis datos, "Mis charlas" (y la página de la charla) |
| Descargar mis datos | Tu contexto | Mis datos |
| Unirme a otra materia | Barra lateral | Mis datos (y el inicio, sin materia) |
| Traer una materia de Canvas o Moodle | Asistente en la barra | Mis datos → asistente; el material, en la misma sección |
| Subir una conversación externa | Página de la carpeta | Mis datos, "Subir una charla de otra IA" |
| Chat del proyecto personal | Carpeta "Mi proyecto" | Selector de materia, "Mi proyecto" |
| Próxima clase | Inicio | Una línea arriba del chat |
| Tareas del docente | Actividades | Practicar, "Tareas de tu docente" |
| Primer ingreso | 5 pasos, carrera y proyecto obligatorios | Consentimiento en una pantalla y código; el perfil, de a una pregunta en el chat con "Saltar" |

## Recorrido de punta a punta

`tests/e2e/recorrido-simple.spec.ts` corre a 375 px y a 1280 px:

1. Registrarse.
2. Aceptar: una pantalla, dos botones, nada elegido.
3. Sumarse con el código.
4. Salir, volver a entrar y preguntar en 1 toque.
5. Ver la cita "programa.pdf, pág. 2".
6. Ver el tema en gris en Mi avance.
7. Practicarlo: el quiz, "Acertaste N de M" y "Seguir".
8. Ver el semáforo en amarillo.
9. Confirmar con "Sí" una duda detectada.
10. Abrir Mis datos y retirar el consentimiento.
11. Comprobar que el docente pierde acceso: "no podés ver su ficha ni sus conversaciones".

La duda del paso 9 la carga el test en la base, como la dejaría el motor. El proveedor guionado no garantiza una duda determinística sobre un tema.

Las capturas de cada pantalla están en `docs/informes/capturas/qa/`. Se generan con `CAPTURAS_DIR=docs/informes/capturas/qa npm run test:e2e -- tests/e2e/recorrido-simple.spec.ts`.

## Números

- `npm run lint`: 0 errores (las 5 advertencias ya estaban).
- `npm run typecheck`: en verde.
- `npm test`: 57 archivos, 453 tests, con integración contra Postgres.
- `npm run test:e2e` sobre `npm run build`: 39 de 39 (antes de la etapa eran 19).
- Migraciones nuevas, las dos aditivas:
  - `unificar_chat`: completa `folderId`, idempotente;
  - `perfil_progresivo`: una columna con valor por defecto.
- Gasto de IA: 0 USD (proveedor guionado).

## Pendiente y hallazgos

- **Para Tomás:** el detalle de evidencia del docente muestra, y las estadísticas de la clase cuentan, dudas sin confirmar o descartadas. La frase de consentimiento está escrita para que sea verdadera con ese comportamiento. Si se decide filtrarlas, la frase puede pasar a "las dudas que confirmes" (en `PROGRESO.md`).
- **Contraste en el panel del docente:** la regla global `a{color:inherit}` deja con texto oscuro los botones-enlace primarios. En el estudiante se corrigió con una clase propia. La corrección general toca al docente y quedó como tarea sugerida aparte.
- **Código que quedó sin uso en la app** y se puede borrar en un PR aparte:
  - `src/server/ai/prompts/tutor.ts` (lo usa un test de evaluadores);
  - la rama del estudiante en `components/domain/sidebar.tsx`;
  - `components/domain/experience-results.tsx` (el estudiante ya no lo usa).
- **Títulos de pestaña:** algunos `metadata.title` de páginas del estudiante están escritos en la página ("Preguntar", "Mis datos"). Ninguno tiene jerga. Se pueden pasar a `TEXT` cuando se traduzca la app.
