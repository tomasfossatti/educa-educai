# Aviso de consentimiento

Versión del aviso: `2026-11b` (constante `CONSENT_VERSION` en `src/lib/constants.ts`). Texto en `src/lib/texts.ts`, sección `student.consent`.

## Cuándo aparece

En el primer ingreso, después de crear la cuenta, en una sola pantalla y antes de pedir el código de la materia (alta mínima del panel simple, ver `docs/DECISIONES.md`, 2026-11-16). La misma elección se ve y se cambia después desde Mis datos, en "Mi consentimiento".

## Texto que ve el estudiante

> **Antes de empezar**
>
> Tu docente ve partes de tus charlas, las dudas que detecte la IA, tu avance, tu carrera y tu proyecto.
>
> **¿Aceptás?**  [ Acepto ]  [ No, gracias ]

Detrás de "Ver más":

> - Tu docente ve los pedazos de tus charlas que la IA usa para encontrar dudas, junto con los mensajes de donde salen.
> - Ve las dudas que encuentra la IA. En sus números cuentan solo las que confirmás, o las que no respondés en 7 días si la IA está muy segura.
> - Ve tu avance en cada tema según tus prácticas, tu carrera, tu año y tu proyecto. De tu proyecto, solo lo que se relaciona con su materia.
> - Te ve con tu nombre. Cada vez que abre lo que ve sobre vos queda anotado, y vos ves quién fue y cuándo.
> - Nadie más ve tus charlas: ni otros estudiantes, ni el administrador, ni la universidad.
> - Si no aceptás, podés usar el chat y el material igual, pero nada se analiza ni le llega a tu docente.
> - Podés cambiar de idea cuando quieras desde Mis datos. Desde ese momento no se analiza nada nuevo y tu docente deja de ver tus charlas y lo que ve sobre vos.

## Por qué la frase dice "partes de tus charlas" y "las dudas que detecte la IA"

Se verificó contra el código el 2026-11-16:

- Ninguna pantalla del docente muestra una conversación completa. El docente ve los fragmentos usados como evidencia y los mensajes de donde salen (`getEvidenceDetail`, `src/server/services/development.ts`).
- El detalle de una evidencia lista todas las dudas detectadas sobre ese fragmento, también las no confirmadas o descartadas, y las estadísticas de la clase (`getCourseOverview`) las cuentan todas. Los porcentajes de la vista macro y de la ficha cuentan solo las que confirma el estudiante, o las no respondidas en 7 días con confianza alta (`countsForTeacher`).

Por eso el aviso dice "las dudas que detecte la IA" y aclara en "Ver más" qué cuenta en los números. Si Tomás decide que el docente no vea las dudas sin confirmar (pendiente en `docs/PROGRESO.md`), la frase puede pasar a "las dudas que confirmes".

## Cómo se registra la elección

- Ninguna opción viene elegida: son dos botones y hay que tocar uno. Si llega un pedido sin elección, la pantalla vuelve con "Elegí una de las dos opciones".
- Al aceptar se guardan la fecha (`StudentProfile.consentAnalysisAt`) y la versión del aviso (`consentVersion`).
- Al retirar, se borra la fecha de aceptación y se guarda la fecha de retiro (`consentWithdrawnAt`). Desde ese momento no se analiza ninguna conversación nueva y el docente pierde acceso a las conversaciones y a la ficha. Lo que ya se había generado se conserva y el estudiante lo sigue viendo; puede borrarlo charla por charla.
- Sin consentimiento, el estudiante no cuenta en los porcentajes que ve el docente.
- Quienes aceptaron la versión `2026-11` no tienen que volver a aceptar: aquella decía que el docente veía "tus conversaciones de la carpeta", es decir más de lo que ve. La versión nueva describe lo mismo con más precisión y sin ampliar nada.

Cada una de estas reglas tiene un test automático (V6, V7, V11 en `tests/integration/visibility-stage3.test.ts` y `visibility-stage4.test.ts`, y por la interfaz en `tests/e2e/mis-datos-reglas.spec.ts`).

## Lo que el aviso no dice y quizá debería

Son puntos para que el abogado decida si van en el aviso, en una política de privacidad aparte o en ninguno:

- Que las conversaciones se procesan con un proveedor de IA (Anthropic) y que la app corre en servidores fuera de Argentina.
- Quién es el responsable de los datos y cómo contactarlo.
- Cuánto tiempo se guardan los datos.
- Que el docente puede abrir la ficha con nombre y que cada apertura queda registrada (el aviso dice que el estudiante ve la lista de accesos, pero no que el docente ve su nombre).
- Que el uso de la IA tiene un tope semanal por estudiante.
- Que se puede pedir el acceso, la rectificación y la supresión de los datos (incluido el borrado de la cuenta, que ya existe en Mis datos), y ante quién reclamar (la Agencia de Acceso a la Información Pública).

## Propuesta de texto para que revise el abogado

Borrador que suma lo que el aviso actual no dice. **No está en la app**: si el abogado lo aprueba o lo corrige, se pasa a `src/lib/texts.ts` y se sube la versión del aviso. Lo que va entre corchetes depende de sus respuestas.

> **Quién ve qué**
>
> Tu docente de cada materia ve, en esa materia: tus conversaciones de la carpeta, las dudas que se detecten (después de que las confirmes), tu carrera, año y proyecto, y de tu proyecto solo lo que se vincule con la materia. Te ve con tu nombre, y cada vez que abre tu ficha queda registrado: vos ves quién la abrió y cuándo.
>
> Nadie más ve tus conversaciones: ni otros estudiantes, ni el administrador, ni la universidad.
>
> Para responderte y analizar tus conversaciones, Educai las envía a Anthropic, la empresa que provee la IA, que procesa los datos en Estados Unidos. La app y su base de datos funcionan en [proveedor de hosting], en [país].
>
> Tus datos se guardan hasta [plazo] o hasta que los borres. Desde Mis datos podés descargar una copia, borrar cada conversación o borrar tu cuenta entera.
>
> Responsable de los datos: [nombre], [correo de contacto]. Si no te responden, podés reclamar ante la Agencia de Acceso a la Información Pública.
>
> Si no aceptás, podés usar el chat y el material igual, pero nada se analiza ni le llega a tu docente. Podés retirar el consentimiento cuando quieras desde Mis datos: desde ese momento se deja de analizar y tu docente deja de ver tus charlas.
>
> **¿Aceptás que Educai analice tus conversaciones y se las muestre a tu docente como se explica arriba?**

## Cómo se cambia el texto

El texto vive en `src/lib/texts.ts`. Si el abogado pide cambios, se editan ahí, se sube `CONSENT_VERSION` y se decide qué pasa con quienes aceptaron la versión anterior (pedir de nuevo el consentimiento o no). Esa decisión va a `docs/DECISIONES.md`.
