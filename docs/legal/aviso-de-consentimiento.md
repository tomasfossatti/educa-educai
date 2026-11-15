# Aviso de consentimiento

Versión del aviso: `2026-11` (constante `CONSENT_VERSION` en `src/lib/constants.ts`). Texto en `src/lib/texts.ts`, sección `consent`.

## Cuándo aparece

En el primer ingreso, después de aceptar la invitación de la cátedra y crear la cuenta, y antes de completar carrera, año y proyecto. La misma elección se puede cambiar después desde la pantalla "Tu contexto".

## Texto que ve el estudiante

> **Quién ve qué**
>
> Tu docente de cada materia ve, en esa materia: tus conversaciones de la carpeta, las dudas que se detecten (después de que las confirmes), tu carrera, año y proyecto, y de tu proyecto solo lo que se vincule con la materia.
>
> Nadie más ve tus conversaciones: ni otros estudiantes, ni el administrador, ni la universidad.
>
> Vos ves la misma ficha que tu docente y la lista de quién la abrió y cuándo.
>
> Si no aceptás, podés usar el chat y el material igual, pero nada se analiza ni le llega a tu docente.
>
> Podés retirar el consentimiento cuando quieras desde Tu contexto: desde ese momento se deja de analizar y tu docente deja de ver tus conversaciones.
>
> **¿Aceptás que Educai analice tus conversaciones y se las muestre a tu docente como se explica arriba?**
>
> ( ) Acepto   ( ) No acepto

## Cómo se registra la elección

- Ninguna opción viene marcada. Si el estudiante no elige, el formulario no avanza ("Elegí si aceptás o no").
- Al aceptar se guardan la fecha (`StudentProfile.consentAnalysisAt`) y la versión del aviso (`consentVersion`).
- Al retirar, se borra la fecha de aceptación y se guarda la fecha de retiro (`consentWithdrawnAt`). Desde ese momento no se analiza ninguna conversación nueva y el docente pierde acceso a las conversaciones y a la ficha. Lo que ya se había generado se conserva y el estudiante lo sigue viendo; puede borrarlo conversación por conversación.
- Sin consentimiento, el estudiante no cuenta en los porcentajes que ve el docente.

Cada una de estas reglas tiene un test automático (V6, V7, V11 en `tests/integration/visibility-stage3.test.ts` y `visibility-stage4.test.ts`).

## Lo que el aviso no dice y quizá debería

Son puntos para que el abogado decida si van en el aviso, en una política de privacidad aparte o en ninguno:

- Que las conversaciones se procesan con un proveedor de IA (Anthropic) y que la app corre en servidores fuera de Argentina.
- Quién es el responsable de los datos y cómo contactarlo.
- Cuánto tiempo se guardan los datos.
- Que el docente puede abrir la ficha con nombre y que cada apertura queda registrada (el aviso dice que el estudiante ve la lista de accesos, pero no que el docente ve su nombre).
- Que el uso de la IA tiene un tope semanal por estudiante.
- Que se puede pedir el acceso, la rectificación y la supresión de los datos (incluido el borrado de la cuenta, que ya existe en "Tu contexto"), y ante quién reclamar (la Agencia de Acceso a la Información Pública).

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
> Tus datos se guardan hasta [plazo] o hasta que los borres. Desde Tu contexto podés descargar una copia, borrar cada conversación o borrar tu cuenta entera.
>
> Responsable de los datos: [nombre], [correo de contacto]. Si no te responden, podés reclamar ante la Agencia de Acceso a la Información Pública.
>
> Si no aceptás, podés usar el chat y el material igual, pero nada se analiza ni le llega a tu docente. Podés retirar el consentimiento cuando quieras desde Tu contexto: desde ese momento se deja de analizar y tu docente deja de ver tus conversaciones.
>
> **¿Aceptás que Educai analice tus conversaciones y se las muestre a tu docente como se explica arriba?**

## Cómo se cambia el texto

El texto vive en `src/lib/texts.ts`. Si el abogado pide cambios, se editan ahí, se sube `CONSENT_VERSION` y se decide qué pasa con quienes aceptaron la versión anterior (pedir de nuevo el consentimiento o no). Esa decisión va a `docs/DECISIONES.md`.
