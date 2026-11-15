import JSZip from "jszip";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

/** Texto de una unidad citable: página del PDF, diapositiva del PPTX o sección del DOCX o TXT. */
export interface PageText {
  page: number;
  text: string;
}

export interface Chunk {
  page: number;
  position: number;
  text: string;
}

export const SUPPORTED_MATERIAL = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/markdown": "txt",
} as const;

export type MaterialKind = (typeof SUPPORTED_MATERIAL)[keyof typeof SUPPORTED_MATERIAL];

/** Tipo de material a partir del MIME o, si el navegador no lo manda, de la extensión. */
export function materialKind(mimeType: string, fileName: string): MaterialKind | null {
  const byMime = SUPPORTED_MATERIAL[mimeType as keyof typeof SUPPORTED_MATERIAL];
  if (byMime) return byMime;
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "pdf" || ext === "docx" || ext === "pptx") return ext;
  if (ext === "txt" || ext === "md") return "txt";
  return null;
}

/** Tamaño de una "sección" en los formatos sin páginas (DOCX y TXT). */
const SECTION_CHARS = 3000;

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Agrupa párrafos en secciones numeradas, para citar formatos que no tienen páginas. */
export function sectionsFromText(text: string, size = SECTION_CHARS): PageText[] {
  const paragraphs = normalize(text).split(/\n\s*\n/).filter((p) => p.trim());
  const sections: PageText[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && current.length + p.length + 2 > size) {
      sections.push({ page: sections.length + 1, text: current });
      current = "";
    }
    current = current ? `${current}\n\n${p}` : p;
  }
  if (current) sections.push({ page: sections.length + 1, text: current });
  return sections;
}

async function pdfPages(data: Uint8Array): Promise<PageText[]> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: false });
  return text.map((t, i) => ({ page: i + 1, text: normalize(t) }));
}

async function pptxSlides(data: Uint8Array): Promise<PageText[]> {
  const zip = await JSZip.loadAsync(data);
  const slides = Object.keys(zip.files)
    .map((name) => ({ name, n: Number(/^ppt\/slides\/slide(\d+)\.xml$/.exec(name)?.[1]) }))
    .filter((s) => Number.isFinite(s.n) && s.n > 0)
    .sort((a, b) => a.n - b.n);
  const out: PageText[] = [];
  for (const s of slides) {
    const xml = await zip.file(s.name)!.async("string");
    // Cada párrafo (<a:p>) es una línea; dentro, los runs de texto (<a:t>).
    const lines = xml
      .split(/<\/a:p>/)
      .map((p) => [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1])).join(""))
      .filter((l) => l.trim());
    out.push({ page: s.n, text: normalize(lines.join("\n")) });
  }
  return out;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Extrae el texto por página (o diapositiva, o sección) de un archivo de material. */
export async function extractPages(data: Uint8Array, kind: MaterialKind): Promise<PageText[]> {
  switch (kind) {
    case "pdf":
      return pdfPages(data);
    case "pptx":
      return pptxSlides(data);
    case "docx": {
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(data) });
      return sectionsFromText(value);
    }
    case "txt":
      return sectionsFromText(new TextDecoder("utf-8").decode(data));
  }
}

/**
 * Parte cada página en fragmentos de hasta `maxChars`, cortando en párrafos u oraciones, con un
 * pequeño solapamiento. Cada fragmento conserva su página, para poder citarla.
 */
export function chunkPages(pages: PageText[], maxChars = 1200, overlap = 150): Chunk[] {
  const chunks: Chunk[] = [];
  for (const { page, text } of pages) {
    if (!text.trim()) continue;
    const pieces = text.split(/(?<=[.!?…])\s+|\n+/).filter((p) => p.trim());
    let current = "";
    for (const piece of pieces) {
      if (current && current.length + piece.length + 1 > maxChars) {
        chunks.push({ page, position: chunks.length, text: current.trim() });
        current = current.slice(-overlap);
      }
      // Una oración más larga que el máximo se corta a la fuerza.
      let rest = piece;
      while (rest.length > maxChars) {
        chunks.push({ page, position: chunks.length, text: rest.slice(0, maxChars) });
        rest = rest.slice(maxChars - overlap);
      }
      current = current ? `${current} ${rest}` : rest;
    }
    if (current.trim()) chunks.push({ page, position: chunks.length, text: current.trim() });
  }
  return chunks;
}
