import { describe, expect, it } from "vitest";
import { containsFalsePrecision, isVerbatimExcerpt, stripFalsePrecision, truncate } from "@/domain/text-guards";

describe("isVerbatimExcerpt", () => {
  const source = "Entonces sería algo como: al menos 40 de los 200 oficinistas se suscriben en las primeras dos semanas.";
  it("acepta citas textuales ignorando mayúsculas, acentos y puntuación", () => {
    expect(isVerbatimExcerpt("Al menos 40 de los 200 oficinistas se suscriben", source)).toBe(true);
    expect(isVerbatimExcerpt("«entonces seria algo como»", source)).toBe(true);
  });
  it("acepta elipsis entre partes en orden", () => {
    expect(isVerbatimExcerpt("al menos 40 … primeras dos semanas", source)).toBe(true);
    expect(isVerbatimExcerpt("primeras dos semanas ... al menos 40", source)).toBe(false);
  });
  it("rechaza texto parafraseado o inventado", () => {
    expect(isVerbatimExcerpt("la mitad de los oficinistas se suscribe", source)).toBe(false);
    expect(isVerbatimExcerpt("", source)).toBe(false);
  });
});

describe("containsFalsePrecision", () => {
  it("detecta porcentajes y puntajes sobre el estudiante", () => {
    expect(containsFalsePrecision("Tenés un 83% de comprensión del tema.")).toBe(true);
    expect(containsFalsePrecision("Tu aplicación es 7/10.")).toBe(true);
    expect(containsFalsePrecision("Estás en el nivel 3 de 5.")).toBe(true);
  });
  it("no marca números del propio trabajo del estudiante", () => {
    expect(containsFalsePrecision("Definiste un umbral del 30% de recompra semanal.")).toBe(false);
  });
  it("elimina las oraciones problemáticas", () => {
    expect(stripFalsePrecision("Bien planteado. Tenés 80% de comprensión. Seguí así.")).toBe("Bien planteado. Seguí así.");
  });
});

describe("truncate", () => {
  it("corta en límite de palabra", () => {
    expect(truncate("una frase bastante larga para recortar", 20)).toBe("una frase bastante…");
  });
});
