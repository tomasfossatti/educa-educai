import { describe, expect, it } from "vitest";
import { planFactsUpdate, summaryIsStale } from "@/domain/folder-context";

const active = [
  { id: "f1", ref: "F1", content: "Le cuesta formular hipótesis medibles", editedByStudent: false },
  { id: "f2", ref: "F2", content: "Trabaja en gastronomía", editedByStudent: true },
];

describe("planFactsUpdate", () => {
  it("archiva solo hechos existentes que el estudiante no editó", () => {
    const plan = planFactsUpdate(active, { add: [], archive: [{ ref: "F1", reason: "ya lo entiende" }, { ref: "F2", reason: "x" }, { ref: "F9", reason: "x" }] });
    expect(plan.archiveIds).toEqual(["f1"]);
  });
  it("no agrega repetidos ni vacíos, y resuelve las cátedras por ref", () => {
    const plan = planFactsUpdate(
      active,
      { add: [{ content: "  trabaja en  GASTRONOMÍA " }, { content: " " }, { content: "Quiere validar con preventas", courseRefs: ["C1", "C7"] }], archive: [] },
      { C1: "course-1" },
    );
    expect(plan.create).toEqual([{ content: "Quiere validar con preventas", courseIds: ["course-1"] }]);
  });
  it("un hecho archivado puede reemplazarse por uno con el mismo texto corregido", () => {
    const plan = planFactsUpdate(active, { add: [{ content: "Le cuesta formular hipótesis medibles" }], archive: [{ ref: "F1", reason: "se reformula" }] });
    expect(plan.archiveIds).toEqual(["f1"]);
    expect(plan.create).toHaveLength(1);
  });
});

describe("summaryIsStale", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
  it("sin hechos no hay resumen que generar; sin resumen y con hechos, sí", () => {
    expect(summaryIsStale(null, null, now)).toBe(false);
    expect(summaryIsStale(null, hoursAgo(1), now)).toBe(true);
  });
  it("una vez por día y solo con hechos nuevos", () => {
    expect(summaryIsStale({ updatedAt: hoursAgo(25), editedByStudent: false }, hoursAgo(2), now)).toBe(true);
    expect(summaryIsStale({ updatedAt: hoursAgo(5), editedByStudent: false }, hoursAgo(2), now)).toBe(false);
    expect(summaryIsStale({ updatedAt: hoursAgo(25), editedByStudent: false }, hoursAgo(30), now)).toBe(false);
  });
  it("no pisa un resumen editado por el estudiante", () => {
    expect(summaryIsStale({ updatedAt: hoursAgo(100), editedByStudent: true }, hoursAgo(1), now)).toBe(false);
  });
});
