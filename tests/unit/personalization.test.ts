import { describe, expect, it } from "vitest";
import { focusText, personalizationPrompt } from "@/domain/personalization";

const profile = { declaredCurrentContext: "Trabajo en una empresa petrolera", projectDescription: "Un centro de kinesiología" };

describe("foco de personalización", () => {
  it("con foco en el proyecto, el prompt solo lleva el proyecto", () => {
    const text = personalizationPrompt({ ...profile, personalizationFocus: "PROJECT" });
    expect(text).toContain("kinesiología");
    expect(text).not.toContain("petrolera");
    expect(text).toContain("No uses su trabajo actual");
  });

  it("con foco en el trabajo, el prompt solo lleva el trabajo", () => {
    const text = personalizationPrompt({ ...profile, personalizationFocus: "WORK" });
    expect(text).toContain("petrolera");
    expect(text).not.toContain("kinesiología");
    expect(text).toContain("No uses su proyecto personal");
  });

  it("si el foco elegido está vacío usa el otro, y sin ninguno no agrega nada", () => {
    expect(focusText({ personalizationFocus: "WORK", declaredCurrentContext: null, projectDescription: "Kinesio" })).toEqual({ focus: "PROJECT", text: "Kinesio" });
    expect(personalizationPrompt({ personalizationFocus: "PROJECT", declaredCurrentContext: null, projectDescription: "  " })).toBe("");
  });
});
