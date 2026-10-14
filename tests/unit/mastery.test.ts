import { describe, expect, it } from "vitest";
import {
  estimateMemoryStability,
  evaluateConceptMastery,
  MENTAL_MODELS,
  type ConceptPracticeRecord,
} from "@/domain/mastery";

describe("estimateMemoryStability", () => {
  it("asigna ventana inmediata de 1 día ante dificultad para favorecer hipercorrección", () => {
    const days = estimateMemoryStability({
      status: "CONSISTENT",
      assistanceLevel: "NONE",
      polarity: "DIFFICULTY",
    });
    expect(days).toBe(1);
  });

  it("calcula mayor estabilidad cuando la evidencia es consistente y sin asistencia", () => {
    const days = estimateMemoryStability({
      status: "CONSISTENT",
      assistanceLevel: "NONE",
      polarity: "STRENGTH",
    });
    // 7 días base * 1.5 = 11 días
    expect(days).toBe(11);
  });

  it("reduce estabilidad cuando la asistencia fue media o alta", () => {
    const medium = estimateMemoryStability({
      status: "CONSISTENT",
      assistanceLevel: "MEDIUM",
      polarity: "STRENGTH",
    });
    const high = estimateMemoryStability({
      status: "CONSISTENT",
      assistanceLevel: "HIGH",
      polarity: "STRENGTH",
    });
    expect(medium).toBeLessThan(11);
    expect(high).toBe(1);
  });
});

describe("evaluateConceptMastery", () => {
  const baseRecord: ConceptPracticeRecord = {
    curriculumItemId: "c1",
    title: "Segmentación de clientes",
    lastPracticedAt: new Date("2026-10-01T12:00:00Z"),
    status: "CONSISTENT",
    assistanceLevel: "NONE",
    polarity: "STRENGTH",
    dimension: "APPLICATION",
  };

  it("identifica estado FRESH si se practicó hace pocos días", () => {
    // 2 días después (estabilidad es 11 días)
    const ref = new Date("2026-10-03T12:00:00Z");
    const result = evaluateConceptMastery(baseRecord, ref);
    expect(result.retentionState).toBe("FRESH");
    expect(result.daysSinceLastPractice).toBe(2);
    expect(result.recommendedStrategy).toBe("ACTIVE_RECALL");
  });

  it("identifica estado DUE_FOR_RECALL cuando se alcanza la ventana de estabilidad", () => {
    // 12 días después (supera los 11 días)
    const ref = new Date("2026-10-13T12:00:00Z");
    const result = evaluateConceptMastery(baseRecord, ref);
    expect(result.retentionState).toBe("DUE_FOR_RECALL");
    expect(result.suggestedActionTitle).toContain("Recuperación activa");
  });

  it("identifica estado AT_RISK cuando transcurrió más del doble de la estabilidad", () => {
    // 25 días después (supera 11 * 2)
    const ref = new Date("2026-10-26T12:00:00Z");
    const result = evaluateConceptMastery(baseRecord, ref);
    expect(result.retentionState).toBe("AT_RISK");
  });

  it("prioriza hipercorrección inmediata ante dificultad", () => {
    const diffRecord: ConceptPracticeRecord = {
      ...baseRecord,
      polarity: "DIFFICULTY",
      lastPracticedAt: new Date("2026-10-10T12:00:00Z"),
    };
    const ref = new Date("2026-10-11T12:00:00Z");
    const result = evaluateConceptMastery(diffRecord, ref);
    expect(result.recommendedStrategy).toBe("HYPERCORRECTION");
    expect(result.suggestedActionTitle).toContain("Revisión rápida");
  });

  it("recomienda práctica intercalada cuando hay un concepto complementario", () => {
    // Concepto que ya requiere recall (12 días después)
    const ref = new Date("2026-10-13T12:00:00Z");
    const result = evaluateConceptMastery(baseRecord, ref, "Propuesta de Valor");
    expect(result.recommendedStrategy).toBe("INTERLEAVED_PRACTICE");
    expect(result.suggestedActionTitle).toContain("Práctica intercalada");
    expect(result.suggestedActionDescription).toContain("Propuesta de Valor");
  });

  it("recomienda desafío de transferencia con Primeros Principios para dimensión TRANSFER", () => {
    const transferRecord: ConceptPracticeRecord = {
      ...baseRecord,
      dimension: "TRANSFER",
    };
    const ref = new Date("2026-10-02T12:00:00Z");
    const result = evaluateConceptMastery(transferRecord, ref);
    expect(result.recommendedStrategy).toBe("TRANSFER_CHALLENGE");
    expect(result.recommendedMentalModel?.key).toBe(MENTAL_MODELS.FIRST_PRINCIPLES.key);
    expect(result.suggestedActionTitle).toContain("Desafío de transferencia");
  });
});
