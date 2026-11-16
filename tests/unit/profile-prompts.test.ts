/** Perfil progresivo: de a una pregunta, después de la primera charla, con "Saltar" (PR 11). */
import { describe, expect, it } from "vitest";
import { isProfilePrompt, nextProfilePrompt } from "@/domain/profile-prompts";

const empty = { career: null, studyYear: null, projectDescription: null, profilePromptsDone: [] as string[] };

describe("perfil progresivo", () => {
  it("no pregunta nada antes de la primera charla", () => {
    expect(nextProfilePrompt(empty, false)).toBeNull();
  });

  it("pregunta de a una, en orden: carrera, año, proyecto y foco", () => {
    expect(nextProfilePrompt(empty, true)).toBe("career");
    expect(nextProfilePrompt({ ...empty, career: "Administración" }, true)).toBe("studyYear");
    expect(nextProfilePrompt({ ...empty, career: "A", studyYear: 2 }, true)).toBe("project");
    expect(nextProfilePrompt({ ...empty, career: "A", studyYear: 2, projectDescription: "Viandas" }, true)).toBe("focus");
  });

  it("lo salteado no vuelve a aparecer", () => {
    expect(nextProfilePrompt({ ...empty, profilePromptsDone: ["career", "studyYear"] }, true)).toBe("project");
    expect(nextProfilePrompt({ ...empty, profilePromptsDone: ["career", "studyYear", "project", "focus"] }, true)).toBeNull();
  });

  it("el foco cuenta como respondido solo si se respondió o salteó (tiene valor por defecto)", () => {
    const full = { career: "A", studyYear: 1, projectDescription: "P", profilePromptsDone: [] };
    expect(nextProfilePrompt(full, true)).toBe("focus");
    expect(nextProfilePrompt({ ...full, profilePromptsDone: ["focus"] }, true)).toBeNull();
  });

  it("un texto vacío no cuenta como dato", () => {
    expect(nextProfilePrompt({ ...empty, career: "   " }, true)).toBe("career");
  });

  it("reconoce solo las preguntas conocidas", () => {
    expect(isProfilePrompt("career")).toBe(true);
    expect(isProfilePrompt("consentAnalysisAt")).toBe(false);
  });
});
