/**
 * Extensión del navegador para Canvas sin tokens: código de un solo uso, canje por la clave y envío
 * de la cookie de sesión. Contra el Canvas de mentira (datos sintéticos). Requiere TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decodeExtensionCode } from "@/domain/lms";
import { factories } from "../support/factories";
import { FAKE_TOKENS, startFakeLms } from "../support/fake-lms";

const TEST_DB = process.env.TEST_DATABASE_URL;
const SERVER = "http://localhost:3200";

describe.skipIf(!TEST_DB)("extensión de Canvas (integración)", () => {
  let db: typeof import("@/server/db").db;
  let ext: typeof import("@/server/services/lms-extension");
  let lms: typeof import("@/server/services/lms");
  let guards: typeof import("@/server/auth/guards");
  let crypto: typeof import("@/server/lms/crypto");
  let linkRoute: typeof import("@/app/api/lms/extension/link/route");
  let syncRoute: typeof import("@/app/api/lms/extension/sync/route");
  let f: ReturnType<typeof factories>;
  let fake: Awaited<ReturnType<typeof startFakeLms>>;
  const cookie = `canvas_session=${FAKE_TOKENS.student}; _csrf_token=abc; log_session_id=x`;

  const post = (body: unknown, key?: string) =>
    new Request("http://localhost/api", { method: "POST", headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify(body) });

  /** Lo que hace la extensión: pide el código como el usuario, lo canjea y manda la cookie. */
  async function linkStudent() {
    const s = await f.student();
    const { code } = await ext.createExtensionCode({ id: s.id, role: "STUDENT" }, { baseUrl: fake.url, serverOrigin: SERVER });
    const secret = decodeExtensionCode(code)!.secret;
    const res = await linkRoute.POST(post({ secret }));
    expect(res.status).toBe(200);
    const { key, canvasUrl } = (await res.json()) as { key: string; canvasUrl: string };
    return { s, code, secret, key, canvasUrl };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.AI_PROVIDER = "scripted";
    process.env.LMS_ALLOW_INSECURE_URLS = "true";
    ({ db } = await import("@/server/db"));
    ext = await import("@/server/services/lms-extension");
    lms = await import("@/server/services/lms");
    guards = await import("@/server/auth/guards");
    crypto = await import("@/server/lms/crypto");
    linkRoute = await import("@/app/api/lms/extension/link/route");
    syncRoute = await import("@/app/api/lms/extension/sync/route");
    f = factories(db);
    fake = await startFakeLms();
  });

  afterAll(async () => {
    await fake?.close();
    delete process.env.LMS_ALLOW_INSECURE_URLS;
  });

  it("el código lleva el Educai y el Canvas, y solo se guarda su hash", async () => {
    const s = await f.student();
    const { code } = await ext.createExtensionCode({ id: s.id, role: "STUDENT" }, { baseUrl: `${fake.url}/`, serverOrigin: SERVER });
    const decoded = decodeExtensionCode(code)!;
    expect(decoded).toMatchObject({ server: SERVER, canvas: fake.url });
    const row = await db.lmsExtensionLink.findUniqueOrThrow({ where: { userId: s.id } });
    expect(JSON.stringify(row)).not.toContain(decoded.secret);
  });

  it("canjea el código una sola vez y la extensión conecta Canvas con la cookie", async () => {
    const { s, secret, key, canvasUrl } = await linkStudent();
    expect(canvasUrl).toBe(fake.url);
    expect((await linkRoute.POST(post({ secret }))).status).toBe(400);

    const res = await syncRoute.POST(post({ cookies: cookie }, key));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, accountName: "Estudiante Sintético" });
    const connection = await db.lmsConnection.findUniqueOrThrow({ where: { userId: s.id } });
    expect(connection).toMatchObject({ provider: "CANVAS", authKind: "cookie", baseUrl: fake.url });
    expect(crypto.decryptSecret(connection.credential)).toBe(cookie);
    expect(await lms.getLmsConnection({ id: s.id, role: "STUDENT" })).toMatchObject({ viaExtension: true });
    const row = await db.lmsExtensionLink.findUniqueOrThrow({ where: { userId: s.id } });
    expect(JSON.stringify(row)).not.toContain(key);
  });

  it("un código vencido no sirve", async () => {
    const s = await f.student();
    const { code } = await ext.createExtensionCode({ id: s.id, role: "STUDENT" }, { baseUrl: fake.url, serverOrigin: SERVER });
    const later = new Date(Date.now() + ext.CODE_TTL_MS + 1000);
    await expect(ext.redeemExtensionCode(decodeExtensionCode(code)!.secret, later)).rejects.toThrow(/venció/);
  });

  it("sin clave, con una clave inventada o sin sesión de Canvas, no guarda nada", async () => {
    expect((await syncRoute.POST(post({ cookies: cookie }))).status).toBe(401);
    expect((await syncRoute.POST(post({ cookies: cookie }, "clave-inventada-de-mas-de-20-caracteres"))).status).toBe(401);
    const { s, key } = await linkStudent();
    const noSession = await syncRoute.POST(post({ cookies: "otra_cookie=1" }, key));
    expect(noSession.status).toBe(422);
    const expired = await syncRoute.POST(post({ cookies: "canvas_session=vencida" }, key));
    expect(expired.status).toBe(422);
    expect(((await expired.json()) as { error: string }).error).toMatch(/Canvas no aceptó la sesión \(401\)/);
    expect(await db.lmsConnection.count({ where: { userId: s.id } })).toBe(0);
  });

  it("un código nuevo o desconectar el LMS dejan sin efecto la clave anterior", async () => {
    const { s, key } = await linkStudent();
    await ext.createExtensionCode({ id: s.id, role: "STUDENT" }, { baseUrl: fake.url, serverOrigin: SERVER });
    expect((await syncRoute.POST(post({ cookies: cookie }, key))).status).toBe(401);

    const second = await linkStudent();
    expect((await syncRoute.POST(post({ cookies: cookie }, second.key))).status).toBe(200);
    await lms.disconnectLms({ id: second.s.id, role: "STUDENT" });
    const res = await syncRoute.POST(post({ cookies: cookie }, second.key));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ unlinked: true });
    expect(await db.lmsConnection.count({ where: { userId: second.s.id } })).toBe(0);
  });

  it("la clave de una persona solo cambia su propia conexión", async () => {
    const a = await linkStudent();
    const b = await linkStudent();
    await syncRoute.POST(post({ cookies: cookie }, a.key));
    expect(await db.lmsConnection.count({ where: { userId: b.s.id } })).toBe(0);
    const { viewer } = await guards.assertExtensionKey(`Bearer ${a.key}`);
    expect(viewer.id).toBe(a.s.id);
  });

  it("cuando la sesión falla, guarda el motivo y el asistente lo muestra en vez de esperar", async () => {
    const { s, key } = await linkStudent();
    const viewer = { id: s.id, role: "STUDENT" as const };
    expect((await ext.getExtensionStatus(viewer)).stage).toBe("linked");
    await syncRoute.POST(post({ cookies: "canvas_session=vencida" }, key));
    const status = await ext.getExtensionStatus(viewer);
    expect(status.stage).toBe("error");
    expect(status.error).toMatch(/Canvas no aceptó la sesión \(401\)/);
    const assistant = await import("@/server/services/lms-assistant");
    const turn = await assistant.lmsAssistantTurn(viewer, "crea la materia costos de proyectos");
    expect(turn.reply).toMatch(/la extensión se vinculó pero falló.*401/);

    // Cuando la sesión llega bien, el error se borra.
    await syncRoute.POST(post({ cookies: cookie }, key));
    expect(await ext.getExtensionStatus(viewer)).toMatchObject({ stage: "synced", error: null });
  });

  it("consulta Canvas con el mismo navegador del que salió la sesión", async () => {
    const { s, key } = await linkStudent();
    const agents: (string | null | undefined)[] = [];
    const lmsIndex = await import("@/server/lms");
    const spy = (params: Parameters<typeof lmsIndex.createLmsClient>[0]) => {
      agents.push(params.userAgent);
      return lmsIndex.createLmsClient(params);
    };
    const auth = await guards.assertExtensionKey(`Bearer ${key}`);
    await ext.syncExtensionCookies(auth.viewer, auth.link, cookie, spy, "Mozilla/5.0 (Navegador sintético)");
    expect(agents).toEqual(["Mozilla/5.0 (Navegador sintético)"]);
    const connection = await db.lmsConnection.findUniqueOrThrow({ where: { userId: s.id } });
    expect(connection.userAgent).toBe("Mozilla/5.0 (Navegador sintético)");
  });

  it("si se pega el link de mcp-siglo en vez de la cookie, lo explica", async () => {
    const s = await f.student();
    await expect(
      lms.connectLms({ id: s.id, role: "STUDENT" }, { provider: "CANVAS", baseUrl: fake.url, authKind: "cookie", token: "https://mcp-siglo.vercel.app/mcp/d5f3351444b9139add0ac4d3bd8ab0e3beeebffcbc7b018c" }),
    ).rejects.toThrow(/Eso es un link/);
  });

  it("solo docentes y estudiantes piden códigos", async () => {
    const a = await f.admin();
    await expect(ext.createExtensionCode({ id: a.id, role: "ADMIN" }, { baseUrl: fake.url, serverOrigin: SERVER })).rejects.toBeInstanceOf(guards.AccessDenied);
  });
});
