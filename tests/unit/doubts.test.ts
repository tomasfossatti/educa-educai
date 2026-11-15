import { describe, expect, it } from "vitest";
import { countsForTeacher, doubtPercent, doubtSentence } from "@/domain/doubts";

const now = new Date("2026-11-20T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe("countsForTeacher", () => {
  it("cuenta lo confirmado y nunca lo descartado", () => {
    expect(countsForTeacher({ studentStatus: "CONFIRMED", confidence: "MEDIUM", createdAt: now }, now)).toBe(true);
    expect(countsForTeacher({ studentStatus: "DISCARDED", confidence: "HIGH", createdAt: daysAgo(30) }, now)).toBe(false);
  });
  it("lo pendiente cuenta solo con confianza alta y 7 días sin respuesta", () => {
    expect(countsForTeacher({ studentStatus: "PENDING", confidence: "HIGH", createdAt: daysAgo(6) }, now)).toBe(false);
    expect(countsForTeacher({ studentStatus: "PENDING", confidence: "HIGH", createdAt: daysAgo(7) }, now)).toBe(true);
    expect(countsForTeacher({ studentStatus: "PENDING", confidence: "MEDIUM", createdAt: daysAgo(30) }, now)).toBe(false);
    expect(countsForTeacher({ studentStatus: "PENDING", confidence: null, createdAt: daysAgo(30) }, now)).toBe(false);
  });
});

describe("doubtSentence", () => {
  it("siempre con denominador", () => {
    expect(doubtSentence("Segmentación", 8, 20)).toBe("El 40% de la clase no entiende Segmentación (8 de 20 estudiantes que conversaron sobre este tema).");
    expect(doubtSentence("Segmentación", 1, 1)).toBe("El 100% de la clase no entiende Segmentación (1 de 1 estudiante que conversó sobre este tema).");
  });
  it("sin conversaciones el porcentaje es 0", () => {
    expect(doubtPercent(0, 0)).toBe(0);
  });
});
