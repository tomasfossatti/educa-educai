# Manual Técnico y Especificación de Arquitectura: Servidor MCP para Canvas LMS

> **Destinatario de este documento**: Agentes de Inteligencia Artificial (LLMs), arquitectos de software e ingenieros de integración.  
> **Propósito**: Este documento contiene la especificación completa, técnica y operativa del servidor Model Context Protocol (MCP) desarrollado para interactuar con la plataforma educativa **Canvas LMS** (específicamente adaptado y verificado para la **Universidad Siglo 21** de Argentina).

---

## 1. Visión General del Sistema

El **Servidor MCP Canvas LMS** es un middleware en TypeScript que implementa el protocolo abierto **Model Context Protocol (MCP)** mediante el SDK oficial `@modelcontextprotocol/sdk`. Actúa como puente entre un modelo de lenguaje (como Claude Desktop, Cursor o Antigravity) y la API REST de Canvas LMS.

### El Problema que Resuelve
En la mayoría de las instituciones educativas (como Universidad Siglo 21), los estudiantes **no poseen permisos de administrador** para generar Tokens de Acceso personales (Developer Tokens / Bearer API Keys). Por tanto, cualquier integración tradicional por API Key resulta inviable.

### La Solución Implementada
Este servidor implementa un cliente HTTP autenticado mediante **Cookies de Sesión Activa** y cabeceras **User-Agent** de navegador real. Adicionalmente, cuenta con un subsistema automatizado con **Puppeteer** capaz de renovar la sesión mediante **Microsoft Azure AD SSO (SAML 2.0)** cuando las cookies expiran (código HTTP `401 Unauthorized`).

```mermaid
flowchart TD
    subgraph IA ["Cliente de IA (Host MCP)"]
        LLM["Modelo LLM\n(Claude / Cursor / Antigravity)"]
    end

    subgraph MCP ["Servidor MCP (Node.js / TypeScript)"]
        STDIO["Transporte STDIO (JSON-RPC 2.0)"]
        MCPSRV["McpServer Engine (@modelcontextprotocol/sdk)"]
        TOOLS["Herramientas (Tools)\n- list_courses\n- get_pending_assignments\n- list_course_files\n- read_course_file_content\n- get_canvas_user_profile"]
        CLIENT["CanvasClient (Axios Instance)\n+ Inyección de Cookies & User-Agent\n+ Sanitización de Headers en Redirecciones"]
        PDF["PDF Parser (pdf-parse / Text Extractor)"]
    end

    subgraph CANVAS ["Infraestructura Canvas LMS / Siglo 21"]
        API["Canvas LMS REST API (/api/v1/...)"]
        S3["Almacenamiento CDN / AWS S3 (Signed URLs)"]
        MECA["Plataforma Interactiva MECA (Articulate Rise SPA)"]
    end

    subgraph RENEW ["Subsistema de Auto-Renovación"]
        PUPP["renew_canvas_cookie.js (Puppeteer Headless)"]
        MSSO["Microsoft SSO / SAML 243 (Azure AD)"]
        ENV[".env Configuration Store"]
    end

    LLM <-->|JSON-RPC 2.0| STDIO
    STDIO <--> MCPSRV
    MCPSRV --> TOOLS
    TOOLS --> CLIENT
    TOOLS --> PDF
    CLIENT <-->|HTTP GET con Cookies| API
    CLIENT <-->|Descarga Binaria (Strip Headers)| S3
    CLIENT <-->|Extracción de Assets| MECA
    
    API -.->|401 Expiración| RENEW
    PUPP <-->|Autenticación Headless| MSSO
    PUPP -->|Actualiza Cookies| ENV
    ENV -.->|Recarga credenciales| CLIENT
```

---

## 2. Topología de Archivos y Responsabilidades

```
MCP Siglo/
├── package.json              # Configuración ESM, scripts y dependencias
├── tsconfig.json             # Compilación TypeScript (NodeNext / ES2022)
├── .env                      # Almacén de credenciales y cookies (GIT-IGNORED)
├── .env.example              # Plantilla para variables de entorno
├── .gitignore                # Reglas de exclusión para control de versiones
├── renew_canvas_cookie.js    # Script de automatización Puppeteer para login SSO
├── README.md                 # Guía para el usuario humano
├── CANVAS_MCP_AI_SPEC.md     # Este documento de especificación
├── dist/                     # Código transpilado a JavaScript ejecutable
│   ├── index.js
│   ├── canvas-client.js
│   ├── config.js
│   └── types.js
└── src/                      # Código fuente en TypeScript
    ├── index.ts              # Entrypoint MCP: inicialización, schemas Zod y registro de Tools
    ├── canvas-client.ts      # Cliente HTTP de Canvas, descarga binaria y parsing PDF
    ├── config.ts             # Parser y validador de configuración de entorno
    └── types.ts              # Modelos de datos e interfaces TypeScript
```

### Detalle de Componentes Fuente (`src/`)

#### [`src/config.ts`](file:///Users/tomas/Desktop/Proyectos/MCP%20Siglo/src/config.ts)
- Carga las variables de entorno desde `.env` usando `dotenv`.
- Sanitiza la URL base de Canvas eliminando barras finales diagonales.
- Provee valores predeterminados seguros (User-Agent de Chrome moderno y URL base de Siglo 21 `https://siglo21.instructure.com`).

#### [`src/types.ts`](file:///Users/tomas/Desktop/Proyectos/MCP%20Siglo/src/types.ts)
Contrato de datos TypeScript que modela los recursos de Canvas:
- `CanvasCourse`: Cursos, nombres, códigos (`INF346`), términos (`Cursado Presencial 2/26`), docentes.
- `CanvasAssignment`: Tareas, entregas, fechas límites (`due_at`), puntos posibles, URLs.
- `CanvasTodoItem`: Elementos en la lista ToDo del usuario.
- `CanvasFile`: Archivos, tamaños, fechas, tipos MIME (`content-type`), URLs de descarga.
- `CanvasUserProfile`: Perfil, ID interno, nombre, correo institucional.
- `FileContentResult`: Resultado estructurado de la lectura y extracción de texto de un archivo.

#### [`src/canvas-client.ts`](file:///Users/tomas/Desktop/Proyectos/MCP%20Siglo/src/canvas-client.ts)
El corazón de la comunicación HTTP. Maneja:
1. **Configuración de Cabeceras**:
   - `Cookie`: Inyecta la cadena completa de cookies de sesión.
   - `User-Agent`: Cabecera de navegador real para evitar bloqueos Cloudflare/WAF.
   - `X-Requested-With: XMLHttpRequest`: Simula llamadas AJAX de Canvas web.
   - `Accept: application/json+canvas-string-ids, application/json`.
2. **Manejo de Errores Contextuales (`handleError`)**:
   - `401 Unauthorized`: Detecta sesión vencida e instruye renovar cookies.
   - `403 Forbidden`: Detecta restricciones de permisos (ej. pestaña archivos oculta).
   - `404 Not Found`: Detecta recursos inexistentes o eliminados.
3. **Hook `beforeRedirect` Crítico**:
   - *Comportamiento Canvas*: Al descargar un archivo (`/files/:id/download`), Canvas responde con un `302 Found` hacia Amazon S3 (`*.amazonaws.com`).
   - *Problema*: Si Axios reenvía las cabeceras `Cookie` o `X-Requested-With` a una URL prefirmada de AWS S3, Amazon responde con `400 Bad Request` (`Only one auth mechanism allowed` o `SignatureDoesNotMatch`).
   - *Solución*: El hook `beforeRedirect` detecta si el host de destino difiere del dominio de Canvas y elimina automáticamente `Cookie`, `Authorization` y `X-Requested-With`.
4. **Procesamiento de Archivos (`readCourseFileContent`)**:
   - Descarga binaria con `responseType: 'arraybuffer'`.
   - Si es PDF: lo procesa con `PDFParse` (`pdf-parse`), obteniendo texto limpio y número de páginas.
   - Si es texto plano (TXT, MD, CSV, JSON, HTML, código): decodifica a UTF-8.
   - Control de contexto: Trunca a `maxCharacters` si el documento es masivo para evitar saturar la ventana de contexto del LLM.

#### [`src/index.ts`](file:///Users/tomas/Desktop/Proyectos/MCP%20Siglo/src/index.ts)
- Registra el servidor `McpServer({ name: 'canvas-lms-mcp-server', version: '1.0.0' })`.
- Conecta el transporte `StdioServerTransport` para comunicación bidireccional estándar por `process.stdin` / `process.stdout`.
- IMPORTANTE: Todos los logs de diagnóstico se dirigen exclusivamente a `console.error` (STDERR) para no corromper los mensajes de protocolo JSON-RPC en STDOUT.

---

## 3. Catálogo de Herramientas (Tools) Expuestas

Todas las herramientas siguen el estándar MCP y están documentadas mediante esquemas **Zod**:

### 1. `list_courses`
* **Descripción**: Lista los cursos del usuario en Canvas LMS.
* **Argumentos**:
  * `enrollment_state` *(string, opcional)*: `"active"` (predeterminado), `"completed"`, o `"all"`.
* **Comportamiento**: Llama a `GET /api/v1/courses?include[]=term&include[]=teachers&include[]=total_students&per_page=100`. Filtra cursos restringidos o sin nombre.
* **Respuesta**: Markdown detallado con ID de curso, nombre oficial, código, período académico y cantidad de alumnos.

### 2. `get_pending_assignments`
* **Descripción**: Consulta las tareas, cuestionarios y actividades pendientes de entrega o calificación.
* **Argumentos**:
  * `course_id` *(number, opcional)*: ID numérico del curso para filtrar tareas pendientes.
* **Comportamiento**:
  * Si no hay `course_id`: consulta `GET /api/v1/users/self/todo`.
  * Si se proporciona `course_id`: consulta las entregas reales individuales del estudiante en `GET /api/v1/courses/:course_id/students/submissions?student_ids[]=self&include[]=assignment&per_page=100`.
  * Filtra los registros en estado `unsubmitted` y los ordena cronológicamente por `due_at` (vencimientos más próximos primero).
* **Respuesta**: Nombre de la actividad, fecha límite exacta en hora local (GMT-3), puntaje máximo, método de entrega y enlace directo en Canvas.

### 3. `list_course_files`
* **Descripción**: Lista los archivos y recursos subidos en la sección de archivos de un curso.
* **Argumentos**:
  * `course_id` *(number, requerido)*: ID del curso en Canvas.
  * `search_term` *(string, opcional)*: Filtro por nombre de archivo.
  * `limit` *(number, opcional, default: 50)*: Cantidad máxima de archivos.
* **Comportamiento**: Invoca `GET /api/v1/courses/:course_id/files`.
* **Nota Técnica de Siglo 21**: Si la cátedra tiene oculta la pestaña de Archivos para estudiantes, retornará `403 Forbidden`. En ese caso, los archivos deben localizarse vía `pages/modulos` o dentro de los enunciados de las asignaciones.

### 4. `read_course_file_content`
* **Descripción**: Descarga un archivo por su `file_id` y extrae su texto plano digital.
* **Argumentos**:
  * `file_id` *(number, requerido)*: ID numérico del archivo en Canvas LMS.
  * `max_characters` *(number, opcional, default: 50000)*: Límite de caracteres retornados.
* **Comportamiento**:
  * Consulta metadatos en `GET /api/v1/files/:file_id`.
  * Descarga el binario desde `file.url` (siguiendo redirecciones y aislando cabeceras hacia S3).
  * Si es PDF: ejecuta `new PDFParse({ data: buffer }).getText()`.
  * Si es texto/código: `buffer.toString('utf-8')`.
* **Respuesta**: Metadatos (páginas, tamaño, caracteres totales) y el texto completo listo para análisis.

### 5. `get_canvas_user_profile`
* **Descripción**: Herramienta de verificación de conexión y estado de sesión.
* **Argumentos**: Ninguno.
* **Comportamiento**: Consulta `GET /api/v1/users/self/profile`.
* **Respuesta**: Nombre completo del usuario, ID de cuenta y confirmación de cookies activas.

---

## 4. Particularidades Arquitectónicas de la Universidad Siglo 21

Cualquier IA que interactúe con este repositorio debe conocer estas 3 características específicas de la implementación de Siglo 21:

### A. La Pestaña `/files` oculta (Error 403)
En Siglo 21, el acceso directo a `/api/v1/courses/:id/files` está bloqueado para estudiantes.
* **Dónde están los archivos de las materias**:
  1. En las asignaciones (Trabajos Prácticos): en el HTML de la descripción se incluye el enlace directo de descarga:
     `https://siglo21.instructure.com/courses/:id/files/:file_id/download?wrap=1`. Con este enlace se extrae el `file_id` y se lee con `read_course_file_content`.
  2. En la página de módulos: `GET /api/v1/courses/:id/pages/modulos`.

### B. El Ecosistema Multimedia MECA (Articulate Rise)
Las lecturas teóricas de los módulos no son PDFs sueltos en Canvas, sino aplicaciones web interactivas servidas en el dominio `meca.ues21.edu.ar`:
- URL típica: `https://meca.ues21.edu.ar/canvas/.../L1/index.html`
- **Estructura Interna**:
  - Contiene un objeto global `window.courseData` (cadena JSON en Base64).
  - Al decodificar el Base64, se accede al árbol de lecciones.
  - La última lección siempre se titula `"Descarga en PDF"`.
  - Dicha lección contiene en su propiedad `media.attachment` el nombre del PDF oficial alojado en la subcarpeta `assets/` de esa lectura en MECA.

### C. Redirección de Login CloudFront -> Microsoft Azure AD (SAML 243)
Al navegar a `https://siglo21.instructure.com/login/canvas`, Siglo 21 redirige a una landing page en CloudFront (`d3hpxjm15fh1lx.cloudfront.net`).
- El botón **"Soy Estudiante"** dirige a `https://siglo21.instructure.com/login/saml/243`.
- Éste inicia un flujo SAML 2.0 que delega la autenticación en **Microsoft Online** (`login.microsoftonline.com/7c6a9009-d5aa-4490-91cb-37d7fec82497/saml2`).

---

## 5. El Mecanismo de Auto-Renovación: `renew_canvas_cookie.js`

Cuando la sesión de Canvas caduca (las cookies duran típicamente entre 24 y 72 horas), la API devuelve `401 Unauthorized`. Para evitar que el usuario deba loguearse en Chrome e inspeccionar la consola de red manualmente, se creó el script [`renew_canvas_cookie.js`](file:///Users/tomas/Desktop/Proyectos/MCP%20Siglo/renew_canvas_cookie.js).

### Flujo de Ejecución Automatizado
1. **Lectura de Variables**: Lee `CANVAS_USERNAME` y `CANVAS_PASSWORD` desde `.env`.
2. **Lanzamiento de Puppeteer**: Inicia Chromium en modo `headless: true`.
3. **Navegación al SSO**: Visita `https://siglo21.instructure.com/login/saml/243`.
4. **Interacción con Microsoft Online**:
   - Ingresa el correo en `#i0116` y pulsa `Enter`.
   - Espera la animación y la visibilidad del campo `#i0118`.
   - Ingresa la contraseña en `#i0118` y pulsa `Enter`.
   - Detecta la pantalla de persistencia de sesión *"¿Quiere mantener la sesión iniciada?"* (`#idSIButton9`) y confirma con `Enter`.
5. **Aterrizaje en Canvas**: Espera que la URL final contenga `siglo21.instructure.com/?login_success=1`.
6. **Extracción y Reemplazo Atómico**:
   - Obtiene `page.cookies()` (incluyendo `canvas_session` y `_legacy_normandy_session`).
   - Obtiene `navigator.userAgent`.
   - Modifica el archivo `.env` sobrescribiendo las variables `CANVAS_SESSION_COOKIES` y `CANVAS_USER_AGENT`.
7. **Verificación de Salud**: Realiza un `GET /api/v1/users/self/profile` para certificar que las nuevas credenciales responden con HTTP 200 y muestra el nombre del estudiante.

---

## 6. Variables de Entorno (`.env`)

```env
# URL base de la institución
CANVAS_BASE_URL=https://siglo21.instructure.com

# Cookies de sesión activas (actualizadas manualmente o vía Puppeteer)
CANVAS_SESSION_COOKIES="_ga=...; canvas_session=...; _legacy_normandy_session=..."

# User-Agent utilizado por el cliente Axios
CANVAS_USER_AGENT="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"

# Credenciales para el renovador Puppeteer
CANVAS_USERNAME=tosanhueza@soysiglo.21.edu.ar
CANVAS_PASSWORD=Tu_Contraseña_Aqui
```

---

## 7. Instrucciones Operativas para Agentes de IA

Si estás interactuando con este repositorio como un nuevo agente de IA, sigue estas directrices:

### Comandos de Construcción y Ejecución
* **Compilar TypeScript**: `npm run build` (genera `/dist`).
* **Iniciar Servidor MCP en STDIO**: `npm start` (o `node dist/index.js`).
* **Modo Desarrollo**: `npm run dev` (ejecuta directamente con `tsx`).
* **Renovar Sesión Expirada**: `npm run renew-session` (o `node renew_canvas_cookie.js`).

### Diagnóstico de Fallos Comunes
| Síntoma | Causa Raíz | Solución para la IA |
|---|---|---|
| `[401 No Autorizado]` | Las cookies en `.env` caducaron. | Ejecutar `node renew_canvas_cookie.js` en la terminal. |
| `[403 Prohibido] al listar archivos` | La cátedra bloqueó la pestaña `/files`. | No intentar forzar `/files`. Buscar los archivos en `pages/modulos` o en las asignaciones. |
| `AWS S3: SignatureDoesNotMatch` | Se enviaron cabeceras de Canvas al bucket S3. | Verificar que `beforeRedirect` en `canvas-client.ts` esté eliminando `Cookie` y `Authorization`. |
| `Waiting for selector '#i0116' failed` | Timeout en la red o cambio en la URL de SSO. | Verificar conexión a internet o revisar la URL SAML 243. |

### Cómo Agregar una Nueva Herramienta MCP
Para incorporar una nueva función (ej. enviar mensajes a foros o descargar notas):
1. Agregar la interfaz de datos en [`src/types.ts`](file:///Users/tomas/Desktop/Proyectos/MCP%20Siglo/src/types.ts).
2. Implementar el método HTTP en [`src/canvas-client.ts`](file:///Users/tomas/Desktop/Proyectos/MCP%20Siglo/src/canvas-client.ts).
3. Registrar la herramienta en [`src/index.ts`](file:///Users/tomas/Desktop/Proyectos/MCP%20Siglo/src/index.ts) utilizando `server.tool(...)` con su esquema Zod correspondiente.
4. Compilar con `npm run build`.
