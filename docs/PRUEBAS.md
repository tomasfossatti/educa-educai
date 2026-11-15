# Estrategia de pruebas

Claude Code escribe y corre todas las pruebas. Este documento define qué se prueba, con qué datos y qué cuenta como prueba suficiente para cerrar una etapa.

## Capas

| Capa | Herramienta | Qué cubre | Cuándo corre |
| --- | --- | --- | --- |
| Unitarias | Vitest | Funciones puras: fórmula de dominio, agregados por tema, filtros de permisos, parsers | En cada commit y en el CI |
| Integración | Vitest con PostgreSQL real | Acciones del servidor, capa de permisos, motor de análisis con el proveedor de IA guionado | En el CI |
| Punta a punta | Playwright | Flujos completos de estudiante y docente en un navegador | En el CI y antes de cerrar cada etapa |
| IA real | Script con la clave de staging | Calidad de extracción, citas y respuestas con el modelo real | A mano, antes de cerrar las etapas 2, 3 y 4 |
| Carga | Playwright (`npm run test:load`, `tests/load`) | 60 estudiantes simulados conversando a la vez, con demora simulada de la IA | Etapa 6, a mano antes de cambios grandes |

## Proveedor de IA guionado

`AI_PROVIDER=scripted` hace que `src/server/ai` devuelva respuestas predefinidas a partir de fixtures en `tests/fixtures/ai/`. Cada fixture declara la entrada que espera y la salida que devuelve, validada con el mismo zod que la salida real. Así el CI es determinístico, gratis y rápido. Cuando el formato de una salida cambia, el fixture se actualiza en el mismo PR.

## Datos sintéticos

Las fábricas viven en `tests/support/factories.ts` y crean, sin tocar datos reales:

- `crearInstitucion()`, `crearCatedra({ docentes, temas })`, `crearDocente()`, `crearEstudiante({ consentimiento })`.
- `inscribir(estudiante, catedra)` y `crearCarpetas(estudiante)`.
- `crearConversacion(carpeta, { turnos, temasDudosos })` con texto en español rioplatense que mencione temas del programa.
- `crearMaterial(catedra, { paginas })` con un PDF generado a partir de texto sintético, para probar citas por archivo y página.

Cada ejecución crea sus propios usuarios con contraseñas aleatorias, dentro de una transacción o de una base descartable, y los limpia al terminar. Ningún dato de una prueba se reutiliza en otra.

## Pruebas de visibilidad V1 a V15

- Un archivo `tests/integration/visibilidad.test.ts` con un caso por regla, nombrado igual que en el spec (`V1`, `V2`, etc.).
- Cada caso arma el escenario mínimo con las fábricas y verifica tanto el resultado permitido como el rechazo, incluyendo que el rechazo no filtre información en el mensaje de error.
- Un caso extra recorre todas las rutas y acciones del servidor, y falla si encuentra alguna que consulte Prisma con datos de estudiantes sin pasar por `guards.ts` (`tests/unit/guard-coverage.test.ts`: exige que cada página, ruta y acción llame a un control).
- Las etapas 3 y 4 no se cierran hasta que sus reglas tienen tests en verde (ver criterios en el spec).

## Calidad de la detección de dudas

- Un conjunto de 30 conversaciones sintéticas en `tests/fixtures/dudas/`, cada una etiquetada a mano con los temas donde hay duda real y los temas donde no.
- Para cerrar la etapa 4 hace falta que al menos el 80% de las dudas detectadas con el modelo real sean correctas.
- Tomás revisa las etiquetas de una muestra de 10 conversaciones antes de que Claude Code las use como vara de medida, para que la IA no se califique a sí misma.

## Flujos de punta a punta mínimos

1. El docente crea la cátedra, sube material, aprueba temas e invita a dos estudiantes.
2. Un estudiante acepta, da consentimiento, conversa con la IA y confirma una duda detectada.
3. El docente ve el porcentaje con su denominador, abre la ficha y el estudiante ve el acceso registrado.
4. Un estudiante que rechaza el consentimiento conversa y no aparece en ningún panel.
5. Un estudiante borra una conversación y los porcentajes se recalculan.
6. Un docente intenta abrir la ficha de un estudiante de otra cátedra y recibe un rechazo.

## Criterios generales

- Lint, tipos, tests y build en verde antes de abrir un PR.
- Cada bug corregido deja un test que habría fallado antes de la corrección.
- Una función nueva sin prueba no se fusiona.
- Cada informe de prueba con IA real se guarda en `docs/informes/` con fecha, modelo, costo y resultado.
