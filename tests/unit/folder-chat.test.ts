import { describe, expect, it } from "vitest";
import { parseExternalConversation, resolveCitations } from "@/server/services/folder-chat";

const hits = [
  { chunkId: "c1", materialId: "m1", fileName: "programa.pdf", page: 2, text: "…", rank: 0.5 },
  { chunkId: "c2", materialId: "m2", fileName: "clase.pptx", page: 4, text: "…", rank: 0.3 },
];

describe("resolveCitations", () => {
  it("se queda solo con fuentes válidas que además aparecen en el texto", () => {
    const c = resolveCitations("Según [2] y también [7].", [2, 7, 1], hits);
    expect(c).toEqual({ noSource: false, items: [{ n: 2, chunkId: "c2", materialId: "m2", fileName: "clase.pptx", page: 4 }] });
  });
  it("sin citas válidas, la respuesta queda marcada sin fuente", () => {
    expect(resolveCitations("Respuesta sin corchetes.", [1], hits)).toEqual({ noSource: true, items: [] });
    expect(resolveCitations("Dice [1].", [1], [])).toEqual({ noSource: true, items: [] });
  });
});

describe("parseExternalConversation", () => {
  it("separa turnos con marcas de usuario e IA", () => {
    const parsed = parseExternalConversation("Yo: ¿qué es una hipótesis?\nChatGPT: Es una afirmación\nque se puede probar.\nYo: gracias");
    expect(parsed).toEqual([
      { role: "STUDENT", content: "¿qué es una hipótesis?" },
      { role: "TUTOR", content: "Es una afirmación\nque se puede probar." },
      { role: "STUDENT", content: "gracias" },
    ]);
  });
  it("sin marcas, queda como un solo mensaje del estudiante", () => {
    expect(parseExternalConversation("Notas sueltas\nsobre segmentación")).toEqual([{ role: "STUDENT", content: "Notas sueltas\nsobre segmentación" }]);
  });
  it("vacía no devuelve mensajes", () => {
    expect(parseExternalConversation("   \n ")).toEqual([]);
  });
});
