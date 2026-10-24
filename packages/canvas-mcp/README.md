# Educai - Canvas LMS MCP Server 🎓

Servidor **Model Context Protocol (MCP)** en TypeScript de nivel empresarial para **Educai**, desarrollado sobre `@modelcontextprotocol/sdk` con transporte `StdioServerTransport`. Proporciona conectividad nativa y robusta entre modelos de IA (Claude Desktop, Cursor, Antigravity, etc.) y la plataforma educativa **Canvas LMS** de la **Universidad Siglo 21**.

---

## 🏛️ Pilares de la Arquitectura Avanzada

1. **Integridad Estricta del Protocolo STDIO**:
   - Toda la comunicación JSON-RPC fluye limpiamente por `process.stdout`.
   - Todos los diagnósticos, advertencias e información de telemetría son redirigidos exclusivamente a `console.error` (STDERR), previniendo cualquier corrupción de tramas JSON-RPC.

2. **Almacenamiento Cifrado de Sesiones Efímeras (Zero Master Password Exposure)**:
   - Las cookies de sesión (`canvas_session`, `_legacy_normandy_session`) se almacenan cifradas mediante **AES-256-GCM** en el directorio de configuración del usuario del sistema operativo (`~/Library/Application Support/educai-mcp` en macOS, `%APPDATA%/educai-mcp` en Windows o `~/.config/educai-mcp` en Linux).
   - Las claves criptográficas se derivan localmente con entropía del entorno y permisos de lectura exclusivos (`0o600`).
   - La contraseña maestra del estudiante **nunca se almacena en texto plano**.

3. **Fallback Automático para Pestaña `/files` Oculta (Siglo 21)**:
   - Cuando la cátedra desactiva el acceso directo a archivos devolviendo `403 Forbidden`, el cliente activa un escáner que recupera los recursos desde:
     - Módulos del curso (`/api/v1/courses/:id/modules`).
     - Directorio de páginas y página principal de módulos (`/pages/modulos`).
     - Consignas y enunciados HTML de Trabajos Prácticos y Asignaciones (`/assignments`).
     - Metadatos directos por ID de archivo (`/api/v1/files/:id`).

4. **Ecosistema Multimedia MECA (Articulate Rise)**:
   - Soporte nativo para módulos teóricos interactivos de la Universidad Siglo 21 alojados en `meca.ues21.edu.ar`.
   - Extracción y decodificación automática del objeto Base64 `window.courseData`.
   - Localización de PDFs oficiales en subcarpetas `assets/` (lección *"Descarga en PDF"*).
   - Extracción de contenido de texto estructurado en Markdown cuando no hay PDF disponible.

5. **Protección Anti-Errores AWS S3 en Redirecciones**:
   - Gancho `beforeRedirect` robusto en Axios que detecta saltos a buckets prefirmados de Amazon S3 (`*.amazonaws.com`), eliminando de manera insensible a mayúsculas/minúsculas las cabeceras `Cookie`, `Authorization`, `X-Requested-With` y `X-CSRF-Token`, previniendo los errores `400 Bad Request` y `SignatureDoesNotMatch`.

---

## 🚀 Catálogo de Herramientas (Tools) MCP con Zod

### 1. `list_courses`
- **Descripción**: Lista los cursos del estudiante en Canvas LMS (activos, completados o todos), mostrando ID numérico, nombre oficial, código (`INF346`, etc.) y período lectivo (`Cursado Presencial 2/26`).
- **Esquema Zod**:
  ```ts
  { enrollment_state: z.enum(['active', 'completed', 'all']).optional() }
  ```

### 2. `get_pending_assignments`
- **Descripción**: Consulta tareas, entregas y cuestionarios pendientes (lista ToDo y entregas sin calificar) ordenados cronológicamente por fecha de vencimiento (`due_at`).
- **Esquema Zod**:
  ```ts
  { course_id: z.number().optional() }
  ```

### 3. `list_course_files`
- **Descripción**: Busca y lista archivos y lecturas de un curso. Incluye soporte automático para la restricción `403 Forbidden` de Siglo 21 y descubrimiento de módulos MECA.
- **Esquema Zod**:
  ```ts
  {
    course_id: z.number(),
    search_term: z.string().optional(),
    limit: z.number().optional().default(50)
  }
  ```

### 4. `read_course_file_content`
- **Descripción**: Descarga un archivo por `file_id` o `file_url` y extrae su texto plano digital.
  - Soporte nativo para PDFs mediante `pdf-parse` v2 (conteo de páginas y texto limpio).
  - Soporte para formatos de texto plano y código (TXT, MD, CSV, JSON, HTML, etc.).
  - Soporte para módulos MECA (Articulate Rise).
  - Truncamiento inteligente de caracteres para no saturar la ventana de contexto del LLM.
- **Esquema Zod**:
  ```ts
  {
    file_id: z.number().optional(),
    file_url: z.string().optional(),
    max_characters: z.number().optional().default(50000)
  }
  ```

### 5. `get_canvas_user_profile`
- **Descripción**: Verifica el estado de salud de la sesión activa, nombre del estudiante, ID institucional y procedencia de las credenciales (Almacén Cifrado vs `.env`).
- **Esquema Zod**: `{}`

### 6. `get_course_schedule`
- **Descripción**: Obtiene el cronograma consolidado y fechas clave de una materia: parciales, recuperatorios, exámenes finales, quizzes y entregas de Trabajos Prácticos (TPs), ordenados cronológicamente con sus fechas límites, aperturas y puntajes.
- **Esquema Zod**:
  ```ts
  { course_id: z.number().describe('ID numérico del curso en Canvas LMS') }
  ```

### 7. `get_course_announcements`
- **Descripción**: Consulta comunicados y avisos oficiales de cátedra publicados por los profesores en Canvas LMS (enterarse de novedades, cambios de fechas o prórrogas).
- **Esquema Zod**:
  ```ts
  {
    course_id: z.number().optional().describe('ID del curso (opcional, si se omite busca en cursos activos)'),
    limit: z.number().optional().default(10)
  }
  ```

### 8. `get_course_discussions`
- **Descripción**: Lista los foros de debate y consultas de una materia, mostrando mensajes no leídos, autor y fecha de última actividad.
- **Esquema Zod**:
  ```ts
  {
    course_id: z.number().describe('ID del curso'),
    limit: z.number().optional().default(15)
  }
  ```

### 9. `get_discussion_replies`
- **Descripción**: Lee un foro de discusión específico con todo su hilo de mensajes y respuestas de docentes y compañeros.
- **Esquema Zod**:
  ```ts
  {
    course_id: z.number(),
    topic_id: z.number().describe('ID numérico del foro')
  }
  ```

### 10. `post_discussion_reply`
- **Descripción**: Publica un mensaje o respuesta en un foro de consultas en nombre del estudiante.
- **Esquema Zod**:
  ```ts
  {
    course_id: z.number(),
    topic_id: z.number(),
    message: z.string().describe('Texto del mensaje')
  }
  ```

### 11. `submit_assignment`
- **Descripción**: Realiza la entrega formal de un Trabajo Práctico (TP) o Asignación en Canvas LMS. Soporta subir un archivo local del disco (PDF, DOCX, ZIP, etc.) mediante negociación S3, enviar texto/código en línea, o enviar una URL web (GitHub, Drive).
- **Esquema Zod**:
  ```ts
  {
    course_id: z.number(),
    assignment_id: z.number(),
    submission_type: z.enum(['online_upload', 'online_text_entry', 'online_url']),
    file_path: z.string().optional().describe('Ruta del archivo local a subir'),
    text_body: z.string().optional().describe('Texto/código digital a entregar'),
    submission_url: z.string().optional().describe('Enlace web de entrega'),
    comment: z.string().optional().describe('Comentario para el docente')
  }
  ```

---

## 🛠️ Instalación y Puesta a Punto

### 1. Compilación de TypeScript:
```bash
npm run build
```

### 2. Ejecución en Modo Desarrollo:
```bash
npm run dev
```

### 3. Renovación Automática de Sesión (Puppeteer):
```bash
npm run renew-session
# O directamente:
node renew_canvas_cookie.js
```
El renovador:
- Se conecta al portal SSO institucional de Siglo 21 (`/login/saml/243` en Microsoft Azure AD).
- Puede solicitar credenciales de forma interactiva en la terminal sin escribirlas en `.env`.
- Si se detecta autenticación en dos pasos (MFA / Microsoft Authenticator), espera a que apruebes la notificación en tu móvil.
- Confirma la persistencia de sesión (KMSI).
- Extrae las cookies frescas y las almacena cifradas con AES-256-GCM en el directorio de usuario del sistema operativo.
- Elimina automáticamente cualquier contraseña en texto plano presente en `.env`.

---

## 🤖 Integración con Clientes MCP (Claude Desktop / Cursor / Antigravity)

### Configuración en Claude Desktop:
Edita `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) o `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "educai-canvas": {
      "command": "node",
      "args": [
        "/Users/tomas/Desktop/Proyectos/MCP Siglo/dist/index.js"
      ],
      "env": {
        "CANVAS_BASE_URL": "https://siglo21.instructure.com"
      }
    }
  }
}
```

*Nota: No es necesario especificar `CANVAS_SESSION_COOKIES` en `env` si ya ejecutaste `npm run renew-session`, ya que el servidor cargará automáticamente la sesión cifrada desde el almacén de configuración del sistema operativo.*

---

## 📁 Estructura del Repositorio

```
MCP Siglo/
├── package.json              # Configuración ESM, scripts y dependencias
├── tsconfig.json             # Compilación TypeScript (ES2022 / NodeNext)
├── .env.example              # Plantilla segura de variables de entorno
├── renew_canvas_cookie.js    # Renovador con Puppeteer, MFA y Azure AD SSO
├── dist/                     # Código JavaScript transpilado
└── src/
    ├── index.ts              # Entrypoint MCP, StdioServerTransport y registro de Tools Zod
    ├── canvas-client.ts      # Cliente HTTP Axios, S3 redirect hook y fallback 403
    ├── meca-parser.ts        # Parser del ecosistema Articulate Rise MECA de Siglo 21
    ├── session-store.ts      # Almacén cifrado AES-256-GCM en AppData / OS Config
    ├── config.ts             # Gestor de configuración unificado (Env + Secure Store)
    └── types.ts              # Modelos de datos e interfaces tipadas
```
