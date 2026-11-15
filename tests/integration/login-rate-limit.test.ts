/** Límite de intentos de login contra una base real. Requiere TEST_DATABASE_URL. */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("límite de intentos de login (integración)", () => {
  let db: typeof import("@/server/db").db;
  let rl: typeof import("@/server/auth/rate-limit");
  const email = `rl-${randomBytes(6).toString("hex")}@test.educai`;
  const ip = `192.0.2.${Math.floor(Math.random() * 200) + 1}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    ({ db } = await import("@/server/db"));
    rl = await import("@/server/auth/rate-limit");
    await db.loginAttempt.deleteMany({ where: { OR: [{ email }, { ip }] } });
  });

  afterAll(async () => {
    await db.loginAttempt.deleteMany({ where: { OR: [{ email }, { ip }] } });
  });

  it("bloquea el email después de 5 fallos y lo libera con un login correcto", async () => {
    for (let i = 0; i < rl.MAX_FAILURES_PER_EMAIL - 1; i++) await rl.recordLoginFailure(email, ip);
    expect(await rl.loginRetryAfterMinutes(email, ip)).toBe(0);

    await rl.recordLoginFailure(email, ip);
    const wait = await rl.loginRetryAfterMinutes(email, ip);
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(15);

    await rl.clearLoginFailures(email);
    expect(await rl.loginRetryAfterMinutes(email, null)).toBe(0);
  });

  it("bloquea la IP que prueba muchos emails", async () => {
    for (let i = 0; i < rl.MAX_FAILURES_PER_IP; i++) await rl.recordLoginFailure(`${i}-${email}`, ip);
    expect(await rl.loginRetryAfterMinutes(`otro-${email}`, ip)).toBeGreaterThan(0);
    await db.loginAttempt.deleteMany({ where: { ip } });
  });
});
