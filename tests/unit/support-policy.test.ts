import { describe, expect, it } from "vitest";
import { applySupportPolicy, requiresTeacherReview, type SupportEvidence } from "@/domain/support-policy";

const ev = (id: string, experienceId: string, source: SupportEvidence["source"] = "CHALLENGE_SUBMISSION", assistanceLevel: SupportEvidence["assistanceLevel"] = "NONE"): SupportEvidence => ({
  evidenceId: id,
  experienceId,
  source,
  assistanceLevel,
});

describe("applySupportPolicy", () => {
  it("sin evidencia → insuficiente", () => {
    expect(applySupportPolicy({ proposed: "CONSISTENT", dimension: "APPLICATION", polarity: "STRENGTH", supporting: [], contradicting: [] }).status).toBe("INSUFFICIENT");
  });

  it("evidencia opuesta → contradictoria aunque el modelo proponga otra cosa", () => {
    const d = applySupportPolicy({ proposed: "CONSISTENT", dimension: "APPLICATION", polarity: "STRENGTH", supporting: [ev("a", "x")], contradicting: [ev("b", "y")] });
    expect(d.status).toBe("CONTRADICTORY");
    expect(d.notes.length).toBeGreaterThan(0);
  });

  it("consistente requiere dos evidencias en dos experiencias", () => {
    const sameExperience = applySupportPolicy({
      proposed: "CONSISTENT",
      dimension: "COMPREHENSION",
      polarity: "STRENGTH",
      supporting: [ev("a", "x"), ev("b", "x")],
      contradicting: [],
    });
    expect(sameExperience.status).toBe("PARTIAL");
    const twoExperiences = applySupportPolicy({
      proposed: "CONSISTENT",
      dimension: "COMPREHENSION",
      polarity: "STRENGTH",
      supporting: [ev("a", "x"), ev("b", "y")],
      contradicting: [],
    });
    expect(twoExperiences.status).toBe("CONSISTENT");
  });

  it("conversación con IA no demuestra aplicación", () => {
    const d = applySupportPolicy({
      proposed: "CONSISTENT",
      dimension: "APPLICATION",
      polarity: "STRENGTH",
      supporting: [ev("a", "x", "AI_CONVERSATION"), ev("b", "y", "AI_CONVERSATION")],
      contradicting: [],
    });
    expect(d.status).toBe("PARTIAL");
    expect(d.notes.join(" ")).toMatch(/conversar no demuestra aplicación/);
  });

  it("asistencia alta limita afirmaciones de autonomía", () => {
    const d = applySupportPolicy({
      proposed: "CONSISTENT",
      dimension: "AUTONOMY",
      polarity: "STRENGTH",
      supporting: [ev("a", "x", "CHALLENGE_SUBMISSION", "HIGH"), ev("b", "y", "CHALLENGE_SUBMISSION", "HIGH")],
      contradicting: [],
    });
    expect(d.status).toBe("PARTIAL");
  });

  it("contradicción sin evidencia opuesta citada → parcial", () => {
    expect(applySupportPolicy({ proposed: "CONTRADICTORY", dimension: "APPLICATION", polarity: "MIXED", supporting: [ev("a", "x")], contradicting: [] }).status).toBe("PARTIAL");
  });

  it("nunca sube el nivel propuesto", () => {
    expect(applySupportPolicy({ proposed: "PARTIAL", dimension: "COMPREHENSION", polarity: "STRENGTH", supporting: [ev("a", "x"), ev("b", "y")], contradicting: [] }).status).toBe("PARTIAL");
  });
});

describe("requiresTeacherReview", () => {
  it("dificultades, contradicciones y prioridad alta requieren revisión", () => {
    expect(requiresTeacherReview({ polarity: "DIFFICULTY", status: "PARTIAL", priority: "LOW" })).toBe(true);
    expect(requiresTeacherReview({ polarity: "STRENGTH", status: "CONTRADICTORY", priority: "LOW" })).toBe(true);
    expect(requiresTeacherReview({ polarity: "STRENGTH", status: "PARTIAL", priority: "HIGH" })).toBe(true);
    expect(requiresTeacherReview({ polarity: "STRENGTH", status: "PARTIAL", priority: "LOW" })).toBe(false);
  });
});
