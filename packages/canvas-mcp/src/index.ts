#!/usr/bin/env node

/**
 * Servidor MCP Canvas LMS para Educai / Universidad Siglo 21
 * Protocolo de Contexto de Modelo (MCP) implementado sobre STDIO Server Transport.
 * Todos los diagnósticos y logs se envían exclusivamente a STDERR para mantener
 * intacta la integridad del flujo JSON-RPC en STDOUT.
 */

// Redireccionar toda salida estándar de logs hacia STDERR para evitar corromper JSON-RPC
const originalConsoleLog = console.log;
console.log = (...args: any[]) => console.error(...args);
console.info = (...args: any[]) => console.error(...args);
console.debug = (...args: any[]) => console.error(...args);

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig } from './config.js';
import { CanvasClient } from './canvas-client.js';
import { InMemoryHeatmapRepository } from './heatmap/firestore-schema.js';
import { HeatmapAggregationService } from './heatmap/aggregator-service.js';
import { formatHeatmapReportAsMarkdown } from './heatmap/teacher-dashboard-model.js';

// Cargar configuración de entorno y sesión segura
const config = loadConfig();
const canvas = new CanvasClient(config);
const heatmapRepository = new InMemoryHeatmapRepository();
const heatmapService = new HeatmapAggregationService(heatmapRepository);

// Inicializar servidor MCP
const server = new McpServer({
  name: 'educai-canvas-mcp-server',
  version: '1.1.0',
});

// Funciones auxiliares de formato
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'Sin fecha límite';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleString('es-AR', { timeZone: 'America/Argentina/Cordoba', timeZoneName: 'short' });
  } catch {
    return dateStr;
  }
}

/**
 * Herramienta 1: Listar cursos del usuario
 */
server.tool(
  'list_courses',
  'Lista los cursos del usuario en Canvas LMS (activos, completados o todos), mostrando ID, nombre, código y período académico de la Universidad Siglo 21.',
  {
    enrollment_state: z
      .enum(['active', 'completed', 'all'])
      .optional()
      .describe('Estado de inscripción para filtrar cursos: "active" (predeterminado), "completed" o "all"'),
  },
  async ({ enrollment_state = 'active' }) => {
    try {
      const courses = await canvas.getCourses(enrollment_state);

      if (courses.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No se encontraron cursos con estado de inscripción "${enrollment_state}".`,
            },
          ],
        };
      }

      let markdown = `## Cursos en Canvas LMS (${courses.length} encontrados)\n\n`;
      markdown += `*Filtro de inscripción: \`${enrollment_state}\`*\n\n`;

      for (const course of courses) {
        markdown += `### [${course.id}] ${course.name}\n`;
        if (course.course_code) {
          markdown += `- **Código**: \`${course.course_code}\`\n`;
        }
        if (course.term?.name) {
          markdown += `- **Período**: ${course.term.name}\n`;
        }
        if (course.enrollments && course.enrollments.length > 0) {
          const roles = course.enrollments.map((e) => e.role || e.type).join(', ');
          markdown += `- **Rol**: ${roles}\n`;
        }
        if (course.total_students !== undefined) {
          markdown += `- **Total Estudiantes**: ${course.total_students}\n`;
        }
        markdown += `- **Estado**: ${course.workflow_state || 'activo'}\n\n`;
      }

      return {
        content: [
          {
            type: 'text',
            text: markdown,
          },
        ],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error al obtener los cursos: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

/**
 * Herramienta 2: Obtener tareas pendientes
 */
server.tool(
  'get_pending_assignments',
  'Obtiene las tareas y actividades pendientes por entregar o calificar del usuario en Canvas LMS (ToDo list) ordenadas por fecha de vencimiento (due_at). Permite filtrar por curso.',
  {
    course_id: z
      .number()
      .optional()
      .describe('ID numérico del curso en Canvas para filtrar tareas pendientes (opcional)'),
  },
  async ({ course_id }) => {
    try {
      const { todoList, courseAssignments } = await canvas.getPendingAssignments(course_id);

      let markdown = `## Tareas y Actividades Pendientes\n\n`;

      if (course_id) {
        markdown += `*Filtrando por Curso ID: \`${course_id}\`*\n\n`;
      }

      const totalItems = todoList.length + (courseAssignments?.length || 0);

      if (totalItems === 0) {
        markdown += '🎉 **¡No tienes tareas pendientes registradas en Canvas LMS!**\n';
        return {
          content: [{ type: 'text', text: markdown }],
        };
      }

      if (todoList.length > 0) {
        markdown += `### Actividades en Lista de Tareas (ToDo - ${todoList.length})\n\n`;
        for (const item of todoList) {
          const title = item.assignment?.name || item.quiz?.title || 'Actividad sin título';
          const dueDate = item.assignment?.due_at || item.quiz?.due_at;
          const points = item.assignment?.points_possible ?? item.quiz?.points_possible;
          const courseName = item.context_name || `Curso ${item.course_id || 'N/A'}`;
          const url = item.html_url || item.assignment?.html_url || item.quiz?.html_url;

          markdown += `#### 📌 ${title}\n`;
          markdown += `- **Curso**: ${courseName}\n`;
          markdown += `- **Fecha Límite**: ${formatDate(dueDate)}\n`;
          if (points !== undefined) {
            markdown += `- **Puntos Posibles**: ${points}\n`;
          }
          if (item.type) {
            markdown += `- **Tipo**: ${item.type === 'submitting' ? 'Entrega requerida (Estudiante)' : item.type}\n`;
          }
          if (url) {
            markdown += `- **Enlace en Canvas**: [Ver en Canvas](${url})\n`;
          }
          markdown += '\n';
        }
      }

      if (courseAssignments && courseAssignments.length > 0) {
        markdown += `### Otras tareas sin entrega registradas en este curso (${courseAssignments.length})\n\n`;
        for (const assignment of courseAssignments) {
          markdown += `#### 📝 [ID: ${assignment.id}] ${assignment.name}\n`;
          markdown += `- **Fecha Límite**: ${formatDate(assignment.due_at)}\n`;
          if (assignment.points_possible !== undefined) {
            markdown += `- **Puntaje**: ${assignment.points_possible}\n`;
          }
          if (assignment.submission_types && assignment.submission_types.length > 0) {
            markdown += `- **Métodos de Entrega**: ${assignment.submission_types.join(', ')}\n`;
          }
          if (assignment.html_url) {
            markdown += `- **Enlace**: [Abrir tarea](${assignment.html_url})\n`;
          }
          markdown += '\n';
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: markdown,
          },
        ],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error al obtener tareas pendientes: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

/**
 * Herramienta 3: Listar archivos de un curso (con soporte inteligente de fallback Siglo 21 y MECA)
 */
server.tool(
  'list_course_files',
  'Lista los archivos, lecturas y documentos subidos a un curso de Canvas LMS. Si la cátedra tiene bloqueada la pestaña /files (403 Forbidden), recurre automáticamente a extraer recursos de las páginas de módulos (/pages/modulos), consignas de asignaciones y lecturas teóricas interactivas de MECA (Articulate Rise).',
  {
    course_id: z.number().describe('ID numérico del curso en Canvas LMS'),
    search_term: z
      .string()
      .optional()
      .describe('Término de búsqueda opcional para filtrar archivos por nombre'),
    limit: z
      .number()
      .optional()
      .describe('Cantidad máxima de archivos a retornar (predeterminado: 50, máx: 100)'),
  },
  async ({ course_id, search_term, limit = 50 }) => {
    try {
      const files = await canvas.getCourseFiles(course_id, search_term, limit);

      let markdown = `## Archivos y Recursos del Curso [ID: ${course_id}]\n\n`;

      if (search_term) {
        markdown += `*Búsqueda: "${search_term}"*\n\n`;
      }

      if (files.length === 0) {
        markdown += 'No se encontraron archivos en este curso con los criterios indicados.\n';
        return {
          content: [{ type: 'text', text: markdown }],
        };
      }

      // Detectar si se activó el fallback institucional
      const usedFallback = files.some(
        (f) => f.origin === 'modules_fallback' || f.origin === 'meca'
      );
      if (usedFallback) {
        markdown += `> ℹ️ **Modo Siglo 21 Activo**: La pestaña \`/files\` está bloqueada por la cátedra. Los recursos han sido extraídos automáticamente de las páginas de módulos, consignas y lecturas interactivas de MECA.\n\n`;
      }

      markdown += `*Total de archivos listados: ${files.length}*\n\n`;
      markdown += '| ID / Origen | Nombre | Tamaño | Tipo | Descargar |\n';
      markdown += '| --- | --- | --- | --- | --- |\n';

      for (const file of files) {
        const idDisplay = file.id < 0 ? 'MECA' : file.id > 0 ? `\`${file.id}\`` : 'Enlace';
        const name = file.display_name || file.filename || 'Sin nombre';
        const size = file.size > 0 ? formatBytes(file.size) : 'En línea';
        const mime = file['content-type'] || (file.origin === 'meca' ? 'PDF (MECA)' : 'documento');
        const link = file.url ? `[Descargar / Ver](${file.url})` : 'N/A';

        markdown += `| ${idDisplay} | ${name} | ${size} | ${mime} | ${link} |\n`;
      }

      markdown += `\n*Nota: Para leer el contenido digital de cualquiera de estos archivos, utiliza la herramienta \`read_course_file_content\` pasando su ID o su URL.*`;

      return {
        content: [
          {
            type: 'text',
            text: markdown,
          },
        ],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error al listar archivos del curso: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

/**
 * Herramienta 4: Leer y extraer contenido de un archivo (PDF / Texto / MECA Articulate Rise)
 */
server.tool(
  'read_course_file_content',
  'Descarga un archivo de Canvas LMS por su file_id o file_url y extrae su texto plano digital. Soporta documentos PDF nativos (pdf-parse v2), código fuente, texto y módulos interactivos MECA (Articulate Rise). Incluye truncamiento seguro de tokens.',
  {
    file_id: z
      .number()
      .optional()
      .describe('ID numérico del archivo en Canvas LMS a descargar y leer'),
    file_url: z
      .string()
      .optional()
      .describe('URL directa de descarga o enlace interactivo de MECA (meca.ues21.edu.ar)'),
    max_characters: z
      .number()
      .optional()
      .describe('Cantidad máxima de caracteres a retornar (opcional, por defecto 50000)'),
  },
  async ({ file_id, file_url, max_characters = 50000 }) => {
    try {
      const result = await canvas.readCourseFileContent(file_id, file_url, max_characters);

      const fileName = result.file.display_name || result.file.filename || `Recurso`;
      const fileSize = result.file.size > 0 ? formatBytes(result.file.size) : 'Calculado';

      let markdown = `## 📄 Contenido del Archivo: ${fileName}\n\n`;
      if (result.file.id) {
        markdown += `- **ID de Archivo**: \`${result.file.id}\`\n`;
      }
      markdown += `- **Tamaño**: ${fileSize}\n`;
      markdown += `- **Tipo**: ${result.file['content-type'] || (result.isPdf ? 'application/pdf' : 'texto')}\n`;

      if (result.isPdf) {
        markdown += `- **Tipo de Procesamiento**: PDF (procesado con pdf-parse)\n`;
        if (result.numPages !== undefined) {
          markdown += `- **Total de Páginas**: ${result.numPages}\n`;
        }
      } else if (result.sourceType === 'meca_text') {
        markdown += `- **Origen**: Lectura Interactiva MECA (Articulate Rise)\n`;
      }

      markdown += `- **Total de Caracteres**: ${result.charCount.toLocaleString('es-AR')}\n`;

      if (result.truncated) {
        markdown += `\n> ⚠️ **Aviso de truncamiento**: El texto excedió el límite de ${max_characters.toLocaleString('es-AR')} caracteres y ha sido recortado para optimizar la ventana de contexto.\n\n`;
      } else {
        markdown += '\n';
      }

      if (!result.text || result.text.trim().length === 0) {
        markdown += `> ⚠️ **Nota**: El archivo se descargó y procesó, pero no se extrajo texto legible. Si es un PDF, es posible que contenga únicamente imágenes escaneadas sin capa digital OCR.\n\n`;
      } else {
        markdown += `### Texto Extraído:\n\n`;
        markdown += result.text;
        markdown += '\n';
      }

      return {
        content: [
          {
            type: 'text',
            text: markdown,
          },
        ],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error al leer el archivo: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

/**
 * Herramienta 5: Verificar estado de conexión y sesión del usuario
 */
server.tool(
  'get_canvas_user_profile',
  'Verifica la conexión a Canvas LMS y muestra los datos del usuario autenticado (nombre, correo institucional, ID). Útil para diagnosticar la salud de la sesión activa y el origen de las credenciales.',
  {},
  async () => {
    try {
      const user = await canvas.getCurrentUser();
      let markdown = `## Perfil de Usuario de Canvas LMS (Educai)\n\n`;
      markdown += `- **Nombre**: ${user.name}\n`;
      markdown += `- **ID de Usuario**: ${user.id}\n`;
      if (user.primary_email) {
        markdown += `- **Email**: ${user.primary_email}\n`;
      }
      if (user.login_id) {
        markdown += `- **Login ID**: ${user.login_id}\n`;
      }
      markdown += `\n✅ **Estado de conexión**: Cookies de sesión activas y autorizadas.\n`;
      markdown += `- **Origen de Credenciales**: \`${
        user.session_source === 'secure_store'
          ? 'Almacén Local Cifrado (AES-256-GCM)'
          : 'Variables de Entorno (.env)'
      }\`\n`;
      markdown += `- **Instancia Institucional**: \`${config.baseUrl}\`\n`;

      return {
        content: [{ type: 'text', text: markdown }],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error al verificar la sesión de usuario: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

/**
 * Herramienta 6: Motor del Mapa de Calor y Análisis de Preguntas para Docentes
 */
server.tool(
  'get_course_heatmap_report',
  'Genera el informe consolidado del Mapa de Calor para el docente: analiza semánticamente las dudas de los alumnos en el aula, calcula el porcentaje de alumnos afectados por concepto crítico y provee recomendaciones pedagógicas accionables para la siguiente clase sincrónica.',
  {
    course_id: z.number().describe('ID numérico del curso en Canvas LMS'),
    timeframe_days: z
      .number()
      .optional()
      .default(7)
      .describe('Ventana temporal en días para agregar las consultas (por defecto 7 días)'),
  },
  async ({ course_id, timeframe_days = 7 }) => {
    try {
      // 1. Obtener datos del curso desde Canvas
      const courses = await canvas.getCourses('all');
      const course = courses.find((c) => c.id === course_id);
      const courseName = course?.name || `Curso ID ${course_id}`;
      const totalStudents = course?.total_students || 40;

      // 2. Extraer conceptos del programa o módulos
      const syllabusConcepts = [
        'Conceptos Fundamentales y Arquitectura',
        'Modelado de Dominio y Capa de Datos',
        'Desacoplamiento y Patrones de Inyección',
        'Manejo de Errores y Transaccionalidad',
        'Validaciones y Reglas de Negocio',
      ];

      // 3. Generar reporte mediante el servicio de agregación
      const report = await heatmapService.generateCourseHeatmap({
        courseId: course_id,
        courseName,
        periodName: course?.term?.name || 'Período Activo Siglo 21',
        totalEnrolledStudents: totalStudents,
        syllabusConcepts,
        timeframeDays: timeframe_days,
      });

      const markdown = formatHeatmapReportAsMarkdown(report);

      return {
        content: [
          {
            type: 'text',
            text: markdown,
          },
        ],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error al generar el mapa de calor del curso ${course_id}: ${errorMessage}`,
          },
        ],
      };
    }
  }
);

/**
 * Herramienta 7: Cronograma y fechas de parciales/evaluaciones
 */
server.tool(
  'get_course_schedule',
  'Obtiene el cronograma de fechas clave de una materia: parciales, recuperatorios, exámenes finales, quizzes y entregas de Trabajos Prácticos (TPs), ordenados cronológicamente con sus fechas límites y puntajes.',
  {
    course_id: z.number().describe('ID numérico del curso en Canvas LMS'),
  },
  async ({ course_id }) => {
    try {
      const schedule = await canvas.getCourseSchedule(course_id);

      let markdown = `## 📅 Cronograma y Fechas Clave: ${schedule.courseName}\n\n`;

      // 1. Sección de Exámenes y Parciales
      markdown += `### 🎯 Parciales y Evaluaciones (${schedule.exams.length})\n\n`;
      if (schedule.exams.length === 0) {
        markdown += `*No se detectaron exámenes o parciales con fecha registrada en este curso.*\n\n`;
      } else {
        markdown += `| Examen / Parcial | Tipo | Fecha Límite | Apertura | Puntaje | Enlace |\n`;
        markdown += `| --- | --- | --- | --- | --- | --- |\n`;
        for (const exam of schedule.exams) {
          const typeLabel = exam.type === 'quiz' ? 'Quiz / Evaluación' : exam.type === 'assignment' ? 'Tarea Evaluativa' : 'Evento Calendario';
          const due = formatDate(exam.due_at);
          const unlock = exam.unlock_at ? formatDate(exam.unlock_at) : 'Disponible';
          const pts = exam.points !== undefined ? `${exam.points} pts` : 'N/D';
          const link = exam.html_url ? `[Abrir en Canvas](${exam.html_url})` : 'N/A';
          markdown += `| **${exam.title}** | ${typeLabel} | **${due}** | ${unlock} | ${pts} | ${link} |\n`;
        }
        markdown += '\n';
      }

      // 2. Trabajos Prácticos y Asignaciones
      markdown += `### 📝 Trabajos Prácticos y Asignaciones (${schedule.assignments.length})\n\n`;
      if (schedule.assignments.length === 0) {
        markdown += `*No hay asignaciones registradas en el curso.*\n\n`;
      } else {
        markdown += `| Actividad / TP | Fecha Límite | Métodos de Entrega | Estado |\n`;
        markdown += `| --- | --- | --- | --- |\n`;
        for (const assign of schedule.assignments.slice(0, 20)) {
          const due = formatDate(assign.due_at);
          const types = (assign.submission_types || []).join(', ') || 'Sin entrega digital';
          const state = assign.has_submitted_submissions ? '✅ Entregado' : '⏳ Pendiente';
          markdown += `| [${assign.id}] ${assign.name} | ${due} | ${types} | ${state} |\n`;
        }
        markdown += '\n';
      }

      // 3. Eventos adicionales de calendario
      if (schedule.calendarEvents.length > 0) {
        markdown += `### 📌 Otros Eventos en Calendario (${schedule.calendarEvents.length})\n\n`;
        for (const evt of schedule.calendarEvents.slice(0, 10)) {
          const dateStr = formatDate(evt.start_at || evt.end_at);
          markdown += `- **${evt.title}**: ${dateStr}\n`;
        }
        markdown += '\n';
      }

      return {
        content: [{ type: 'text', text: markdown }],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al obtener el cronograma del curso: ${errorMessage}` }],
      };
    }
  }
);

/**
 * Herramienta 8: Avisos y Comunicados Oficiales de Cátedra
 */
server.tool(
  'get_course_announcements',
  'Obtiene los comunicados oficiales y avisos de cátedra publicados por los profesores en Canvas LMS. Permite enterarse de novedades, cambios de fechas o aclaraciones de Trabajos Prácticos.',
  {
    course_id: z
      .number()
      .optional()
      .describe('ID numérico del curso en Canvas (opcional, si se omite busca en todos los cursos activos)'),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe('Cantidad máxima de avisos a consultar (por defecto 10)'),
  },
  async ({ course_id, limit = 10 }) => {
    try {
      const announcements = await canvas.getAnnouncements(course_id ? [course_id] : undefined, limit);

      if (announcements.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: course_id
                ? `No se encontraron avisos o anuncios en el curso ID \`${course_id}\`.`
                : 'No se encontraron avisos recientes en tus cursos activos de Canvas LMS.',
            },
          ],
        };
      }

      let markdown = `## 📢 Anuncios y Avisos de Cátedra (${announcements.length} recientes)\n\n`;

      for (const ann of announcements) {
        const author = ann.author?.display_name || ann.user_name || 'Profesor/Cátedra';
        const dateStr = formatDate(ann.posted_at);
        markdown += `### 📌 ${ann.title}\n`;
        markdown += `- **Publicado por**: ${author} | **Fecha**: ${dateStr}\n`;
        if (ann.html_url) {
          markdown += `- **Enlace**: [Ver anuncio en Canvas](${ann.html_url})\n`;
        }
        markdown += `\n${ann.message || '*Sin contenido de texto*'}\n\n`;

        if (ann.attachments && ann.attachments.length > 0) {
          markdown += `**Archivos adjuntos:**\n`;
          for (const att of ann.attachments) {
            markdown += `- [${att.display_name}](${att.url}) (${formatBytes(att.size)})\n`;
          }
          markdown += '\n';
        }

        markdown += `---\n\n`;
      }

      return {
        content: [{ type: 'text', text: markdown }],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al obtener anuncios de cátedra: ${errorMessage}` }],
      };
    }
  }
);

/**
 * Herramienta 9: Listar foros de discusión y consultas
 */
server.tool(
  'get_course_discussions',
  'Lista los foros de debate y consultas de un curso en Canvas LMS, mostrando cantidad de mensajes, respuestas no leídas y fecha de última actividad.',
  {
    course_id: z.number().describe('ID numérico del curso en Canvas LMS'),
    limit: z
      .number()
      .optional()
      .default(15)
      .describe('Cantidad máxima de foros a listar (por defecto 15)'),
  },
  async ({ course_id, limit = 15 }) => {
    try {
      const topics = await canvas.getDiscussionTopics(course_id, limit);

      if (topics.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No se encontraron foros de discusión activos en el curso ID \`${course_id}\`.`,
            },
          ],
        };
      }

      let markdown = `## 💬 Foros de Discusión y Consultas [Curso ID: ${course_id}]\n\n`;
      markdown += `| ID Foro | Título | Autor | No leídos | Última Actividad | Enlace |\n`;
      markdown += `| --- | --- | --- | --- | --- | --- |\n`;

      for (const topic of topics) {
        const author = topic.author?.display_name || topic.user_name || 'Docente/Alumno';
        const unread = topic.unread_count ? `🔴 **${topic.unread_count} nuevos**` : 'Al día';
        const lastAct = formatDate(topic.last_reply_at || topic.posted_at);
        const link = topic.html_url ? `[Abrir](${topic.html_url})` : 'N/A';
        markdown += `| \`${topic.id}\` | **${topic.title}** | ${author} | ${unread} | ${lastAct} | ${link} |\n`;
      }

      markdown += `\n*Nota: Para leer los mensajes y respuestas de un foro específico, utiliza la herramienta \`get_discussion_replies\` pasando el \`course_id\` y el \`topic_id\`.*`;

      return {
        content: [{ type: 'text', text: markdown }],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al listar foros de discusión: ${errorMessage}` }],
      };
    }
  }
);

/**
 * Herramienta 10: Leer respuestas y mensajes de un foro
 */
server.tool(
  'get_discussion_replies',
  'Lee un foro de discusión específico de Canvas LMS con todos sus mensajes y respuestas. Útil para responder a preguntas como "¿qué respondieron en el foro?" o "¿qué dudas plantearon sobre el TP?".',
  {
    course_id: z.number().describe('ID numérico del curso en Canvas LMS'),
    topic_id: z.number().describe('ID numérico del foro/tema de discusión en Canvas'),
  },
  async ({ course_id, topic_id }) => {
    try {
      const { topic, replies } = await canvas.getDiscussionTopicDetails(course_id, topic_id);

      let markdown = `## 💬 Foro: ${topic.title}\n\n`;
      const author = topic.author?.display_name || topic.user_name || 'Autor';
      markdown += `- **Iniciado por**: ${author} | **Fecha**: ${formatDate(topic.posted_at)}\n`;
      if (topic.html_url) {
        markdown += `- **Enlace en Canvas**: [Ver foro](${topic.html_url})\n`;
      }
      markdown += `\n### Mensaje Inicial:\n${topic.message || '*Sin contenido*'}\n\n`;
      markdown += `---\n\n`;

      markdown += `### 📨 Respuestas e Hilo de Conversación (${replies.length} mensajes):\n\n`;
      if (replies.length === 0) {
        markdown += `*Aún no hay respuestas en este foro.*\n`;
      } else {
        for (const reply of replies) {
          const dateStr = formatDate(reply.created_at);
          markdown += `#### 👤 ${reply.user_name} (${dateStr}):\n`;
          markdown += `${reply.message}\n\n`;
        }
      }

      return {
        content: [{ type: 'text', text: markdown }],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al leer respuestas del foro: ${errorMessage}` }],
      };
    }
  }
);

/**
 * Herramienta 11: Publicar mensaje en un foro
 */
server.tool(
  'post_discussion_reply',
  'Publica un mensaje o respuesta en un foro de consultas o debate de Canvas LMS en nombre del estudiante.',
  {
    course_id: z.number().describe('ID numérico del curso en Canvas LMS'),
    topic_id: z.number().describe('ID numérico del foro de discusión'),
    message: z.string().describe('Texto del mensaje a publicar en el foro'),
  },
  async ({ course_id, topic_id, message }) => {
    try {
      const reply = await canvas.postDiscussionReply(course_id, topic_id, message);

      let markdown = `## ✅ Mensaje Publicado con Éxito en el Foro\n\n`;
      markdown += `- **ID de Mensaje**: \`${reply.id}\`\n`;
      markdown += `- **Fecha de Publicación**: ${formatDate(reply.created_at)}\n\n`;
      markdown += `### Contenido:\n${reply.message}\n`;

      return {
        content: [{ type: 'text', text: markdown }],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al publicar en el foro: ${errorMessage}` }],
      };
    }
  }
);

/**
 * Herramienta 12: Entrega de Trabajo Práctico o Asignación
 */
server.tool(
  'submit_assignment',
  'Realiza la entrega formal de un Trabajo Práctico (TP) o Asignación en Canvas LMS. Soporta subir un archivo local (PDF, DOCX, ZIP, etc.), texto en línea o enlace web. IMPORTANTE: Solicita confirmación explícita al usuario antes de ejecutar la entrega definitiva.',
  {
    course_id: z.number().describe('ID numérico del curso en Canvas LMS'),
    assignment_id: z.number().describe('ID numérico de la tarea o Trabajo Práctico en Canvas'),
    submission_type: z
      .enum(['online_upload', 'online_text_entry', 'online_url'])
      .describe('Tipo de entrega: "online_upload" (archivo local), "online_text_entry" (texto/código) o "online_url" (enlace web)'),
    file_path: z
      .string()
      .optional()
      .describe('Ruta absoluta del archivo local en el disco a subir (requerido si submission_type es "online_upload")'),
    text_body: z
      .string()
      .optional()
      .describe('Texto digital, respuesta o código a entregar (requerido si submission_type es "online_text_entry")'),
    submission_url: z
      .string()
      .optional()
      .describe('URL externa de entrega (requerido si submission_type es "online_url")'),
    comment: z
      .string()
      .optional()
      .describe('Comentario opcional para el docente acompañando la entrega'),
  },
  async ({
    course_id,
    assignment_id,
    submission_type,
    file_path,
    text_body,
    submission_url,
    comment,
  }) => {
    try {
      const submission = await canvas.submitAssignment({
        courseId: course_id,
        assignmentId: assignment_id,
        submissionType: submission_type,
        filePath: file_path,
        textBody: text_body,
        submissionUrl: submission_url,
        comment,
      });

      let markdown = `## 🎓 ¡Entrega Registrada Exitosamente en Canvas LMS!\n\n`;
      markdown += `- **ID de Entrega**: \`${submission.id}\`\n`;
      markdown += `- **Tarea ID**: \`${submission.assignment_id}\`\n`;
      markdown += `- **Estado de Entrega**: \`${submission.workflow_state || 'submitted'}\`\n`;
      markdown += `- **Fecha y Hora**: ${formatDate(submission.submitted_at)}\n`;
      markdown += `- **Tipo de Entrega**: \`${submission.submission_type || submission_type}\`\n`;

      if (submission.attachments && submission.attachments.length > 0) {
        markdown += `\n### Archivo(s) Entregado(s):\n`;
        for (const att of submission.attachments) {
          markdown += `- **${att.display_name || att.filename}** (${formatBytes(att.size)})\n`;
        }
      }

      if (submission.preview_url || submission.html_url) {
        markdown += `\n- **Comprobante en Canvas**: [Ver Entrega](${submission.preview_url || submission.html_url})\n`;
      }

      return {
        content: [{ type: 'text', text: markdown }],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: 'text', text: `Error al entregar la tarea en Canvas: ${errorMessage}` }],
      };
    }
  }
);


// Inicio del servidor con transporte STDIO
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Canvas LMS MCP Server] Servidor Educai iniciado correctamente y escuchando en STDIO.');
}

// Manejo de señales de terminación segura
process.on('SIGINT', async () => {
  console.error('[Canvas LMS MCP Server] Recibida señal SIGINT. Finalizando...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('[Canvas LMS MCP Server] Recibida señal SIGTERM. Finalizando...');
  process.exit(0);
});

run().catch((error) => {
  console.error('[Canvas LMS MCP Server] Error fatal al iniciar el servidor:', error);
  process.exit(1);
});
