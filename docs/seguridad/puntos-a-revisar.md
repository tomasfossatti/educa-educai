# Puntos a revisar

Lo que conviene mirar con más cuidado, ordenado por riesgo. Los dos primeros son hallazgos que ya se corrigieron durante la preparación del paquete y conviene verificar.

## Hallazgos ya corregidos

1. **Docente que lee mensajes de un estudiante que retiró el consentimiento (V11).** Las pantallas heredadas de educa-educai (detalle de evidencia y de conclusión, cola de atención, insights, resumen de la clase, snapshot de desarrollo y análisis de entregas) solo exigían inscripción. El detalle de evidencia trae además los mensajes de origen de la conversación. Se corrigió en el servicio y quedó cubierto por `visibility-consent-teacher-views.test.ts`. Abrir una evidencia o una conclusión no quedaba registrado; ahora sí (V2). Conviene revisar que no quede otra lectura de evidencia, señales o conclusiones sin el filtro de consentimiento: `grep -rn "evidenceObject\|inference\.\|signal\." src/app src/server/services`.
2. **Página de error al cerrar una conversación con carga.** No era un problema de permisos: `refresh()` fallaba después de guardar todo. Ver `docs/informes/carga-etapa-6.md`.

## Permisos

3. **Consultas directas a Prisma en páginas.** Muchas páginas, sobre todo las heredadas, hacen el control con un `require*` y después consultan la base directamente, filtrando a mano por estudiante o por cátedra. La regla 1 de `CLAUDE.md` pide que todo pase por `guards.ts`. Vale la pena leer el `where` de cada consulta en `src/app/t/courses/[courseId]/**` y `src/app/s/(app)/courses/**`.
4. **`requireTeacherStudent` no exige consentimiento.** La ficha del docente lo resuelve aparte. Cualquier dato nuevo que se agregue a esa página tiene que pasar por `loadStudentFile` o por un filtro de consentimiento.
5. **Controles solo en el layout.** `/s/join` y `/t/new` dependen del layout para el control de sesión. En Next, un layout no es una frontera de seguridad confiable para todas las navegaciones. Hoy esas páginas solo muestran formularios y sus acciones tienen control propio.
6. **Contexto declarado.** El docente ve el contexto que el estudiante declaró si este activó "compartir con docentes" (`shareContextWithTeachers`), aunque no haya dado el consentimiento de análisis. Es una elección separada del estudiante; confirmar que el texto de esa opción lo deja claro.
7. **Rutas heredadas del tutor** (`/s/courses/[courseId]/tutor/...` y `/api/tutor/...`). Siguen activas junto con el chat de carpetas. Si no se usan en el piloto, conviene sacarlas para reducir superficie.

## Autenticación y sesión

8. **IP para el límite de intentos.** `clientIp` toma la última dirección de `x-forwarded-for`, que es la que agrega el proxy del proveedor. Confirmar que en producción hay exactamente un proxy delante de la app; si hay dos, la IP sería la del primer proxy.
9. **Cookies.** `httpOnly`, `SameSite` y `Secure` con `SESSION_COOKIE_SECURE=true` en producción (`render.yaml` lo fija). La sesión dura 30 días y el token se guarda solo como hash.
10. **Proveedor guionado en producción.** `AI_PROVIDER=scripted` está prohibido con `NODE_ENV=production` salvo `ALLOW_SCRIPTED_AI=true`, que solo usan el e2e y la prueba de carga. Confirmar que producción no tiene esa variable.

## Archivos y contenido

11. **Material de la cátedra (PDF, DOCX, PPTX, hasta 20 MB).** DOCX y PPTX son ZIP: no hay límite al tamaño descomprimido (`src/server/material/extract.ts`), así que un archivo armado a propósito podría consumir memoria. Solo lo sube el docente, lo que baja el riesgo.
12. **Inyección de instrucciones.** Una conversación subida o un archivo del material puede traer texto que intente manipular al modelo. La salida del modelo se valida con zod y el código decide qué se muestra y a quién; las herramientas de los chats reciben datos ya filtrados por permisos. Vale la pena intentar, desde el chat del docente, pedir datos de otra cátedra (V12) y, desde el del estudiante, datos de otro estudiante (V13).
13. **Citas.** El código solo conserva los números de fragmentos que existen y aparecen en el texto. Confirmar que un fragmento citado nunca pertenece a otra cátedra (`searchMaterial` filtra por `courseId`).

## Operación

14. **Secretos.** Solo en las variables del proveedor y en `.secrets/` (ignorada por git). El webhook de alertas de consumo es un secreto.
15. **Logs.** No deberían incluir contenido de conversaciones. Las alertas de consumo llevan solo el id del estudiante.
16. **`/api/health` es pública.** Devuelve el nombre de la última migración y el commit desplegado. No expone datos, pero sí la versión.
17. **Backups.** No salen de producción. El procedimiento de restauración está en `docs/ENTORNOS_Y_DESPLIEGUE.md`.
