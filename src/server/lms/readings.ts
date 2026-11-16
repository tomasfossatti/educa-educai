import "server-only";
import { htmlToText, parseRiseCourse } from "@/domain/lms";
import { LmsError, lmsFetch, readLimited, statusError } from "./net";
import { MAX_ITEM_BYTES, type DownloadedItem } from "./types";

/** Servidores de lecturas incrustadas que se aceptan (Siglo 21 usa meca.ues21.edu.ar). */
export function readingHosts(): string[] {
  const raw = process.env.LMS_READING_HOSTS?.trim();
  return (raw ? raw.split(",") : ["meca.ues21.edu.ar"]).map((h) => h.trim().toLowerCase()).filter(Boolean);
}

const MIN_TEXT = 300;

/**
 * Baja una lectura incrustada (pública, sin credenciales del LMS). Si es una lectura interactiva con
 * PDF de descarga, se queda con el PDF; si no, con su texto.
 */
export async function downloadReading(url: string, title: string, baseName: string): Promise<DownloadedItem> {
  const target = /\.html?$/i.test(url) ? url : `${url.replace(/\/+$/, "")}/index.html`;
  let response = await lmsFetch(target, { headers: { "user-agent": "Mozilla/5.0 (Educai)" } });
  if (response.status === 404 && target !== url) response = await lmsFetch(url, { headers: { "user-agent": "Mozilla/5.0 (Educai)" } });
  if (!response.ok) throw statusError(response.status, "la lectura");
  const html = new TextDecoder().decode(await readLimited(response, MAX_ITEM_BYTES));

  const rise = parseRiseCourse(html, response.url || target);
  if (rise) {
    for (const pdfUrl of rise.attachments.filter((u) => /\.pdf(\?|$)/i.test(u))) {
      try {
        const pdf = await lmsFetch(pdfUrl);
        if (pdf.ok) return { data: await readLimited(pdf, MAX_ITEM_BYTES), fileName: `${baseName}.pdf`, mimeType: "application/pdf" };
      } catch {
        // sin PDF: se usa el texto de la lectura
      }
    }
    if (rise.text.length >= MIN_TEXT) return { data: new TextEncoder().encode(`${title}\n\n${rise.text}`), fileName: `${baseName}.txt`, mimeType: "text/plain" };
  }
  const text = htmlToText(html);
  if (text.length < MIN_TEXT) throw new LmsError("La lectura no tiene texto legible.", "other");
  return { data: new TextEncoder().encode(`${title}\n\n${text}`), fileName: `${baseName}.txt`, mimeType: "text/plain" };
}
