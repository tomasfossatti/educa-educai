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

### 2026-11-16 · Las dudas se confirman dentro del chat
Contexto: las dudas detectadas aparecían en una lista al pie de la conversación, con "Sí, es una duda" y "No, descartar", y solo dentro de esa charla. El diseño nuevo pide una tarjeta en el chat, "Parece que te costó «tema». ¿Es así?", con dos botones grandes.
Decisión: el chat (el inicio y `/s/c/[id]`) muestra una tarjeta por duda pendiente de la materia elegida: las tres más nuevas en el inicio y las de esa charla en `/s/c/[id]`. "Sí" y "No" usan la misma acción de antes (`respondToDoubtAction` → `respondToSignal`). El fragmento que la respalda queda detrás de "Ver más". Mientras se analiza la charla recién terminada, el chat lo avisa en una frase y se actualiza solo. La regla de conteo no cambia: solo lo confirmado, o lo no respondido en 7 días con confianza alta, entra en los porcentajes del docente (`countsForTeacher`). El historial completo (confirmadas y descartadas) va a Mis datos.
Consecuencias: sin migración. `listPendingDoubts` y `listMyDoubts` en `src/server/services/doubts.ts`, siempre filtradas por el estudiante y, las pendientes, por una carpeta propia (`assertFolderOwner`).

### 2026-11-16 · Umbrales del semáforo de Mi avance
Contexto: Mi avance muestra un semáforo por tema, sin porcentajes. Lo tiene que calcular código determinístico a partir de `MasteryRecord`, no el modelo.
Alternativas: verde desde 0,7 (con dos intentos perfectos ya sería verde, pero también con dos intentos mediocres); verde solo con tres intentos (deja en amarillo a quien acertó todo dos veces); verde desde 0,8.
Decisión: `TRAFFIC_LIGHT` en `src/domain/traffic-light.ts`. Verde ("Lo domino") con un avance de 0,8 o más. Amarillo ("En camino") con al menos una práctica y menos de 0,8. Gris ("Sin empezar") sin prácticas o sin registro. Con el tope de la fórmula portada (0,5 con un intento y 0,8 con dos), el verde pide al menos dos prácticas buenas: un acierto con suerte no alcanza. Las dudas confirmadas no cambian el color, igual que no bajan el puntaje en el spec.
Consecuencias: sin migración. Tests de los bordes en `tests/unit/traffic-light.test.ts` (0,79, 0,8, un intento perfecto, dos perfectos y sin registro). Tocar un tema arranca una práctica de ese tema con la misma acción que Practicar.

### 2026-11-16 · Practicar: un botón por tema, resultado en una pantalla
Contexto: el quiz vivía dentro de la página de la carpeta, con el porcentaje de dominio a la vista. El diseño nuevo pide una lista de temas, que tocar uno arranque el quiz y un resultado con un solo mensaje y "Seguir".
Alternativas: arrancar el quiz con un enlace (`/s/practicar?tema=…`); con un botón que llama a la acción.
Decisión: cada tema es un botón que llama a `startQuizAction`. Un enlace se puede precargar y armaría quizzes (y gastaría IA) sin que nadie toque nada. Se reusa el quiz existente sin cambios: respuestas ocultas hasta entregar, mínimo de tres preguntas con fuente, tope de dominio y registro de intentos. El resultado dice "Acertaste N de M" y una frase: "¡Muy bien!" si acertó todas, "Vas bien" si no. No muestra porcentajes. El detalle de cada pregunta queda detrás de "Ver más". Si no se puede armar el quiz, Practicar lo avisa en una frase: falta material, el tope semanal o la IA no respondió. Las tareas del docente aparecen al pie solo si hay alguna.
Consecuencias: sin migración. `/s/folders/[f]/quiz/[q]` redirige a `/s/practicar/[q]`. `/s/courses/[id]` elige esa materia (con `/s/materia/[folderId]`, que solo guarda la cookie de navegación) y abre su chat. La página de la materia del PR 2 deja de existir, y su test de datos inventados sigue cubriendo las pantallas del estudiante. La carpeta ya no muestra el quiz.

### 2026-11-16 · El inicio es el chat y la materia actual es una carpeta
Contexto: el inicio tenía tarjetas de carpetas, "Tu desarrollo" y "Tu contexto declarado". El diseño nuevo pide que `/s` ya sea el chat, con la caja grande, como mucho dos toques entre el login y la primera pregunta, y un selector de materia arriba.
Alternativas: abrir el chat en `/s/c/[id]` después de la primera pregunta (cambia la dirección y obliga a volver); quedarse en `/s` con la última charla abierta.
Decisión: `/s` muestra la última charla abierta de la materia actual o, si no hay, la caja vacía. La primera pregunta crea la charla y responde en la misma acción, sin cambiar de pantalla. "Terminar" la cierra (y la analiza, si hay consentimiento), y la caja queda lista para otra. La materia actual es una carpeta: cookie `educai_folder`, con la de curso como respaldo para quien ya la tenía. Sumarse con código o aceptar una invitación lleva directo al chat de esa materia. Sin materia de la cátedra ni del LMS, `/s` muestra solo el campo del código. Las invitaciones pendientes son una tarjeta con "Unirme".
Consecuencias: sin migración. `src/server/services/student-panel.ts` arma el selector, la materia actual y la charla activa, siempre con datos del propio estudiante. Se retiran las tarjetas de carpetas y los bloques viejos del inicio.

### 2026-11-16 · Un solo chat: el de la carpeta de la materia
Contexto: el estudiante tenía dos chats. El tutor de la materia (`/s/courses/[id]/tutor/[c]`, `/api/tutor`, operación `tutor.reply`) no buscaba en el material, no citaba ni avisaba "sin fuente", no tenía hilos sobre un fragmento ni dudas para confirmar, y creaba conversaciones sin carpeta, así que no alimentaba el contexto. El de la carpeta (`/s/folders/[f]/c/[c]`, `folder.chat`) hace todo eso.
Alternativas: conservar el tutor y sumarle material y citas (habría que rehacer las citas en streaming); conservar el de la carpeta y llevarle lo único que el tutor tenía de más: el foco en un tema o en una tarea.
Decisión: queda el de la carpeta, en `/s/c/[id]`. Cumple la regla 4 de CLAUDE.md (cita archivo y página o dice que no hay fuente) y el modelo de datos del spec ("una conversación pertenece siempre a una carpeta"). "Pensarla con el tutor" y "Practicar con el tutor" abren una charla en la carpeta de la materia, con la tarea o el tema; el prompt del chat los recibe, con la instrucción de no resolver la tarea. Se retiran `/api/tutor/[id]`, el componente del chat en streaming y `services/conversations.ts`. El tope semanal y `AIUsageEvent` no cambian, porque el chat sigue pasando por `generateStructured`.
Consecuencias: migración de datos `unificar_chat`, aditiva e idempotente. Crea la carpeta de la materia si falta y asigna `folderId` a las conversaciones que no lo tenían; no toca mensajes. Las direcciones viejas (`/s/folders/[f]/c/[c]` con su hilo, `/s/courses/[id]/tutor/[c]`) redirigen. `prompts/tutor.ts` queda sin uso en la app (lo usa un test de evaluadores).

### 2026-11-16 · Panel del estudiante simplificado: el chat es la app (decisión de Tomás)
Contexto: el estudiante se perdía. Había dos chats paralelos (el tutor de la materia en `/s/courses/[id]/tutor`, sin material ni citas, y el de las carpetas en `/s/folders/[id]/c`), una página de materia con datos inventados y una barra lateral con diez entradas.
Alternativas: ordenar la barra actual; mantener el inicio con tarjetas y sumar un acceso directo al chat; rehacer la navegación alrededor del chat.
Decisión: Tomás decidió que el chat es la app. Hay tres destinos (Preguntar, Practicar y Mi avance) y un menú "Mis datos" que agrupa todo lo demás sin perder funciones. La vara es que alguien de 5 años lo use sin explicación, y hay como máximo dos toques entre el login y la primera pregunta. Reemplaza la sección "Panel del estudiante" del spec en lo que toca al inicio y la navegación. Las reglas V1 a V15 no cambian. No se toca el panel del docente.
Consecuencias: la sección del spec se reescribe; la etapa "Simplificación del panel del estudiante" se suma a `PROGRESO.md`, con un PR por paso. Las URLs viejas redirigen.

### 2026-11-16 · Frase de consentimiento fiel a lo que hoy ve el docente
Contexto: el aviso decía que el docente ve "tus conversaciones de la carpeta" y "las dudas que se detecten (después de que las confirmes)". En el código, ninguna pantalla del docente muestra una conversación completa. Muestra los fragmentos usados como evidencia, con los mensajes de donde salen, el avance por tema, la carrera, el año y el proyecto. Además, el detalle de una evidencia (`getEvidenceDetail`, `src/server/services/development.ts`) lista todas las dudas de esa evidencia, también las no confirmadas o descartadas, y las estadísticas de `attention.ts` cuentan todas las dudas.
Alternativas: escribir la frase según el código; filtrar las dudas no confirmadas en las vistas del docente (toca el panel del docente, que quedó fuera de este trabajo); mantener "tus conversaciones" (exagera).
Decisión (Tomás): la frase sigue al código: "Tu docente ve partes de tus charlas, las dudas que detecte la IA, tu avance, tu carrera y tu proyecto". El panel del docente no se toca. El hallazgo queda en `PROGRESO.md` para que Tomás decida si el docente debe ver las dudas sin confirmar.
Consecuencias: la frase y el detalle de "Ver más" cambian en `src/lib/texts.ts` y en `docs/legal/aviso-de-consentimiento.md`. Sube la versión del aviso.

### 2026-11-16 · "Mi proyecto" y las materias del LMS van en el selector de materia
Contexto: el diseño nuevo muestra el selector solo si hay más de una materia. Con una sola, el chat del proyecto personal, que el spec pide, quedaba inalcanzable.
Alternativas: el selector solo para materias y el proyecto en Mis datos; retirar el chat del proyecto.
Decisión (Tomás): el selector lista las materias, las traídas del LMS y "Mi proyecto", y aparece cuando hay dos opciones o más. Con una materia y el proyecto ya son dos.
Consecuencias: la "materia actual" pasa a ser una carpeta (cookie propia, con la de curso como respaldo).

### 2026-11-16 · "Lo que ve mi docente sobre mí": mismos datos, rótulos simples
Contexto: la ficha (V7) usa el mismo componente que el docente, con palabras como "evidencia", "dominio" y "conclusión", que el diseño nuevo prohíbe en lo que ve el estudiante.
Alternativas: mostrar los rótulos del docente y exceptuar la sección del test de jerga.
Decisión (Tomás): el mismo componente y los mismos datos, con rótulos simples cuando la mira el estudiante. Los rótulos del docente no cambian, y V7 sigue comparando el contenido.
Consecuencias: `StudentFileView` recibe los rótulos por parámetro.

### 2026-11-16 · Tareas en Practicar; desarrollo y conclusiones en Mis datos
Contexto: al dejar solo tres destinos, salen del menú Actividades y Desarrollo, que vienen de educa-educai y no figuran en el spec como destinos propios.
Alternativas: un cuarto destino; esconderlas detrás de Mis datos; quitarlas.
Decisión: las tareas que publica el docente aparecen al pie de Practicar, solo si hay alguna. Practicar es el lugar de "hacer algo con la materia". El desarrollo y las conclusiones van en Mis datos, dentro de "Lo que ve mi docente sobre mí", porque el docente los ve en su ficha y el spec pide que el estudiante pueda responder a una conclusión.
Consecuencias: ninguna función queda inalcanzable; las páginas viejas redirigen o se enlazan desde esos dos lugares.

### 2026-11-16 · Ramas encadenadas y PR en borrador para la simplificación
Contexto: son doce pasos que dependen uno del otro, y Tomás pidió no abrir PR a `main` sin su pedido.
Decisión (Tomás): cada rama sale de la anterior. Hay un PR en borrador por paso: el primero contra `main` y cada uno de los demás contra la rama anterior, así cada diff es chico. No se fusiona nada.

### 2026-11-16 · Un estudiante quitado vuelve solo si el docente lo invita
Contexto: en la ronda de QA, el docente quitó a una estudiante ("Dejarás de ver su información en este curso") y ella volvió a entrar con el código de la materia, sin que el docente hiciera nada. Al revés, invitarla de nuevo por email no hacía nada, porque su invitación ya figuraba como aceptada. El spec no dice qué pasa al quitar a alguien.
Alternativas: dejar que el código la reactive (el docente pierde el control de quién está); cambiar el código de la materia cada vez que se quita a alguien (afecta a toda la clase); bloquear el código para quien fue quitado y reabrir la invitación por email.
Decisión: el código no reactiva una inscripción quitada y le explica al estudiante que le pida a su docente que lo invite. Invitar de nuevo un email cuya invitación ya se aceptó, y que hoy no está inscripto, la vuelve a abrir; al aceptarla, la inscripción se reactiva.
Consecuencias: sin migración. La lógica pasa a `src/server/services/enrollment.ts`, con tests de integración.

### 2026-11-16 · La propuesta de temas corre en su propio pedido y no queda trabada
Contexto: con «Taller de innovación», Tomás vio la materia en «Procesando programa». La propuesta corría al final de la importación, en el mismo proceso en segundo plano, y Vercel corta ese proceso a los 5 minutos (`maxDuration` del asistente). La descarga de 16 PDF más una llamada a la IA gratuita (hasta 3 minutos, con un reintento) puede pasarse; si se corta, la currícula quedaba en EXTRACTING para siempre, sin forma de reintentar desde la pantalla.
Alternativas: subir el tope (el plan de Vercel lo limita); una cola de trabajos (infraestructura nueva); separar la propuesta en otro pedido y recuperar las que se cortan.
Decisión: la importación solo avisa. Cuando el chat ve la importación lista, pide la propuesta en otro pedido (`proposeTopicsAction`), con el tope completo. La reserva es atómica (no corre dos veces). Una currícula en EXTRACTING por más de 6 minutos pasa a «con error» al abrir el inicio o «Currícula». En «Currícula» hay un botón «Proponer temas con el material» para pedirla sin el chat.
Consecuencias: sin migración. Si la persona cierra el chat antes de que termine la descarga, la propuesta se pide desde «Currícula».

### 2026-11-16 · La importación del LMS propone los temas sin pedir el programa
Contexto: Tomás trajo «Costos de proyectos» con el asistente y la materia quedó en «Currícula sin cargar». Para tener temas había que subir el programa a mano, cuando el pedido era justamente que lo hiciera el asistente. Sin temas aprobados no hay dudas por tema, dominio, quiz ni slides.
Alternativas: buscar el programa en Canvas (no todas las cátedras lo publican y en Siglo 21 no está confirmado); proponer los temas con las lecturas importadas; aprobar los temas sin revisión (el spec pide que el docente los apruebe).
Decisión: al terminar la importación en una cátedra del docente sin programa (currícula sin cargar o con error), Educai arma un texto con cada lectura (módulo, título y sus primeros 1.500 caracteres, hasta 50.000 en total) y corre la misma extracción que con el programa. Los temas quedan propuestos y la currícula en revisión: el docente los acepta, edita o descarta y confirma. El chat lo avisa. No toca una currícula en revisión o configurada, ni las carpetas de los estudiantes. Volver a pedir una materia ya importada también dispara la propuesta si faltaba.
Consecuencias: sin migración. El texto armado queda como `programText`, con un encabezado que aclara que no es el programa oficial; las citas de los temas se validan contra ese texto. Una llamada a la IA por materia, registrada en `AIUsageEvent`.

### 2026-11-16 · "Sección" en vez de "pág." en los archivos sin páginas
Contexto: TXT, MD y DOCX no tienen páginas; Educai los parte en secciones de 3.000 caracteres y las citaba como "pág. N", que no coincide con nada que vea la persona (por ejemplo, las 4 lecturas escaneadas del módulo 1 de «Costos de proyectos», que entran como texto).
Alternativas: OCR de los PDF escaneados para tener páginas reales (dependencia pesada o costo por lectura); dejar "pág.".
Decisión: la unidad sale de la extensión del archivo (`src/domain/citations.ts`): "pág." en PDF y PPTX, "sección" en TXT, MD y DOCX, en el chat, el quiz, las slides, el PowerPoint, la lista de material ("11 secciones") y en los fragmentos que recibe la IA. El OCR queda para si muchas materias traen PDF escaneados.
Consecuencias: sin migración; las citas ya guardadas se muestran con la unidad nueva porque se arma al mostrarlas.

### 2026-11-16 · Lecturas de Siglo 21: el PDF primero y el texto con aviso
Contexto: en la primera importación real («Costos de proyectos», 16 lecturas) todo entró como `.txt` con nombres genéricos ("Módulo 1 · Lectura 1"). Las lecturas de meca.ues21.edu.ar no son Articulate Rise, como suponía el código portado de mcp-siglo: son HTML común con el título en el cabezal (`titulomateria`) y el PDF enlazado al lado con un ícono. Al entrar como texto, las "páginas" citadas son secciones de 3.000 caracteres que no coinciden con el PDF que ve el estudiante. Además, los 4 PDF del módulo 1 son escaneados (16 a 18 páginas sin texto); los otros 12 tienen texto y contienen todo lo de la página web.
Alternativas: guardar siempre el PDF (el módulo 1 quedaría sin texto); OCR de los escaneados (dependencia pesada y costo por lectura); usar siempre el texto de la página (citas con páginas que no existen).
Decisión: se usa el PDF del mismo servidor que la lectura si tiene texto en al menos la mitad de sus páginas; si no hay PDF o es escaneado, el texto de la página, y la importación lo avisa en el chat. El archivo lleva el título real de la lectura. Las lecturas pasan a la clave `reading2:` y, cuando la nueva queda lista, reemplazan lo guardado con la clave anterior, así que alcanza con volver a pedir la materia.
Consecuencias: sin migración (el aviso usa `LmsImport.error` cuando la importación termina bien). En los archivos de texto la cita dice "sección" (ver la entrada siguiente).

### 2026-11-16 · La extensión avisa en qué paso falló y usa el navegador real
En la primera prueba de Tomás con Siglo 21 la pantalla quedó en «Esperando a la extensión…» sin decir por qué. Ahora Educai guarda el último error al recibir la sesión (`LmsExtensionLink.lastError`, sin la cookie) y el asistente muestra en qué paso está: código sin usar, extensión vinculada sin sesión, o el motivo del fallo con el código HTTP de Canvas. Además, la extensión manda el user agent del navegador y Educai consulta Canvas con ese mismo valor (`LmsConnection.userAgent`), como hacía mcp-siglo con un user agent de Chrome. Con cookie y sin dato, se usa uno de Chrome. Migración aditiva `extension_diagnostico`. Extensión 1.0.1: hay que volver a descargarla.

### 2026-11-16 · Extensión de navegador para los Canvas que no dejan crear tokens
Contexto: Siglo 21 no deja crear tokens y pegar la cookie a mano vence enseguida. Tomás compartió la extensión de mcp-siglo y pidió una nueva, optimizada.
Alternativas: reusar la de mcp-siglo (crea una cuenta anónima por link, solo sirve para Siglo 21 y reenvía la cookie cada 10 minutos aunque no cambie); OAuth de Canvas (lo ideal, pero necesita una Developer Key que crea un administrador de la universidad).
Decisión: extensión propia (`extension/`, Manifest V3) vinculada a la cuenta de Educai con un código de un solo uso que vence a los 10 minutos y que la extensión cambia por una clave propia. De los dos solo se guarda el SHA-256. El código lleva el origen de Educai y el del Canvas, y la extensión pide permiso solo sobre esos dos sitios en el momento de vincular. Manda la sesión cuando cambia la cookie y, si no cambió, como mucho cada 30 minutos. Cada 10 minutos usa Canvas para que no cierre la sesión. Educai verifica la cookie con Canvas antes de guardarla (cifrada, como un token). Un código nuevo o «Desconectar» invalidan la clave anterior. Las dos rutas de la extensión no piden la contraseña de staging porque tienen su propia credencial. El zip se arma en el build (`public/educai-canvas.zip`) con íconos generados, sin binarios en el repo.
Consecuencias: migración aditiva `extension_canvas`. La extensión se instala como «descomprimida» en modo de desarrollador; publicarla en la Chrome Web Store necesita una cuenta de desarrollador de Tomás. La sesión se mantiene mientras Chrome esté abierto.

### 2026-11-16 · Asistente que trae materias del LMS por chat (cambio de alcance pedido por Tomás)
Contexto: el spec dejaba la integración con Canvas y Moodle fuera del piloto ("alta manual, sin LMS") y solo pedía portar el cliente de Canvas de mcp-siglo. Tomás pidió que el docente y el estudiante conecten su LMS y le digan al chat "crea la materia «Costos de proyectos»" para que Educai la arme y baje sus 4 módulos con 4 lecturas cada uno.
Alternativas: LTI 1.3 (lo que el spec proponía a futuro: requiere que la universidad registre la herramienta, fuera de nuestro control); login institucional con SSO y segundo factor como hace mcp-siglo (frágil y con contraseña del usuario de por medio); token de acceso del usuario. Para interpretar el pedido: dejarle la decisión a la IA con herramientas, o reconocer el pedido con código y usar la IA solo como respaldo.
Decisión: conexión por usuario con token de acceso (Canvas y Moodle), cookie de sesión para los Canvas que no dejan crear tokens (como Siglo 21) y usuario y contraseña en Moodle, que se cambian por un token y no se guardan. La credencial va cifrada con AES-256-GCM (`LMS_ENCRYPTION_KEY`) y nunca vuelve a la pantalla. El pedido se reconoce con código (`src/domain/lms.ts`); si no, la IA lo interpreta (`lms.assistant`, validado con zod) y el código decide qué materia es, y ante dos parecidas pregunta en vez de adivinar. El docente importa a una cátedra suya (nueva o la que ya tiene ese nombre); el estudiante, a una carpeta propia cuyo material solo ve él (`Material.folderId`, con una restricción en la base: una cátedra o una carpeta, nunca las dos). Si la materia ya está en Educai con su docente, el estudiante no la duplica. Se baja de los módulos: archivos (PDF, DOCX, PPTX, TXT), páginas con texto y las lecturas incrustadas con el formato de Siglo 21 (portado de mcp-siglo, con el PDF de "Descarga en PDF" si lo hay). La descarga corre después de responder (`after`), con avance en el chat, y no repite lo que ya bajó. Las direcciones se validan contra SSRF (solo https, sin IP privadas, redirecciones seguidas a mano y sin credenciales al salir del LMS).
Consecuencias: migración aditiva `lms_importacion` (dos tablas, dos enums y columnas opcionales en `Material` y `MaterialChunk`). Páginas `/t/asistente` y `/s/asistente`. Falta probarlo contra un Canvas o Moodle real: necesita un token o la cookie de Tomás.

### 2026-11-16 · La barra lateral del estudiante ya no muestra datos fijos
Mostraba "Estrategia y Validación de Negocios" y "Clase 4 de 8" para cualquiera. Ahora muestra la materia actual solo si existe y no muestra el número de clase, porque la app no lo calcula.

### 2026-11-16 · Lápiz mágico en los campos del perfil
Pedido de Tomás: cada cuadro de texto del primer ingreso y de Tu contexto tiene abajo a la derecha un botón que pide a la IA una mejor redacción. La sugerencia aparece debajo y solo reemplaza el texto si el estudiante toca "Usar". La instrucción es ordenar y aclarar sin completar: en la primera prueba real, con "Mejorar la distribución de educai", el modelo agregó "gestión y análisis de datos", que el estudiante no había escrito; se ajustó el prompt y ahora devuelve "Quiero desarrollar la capacidad de optimizar la distribución de Educai", y lo que quiera proponer lo plantea como pregunta. Tomás pidió después que el lápiz quede bloqueado hasta que haya texto (mejora lo escrito, no escribe desde cero) y que desarrolle con más detalle: la instrucción quedó en "desarrollar y hacer explícito lo implícito, sin datos nuevos", y la IA recibe como contexto lo que el estudiante ya escribió en otros campos (carrera, proyecto, qué hace hoy), solo para entender. Sin ese contexto entendía "distribución de Educai" como logística. Operación `profile.improve`, con zod, contada en el tope semanal del estudiante.

### 2026-11-16 · El estudiante elige de dónde salen los ejemplos: trabajo o proyecto
Cada parte de la app usaba un contexto distinto: el chat de carpetas, el proyecto personal; el motor y la devolución, el trabajo actual. Para alguien que trabaja en una petrolera y arma un centro de kinesiología, eso mezclaba dos mundos sin relación. Tomás decidió que el estudiante elija uno solo en el primer ingreso ("¿De dónde querés que la IA saque los ejemplos?", sin opción marcada), editable en Tu contexto. Se guarda en `StudentProfile.personalizationFocus` (migración aditiva; los perfiles existentes quedan en el proyecto, el foco del spec) y una sola función (`src/domain/personalization.ts`) arma el contexto para todos los prompts, con la instrucción de no usar el otro salvo que el estudiante lo mencione. "¿En qué estás hoy?" pasó a "¿Qué hacés hoy además de estudiar?" (trabajo, emprendimiento u organización, con o sin sueldo, porque muchos estudiantes emprenden sin cobrar) y es opcional, salvo que se elija como foco. Las opciones del foco son "De lo que hago hoy" y "De mi proyecto personal". La ficha muestra el foco, igual para el estudiante y el docente.

### 2026-11-15 · Cadena de respaldo entre proveedores gratuitos
A partir del script que pasó Tomás, `AI_PROVIDER=fallback` prueba en orden Groq (`openai/gpt-oss-120b`), Gemini, OpenRouter (`nvidia/nemotron-3-ultra-550b-a55b:free`; `openrouter/free` elegía modelos de 1,7B), DeepSeek y Cerebras, y pasa al siguiente ante un límite, falta de saldo, error del servidor, salida inválida o rechazo. Los que no tienen clave se saltean y cada llamada queda registrada con el proveedor y el modelo que respondieron. En una cadena no se espera ante un límite por minuto: se salta al siguiente, y solo el último espera. Con gpt-oss apareció que el modelo devolvía la fuente en `sources` pero no escribía "[1]" en el texto, y el código la marcaba sin fuente; en lugar de aflojar la regla, el prompt del chat ahora pide la marca con un ejemplo (4 de 4 citas correctas en la prueba). Planes gratuitos: solo datos sintéticos.

### 2026-11-15 · Gemini (plan gratuito) mientras DeepSeek no tenga saldo
Tomás pidió usar una API gratuita de Google hasta cargar saldo en DeepSeek. Gemini expone una API compatible con OpenAI, así que el proveedor de DeepSeek pasó a ser uno genérico (`openai-compatible.ts`) y DeepSeek y Gemini son dos configuraciones (`AI_PROVIDER=gemini`, modelo `gemini-3.5-flash`). Se probó contra la API real: modo JSON, `reasoning_effort`, streaming con uso y un chat con cita del material. El razonamiento interno de Gemini no viene en `completion_tokens`, así que se cuenta como salida desde `total_tokens`. El costo es 0 en el plan gratuito, cuyo límite son las solicitudes por minuto y por día. En ese plan Google puede usar lo enviado para mejorar sus productos: solo datos sintéticos, nunca estudiantes reales.

### 2026-11-15 · Sin revisión de abogado ni revisión de seguridad externa (decisión de Tomás)
Tomás decidió quitar de la etapa 6 la revisión del abogado (aviso de consentimiento y convenio) y la revisión de seguridad hecha por una persona. Los documentos de `docs/legal/` y `docs/seguridad/` quedan como referencia y siguen al día con el código. Lo que queda sin una mirada externa: el texto del aviso y las bases legales del tratamiento (incluida la transferencia internacional si se usa DeepSeek con estudiantes reales), y la verificación de permisos por alguien distinto de quien escribió el código. Lo cubren, hasta donde puede el código, los tests V1 a V15, el test de cobertura de permisos y los intentos por URL de Playwright.

### 2026-11-15 · DeepSeek como proveedor de IA provisorio
Tomás decidió usar la API de DeepSeek mientras no haya clave de Anthropic. Se sumó `src/server/ai/deepseek.ts` detrás de la misma interfaz (`AI_PROVIDER=deepseek`), sin dependencias nuevas: modo JSON con el esquema en el prompt y validación con zod, el PDF del programa convertido a texto, `reasoning_effort` low para el chat y high para el análisis, y costo con la tarifa de caché. Modelo `deepseek-flash` y precios configurables por variable; por defecto, la tarifa pico más alta publicada, para que el tope de gasto se active antes. Anthropic sigue disponible y es el valor por defecto. Riesgo: según su política de privacidad, DeepSeek procesa los datos en China; con datos sintéticos no importa, con estudiantes reales es una transferencia internacional que habría que resolver antes del piloto.

### 2026-11-15 · Staging en Vercel con Neon y contraseña de sitio
La cuenta de Vercel de Tomás ya tenía la integración de Neon, así que staging va ahí en lugar de Render (el spec admite "Render u otro servicio con PostgreSQL gestionado"): base en São Paulo, despliegue automático solo desde `main` y migraciones en el build. Como el registro de la app está abierto, staging pide una contraseña de sitio (`SITE_PASSWORD`, en `src/proxy.ts`) para que nadie de afuera cree cuentas y gaste IA real; sin la variable no cambia nada. Vercel limita cada pedido a 4,5 MB, lo que en staging achica el tamaño máximo del material.

### 2026-11-15 · Plazos de conservación: mecanismo listo, apagado por defecto
Los plazos son una decisión legal, así que el código no trae ninguno: cada uno es una variable vacía y, sin decisión, no se borra nada. El borrado reutiliza el mismo que usa el estudiante (V10) para no dejar evidencia ni contexto huérfanos, y se aplica a mano con una prueba previa que solo cuenta. Un plazo menor a 30 días se ignora como error de configuración.

### 2026-11-15 · Descarga de los datos propios
Para el derecho de acceso (art. 14) el estudiante descarga desde "Tu contexto" un JSON con todo lo suyo, sin el hash de la contraseña ni las sesiones; nadie más puede pedir esa copia. Se adelantó a la respuesta del abogado porque solo entrega a cada persona lo suyo y no amplía lo que ve nadie. En la misma pantalla se corrigió un texto que decía que las conversaciones eran visibles "solo" para el estudiante, cuando con consentimiento también las ve el docente de la materia.

### 2026-11-15 · Endurecimiento antes de la revisión de seguridad
Se sumó el test estático que pedía `PRUEBAS.md` (cada página, ruta y acción llama a un control de permisos), un flujo de Playwright que intenta abrir datos ajenos cambiando ids en la URL, control propio en `/s/join` y `/t/new`, un límite de 200 MB descomprimidos para DOCX y PPTX, y el borrado de las invitaciones con el correo al borrar la cuenta. El test estático confirma que hay un control, no que sea el correcto: eso lo siguen cubriendo los tests V1 a V15.

### 2026-11-15 · Documentos para el abogado en docs/legal
Describen lo que la app hace hoy, verificado contra el código, en lugar de una política redactada de antemano: aviso de consentimiento, tratamiento de datos y puntos para el convenio. Las brechas (sin descarga de datos, sin plazos de conservación automáticos, el aviso no nombra a los proveedores) quedan señaladas y no se implementan hasta que el abogado y Tomás decidan, porque cambian el alcance.

### 2026-11-15 · Consentimiento en las vistas del docente heredadas de educa-educai
Al preparar la revisión de seguridad apareció una brecha de V6 y V11: el detalle de evidencia y de conclusión, la cola de atención, los insights por tema, el resumen de la clase, el snapshot de desarrollo y el análisis de las entregas solo exigían inscripción. Un docente podía seguir leyendo fragmentos y mensajes de origen de un estudiante que había retirado el consentimiento. Ahora esas lecturas exigen consentimiento activo (en el servicio, no en cada página), y abrir una evidencia o una conclusión queda en `AccessLog` (V2). La regla no cambia: se aplica donde faltaba.

### 2026-11-15 · Backups del proveedor y prueba de restauración con scripts propios
El backup diario de producción lo hace el proveedor de la base; no se copia a GitHub ni a otro lado, porque los datos reales no salen de producción. Para probar la restauración hay dos scripts (`backup-db.sh` y `restore-check.sh`) que restauran en una base vacía, comparan filas por tabla y levantan la app contra esa base. El CI los corre en cada PR con datos sintéticos, así no se rompen sin que nadie lo note. Se agregó `/api/health` (base alcanzable, última migración, versión) para el chequeo de salud del proveedor y de la restauración.

### 2026-11-15 · Prueba de carga con Playwright y criterios medidos en el servidor
La prueba de carga (`npm run test:load`) usa Playwright con 60 contextos de navegador en lugar de k6, porque las acciones de Next no tienen una API HTTP estable para guionar a mano. Como los navegadores comparten la máquina, los criterios se miden en el servidor: login ≤ 5 s, páginas ≤ 1,5 s y preguntas ≤ 1 s más la demora de la IA (p95), cero errores e integridad de datos. Se recomienda una instancia de al menos 2 CPU para producción (detalle en `docs/informes/carga-etapa-6.md`). El proveedor guionado acepta `SCRIPTED_AI_LATENCY_MS` para simular la demora del modelo.

### 2026-11-15 · refresh() tolerante al final de las acciones
Con carga, `refresh()` lanzaba a veces "refresh can only be called from within a Server Action" después de que la acción ya había guardado todo, y el estudiante veía un error. Las acciones usan `src/server/next-refresh.ts`, que tolera solo ese error (la página se renderiza igual con datos nuevos) y lo registra. La causa dentro de Next no quedó identificada.

### 2026-11-15 · Tope semanal de IA por estudiante y alertas de consumo
Tope de 2 USD por semana y por estudiante (`AI_WEEKLY_STUDENT_CAP_USD`), con semana de lunes a domingo en hora argentina. Con el chat en Opus 5.5 alcanza para unas 40 preguntas con material y el análisis de esas conversaciones. Al llegar al tope se frenan el chat, el quiz y las subidas cuyo análisis lo pasaría, antes de llamar al modelo; el análisis de lo ya conversado sigue, porque su costo sale de conversaciones que pasaron por el tope. El estudiante ve un aviso desde el 80%. Las alertas (80% y 100% por estudiante, y del consumo total de la instalación, 25 USD por semana por defecto) se registran una vez por semana y umbral en `ProductEvent`, van al log y a un webhook opcional (`AI_ALERT_WEBHOOK_URL`, Slack o Discord) con el id del estudiante y sin nombre ni contenido. No hizo falta migración. Los montos son de partida y los ajusta Tomás.

### 2026-11-15 · Modelo económico para el análisis
El spec pide que la extracción de evidencia use un modelo más económico que el chat. El motor (`interpret.*`) y el contexto de carpeta (`context.*`) pasan a Claude Sonnet 5.5 (2/10 USD por millón contra 4/20 de Opus 5.5); chat, quiz, slides y programa siguen en Opus 5.5. Se descartó Haiku 5.5, que es mucho más barato pero no admite el respaldo del servidor ante rechazos y todavía no hay medición de precisión con modelo real. Se cambia con `AI_EXTRACTION_MODEL` o por operación con `AI_MODEL_<OPERACION>`; `AI_MODEL` ya no pisa el análisis.

### 2026-11-15 · Slides de la clase
Se agregó `ClassSession` (fecha, temas, objetivo, borrador y aprobación). El borrador sale del material de los temas y de las dudas frecuentes de la clase (vista macro de dos semanas). Las slides sin fragmento válido se descartan, y sin material no hay borrador. Editar o regenerar saca la aprobación. La aprobación es lo que muestra la próxima clase en el inicio del estudiante. PowerPoint con `pptxgenjs` (MIT): portada, una slide por punto, fuente al pie y notas del docente.

### 2026-11-15 · Pregunta sobre un fragmento: hilos dentro de la conversación
El hilo es parte de la misma conversación (`ConversationThread` y `Message.threadId`), así el motor lo sigue viendo como evidencia y el borrado en cascada lo incluye. El historial del hilo no se mezcla con el principal.

### 2026-11-15 · Contexto de carpeta: dónde vive el resumen y cuándo se construye
El resumen cruza carpetas, así que se guarda una sola fila SUMMARY activa en la carpeta del proyecto y entra al prompt de todas las carpetas. Los hechos se actualizan al cerrar cada conversación (o al recibir una subida) y el resumen se renueva como máximo una vez por día. Es análisis, así que se construye solo con el consentimiento activo. El archivado es condicional en la base, para no pisar una edición del estudiante que llegue mientras corre el proceso. El estudiante puede borrar; el proceso nunca borra.

### 2026-11-15 · Carpetas sin duplicados ante pedidos simultáneos
Se crean con `ON CONFLICT DO NOTHING`, y la carpeta del proyecto tiene un índice único parcial. La migración une duplicados si los hubiera, sin borrar datos.

### 2026-11-15 · Quiz y dominio por tema
La fórmula se portó tal cual de `deeptutor/learning/mastery.py` (con atribución en `THIRD_PARTY_NOTICES.md`). Con menos de cinco intentos se usan los últimos pesos y cada acierto se acota a 0..1, como en el original. El acierto de un intento es la fracción de respuestas correctas del quiz. Las preguntas sin fragmento válido como fuente se descartan, y si quedan menos de tres no hay quiz (no se inventa). Las respuestas correctas no llegan al navegador hasta entregar.

### 2026-11-15 · Flujos de punta a punta con Playwright en el repo y en el CI
`tests/e2e` corre sobre el build de producción con el proveedor guionado y una base propia, creando datos sintéticos en cada test. El CI suma un job `e2e`.

### 2026-11-15 · Cierre por inactividad sin tareas programadas
El spec procesa una conversación al cerrarla o a los 20 minutos de inactividad. El plan gratuito de Render no tiene tareas programadas, así que el cierre por inactividad se hace de forma oportunista: al cargar el panel del docente y el inicio del estudiante se cierran y encolan las conversaciones cuyo último mensaje tiene más de 20 minutos. Es idempotente (cierre condicional). Si más adelante hay un cron, llama a la misma función.

### 2026-11-15 · Aviso de consentimiento alineado con el spec
El aviso del onboarding decía que las conversaciones completas solo las ve el estudiante, y el consentimiento venía premarcado. Se reescribió según el spec (el docente de la materia ve conversaciones, dudas, perfil y proyecto vinculado; nadie más) y pasó a ser una elección explícita "Acepto / No acepto", sin opción por defecto. La versión del aviso sube a `2026-11`. El texto final lo revisa el abogado en la etapa 6.

### 2026-11-15 · Citas decididas en código
El modelo devuelve la respuesta y los números de los fragmentos usados (validado con zod). El código conserva solo los números válidos que además aparecen entre corchetes en el texto; si no queda ninguno, la respuesta se marca "sin fuente" y la interfaz lo avisa.

### 2026-11-15 · Búsqueda en el material: texto completo en español, embeddings después
Anthropic no ofrece embeddings y sumar otro proveedor (por ejemplo Voyage) requiere una cuenta y una clave que hoy no hay. La búsqueda usa el texto completo de PostgreSQL en español (`to_tsvector('spanish')` con índice GIN), en la misma base. La columna `embedding vector(1024)` ya existe y se completa cuando haya proveedor, para pasar a búsqueda híbrida sin migrar datos.

### 2026-11-15 · Página citable en formatos sin páginas
PDF cita la página y PPTX la diapositiva. DOCX y TXT no tienen páginas: se agrupan en secciones de unos 3000 caracteres y se cita la sección. Extracción con `unpdf` (MIT), `mammoth` (BSD) y `jszip` (MIT).

### 2026-11-15 · Etapa 3: esquema de carpetas y material
Se implementó la lista de la etapa 1 en la parte que usa la etapa 3: `Folder`, `FolderContext`, `Material`, `MaterialChunk` (con `embedding vector(1024)` nulo e índice de texto completo en español), `ConversationOrigin`, `Message.citations`, `Role.ADMIN` y en `StudentProfile` `consentWithdrawnAt`, `career`, `studyYear` y `projectDescription`. `AIConversation.courseId` y `Experience.courseId` pasan a opcionales por la carpeta del proyecto. `folderId` queda opcional en la base hasta que todo el código cree conversaciones con carpeta; la migración asigna las existentes a la carpeta de su materia. Todo es aditivo. `MasteryRecord`, `ClassSession` y `AccessLog` llegan con las etapas 4 y 5.

### 2026-11-15 · Sin consentimiento, el docente tampoco abre la ficha
La ficha se arma con la misma evidencia que las conversaciones, así que se aplica la misma regla (V6, V11): el docente la abre solo si el estudiante está inscripto y tiene el consentimiento activo. El estudiante siempre ve la suya.

### 2026-11-15 · Descartar PageLM, DeepStudent, Get It y Gemini
Las tres herramientas no figuran en el spec y sus acciones llamaban a la IA sin exigir sesión. Gemini está fuera del stack del spec. Sin `AI_PROVIDER`, el proveedor por defecto pasa a ser Anthropic.

### 2026-11-15 · Etapa 1: entidades nuevas y cambios al esquema (revisada por Tomás el 2026-11-16)
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
