import { describe, expect, it } from "vitest";
import { budgetState, nextWeekStart, readUsd, weekKey, weekStart } from "@/domain/ai-budget";

describe("semana del tope de IA (hora argentina)", () => {
  it("empieza el lunes a las 00:00 de Argentina (03:00 UTC)", () => {
    // Miércoles 18 de noviembre de 2026, 15:00 UTC.
    expect(weekStart(new Date("2026-11-18T15:00:00Z")).toISOString()).toBe("2026-11-16T03:00:00.000Z");
    expect(weekKey(new Date("2026-11-18T15:00:00Z"))).toBe("2026-11-16");
  });

  it("el domingo a la noche en Argentina sigue siendo la semana anterior", () => {
    // Lunes 02:30 UTC = domingo 23:30 en Argentina.
    expect(weekStart(new Date("2026-11-16T02:30:00Z")).toISOString()).toBe("2026-11-09T03:00:00.000Z");
    // Lunes 03:00 UTC = lunes 00:00 en Argentina: semana nueva.
    expect(weekStart(new Date("2026-11-16T03:00:00Z")).toISOString()).toBe("2026-11-16T03:00:00.000Z");
  });

  it("se renueva siete días después", () => {
    expect(nextWeekStart(new Date("2026-11-18T15:00:00Z")).toISOString()).toBe("2026-11-23T03:00:00.000Z");
  });
});

describe("estado del tope", () => {
  it("avisa desde el umbral y corta al llegar al tope", () => {
    expect(budgetState(0.5, 2, 0.8)).toBe("ok");
    expect(budgetState(1.6, 2, 0.8)).toBe("warning");
    expect(budgetState(2, 2, 0.8)).toBe("exceeded");
    expect(budgetState(3, 2, 0.8)).toBe("exceeded");
  });

  it("un tope de 0 lo desactiva", () => {
    expect(budgetState(100, 0, 0.8)).toBe("ok");
  });

  it("lee montos de variables de entorno con punto o coma y cae al valor por defecto si no sirven", () => {
    expect(readUsd("1.5", 2)).toBe(1.5);
    expect(readUsd("1,5", 2)).toBe(1.5);
    expect(readUsd("", 2)).toBe(2);
    expect(readUsd(undefined, 2)).toBe(2);
    expect(readUsd("abc", 2)).toBe(2);
    expect(readUsd("-1", 2)).toBe(2);
  });
});
