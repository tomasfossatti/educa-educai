import { describe, expect, it } from "vitest";
import { computeMastery, quizCorrectness } from "@/domain/topic-mastery";

describe("computeMastery (portado de DeepTutor)", () => {
  it("sin intentos, 0", () => {
    expect(computeMastery([])).toBe(0);
  });
  it("tope 0,5 con un intento y 0,8 con dos", () => {
    expect(computeMastery([1])).toBe(0.5);
    expect(computeMastery([1, 1])).toBe(0.8);
    expect(computeMastery([1, 1, 1])).toBe(1);
  });
  it("pesa más lo reciente: recuperarse de un error vale más que equivocarse al final", () => {
    expect(computeMastery([0, 1, 1])).toBeGreaterThan(computeMastery([1, 1, 0]));
  });
  it("usa solo los últimos cinco intentos con los pesos del spec", () => {
    // Pesos 0,5 0,7 0,85 0,95 1 sobre [0,1,1,1,1] → 3,5/4 = 0,875; el primer 0 de seis intentos queda afuera.
    expect(computeMastery([0, 0, 1, 1, 1, 1])).toBeCloseTo(3.5 / 4, 10);
  });
  it("con dos intentos usa los dos últimos pesos (0,95 y 1)", () => {
    expect(computeMastery([0, 1])).toBeCloseTo(1 / 1.95, 10);
  });
  it("acota el acierto entre 0 y 1", () => {
    expect(computeMastery([2, 2, 2])).toBe(1);
    expect(computeMastery([-1, 0, 0])).toBe(0);
  });
});

describe("quizCorrectness", () => {
  it("fracción de respuestas correctas", () => {
    expect(quizCorrectness(3, 4)).toBe(0.75);
    expect(quizCorrectness(0, 0)).toBe(0);
  });
});

describe("keepValidQuestions", () => {
  it("descarta preguntas sin fuente válida o con índice correcto fuera de rango", async () => {
    const { keepValidQuestions } = await import("@/server/services/quiz");
    const hits = [{ chunkId: "c", materialId: "m", fileName: "a.pdf", page: 3, text: "", rank: 1 }];
    const q = (source: number | null, correctIndex = 0) => ({ prompt: "¿Qué?", options: ["a", "b", "c"], correctIndex, explanation: "x", source });
    const kept = keepValidQuestions([q(1), q(null), q(2), q(1, 7)], hits);
    expect(kept).toHaveLength(1);
    expect(kept[0].source).toEqual({ fileName: "a.pdf", page: 3 });
  });
});
