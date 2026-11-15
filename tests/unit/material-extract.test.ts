import { describe, expect, it } from "vitest";
import { chunkPages, extractPages, materialKind, sectionsFromText } from "@/server/material/extract";
import { makeDocx, makePdf, makePptx } from "../support/documents";

describe("materialKind", () => {
  it("reconoce por MIME y, si falta, por extensión", () => {
    expect(materialKind("application/pdf", "x")).toBe("pdf");
    expect(materialKind("application/octet-stream", "Clase 3.PPTX")).toBe("pptx");
    expect(materialKind("", "apunte.md")).toBe("txt");
    expect(materialKind("image/png", "foto.png")).toBeNull();
  });
});

describe("extractPages", () => {
  it("PDF: una entrada por página, con su número", async () => {
    const pages = await extractPages(makePdf(["Segmentacion de mercado", "Hipotesis falsables con metrica"]), "pdf");
    expect(pages.map((p) => p.page)).toEqual([1, 2]);
    expect(pages[1].text).toContain("Hipotesis falsables");
  });

  it("PPTX: una entrada por diapositiva, en orden", async () => {
    const pages = await extractPages(await makePptx([["Clase 1", "Problema y solución"], ["Clase 2", "Métricas & umbrales"]]), "pptx");
    expect(pages).toEqual([
      { page: 1, text: "Clase 1\nProblema y solución" },
      { page: 2, text: "Clase 2\nMétricas & umbrales" },
    ]);
  });

  it("DOCX: el texto queda en secciones numeradas", async () => {
    const pages = await extractPages(await makeDocx(["Unidad 1. Segmentación.", "Unidad 2. Hipótesis."]), "docx");
    expect(pages[0].page).toBe(1);
    expect(pages[0].text).toContain("Unidad 2. Hipótesis.");
  });

  it("TXT: secciones por párrafos", async () => {
    const pages = await extractPages(new TextEncoder().encode("Uno.\n\nDos."), "txt");
    expect(pages).toEqual([{ page: 1, text: "Uno.\n\nDos." }]);
  });
});

describe("sectionsFromText", () => {
  it("abre una sección nueva cuando se supera el tamaño", () => {
    const sections = sectionsFromText(["a".repeat(60), "b".repeat(60), "c".repeat(60)].join("\n\n"), 130);
    expect(sections.map((s) => s.page)).toEqual([1, 2]);
    expect(sections[1].text).toBe("c".repeat(60));
  });
});

describe("chunkPages", () => {
  it("cada fragmento conserva su página y ninguno supera el máximo", () => {
    const sentence = "La hipótesis debe poder ser falsa. ";
    const chunks = chunkPages([{ page: 7, text: sentence.repeat(80) }, { page: 8, text: "Corta." }], 300, 40);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.text.length <= 300)).toBe(true);
    expect(chunks.at(-1)).toMatchObject({ page: 8, text: "Corta." });
    expect(new Set(chunks.slice(0, -1).map((c) => c.page))).toEqual(new Set([7]));
  });

  it("corta a la fuerza una oración más larga que el máximo", () => {
    const chunks = chunkPages([{ page: 1, text: "x".repeat(1000) }], 300, 50);
    expect(chunks.every((c) => c.text.length <= 300)).toBe(true);
  });

  it("ignora páginas vacías", () => {
    expect(chunkPages([{ page: 1, text: "  " }])).toEqual([]);
  });
});
