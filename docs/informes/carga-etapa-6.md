# Prueba de carga de la etapa 6

15 de noviembre de 2026 · Claude Code

## Resumen

Educai aguanta 60 estudiantes conversando a la vez sin errores y sin perder ni duplicar datos. Con un servidor de 2 CPU se cumplen todos los criterios. Con 1 CPU se cumplen todos menos uno: si los 60 entran en el mismo segundo, el login tarda hasta 7 s (p95) por el costo del hash de contraseñas. La prueba encontró un error real, que quedó corregido: al cerrar una conversación el estudiante podía ver una página de error aunque el cierre y el análisis se hubieran hecho bien.

Detalle de cada corrida: [`carga-2026-11-15-1cpu.md`](carga-2026-11-15-1cpu.md) y [`carga-2026-11-15-2cpu.md`](carga-2026-11-15-2cpu.md).

## Escenario

`npm run build && npm run test:load` (Playwright, `tests/load/carga.spec.ts`). Una cátedra con material y 60 estudiantes sintéticos, cada uno con su propio contexto de navegador sobre el build de producción:

1. Los 60 inician sesión a la vez.
2. Cada uno abre la carpeta de la materia y empieza una conversación.
3. Tres rondas en las que los 60 preguntan al mismo tiempo (180 preguntas con búsqueda en el material y citas).
4. Los 60 cierran la conversación a la vez, lo que encola 60 análisis del motor y 60 actualizaciones del contexto de carpeta.

La IA es el proveedor guionado con 1,5 s de demora por llamada, para que las conexiones queden abiertas como con el modelo real. El servidor de la app se limitó a 1 o 2 CPU con `taskset`; PostgreSQL y los navegadores usaron el resto de la máquina (4 CPU, 16 GB).

## Resultados (servidor, p95)

| Medida | Criterio | 1 CPU | 2 CPU |
| --- | --- | --- | --- |
| Errores | 0 | 0 | 0 |
| Login simultáneo | ≤ 5 s | 7,0 s (no cumple) | 1,3 s |
| Abrir carpeta y cerrar conversación | ≤ 1,5 s | 0,7 s | 0,4 s |
| Pregunta, sin contar la demora de la IA | ≤ 1 s | 0,5 s | 0,2 s |
| Análisis terminados | 60 en ≤ 5 min | 60 en 13 s | 60 en 11 s |
| Mensajes, conversaciones y carpetas | sin pérdidas ni duplicados | sí | sí |

Los criterios se miden en el servidor (tiempo hasta el primer byte de cada página, navegación o acción). El tiempo total que ve cada estudiante en la prueba (de 2 a 30 s según la fase) está dominado por los 60 navegadores compitiendo por la misma CPU: con 10 estudiantes, abrir la carpeta tarda 1,3 s en total.

## Hallazgos

- **Página de error al cerrar una conversación (corregido).** Con carga, `refresh()` de Next a veces lanzaba "refresh can only be called from within a Server Action" al final de `closeConversationAction`, después de haber cerrado la conversación y encolado el análisis. El estudiante veía un error aunque todo se había guardado. Las acciones usan ahora `src/server/next-refresh.ts`, que tolera solo ese caso (el pedido ya está en la fase de render, que vuelve a armar la página con los datos nuevos) y lo deja en el log. Con el cambio, en las corridas posteriores no hubo errores. La causa exacta dentro de Next no quedó identificada.
- **Login con 1 CPU.** El hash scrypt (N = 2^15) cuesta unos 100 ms de CPU por login. No se baja el costo porque debilita las contraseñas. Como la sesión dura 30 días, el login masivo pasa una vez al inicio del piloto y no en cada clase.

## Recomendación para producción

Una instancia de la app con al menos 2 CPU durante el piloto. Con 1 CPU funciona, pero el primer ingreso de toda la clase a la vez puede tardar varios segundos.

## Qué no cubre esta prueba

- Los límites por minuto de la API de Anthropic: 60 preguntas simultáneas con el modelo real dependen del nivel de la cuenta. Se prueba cuando haya clave, junto con la prueba real de la etapa 2.
- La latencia real del modelo, que puede ser mayor que 1,5 s; con más demora las conexiones quedan abiertas más tiempo, pero el servidor no hace trabajo extra mientras espera.
- La base gestionada del proveedor: la prueba usó PostgreSQL local, con el pool de conexiones por defecto de Prisma.
