import { describe, expect, it } from "vitest";
import { computeItem, computeSnapshot, computeTransitions, type SnapshotSignal } from "@/domain/snapshot";

let n = 0;
function signal(partial: Partial<SnapshotSignal> & Pick<SnapshotSignal, "experienceId" | "polarity">, day: number): SnapshotSignal {
  n += 1;
  return {
    id: `s${n}`,
    evidenceId: `e${n}`,
    occurredAt: new Date(2026, 9, day),
    source: "CHALLENGE_SUBMISSION",
    assistanceLevel: "NONE",
    dimension: "APPLICATION",
    curriculumItemId: "c4",
    curriculumItemTitle: "Hipótesis falsables",
    ...partial,
  };
}

describe("computeItem", () => {
  it("una sola experiencia → evidencia parcial, sin tendencia", () => {
    const item = computeItem([signal({ experienceId: "x", polarity: "STRENGTH" }, 1)]);
    expect(item.status).toBe("PARTIAL");
    expect(item.trend).toBe("UNKNOWN");
    expect(item.direction).toBe("STRENGTH");
  });

  it("misma dirección en dos experiencias → consistente", () => {
    const item = computeItem([signal({ experienceId: "x", polarity: "DIFFICULTY" }, 1), signal({ experienceId: "y", polarity: "DIFFICULTY" }, 5)]);
    expect(item.status).toBe("CONSISTENT");
    expect(item.direction).toBe("DIFFICULTY");
  });

  it("dificultad → fortaleza es mejora, no contradicción", () => {
    const item = computeItem([signal({ experienceId: "x", polarity: "DIFFICULTY" }, 1), signal({ experienceId: "y", polarity: "STRENGTH" }, 9)]);
    expect(item.trend).toBe("IMPROVING");
    expect(item.status).toBe("PARTIAL");
    expect(item.direction).toBe("STRENGTH");
  });

  it("dificultad → mixta es mejora parcial", () => {
    const item = computeItem([signal({ experienceId: "x", polarity: "DIFFICULTY" }, 1), signal({ experienceId: "y", polarity: "MIXED" }, 9)]);
    expect(item.trend).toBe("IMPROVING");
    expect(item.direction).toBe("MIXED");
    expect(item.status).toBe("PARTIAL");
  });

  it("fortaleza → dificultad son señales contradictorias", () => {
    const item = computeItem([signal({ experienceId: "x", polarity: "STRENGTH" }, 1), signal({ experienceId: "y", polarity: "DIFFICULTY" }, 3)]);
    expect(item.status).toBe("CONTRADICTORY");
    expect(item.trend).toBe("DECLINING");
  });

  it("ida y vuelta → contradictoria sin tendencia", () => {
    const item = computeItem([
      signal({ experienceId: "x", polarity: "STRENGTH" }, 1),
      signal({ experienceId: "y", polarity: "DIFFICULTY" }, 2),
      signal({ experienceId: "z", polarity: "STRENGTH" }, 3),
    ]);
    expect(item.status).toBe("CONTRADICTORY");
    expect(item.trend).toBe("UNKNOWN");
  });
});

describe("computeSnapshot", () => {
  it("sin evidencia: todas las dimensiones son insuficientes", () => {
    const snapshot = computeSnapshot([], []);
    expect(snapshot.dimensions).toHaveLength(6);
    expect(snapshot.dimensions.every((d) => d.status === "INSUFFICIENT")).toBe(true);
  });

  it("cada dimensión conserva las señales y evidencias que la sostienen", () => {
    const signals = [
      signal({ experienceId: "x", polarity: "DIFFICULTY" }, 1),
      signal({ experienceId: "y", polarity: "STRENGTH" }, 9),
      signal({ experienceId: "x", polarity: "STRENGTH", dimension: "COMPREHENSION" }, 1),
    ];
    const evidence = signals.map((s) => ({ id: s.evidenceId, experienceId: s.experienceId, occurredAt: s.occurredAt, assistanceLevel: s.assistanceLevel }));
    const snapshot = computeSnapshot(signals, evidence);
    const application = snapshot.dimensions.find((d) => d.dimension === "APPLICATION")!;
    expect(application.signalIds).toHaveLength(2);
    expect(application.evidenceIds).toHaveLength(2);
    const evolution = snapshot.dimensions.find((d) => d.dimension === "EVOLUTION")!;
    expect(evolution.status).toBe("PARTIAL");
    expect(evolution.summary).toMatch(/mejora/i);
    expect(snapshot.dimensions.find((d) => d.dimension === "TRANSFER")!.status).toBe("INSUFFICIENT");
    expect(computeTransitions(signals)).toHaveLength(1);
    // Una mejora no cuenta como patrón consistente.
    expect(snapshot.dimensions.find((d) => d.dimension === "CONSISTENCY")!.status).toBe("PARTIAL");
  });

  it("consistencia: la misma dirección repetida en dos experiencias", () => {
    const signals = [signal({ experienceId: "a", polarity: "STRENGTH" }, 1), signal({ experienceId: "b", polarity: "STRENGTH" }, 6)];
    const evidence = signals.map((s) => ({ id: s.evidenceId, experienceId: s.experienceId, occurredAt: s.occurredAt, assistanceLevel: s.assistanceLevel }));
    const consistency = computeSnapshot(signals, evidence).dimensions.find((d) => d.dimension === "CONSISTENCY")!;
    expect(consistency.status).toBe("CONSISTENT");
    expect(consistency.evidenceIds).toHaveLength(2);
  });

  it("autonomía: menos asistencia en la última experiencia es una mejora", () => {
    const evidence = [
      { id: "1", experienceId: "a", occurredAt: new Date(2026, 9, 1), assistanceLevel: "HIGH" as const },
      { id: "2", experienceId: "b", occurredAt: new Date(2026, 9, 5), assistanceLevel: "HIGH" as const },
      { id: "3", experienceId: "c", occurredAt: new Date(2026, 9, 9), assistanceLevel: "LOW" as const },
    ];
    const autonomy = computeSnapshot([], evidence).dimensions.find((d) => d.dimension === "AUTONOMY")!;
    expect(autonomy.details.assistanceTrend).toBe("IMPROVING");
    expect(autonomy.status).toBe("PARTIAL");
    // Un salto menor a un nivel (ninguna → baja) no se informa como cambio.
    const minor = computeSnapshot([], [
      { id: "1", experienceId: "a", occurredAt: new Date(2026, 9, 1), assistanceLevel: "NONE" as const },
      { id: "2", experienceId: "b", occurredAt: new Date(2026, 9, 5), assistanceLevel: "LOW" as const },
    ]).dimensions.find((d) => d.dimension === "AUTONOMY")!;
    expect(minor.details.assistanceTrend).toBe("STABLE");
  });
});
