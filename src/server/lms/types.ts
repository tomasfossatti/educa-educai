import type { PlannedItem } from "@/domain/lms";

export type LmsProviderName = "CANVAS" | "MOODLE";

export interface LmsCourse {
  id: string;
  name: string;
  code: string | null;
  term: string | null;
}

export interface DownloadedItem {
  data: Uint8Array;
  fileName: string;
  mimeType: string;
  /**
   * Una lectura que entró como texto en vez de PDF: "no_pdf" si no tenía PDF que se pudiera bajar,
   * "scanned_pdf" si el PDF es una imagen escaneada. Sirve para avisar que las páginas no son las del PDF.
   */
  fallback?: "no_pdf" | "scanned_pdf";
}

/** Algo que se puede bajar y leer: un archivo, una página del curso o una lectura incrustada. */
export interface LmsItem extends PlannedItem {
  download(): Promise<DownloadedItem>;
}

export interface LmsModule {
  name: string;
  items: LmsItem[];
}

export interface LmsClient {
  readonly provider: LmsProviderName;
  whoAmI(): Promise<{ name: string }>;
  listCourses(): Promise<LmsCourse[]>;
  courseModules(courseId: string): Promise<LmsModule[]>;
}

/** Tope por archivo: el mismo que la subida manual de material. */
export const MAX_ITEM_BYTES = 20 * 1024 * 1024;

export const SUPPORTED_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/markdown": "md",
};

/** Extensión legible del archivo, por tipo o por nombre; null si Educai no lo puede leer. */
export function readableExtension(mimeType: string | null | undefined, fileName: string): string | null {
  const byMime = mimeType ? SUPPORTED_MIME[mimeType.split(";")[0].trim().toLowerCase()] : undefined;
  if (byMime) return byMime;
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return ["pdf", "docx", "pptx", "txt", "md"].includes(ext) ? ext : null;
}

export function textItem(title: string, text: string, fileName: string): DownloadedItem {
  return { data: new TextEncoder().encode(`${title}\n\n${text}`), fileName, mimeType: "text/plain" };
}
