import fs from 'fs';
import path from 'path';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { PDFParse } from 'pdf-parse';
import { ServerConfig } from './config.js';
import {
  CanvasCourse,
  CanvasTodoItem,
  CanvasAssignment,
  CanvasFile,
  CanvasUserProfile,
  FileContentResult,
  CanvasModule,
  CanvasPage,
  CanvasQuiz,
  CanvasCalendarEvent,
  CanvasDiscussionTopic,
  CanvasDiscussionReply,
  CanvasSubmission,
} from './types.js';
import { isMecaUrl, parseMecaPackage } from './meca-parser.js';

/**
 * Convierte contenido HTML básico retornado por Canvas LMS a Markdown limpio
 */
export function htmlToMarkdown(html?: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '\n$1\n')
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '\n$1\n')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n\s+\n/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}


/**
 * Función auxiliar para limpiar cabeceras sensibles (Cookie, Authorization)
 * cuando una petición se redirige fuera del dominio de Canvas (ej. AWS S3).
 * Evita el error 'SignatureDoesNotMatch' de Amazon S3 en URLs prefirmadas.
 */
function sanitizeRedirectHeaders(options: any, baseHost: string): void {
  const nextHost = (options.hostname || options.host || '').toLowerCase();
  const isExternalHost = nextHost && nextHost !== baseHost;
  const isS3 = nextHost.includes('amazonaws.com') || nextHost.includes('s3.');

  if ((isExternalHost || isS3) && options.headers) {
    for (const key of Object.keys(options.headers)) {
      const lower = key.toLowerCase();
      if (
        lower === 'cookie' ||
        lower === 'authorization' ||
        lower === 'x-requested-with' ||
        lower === 'x-csrf-token'
      ) {
        delete options.headers[key];
      }
    }
  }
}

export class CanvasClient {
  private client: AxiosInstance;
  private config: ServerConfig;
  private baseHost: string;

  constructor(config: ServerConfig) {
    this.config = config;

    let baseHost = 'siglo21.instructure.com';
    try {
      baseHost = new URL(config.baseUrl).hostname.toLowerCase();
    } catch {
      // Fallback a valor por defecto
    }
    this.baseHost = baseHost;

    const headers: Record<string, string> = {
      'User-Agent': config.userAgent,
      Accept: 'application/json+canvas-string-ids, application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };

    if (config.sessionCookies) {
      headers['Cookie'] = config.sessionCookies;
    }

    if (config.apiToken) {
      headers['Authorization'] = `Bearer ${config.apiToken}`;
    }

    this.client = axios.create({
      baseURL: config.baseUrl,
      headers,
      timeout: 25000,
      maxRedirects: 10,
      beforeRedirect: (options: any) => {
        sanitizeRedirectHeaders(options, this.baseHost);
      },
      validateStatus: (status) => status >= 200 && status < 300,
    });
  }

  private ensureConfigured(): void {
    if (!this.config.sessionCookies && !this.config.apiToken) {
      throw new Error(
        'No se han configurado las cookies de sesión (CANVAS_SESSION_COOKIES) ni el token de API (CANVAS_API_TOKEN). ' +
          'Por favor ejecuta "npm run renew-session" o configura CANVAS_SESSION_COOKIES.'
      );
    }
  }

  private handleError(error: unknown, context: string): never {
    if (axios.isAxiosError(error)) {
      const axiosErr = error as AxiosError;
      const status = axiosErr.response?.status;
      const data = axiosErr.response?.data as any;

      if (status === 401) {
        throw new Error(
          `[401 No Autorizado] al ${context}: La sesión de Canvas LMS ha expirado o las cookies son inválidas. ` +
            `Ejecuta "npm run renew-session" para renovar automáticamente la sesión institucional vía Microsoft SSO.`
        );
      }

      if (status === 403) {
        throw new Error(
          `[403 Prohibido] al ${context}: No tienes permisos suficientes para acceder a este recurso o el curso tiene la pestaña restringida.`
        );
      }

      if (status === 404) {
        throw new Error(
          `[404 No Encontrado] al ${context}: El recurso solicitado no existe o fue eliminado en Canvas LMS.`
        );
      }

      const msg = data?.message || data?.errors?.[0]?.message || axiosErr.message;
      throw new Error(`Error en Canvas LMS (${status || 'red'}) al ${context}: ${msg}`);
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(`Error desconocido al ${context}: ${String(error)}`);
  }

  /**
   * Obtiene el perfil del usuario autenticado (útil para verificar conexión y sesión)
   */
  async getCurrentUser(): Promise<CanvasUserProfile> {
    this.ensureConfigured();
    try {
      const response = await this.client.get<CanvasUserProfile>('/api/v1/users/self/profile');
      return {
        ...response.data,
        session_source: this.config.sessionSource === 'secure_store' ? 'secure_store' : 'environment',
      };
    } catch (err) {
      this.handleError(err, 'obtener el perfil de usuario');
    }
  }

  /**
   * Herramienta 1: Listar cursos del usuario
   * @param enrollmentState Estado de inscripción ('active', 'completed', 'all')
   */
  async getCourses(enrollmentState: string = 'active'): Promise<CanvasCourse[]> {
    this.ensureConfigured();
    try {
      const params: Record<string, any> = {
        per_page: 100,
        'include[]': ['term', 'teachers', 'total_students'],
      };

      if (enrollmentState && enrollmentState !== 'all') {
        params.enrollment_state = enrollmentState;
      }

      const response = await this.client.get<CanvasCourse[]>('/api/v1/courses', {
        params,
      });

      // Filtrar cursos sin nombre o de acceso restringido
      return response.data.filter((course) => Boolean(course.name && course.id));
    } catch (err) {
      this.handleError(err, 'listar los cursos');
    }
  }

  /**
   * Herramienta 2: Obtener tareas y actividades pendientes
   * Consulta el ToDo list de Canvas y opcionalmente el bucket de entregas pendientes de un curso
   * @param courseId ID opcional de un curso para filtrar
   */
  async getPendingAssignments(courseId?: number): Promise<{
    todoList: CanvasTodoItem[];
    courseAssignments?: CanvasAssignment[];
  }> {
    this.ensureConfigured();
    try {
      // 1. Obtener items del ToDo del usuario en Canvas
      const todoResponse = await this.client.get<CanvasTodoItem[]>('/api/v1/users/self/todo', {
        params: { per_page: 100 },
      });

      let todoItems = todoResponse.data || [];

      if (courseId) {
        todoItems = todoItems.filter(
          (item) => item.course_id === courseId || item.assignment?.course_id === courseId
        );
      }

      let courseAssignments: CanvasAssignment[] | undefined;

      // Si se especificó un curso, consultar las entregas del estudiante para ese curso
      if (courseId) {
        try {
          const submissionsResponse = await this.client.get<any[]>(
            `/api/v1/courses/${courseId}/students/submissions`,
            {
              params: {
                'student_ids[]': 'self',
                'include[]': ['assignment'],
                per_page: 100,
              },
            }
          );

          if (Array.isArray(submissionsResponse.data)) {
            // Filtrar entregas en estado 'unsubmitted' y mapear a assignments
            const unsubmitted = submissionsResponse.data
              .filter((sub) => sub.workflow_state === 'unsubmitted' && sub.assignment)
              .map((sub) => sub.assignment as CanvasAssignment);

            // Ordenar: primero las que tienen due_at más próximo
            unsubmitted.sort((a, b) => {
              if (a.due_at && b.due_at)
                return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
              if (a.due_at) return -1;
              if (b.due_at) return 1;
              return 0;
            });

            courseAssignments = unsubmitted;
          }
        } catch {
          // Fallback a assignments con bucket
          try {
            const assignmentsResponse = await this.client.get<CanvasAssignment[]>(
              `/api/v1/courses/${courseId}/assignments`,
              {
                params: {
                  bucket: 'unsubmitted',
                  order_by: 'due_at',
                  per_page: 50,
                },
              }
            );
            courseAssignments = assignmentsResponse.data;
          } catch {
            // Preservar lo obtenido en todoItems
          }
        }
      }

      return {
        todoList: todoItems,
        courseAssignments,
      };
    } catch (err) {
      this.handleError(err, 'obtener las tareas pendientes');
    }
  }

  /**
   * Herramienta 3: Listar archivos de un curso.
   * Maneja automáticamente la restricción de la Universidad Siglo 21:
   * Si /files devuelve 403 Forbidden, recurre a páginas de módulos (pages/modulos),
   * assignments y el ecosistema MECA.
   * @param courseId ID del curso
   * @param searchTerm Término de búsqueda opcional
   * @param limit Cantidad máxima de archivos a retornar (default 50)
   */
  async getCourseFiles(
    courseId: number,
    searchTerm?: string,
    limit: number = 50
  ): Promise<CanvasFile[]> {
    this.ensureConfigured();

    // 1. Intentar el endpoint estándar de archivos de Canvas
    try {
      const params: Record<string, any> = {
        per_page: Math.min(limit, 100),
        sort: 'updated_at',
        order: 'desc',
      };

      if (searchTerm && searchTerm.trim() !== '') {
        params.search_term = searchTerm.trim();
      }

      const response = await this.client.get<CanvasFile[]>(`/api/v1/courses/${courseId}/files`, {
        params,
      });

      const files = response.data || [];
      return files.map((f) => ({ ...f, origin: 'api_files' }));
    } catch (err) {
      // Si el error es 403 Forbidden, activar fallback inteligente para Siglo 21
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        console.error(
          `[CanvasClient] Pestaña /files restringida (403 Forbidden) en curso ${courseId}. ` +
            `Activando fallback automático de la Universidad Siglo 21 (módulos, páginas y MECA)...`
        );
        return await this.getCourseFilesFallback(courseId, searchTerm, limit);
      }

      this.handleError(err, `listar archivos del curso ${courseId}`);
    }
  }

  /**
   * Fallback para Universidad Siglo 21:
   * Escanea módulos, la página de módulos (/pages/modulos), enunciados de asignaciones
   * y paquetes interactivos MECA para descubrir y extraer los archivos reales de la materia.
   */
  private async getCourseFilesFallback(
    courseId: number,
    searchTerm?: string,
    limit: number = 50
  ): Promise<CanvasFile[]> {
    const discoveredFilesMap = new Map<number, CanvasFile>();
    const discoveredMecaFiles: CanvasFile[] = [];
    const discoveredFileIds = new Set<number>();
    const mecaUrls = new Set<string>();

    const filterTerm = searchTerm ? searchTerm.toLowerCase().trim() : '';

    // Regex para identificar enlaces a archivos de Canvas en código HTML
    const canvasFileRegex = /\/(?:courses\/\d+\/)?files\/(\d+)(?:\/download)?/gi;
    // Regex para identificar enlaces a módulos interactivos MECA
    const mecaRegex = /https?:\/\/meca\.ues21\.edu\.ar\/[^\s"'<>)\]]+/gi;

    const extractLinksFromHtml = (htmlContent: string) => {
      if (!htmlContent) return;
      let match: RegExpExecArray | null;
      while ((match = canvasFileRegex.exec(htmlContent)) !== null) {
        const id = parseInt(match[1], 10);
        if (!isNaN(id) && id > 0) discoveredFileIds.add(id);
      }
      while ((match = mecaRegex.exec(htmlContent)) !== null) {
        mecaUrls.add(match[0]);
      }
    };

    // A. Consultar Módulos del Curso (/api/v1/courses/:id/modules?include[]=items)
    try {
      const modulesRes = await this.client.get<CanvasModule[]>(
        `/api/v1/courses/${courseId}/modules`,
        {
          params: { 'include[]': ['items'], per_page: 50 },
        }
      );

      if (Array.isArray(modulesRes.data)) {
        for (const mod of modulesRes.data) {
          if (!mod.items) continue;
          for (const item of mod.items) {
            if (item.type === 'File' && item.content_id) {
              discoveredFileIds.add(item.content_id);
            }
            if (item.external_url && isMecaUrl(item.external_url)) {
              mecaUrls.add(item.external_url);
            }
          }
        }
      }
    } catch {
      // Continuar al siguiente método si módulos falla
    }

    // B. Consultar Páginas del Curso: específicamente 'modulos' y listado general
    try {
      // 1. Probar página específica de módulos de Siglo 21 ('pages/modulos')
      try {
        const modulosPage = await this.client.get<CanvasPage>(
          `/api/v1/courses/${courseId}/pages/modulos`
        );
        if (modulosPage.data?.body) {
          extractLinksFromHtml(modulosPage.data.body);
        }
      } catch {
        // La página puede tener otro slug
      }

      // 2. Escanear páginas disponibles
      const pagesRes = await this.client.get<CanvasPage[]>(
        `/api/v1/courses/${courseId}/pages`,
        {
          params: { per_page: 25 },
        }
      );

      if (Array.isArray(pagesRes.data)) {
        for (const page of pagesRes.data.slice(0, 10)) {
          try {
            const pageDetail = await this.client.get<CanvasPage>(
              `/api/v1/courses/${courseId}/pages/${page.url}`
            );
            if (pageDetail.data?.body) {
              extractLinksFromHtml(pageDetail.data.body);
            }
          } catch {
            // Ignorar páginas que fallen individualmente
          }
        }
      }
    } catch {
      // Continuar al siguiente método si páginas falla
    }

    // C. Consultar Enunciados de Asignaciones (/api/v1/courses/:id/assignments)
    try {
      const assignmentsRes = await this.client.get<CanvasAssignment[]>(
        `/api/v1/courses/${courseId}/assignments`,
        {
          params: { per_page: 50 },
        }
      );

      if (Array.isArray(assignmentsRes.data)) {
        for (const assignment of assignmentsRes.data) {
          if (assignment.description) {
            extractLinksFromHtml(assignment.description);
          }
        }
      }
    } catch {
      // Continuar si falla asignaciones
    }

    // D. Obtener metadatos de los File IDs descubiertos mediante GET /api/v1/files/:file_id
    const fileIdList = Array.from(discoveredFileIds);
    for (const fileId of fileIdList.slice(0, limit * 2)) {
      try {
        const metadataRes = await this.client.get<CanvasFile>(`/api/v1/files/${fileId}`);
        const file = metadataRes.data;
        if (file && file.id) {
          file.origin = 'modules_fallback';
          file.origin_context = 'Recurso extraído de módulos/páginas/consignas de Siglo 21';
          discoveredFilesMap.set(file.id, file);
        }
      } catch {
        // Si no se puede consultar individualmente, crear entrada sintética
        discoveredFilesMap.set(fileId, {
          id: fileId,
          display_name: `Archivo de cátedra [ID ${fileId}]`,
          filename: `canvas_file_${fileId}`,
          url: `${this.config.baseUrl}/files/${fileId}/download?download_frd=1`,
          size: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          origin: 'modules_fallback',
          origin_context: 'Enlace detectado en contenidos del curso',
        });
      }
    }

    // E. Extraer lecturas teóricas desde módulos MECA descubiertos (meca.ues21.edu.ar)
    for (const mecaUrl of Array.from(mecaUrls).slice(0, 10)) {
      try {
        const parsedMeca = await parseMecaPackage(mecaUrl, this.config.userAgent);
        for (const attachment of parsedMeca.attachments) {
          // Generar ID sintético negativo para identificar recursos MECA
          const mecaFileId = -(Math.abs(crc32(attachment.url)) || 9999);
          discoveredMecaFiles.push({
            id: mecaFileId,
            display_name: `[MECA] ${parsedMeca.title} - ${attachment.title}`,
            filename: attachment.filename,
            'content-type': 'application/pdf',
            url: attachment.url,
            size: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            origin: 'meca',
            origin_context: `Lectura interactiva Articulate Rise (${attachment.lessonTitle}): ${mecaUrl}`,
          });
        }
      } catch (mecaErr) {
        console.error(
          `[CanvasClient] Advertencia al procesar paquete MECA (${mecaUrl}): ${
            mecaErr instanceof Error ? mecaErr.message : String(mecaErr)
          }`
        );
      }
    }

    // Combinar todos los archivos descubiertos
    let allFiles = [...Array.from(discoveredFilesMap.values()), ...discoveredMecaFiles];

    // Filtrar por search_term si fue proporcionado
    if (filterTerm) {
      allFiles = allFiles.filter((f) => {
        const name = (f.display_name || f.filename || '').toLowerCase();
        return name.includes(filterTerm);
      });
    }

    return allFiles.slice(0, limit);
  }

  /**
   * Obtiene los metadatos de un archivo por su ID
   * @param fileId ID del archivo en Canvas LMS
   */
  async getFileMetadata(fileId: number): Promise<CanvasFile> {
    this.ensureConfigured();
    try {
      const response = await this.client.get<CanvasFile>(`/api/v1/files/${fileId}`);
      return response.data;
    } catch (err) {
      this.handleError(err, `obtener información del archivo ID ${fileId}`);
    }
  }

  /**
   * Descarga el buffer binario de un archivo de Canvas LMS o de una URL externa.
   * Cuenta con protección estricta contra Amazon S3 SignatureDoesNotMatch.
   */
  async downloadFileBuffer(
    fileId?: number,
    customUrl?: string
  ): Promise<{ buffer: Buffer; file: CanvasFile }> {
    this.ensureConfigured();

    let downloadUrl = customUrl;
    let fileInfo: CanvasFile;

    if (fileId !== undefined && fileId > 0) {
      fileInfo = await this.getFileMetadata(fileId);
      downloadUrl = fileInfo.url || `${this.config.baseUrl}/files/${fileId}/download?download_frd=1`;
    } else if (customUrl) {
      const filename = customUrl.split('/').pop()?.split('?')[0] || 'recurso_descarga';
      fileInfo = {
        id: fileId || 0,
        display_name: filename,
        filename,
        url: customUrl,
        size: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } else {
      throw new Error('Se requiere un fileId o una URL de archivo válida para descargar.');
    }

    if (!downloadUrl) {
      throw new Error('No se pudo determinar la URL de descarga para el archivo solicitado.');
    }

    try {
      const isCanvasDomain = downloadUrl.toLowerCase().includes(this.baseHost);
      const isS3Direct =
        downloadUrl.includes('amazonaws.com') || downloadUrl.includes('s3.');

      const requestHeaders: Record<string, string> = {
        'User-Agent': this.config.userAgent,
      };

      // Si la URL es de Canvas y NO es directamente un bucket de S3, adjuntar credenciales
      if (isCanvasDomain && !isS3Direct) {
        if (this.config.sessionCookies) {
          requestHeaders['Cookie'] = this.config.sessionCookies;
        }
        if (this.config.apiToken) {
          requestHeaders['Authorization'] = `Bearer ${this.config.apiToken}`;
        }
      }

      const response = await axios.get(downloadUrl, {
        headers: requestHeaders,
        responseType: 'arraybuffer',
        timeout: 60000,
        maxRedirects: 10,
        beforeRedirect: (options: any) => {
          sanitizeRedirectHeaders(options, this.baseHost);
        },
      });

      const buffer = Buffer.from(response.data);
      return { buffer, file: fileInfo };
    } catch (err) {
      this.handleError(
        err,
        `descargar el archivo "${fileInfo.display_name || fileInfo.filename}"`
      );
    }
  }

  /**
   * Herramienta 4: Descarga un archivo y extrae su texto plano digital.
   * Soporta:
   * - Archivos PDF nativos mediante pdf-parse v2
   * - Formatos de texto plano y código (TXT, MD, CSV, JSON, HTML, etc.)
   * - Módulos teóricos interactivos de MECA (Articulate Rise en meca.ues21.edu.ar)
   * - Truncamiento configurable para respetar la ventana de contexto del LLM.
   */
  async readCourseFileContent(
    fileId?: number,
    fileUrl?: string,
    maxCharacters: number = 50000
  ): Promise<FileContentResult> {
    if (!fileId && !fileUrl) {
      throw new Error('Debes proporcionar al menos un "file_id" numérico o una "file_url" de archivo.');
    }

    // 1. Manejo especializado para módulos de MECA (Articulate Rise)
    if (fileUrl && isMecaUrl(fileUrl)) {
      return await this.readMecaModuleContent(fileUrl, maxCharacters);
    }

    // 2. Descarga estándar de archivo
    const { buffer, file } = await this.downloadFileBuffer(fileId, fileUrl);

    const contentType = (file['content-type'] || '').toLowerCase();
    const filename = (file.filename || file.display_name || '').toLowerCase();
    const isPdf =
      contentType.includes('pdf') ||
      filename.endsWith('.pdf') ||
      buffer.slice(0, 5).toString('utf-8') === '%PDF-';

    let rawText = '';
    let numPages: number | undefined;

    if (isPdf) {
      const parser = new PDFParse({ data: buffer });
      try {
        const textResult = await parser.getText();
        rawText = textResult.text || '';
        numPages = textResult.total;
      } catch (pdfErr) {
        throw new Error(
          `Error al extraer texto del documento PDF "${file.display_name || file.filename}": ${
            pdfErr instanceof Error ? pdfErr.message : String(pdfErr)
          }`
        );
      } finally {
        await parser.destroy();
      }
    } else if (
      contentType.startsWith('text/') ||
      contentType.includes('json') ||
      contentType.includes('xml') ||
      contentType.includes('javascript') ||
      contentType.includes('csv') ||
      filename.endsWith('.txt') ||
      filename.endsWith('.md') ||
      filename.endsWith('.csv') ||
      filename.endsWith('.json') ||
      filename.endsWith('.html') ||
      filename.endsWith('.xml') ||
      filename.endsWith('.py') ||
      filename.endsWith('.js') ||
      filename.endsWith('.ts')
    ) {
      rawText = buffer.toString('utf-8');
    } else {
      throw new Error(
        `El archivo "${file.display_name || file.filename}" tiene tipo "${contentType || 'desconocido'}" ` +
          `que no es un documento de texto plano ni PDF. Formatos soportados: PDF, TXT, MD, CSV, JSON, HTML, código fuente. ` +
          `Enlace de descarga directa: ${file.url}`
      );
    }

    let truncated = false;
    let finalText = rawText;
    if (maxCharacters > 0 && finalText.length > maxCharacters) {
      finalText = finalText.slice(0, maxCharacters);
      truncated = true;
    }

    return {
      file,
      text: finalText,
      isPdf,
      numPages,
      charCount: rawText.length,
      truncated,
      sourceType: 'canvas_file',
    };
  }

  /**
   * Lee un módulo teórico MECA:
   * Extrae el PDF oficial si existe o el texto completo de las lecciones interactivas.
   */
  private async readMecaModuleContent(
    mecaUrl: string,
    maxCharacters: number
  ): Promise<FileContentResult> {
    const parsedMeca = await parseMecaPackage(mecaUrl, this.config.userAgent);

    // Si tiene adjunto PDF (ej. "Descarga en PDF"), descargar el PDF y procesarlo con pdf-parse
    if (parsedMeca.attachments.length > 0) {
      const primaryPdf = parsedMeca.attachments[0];
      try {
        const { buffer, file } = await this.downloadFileBuffer(undefined, primaryPdf.url);
        file.display_name = `[MECA] ${parsedMeca.title} - ${primaryPdf.title}`;

        const parser = new PDFParse({ data: buffer });
        try {
          const textResult = await parser.getText();
          const rawText = textResult.text || '';
          let truncated = false;
          let finalText = rawText;
          if (maxCharacters > 0 && finalText.length > maxCharacters) {
            finalText = finalText.slice(0, maxCharacters);
            truncated = true;
          }

          return {
            file,
            text: finalText,
            isPdf: true,
            numPages: textResult.total,
            charCount: rawText.length,
            truncated,
            sourceType: 'meca_pdf',
          };
        } finally {
          await parser.destroy();
        }
      } catch (pdfErr) {
        console.error(
          `[CanvasClient] No se pudo procesar el PDF del módulo MECA, utilizando texto interactivo: ${
            pdfErr instanceof Error ? pdfErr.message : String(pdfErr)
          }`
        );
      }
    }

    // Si no hay PDF o falló, utilizar el texto extraído directamente del paquete Base64 de Articulate Rise
    let rawText = parsedMeca.rawText;
    let truncated = false;
    let finalText = rawText;
    if (maxCharacters > 0 && finalText.length > maxCharacters) {
      finalText = finalText.slice(0, maxCharacters);
      truncated = true;
    }

    const syntheticFile: CanvasFile = {
      id: 0,
      display_name: `[MECA] ${parsedMeca.title}`,
      filename: `${parsedMeca.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`,
      url: mecaUrl,
      size: Buffer.byteLength(rawText, 'utf8'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      origin: 'meca',
      origin_context: 'Lectura interactiva Articulate Rise',
    };

    return {
      file: syntheticFile,
      text: finalText,
      isPdf: false,
      charCount: rawText.length,
      truncated,
      sourceType: 'meca_text',
    };
  }

  /**
   * Obtiene los quizzes y evaluaciones de un curso
   */
  async getCourseQuizzes(courseId: number): Promise<CanvasQuiz[]> {
    this.ensureConfigured();
    try {
      const response = await this.client.get<CanvasQuiz[]>(`/api/v1/courses/${courseId}/quizzes`, {
        params: { per_page: 50 },
      });
      return response.data || [];
    } catch (err) {
      if (axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 403)) {
        return [];
      }
      this.handleError(err, `obtener quizzes del curso ${courseId}`);
    }
  }

  /**
   * Obtiene eventos de calendario y fechas de actividades
   */
  async getCalendarEvents(options: {
    courseId?: number;
    startDate?: string;
    endDate?: string;
    type?: 'event' | 'assignment';
    allEvents?: boolean;
  } = {}): Promise<CanvasCalendarEvent[]> {
    this.ensureConfigured();
    try {
      const queryParams: Record<string, any> = {
        per_page: 100,
      };

      if (options.courseId) {
        queryParams['context_codes[]'] = `course_${options.courseId}`;
      }
      if (options.type) {
        queryParams.type = options.type;
      }
      if (options.startDate) {
        queryParams.start_date = options.startDate;
      }
      if (options.endDate) {
        queryParams.end_date = options.endDate;
      }
      if (options.allEvents) {
        queryParams.all_events = true;
      }

      const response = await this.client.get<CanvasCalendarEvent[]>('/api/v1/calendar_events', {
        params: queryParams,
      });
      return response.data || [];
    } catch (err) {
      this.handleError(err, 'obtener eventos del calendario');
    }
  }

  /**
   * Obtiene el cronograma consolidado y fechas de exámenes de un curso
   */
  async getCourseSchedule(courseId: number): Promise<{
    courseName: string;
    exams: Array<{
      id: number;
      title: string;
      type: 'quiz' | 'assignment' | 'event';
      due_at?: string | null;
      unlock_at?: string | null;
      lock_at?: string | null;
      points?: number;
      html_url?: string;
    }>;
    assignments: CanvasAssignment[];
    calendarEvents: CanvasCalendarEvent[];
  }> {
    this.ensureConfigured();

    // 1. Obtener nombre del curso
    let courseName = `Curso ID ${courseId}`;
    try {
      const courseRes = await this.client.get<CanvasCourse>(`/api/v1/courses/${courseId}`);
      if (courseRes.data?.name) courseName = courseRes.data.name;
    } catch {
      // Usar fallback
    }

    // 2. Ejecutar consultas en paralelo: tareas, quizzes y eventos de calendario
    const [assignmentsRes, quizzesRes, calendarRes] = await Promise.allSettled([
      this.client.get<CanvasAssignment[]>(`/api/v1/courses/${courseId}/assignments`, {
        params: { per_page: 100, order_by: 'due_at' },
      }),
      this.getCourseQuizzes(courseId),
      this.getCalendarEvents({ courseId, allEvents: true }),
    ]);

    const assignments = assignmentsRes.status === 'fulfilled' ? assignmentsRes.value.data || [] : [];
    const quizzes = quizzesRes.status === 'fulfilled' ? quizzesRes.value || [] : [];
    const calendarEvents = calendarRes.status === 'fulfilled' ? calendarRes.value || [] : [];

    // 3. Identificar exámenes y parciales mediante coincidencia semántica
    const examRegex = /(parcial|recuperatorio|final|examen|evaluaci[oó]n|integrador|control|quiz)/i;
    const exams: Array<{
      id: number;
      title: string;
      type: 'quiz' | 'assignment' | 'event';
      due_at?: string | null;
      unlock_at?: string | null;
      lock_at?: string | null;
      points?: number;
      html_url?: string;
    }> = [];

    const seenTitles = new Set<string>();

    for (const quiz of quizzes) {
      const norm = quiz.title.toLowerCase().trim();
      seenTitles.add(norm);
      exams.push({
        id: quiz.id,
        title: quiz.title,
        type: 'quiz',
        due_at: quiz.due_at,
        unlock_at: quiz.unlock_at,
        lock_at: quiz.lock_at,
        points: quiz.points_possible,
        html_url: quiz.html_url,
      });
    }

    for (const assign of assignments) {
      const norm = assign.name.toLowerCase().trim();
      if (examRegex.test(norm) && !seenTitles.has(norm)) {
        seenTitles.add(norm);
        exams.push({
          id: assign.id,
          title: assign.name,
          type: 'assignment',
          due_at: assign.due_at,
          unlock_at: assign.unlock_at,
          lock_at: assign.lock_at,
          points: assign.points_possible,
          html_url: assign.html_url,
        });
      }
    }

    for (const evt of calendarEvents) {
      const norm = (evt.title || '').toLowerCase().trim();
      if (examRegex.test(norm) && !seenTitles.has(norm)) {
        seenTitles.add(norm);
        exams.push({
          id: Number(evt.id) || 0,
          title: evt.title,
          type: 'event',
          due_at: evt.end_at || evt.start_at,
          unlock_at: evt.start_at,
          lock_at: evt.end_at,
          html_url: evt.html_url,
        });
      }
    }

    // Ordenar cronológicamente (primero los que tienen fecha más próxima)
    exams.sort((a, b) => {
      const timeA = a.due_at ? new Date(a.due_at).getTime() : Infinity;
      const timeB = b.due_at ? new Date(b.due_at).getTime() : Infinity;
      return timeA - timeB;
    });

    return {
      courseName,
      exams,
      assignments,
      calendarEvents,
    };
  }

  /**
   * Obtiene los comunicados y anuncios oficiales de la cátedra
   */
  async getAnnouncements(courseIds?: number[], limit: number = 20): Promise<CanvasDiscussionTopic[]> {
    this.ensureConfigured();
    try {
      let targetCourseIds = courseIds;
      if (!targetCourseIds || targetCourseIds.length === 0) {
        const activeCourses = await this.getCourses('active');
        targetCourseIds = activeCourses.map((c) => c.id);
      }

      if (targetCourseIds.length === 0) {
        return [];
      }

      const params: Record<string, any> = {
        'context_codes[]': targetCourseIds.map((id) => `course_${id}`),
        per_page: limit,
      };

      const response = await this.client.get<CanvasDiscussionTopic[]>('/api/v1/announcements', {
        params,
      });

      return (response.data || []).map((a) => ({
        ...a,
        message: htmlToMarkdown(a.message),
      }));
    } catch (err) {
      if (courseIds && courseIds.length === 1) {
        try {
          const fallbackRes = await this.client.get<CanvasDiscussionTopic[]>(
            `/api/v1/courses/${courseIds[0]}/discussion_topics`,
            {
              params: { only_announcements: true, per_page: limit },
            }
          );
          return (fallbackRes.data || []).map((a) => ({
            ...a,
            message: htmlToMarkdown(a.message),
          }));
        } catch {
          // Si falla fallback, continuar con el manejo estándar
        }
      }
      this.handleError(err, 'obtener anuncios de cátedra');
    }
  }

  /**
   * Lista los foros de debate y consultas de un curso
   */
  async getDiscussionTopics(courseId: number, limit: number = 20): Promise<CanvasDiscussionTopic[]> {
    this.ensureConfigured();
    try {
      const response = await this.client.get<CanvasDiscussionTopic[]>(
        `/api/v1/courses/${courseId}/discussion_topics`,
        {
          params: {
            per_page: limit,
            order_by: 'recent_activity',
          },
        }
      );

      return (response.data || []).map((topic) => ({
        ...topic,
        message: htmlToMarkdown(topic.message),
      }));
    } catch (err) {
      this.handleError(err, `obtener foros del curso ${courseId}`);
    }
  }

  /**
   * Obtiene el detalle de un foro de discusión junto con sus respuestas y comentarios
   */
  async getDiscussionTopicDetails(
    courseId: number,
    topicId: number
  ): Promise<{ topic: CanvasDiscussionTopic; replies: CanvasDiscussionReply[] }> {
    this.ensureConfigured();
    try {
      // 1. Obtener datos del tema principal
      const topicRes = await this.client.get<CanvasDiscussionTopic>(
        `/api/v1/courses/${courseId}/discussion_topics/${topicId}`
      );
      const topic = {
        ...topicRes.data,
        message: htmlToMarkdown(topicRes.data.message),
      };

      // 2. Obtener vista completa de participaciones y respuestas
      const viewRes = await this.client.get<any>(
        `/api/v1/courses/${courseId}/discussion_topics/${topicId}/view`
      );

      const participantsMap = new Map<number, string>();
      if (Array.isArray(viewRes.data?.participants)) {
        for (const p of viewRes.data.participants) {
          participantsMap.set(p.id, p.display_name || 'Usuario');
        }
      }

      const replies: CanvasDiscussionReply[] = [];
      const flattenReplies = (entries: any[]) => {
        if (!Array.isArray(entries)) return;
        for (const entry of entries) {
          if (!entry) continue;
          replies.push({
            id: entry.id,
            user_id: entry.user_id,
            parent_id: entry.parent_id,
            created_at: entry.created_at,
            updated_at: entry.updated_at,
            message: htmlToMarkdown(entry.message),
            user_name: participantsMap.get(entry.user_id) || 'Participante',
          });
          if (Array.isArray(entry.replies)) {
            flattenReplies(entry.replies);
          }
        }
      };

      if (Array.isArray(viewRes.data?.view)) {
        flattenReplies(viewRes.data.view);
      }

      replies.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      return { topic, replies };
    } catch (err) {
      this.handleError(err, `obtener detalles del foro ID ${topicId} en curso ${courseId}`);
    }
  }

  /**
   * Publica un mensaje o respuesta en un foro de discusión
   */
  async postDiscussionReply(
    courseId: number,
    topicId: number,
    message: string
  ): Promise<CanvasDiscussionReply> {
    this.ensureConfigured();
    if (!message || message.trim().length === 0) {
      throw new Error('El mensaje no puede estar vacío.');
    }
    try {
      const response = await this.client.post<any>(
        `/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries`,
        { message }
      );

      return {
        id: response.data.id,
        user_id: response.data.user_id,
        parent_id: response.data.parent_id,
        created_at: response.data.created_at,
        message: htmlToMarkdown(response.data.message),
        user_name: response.data.user_name || 'Yo',
      };
    } catch (err) {
      this.handleError(err, `publicar respuesta en el foro ID ${topicId}`);
    }
  }

  /**
   * Realiza la entrega formal de un Trabajo Práctico o Asignación en Canvas LMS
   * Soporta:
   * - online_upload: sube un archivo local (PDF, DOCX, ZIP, etc.) con negociación S3
   * - online_text_entry: entrega texto digital o código
   * - online_url: entrega un enlace web (GitHub, Google Drive, etc.)
   */
  async submitAssignment(options: {
    courseId: number;
    assignmentId: number;
    submissionType: 'online_upload' | 'online_text_entry' | 'online_url';
    filePath?: string;
    textBody?: string;
    submissionUrl?: string;
    comment?: string;
  }): Promise<CanvasSubmission> {
    this.ensureConfigured();

    if (options.submissionType === 'online_upload') {
      if (!options.filePath) {
        throw new Error('Debes proporcionar "filePath" con la ruta absoluta del archivo a subir.');
      }

      const resolvedPath = path.resolve(options.filePath);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`El archivo a subir no existe en el disco: ${resolvedPath}`);
      }

      const fileStats = fs.statSync(resolvedPath);
      const filename = path.basename(resolvedPath);
      const ext = path.extname(filename).toLowerCase();

      let contentType = 'application/octet-stream';
      if (ext === '.pdf') contentType = 'application/pdf';
      else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (ext === '.zip') contentType = 'application/zip';
      else if (ext === '.txt') contentType = 'text/plain';
      else if (ext === '.py') contentType = 'text/x-python';

      // Paso 1: Notificar a Canvas LMS de la intención de subida
      const initiateUrl = `/api/v1/courses/${options.courseId}/assignments/${options.assignmentId}/submissions/self/files`;
      let initiateRes;
      try {
        initiateRes = await this.client.post(initiateUrl, {
          name: filename,
          size: fileStats.size,
          content_type: contentType,
        });
      } catch (err) {
        this.handleError(err, `iniciar la subida del archivo para la tarea ID ${options.assignmentId}`);
      }

      const { upload_url, upload_params, file_param } = initiateRes.data;
      if (!upload_url) {
        throw new Error('Canvas LMS no retornó una URL de subida de archivo válida.');
      }

      // Paso 2: Subir el archivo binario a la URL de almacenamiento (ej. AWS S3)
      let fileId: number | undefined;
      try {
        const formData = new FormData();
        if (upload_params) {
          for (const [k, v] of Object.entries(upload_params)) {
            formData.append(k, String(v));
          }
        }

        const paramName = file_param || 'file';
        const fileBuffer = fs.readFileSync(resolvedPath);
        formData.append(paramName, new Blob([fileBuffer]), filename);

        const uploadRes = await fetch(upload_url, {
          method: 'POST',
          body: formData,
          redirect: 'manual',
        });

        // Manejo de redirección (303 See Other / 302 hacia create_success de Canvas)
        if (uploadRes.status >= 300 && uploadRes.status < 400) {
          const redirectLocation = uploadRes.headers.get('location');
          if (redirectLocation) {
            const finalRes = await this.client.get(redirectLocation);
            fileId = finalRes.data?.id;
          }
        } else if (uploadRes.ok) {
          const json = (await uploadRes.json().catch(() => null)) as any;
          fileId = json?.id;
        } else {
          const errText = await uploadRes.text().catch(() => '');
          throw new Error(`Error en el almacenamiento de Canvas (${uploadRes.status}): ${errText}`);
        }

        if (!fileId) {
          throw new Error('El archivo se transfirió pero no se pudo recuperar el File ID resultante de Canvas.');
        }
      } catch (uploadErr) {
        throw new Error(
          `Fallo al subir el archivo físico a Canvas: ${
            uploadErr instanceof Error ? uploadErr.message : String(uploadErr)
          }`
        );
      }

      // Paso 3: Confirmar la entrega formal en Canvas
      try {
        const submitRes = await this.client.post<CanvasSubmission>(
          `/api/v1/courses/${options.courseId}/assignments/${options.assignmentId}/submissions`,
          {
            submission: {
              submission_type: 'online_upload',
              file_ids: [fileId],
            },
            comment: options.comment ? { text_comment: options.comment } : undefined,
          }
        );
        return submitRes.data;
      } catch (err) {
        this.handleError(err, `confirmar la entrega de la tarea ID ${options.assignmentId}`);
      }
    } else if (options.submissionType === 'online_text_entry') {
      if (!options.textBody || options.textBody.trim().length === 0) {
        throw new Error('Para "online_text_entry" debes proporcionar "textBody".');
      }

      try {
        const submitRes = await this.client.post<CanvasSubmission>(
          `/api/v1/courses/${options.courseId}/assignments/${options.assignmentId}/submissions`,
          {
            submission: {
              submission_type: 'online_text_entry',
              body: options.textBody,
            },
            comment: options.comment ? { text_comment: options.comment } : undefined,
          }
        );
        return submitRes.data;
      } catch (err) {
        this.handleError(err, `entregar texto en la tarea ID ${options.assignmentId}`);
      }
    } else if (options.submissionType === 'online_url') {
      if (!options.submissionUrl || options.submissionUrl.trim().length === 0) {
        throw new Error('Para "online_url" debes proporcionar "submissionUrl".');
      }

      try {
        const submitRes = await this.client.post<CanvasSubmission>(
          `/api/v1/courses/${options.courseId}/assignments/${options.assignmentId}/submissions`,
          {
            submission: {
              submission_type: 'online_url',
              url: options.submissionUrl,
            },
            comment: options.comment ? { text_comment: options.comment } : undefined,
          }
        );
        return submitRes.data;
      } catch (err) {
        this.handleError(err, `entregar enlace en la tarea ID ${options.assignmentId}`);
      }
    } else {
      throw new Error(`Tipo de entrega no soportado: ${options.submissionType}`);
    }
  }
}


/**
 * Hash simple de 32 bits para generar IDs sintéticos reproducibles
 */
function crc32(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
