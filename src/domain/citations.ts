/**
 * Unidad que se cita de cada archivo. PDF y PPTX tienen páginas (o diapositivas) reales; DOCX y TXT
 * no, así que se parten en secciones numeradas que no coinciden con ninguna página que vea la persona.
 */
export type CitationUnit = "page" | "section";

export function citationUnit(fileName: string): CitationUnit {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return ext === "txt" || ext === "md" || ext === "docx" ? "section" : "page";
}

/** Cómo se nombra la unidad en el texto que recibe la IA ("[1] apunte.txt, sección 3:"). */
export function citationLabelForModel(fileName: string, n: number): string {
  return `${citationUnit(fileName) === "section" ? "sección" : "página"} ${n}`;
}
