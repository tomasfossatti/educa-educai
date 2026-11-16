import "server-only";
import { htmlToText, materialFileName, parseRiseCourse, readingPage } from "@/domain/lms";
import { extractPages } from "@/server/material/extract";
import { LmsError, lmsFetch, readLimited, statusError } from "./net";
import { MAX_ITEM_BYTES, type DownloadedItem } from "./types";

/** Servidores de lecturas incrustadas que se aceptan (Siglo 21 usa meca.ues21.edu.ar). */
export function readingHosts(): string[] {
  const raw = process.env.LMS_READING_HOSTS?.trim();
  return (raw ? raw.split(",") : ["meca.ues21.edu.ar"]).map((h) => h.trim().toLowerCase()).filter(Boolean);
}

const MIN_TEXT = 300;
/** Caracteres para considerar que una página del PDF tiene texto (y no es una imagen escaneada). */
const MIN_PAGE_TEXT = 40;

/**
 * El PDF sirve para citar solo si tiene texto. Los escaneados (una imagen por página) no se pueden
 * leer sin OCR: en ese caso conviene el texto de la página web.
 */
export async function pdfHasText(data: Uint8Array): Promise<boolean> {
  try {
    // Copia: pdf.js se queda con el buffer que recibe y lo deja vacío.
    const pages = await extractPages(data.slice(), "pdf");
    const withText = pages.filter((p) => p.text.replace(/\s+/g, "").length >= MIN_PAGE_TEXT).length;
    return pages.length > 0 && withText * 2 >= pages.length;
  } catch {
    return false;
  }
}

async function fetchPdf(url: string): Promise<{ data: Uint8Array; readable: boolean } | null> {
  try {
    const response = await lmsFetch(url, { timeoutMs: 60_000 });
    if (!response.ok) return null;
    const data = await readLimited(response, MAX_ITEM_BYTES);
    return { data, readable: await pdfHasText(data) };
  } catch {
    return null;
  }
}

/**
 * Baja una lectura incrustada (pública, sin credenciales del LMS). Se prefiere su PDF de descarga,
 * porque así las citas llevan la página real. Si no hay PDF o es una imagen escaneada, se usa el
 * texto de la lectura y se marca, para avisarle a quien importa que las páginas citadas son
 * secciones del texto y no páginas del PDF.
 */
export async function downloadReading(url: string, module: string, reading: string): Promise<DownloadedItem> {
  const target = /\.html?$/i.test(url) ? url : `${url.replace(/\/+$/, "")}/index.html`;
  let response = await lmsFetch(target, { headers: { "user-agent": "Mozilla/5.0 (Educai)" } });
  if (response.status === 404 && target !== url) response = await lmsFetch(url, { headers: { "user-agent": "Mozilla/5.0 (Educai)" } });
  if (!response.ok) throw statusError(response.status, "la lectura");
  const html = new TextDecoder().decode(await readLimited(response, MAX_ITEM_BYTES));
  const pageUrl = response.url || target;

  const rise = parseRiseCourse(html, pageUrl);
  const page = rise ? null : readingPage(html, pageUrl);
  const title = (rise?.title && rise.title !== "Lectura" ? rise.title : page?.title) ?? null;
  const name = (ext: string) => materialFileName(module, title ? `${reading} - ${title}` : reading, ext);
  const heading = `${module} · ${reading}${title ? `: ${title}` : ""}`;

  const pdfUrls = rise ? rise.attachments.filter((u) => /\.pdf(\?|$)/i.test(u)) : page?.pdfUrl ? [page.pdfUrl] : [];
  let scanned = false;
  for (const pdfUrl of pdfUrls) {
    const pdf = await fetchPdf(pdfUrl);
    if (pdf?.readable) return { data: pdf.data, fileName: name(".pdf"), mimeType: "application/pdf" };
    if (pdf) scanned = true;
  }

  const text = rise && rise.text.length >= MIN_TEXT ? rise.text : htmlToText(html);
  if (text.length < MIN_TEXT) throw new LmsError("La lectura no tiene texto legible.", "other");
  return {
    data: new TextEncoder().encode(`${heading}\n\n${text}`),
    fileName: name(".txt"),
    mimeType: "text/plain",
    fallback: scanned ? "scanned_pdf" : "no_pdf",
  };
}
