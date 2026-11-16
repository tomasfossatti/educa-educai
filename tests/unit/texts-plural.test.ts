/** Plurales y saludo neutro en los textos de la interfaz (hallazgo H6 de la ronda de QA). */
import { describe, expect, it } from "vitest";
import { TEXT } from "@/lib/texts";

describe("textos con cantidades", () => {
  it("concuerdan en singular y en plural", () => {
    expect(TEXT.teacherCourse.pendingReview(1)).toBe("1 necesita revisión humana antes de considerarse confiable.");
    expect(TEXT.teacherCourse.pendingReview(3)).toBe("3 necesitan revisión humana antes de considerarse confiables.");
    expect(TEXT.teacherCourse.submitted(1, 1)).toBe("1 de 1 estudiante entregó.");
    expect(TEXT.teacherCourse.submitted(2, 5)).toBe("2 de 5 estudiantes entregaron.");
    expect(TEXT.development.snapshotBasis("hoy", 1, 1)).toContain("a partir de 1 evidencia en 1 experiencia.");
    expect(TEXT.development.snapshotBasis("hoy", 4, 2)).toContain("a partir de 4 evidencias en 2 experiencias.");
  });

  it("el saludo del inicio no supone el género", () => {
    expect(TEXT.home.welcome).not.toMatch(/Bienvenid[oa]\b/);
  });
});
