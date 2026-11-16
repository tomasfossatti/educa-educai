/** Semáforo de Mi avance: umbrales fijos y sus bordes (PR 8 de la simplificación). */
import { describe, expect, it } from "vitest";
import { TRAFFIC_LIGHT, trafficLight } from "@/domain/traffic-light";
import { computeMastery } from "@/domain/topic-mastery";

describe("semáforo de Mi avance", () => {
  it("los umbrales son los documentados", () => {
    expect(TRAFFIC_LIGHT).toEqual({ greenMinScore: 0.8, yellowMinAttempts: 1 });
  });

  it("sin registro o sin prácticas, gris", () => {
    expect(trafficLight(null)).toBe("GRAY");
    expect(trafficLight(undefined)).toBe("GRAY");
    expect(trafficLight({ score: 0, attempts: 0 })).toBe("GRAY");
    expect(trafficLight({ score: 0.9, attempts: 0 })).toBe("GRAY");
  });

  it("con una práctica, amarillo aunque acierte todo (el tope es 0,5)", () => {
    const score = computeMastery([1]);
    expect(score).toBe(0.5);
    expect(trafficLight({ score, attempts: 1 })).toBe("YELLOW");
    expect(trafficLight({ score: 0, attempts: 1 })).toBe("YELLOW");
  });

  it("el borde del verde: 0,79 es amarillo y 0,8 es verde", () => {
    expect(trafficLight({ score: 0.79, attempts: 3 })).toBe("YELLOW");
    expect(trafficLight({ score: 0.8, attempts: 3 })).toBe("GREEN");
    expect(trafficLight({ score: 1, attempts: 5 })).toBe("GREEN");
  });

  it("dos prácticas perfectas llegan justo al verde (tope 0,8)", () => {
    const score = computeMastery([1, 1]);
    expect(trafficLight({ score, attempts: 2 })).toBe("GREEN");
  });

  it("dos prácticas, una floja, quedan en amarillo", () => {
    const score = computeMastery([0.33, 1]);
    expect(trafficLight({ score, attempts: 2 })).toBe("YELLOW");
  });
});
