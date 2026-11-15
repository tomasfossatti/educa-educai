/** Estado del servicio: base alcanzable y migración aplicada, sin datos de nadie. Requiere TEST_DATABASE_URL. */
import { beforeAll, describe, expect, it } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("estado del servicio (integración)", () => {
  let GET: typeof import("@/app/api/health/route").GET;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    ({ GET } = await import("@/app/api/health/route"));
  });

  it("responde ok con la última migración aplicada y sin caché", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(String(body.migration)).toMatch(/^\d{14}_/);
    expect(Object.keys(body).sort()).toEqual(["migration", "ok", "version"]);
  });
});
