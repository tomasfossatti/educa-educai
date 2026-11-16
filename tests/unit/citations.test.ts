import { describe, expect, it } from "vitest";
import { citationLabelForModel, citationUnit } from "@/domain/citations";
import { TEXT } from "@/lib/texts";

describe("unidad de cita por tipo de archivo", () => {
  it("PDF y PPTX citan páginas; TXT, MD y DOCX, secciones", () => {
    expect(citationUnit("Módulo 2 · Lectura 3 - Punto de equilibrio.pdf")).toBe("page");
    expect(citationUnit("clase.PPTX")).toBe("page");
    expect(citationUnit("Módulo 1 · Lectura 1 - El entorno empresarial y los costos.txt")).toBe("section");
    expect(citationUnit("notas.md")).toBe("section");
    expect(citationUnit("apunte.docx")).toBe("section");
  });

  it("la interfaz dice «sección» donde no hay páginas reales", () => {
    expect(TEXT.citation.source("programa.pdf", 2)).toBe("programa.pdf, pág. 2");
    expect(TEXT.citation.source("lectura.txt", 2)).toBe("lectura.txt, sección 2");
    expect(TEXT.chat.page(4, "lectura.txt")).toBe("sección 4");
    expect(TEXT.chat.page(4, "lectura.pdf")).toBe("pág. 4");
    expect(TEXT.quiz.source("lectura.txt", 1)).toBe("Fuente: lectura.txt, sección 1");
    expect(TEXT.material.pages(11, "lectura.txt")).toBe("11 secciones");
    expect(TEXT.material.pages(1, "lectura.pdf")).toBe("1 página");
  });

  it("el texto que recibe la IA también nombra la unidad correcta", () => {
    expect(citationLabelForModel("lectura.txt", 3)).toBe("sección 3");
    expect(citationLabelForModel("programa.pdf", 3)).toBe("página 3");
  });
});
