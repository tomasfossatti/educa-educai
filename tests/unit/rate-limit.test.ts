import { describe, expect, it } from "vitest";
import { clientIp, lockedUntil, MAX_FAILURES_PER_EMAIL, WINDOW_MS } from "@/server/auth/rate-limit";

const now = new Date("2026-11-15T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe("lockedUntil", () => {
  it("no bloquea por debajo del cupo", () => {
    const failures = [1, 2, 3, 4].map(minutesAgo);
    expect(lockedUntil(failures, MAX_FAILURES_PER_EMAIL, now)).toBeNull();
  });

  it("bloquea al llegar al cupo y libera cuando el fallo que lo completó sale de la ventana", () => {
    const failures = [10, 8, 6, 4, 2].map(minutesAgo);
    const until = lockedUntil(failures, MAX_FAILURES_PER_EMAIL, now);
    expect(until?.getTime()).toBe(minutesAgo(10).getTime() + WINDOW_MS);
  });

  it("ignora los fallos fuera de la ventana", () => {
    const failures = [40, 30, 20, 3, 2].map(minutesAgo);
    expect(lockedUntil(failures, MAX_FAILURES_PER_EMAIL, now)).toBeNull();
  });
});

describe("clientIp", () => {
  it("toma el primer valor de X-Forwarded-For", () => {
    expect(clientIp("203.0.113.7, 10.0.0.1", null)).toBe("203.0.113.7");
  });
  it("cae en X-Real-IP y después en null", () => {
    expect(clientIp(null, "198.51.100.2")).toBe("198.51.100.2");
    expect(clientIp(null, null)).toBeNull();
  });
});
