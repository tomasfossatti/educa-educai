import axios from 'axios';

export interface MecaAttachment {
  title: string;
  filename: string;
  url: string;
  lessonTitle: string;
}

export interface MecaParsedCourse {
  title: string;
  sourceUrl: string;
  attachments: MecaAttachment[];
  rawText: string;
}

/**
 * Determina si una URL pertenece al ecosistema MECA de la Universidad Siglo 21 (Articulate Rise)
 */
export function isMecaUrl(url: string): boolean {
  if (!url) return false;
  return url.toLowerCase().includes('meca.ues21.edu.ar');
}

/**
 * Extrae texto de items/bloques de Articulate Rise recursivamente
 */
function extractTextFromBlocks(blocks: any[]): string {
  if (!Array.isArray(blocks)) return '';
  const lines: string[] = [];

  for (const block of blocks) {
    if (!block) continue;

    // Título / Encabezado
    if (block.heading || block.title) {
      lines.push(`\n### ${block.heading || block.title}\n`);
    }

    // Párrafos / Texto
    if (block.text || block.paragraph || block.body) {
      const text = block.text || block.paragraph || block.body;
      if (typeof text === 'string') {
        // Remover etiquetas HTML si existen
        const cleanText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleanText) lines.push(cleanText);
      }
    }

    // Listas
    if (Array.isArray(block.items)) {
      for (const item of block.items) {
        if (typeof item === 'string') {
          lines.push(`- ${item.replace(/<[^>]+>/g, '').trim()}`);
        } else if (item?.text) {
          lines.push(`- ${String(item.text).replace(/<[^>]+>/g, '').trim()}`);
        }
      }
    }

    // Sub-bloques anidados
    if (Array.isArray(block.children)) {
      lines.push(extractTextFromBlocks(block.children));
    }
  }

  return lines.join('\n\n');
}

/**
 * Descarga y analiza un paquete interactivo MECA de Articulate Rise.
 * Decodifica el objeto window.courseData en Base64 y extrae los PDFs en assets/ y el texto teórico.
 */
export async function parseMecaPackage(
  url: string,
  userAgent: string = 'Mozilla/5.0'
): Promise<MecaParsedCourse> {
  let targetUrl = url.trim();
  if (targetUrl.endsWith('/')) {
    targetUrl += 'index.html';
  } else if (!targetUrl.endsWith('.html') && !targetUrl.endsWith('.htm')) {
    targetUrl += '/index.html';
  }

  const response = await axios.get<string>(targetUrl, {
    headers: {
      'User-Agent': userAgent,
      Accept: 'text/html,application/xhtml+xml,application/xml',
    },
    timeout: 25000,
  });

  const html = response.data;

  // Buscar window.courseData = "..." o courseData = "..."
  const base64Match = html.match(/courseData\s*=\s*["']([A-Za-z0-9+/=]+)["']/);

  if (!base64Match || !base64Match[1]) {
    throw new Error(
      `No se encontró el objeto de datos 'courseData' en el módulo MECA (${targetUrl}). ` +
        `Es posible que la estructura del recurso haya cambiado o requiera autenticación adicional.`
    );
  }

  let courseData: any;
  try {
    const jsonString = Buffer.from(base64Match[1], 'base64').toString('utf-8');
    courseData = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(
      `Error al decodificar los datos Base64 del curso MECA: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const courseTitle = courseData.title || 'Módulo Interactivo MECA';
  const attachments: MecaAttachment[] = [];
  const textParts: string[] = [`# ${courseTitle}\n`];

  // Base URL para assets relativos (directorio donde se encuentra index.html)
  const baseUrlDir = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

  if (Array.isArray(courseData.lessons)) {
    for (const lesson of courseData.lessons) {
      const lessonTitle = lesson.title || 'Lección';
      textParts.push(`\n## ${lessonTitle}\n`);

      // 1. Verificar si tiene media attachments (PDF oficial de descarga)
      const attachment =
        lesson.media?.attachment ||
        lesson.media?.download ||
        lesson.attachment;

      if (attachment) {
        const rawFilename =
          attachment.originalUrl ||
          attachment.key ||
          attachment.filename ||
          attachment.url ||
          '';

        if (rawFilename) {
          // Resolver URL completa hacia la subcarpeta assets/
          let downloadUrl: string;
          if (rawFilename.startsWith('http://') || rawFilename.startsWith('https://')) {
            downloadUrl = rawFilename;
          } else if (rawFilename.startsWith('/')) {
            const urlObj = new URL(targetUrl);
            downloadUrl = `${urlObj.origin}${rawFilename}`;
          } else {
            // Relativo: típicamente "assets/nombre_archivo.pdf"
            downloadUrl = new URL(rawFilename, baseUrlDir).href;
          }

          const cleanFilename = rawFilename.split('/').pop() || 'material.pdf';

          attachments.push({
            title: attachment.filename || lessonTitle,
            filename: cleanFilename,
            url: downloadUrl,
            lessonTitle,
          });
        }
      }

      // 2. Extraer contenido de texto de la lección
      if (Array.isArray(lesson.items)) {
        textParts.push(extractTextFromBlocks(lesson.items));
      } else if (Array.isArray(lesson.sections)) {
        textParts.push(extractTextFromBlocks(lesson.sections));
      }
    }
  }

  return {
    title: courseTitle,
    sourceUrl: targetUrl,
    attachments,
    rawText: textParts.join('\n\n').trim(),
  };
}
