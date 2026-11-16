import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { encodeExtensionCode } from "@/domain/lms";
import { AccessDenied, type Viewer } from "@/server/auth/guards";
import { db } from "@/server/db";
import { createLmsClient, LmsError, normalizeBaseUrl } from "@/server/lms";
import { encryptSecret } from "@/server/lms/crypto";

/**
 * Extensión de navegador para los Canvas que no dejan crear tokens (Siglo 21):
 * 1. En el asistente, el usuario logueado pide un código (vale 10 minutos y una sola vez).
 * 2. Lo pega en la extensión, que lo cambia por una clave propia (redeemExtensionCode).
 * 3. Con esa clave, la extensión manda la cookie de sesión de Canvas cada vez que cambia
 *    (syncExtensionCookies). Se guarda cifrada, igual que un token.
 * Del código y de la clave solo se guarda el SHA-256. Desconectar el LMS borra el vínculo.
 */

export const CODE_TTL_MS = 10 * 60 * 1000;

export class ExtensionError extends Error {}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export async function createExtensionCode(viewer: Viewer, input: { baseUrl: string; serverOrigin: string }): Promise<{ code: string; expiresAt: Date }> {
  if (viewer.role !== "TEACHER" && viewer.role !== "STUDENT") throw new AccessDenied();
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const secret = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  // Un vínculo por usuario: un código nuevo reemplaza al anterior y desvincula la extensión vieja.
  const data = { baseUrl, codeHash: sha256(secret), codeExpiresAt: expiresAt, keyHash: null, linkedAt: null };
  await db.lmsExtensionLink.upsert({ where: { userId: viewer.id }, create: { userId: viewer.id, ...data }, update: data });
  return { code: encodeExtensionCode({ server: input.serverOrigin, canvas: baseUrl, secret }), expiresAt };
}

/** Cambia el código por la clave de la extensión. El código no se puede usar dos veces. */
export async function redeemExtensionCode(secret: string, now = new Date()): Promise<{ key: string; canvasUrl: string }> {
  if (typeof secret !== "string" || secret.length < 20) throw new ExtensionError("El código no es válido.");
  const link = await db.lmsExtensionLink.findUnique({ where: { codeHash: sha256(secret) } });
  if (!link || !link.codeExpiresAt) throw new ExtensionError("El código no es válido o ya se usó. Pedí uno nuevo en Educai.");
  if (link.codeExpiresAt < now) throw new ExtensionError("El código venció. Pedí uno nuevo en Educai.");
  const key = randomBytes(32).toString("base64url");
  // updateMany con el hash en el filtro: si dos pedidos llegan a la vez, solo uno lo canjea.
  const claimed = await db.lmsExtensionLink.updateMany({
    where: { id: link.id, codeHash: link.codeHash },
    data: { codeHash: null, codeExpiresAt: null, keyHash: sha256(key), linkedAt: now },
  });
  if (claimed.count !== 1) throw new ExtensionError("El código ya se usó. Pedí uno nuevo en Educai.");
  return { key, canvasUrl: link.baseUrl };
}

type CanvasFactory = typeof createLmsClient;

/**
 * Guarda la cookie de Canvas que manda la extensión, después de verificar con Canvas que la sesión
 * sirve. Si la sesión se cerró, avisa sin borrar la conexión anterior.
 */
export async function syncExtensionCookies(
  viewer: Viewer,
  link: { id: string; baseUrl: string },
  cookies: unknown,
  makeClient: CanvasFactory = createLmsClient,
  userAgent?: unknown,
): Promise<{ accountName: string }> {
  const agent = typeof userAgent === "string" && userAgent.trim() ? userAgent.trim().slice(0, 400) : null;
  try {
    if (typeof cookies !== "string" || !/(?:^|;\s*)canvas_session=/.test(cookies) || cookies.length > 16_000) {
      throw new ExtensionError("La extensión no encontró la sesión de Canvas: entrá a Canvas e iniciá sesión.");
    }
    const client = makeClient({ provider: "CANVAS", baseUrl: link.baseUrl, credential: cookies, authKind: "cookie", userAgent: agent });
    let me: { name: string };
    try {
      me = await client.whoAmI();
    } catch (error) {
      if (error instanceof LmsError && error.status === 401) throw new ExtensionError("Canvas no aceptó la sesión (401): entrá a Canvas, iniciá sesión de nuevo y tocá «Sincronizar ahora» en la extensión.");
      throw error;
    }
    const now = new Date();
    const data = { provider: "CANVAS" as const, baseUrl: link.baseUrl, credential: encryptSecret(cookies), authKind: "cookie", userAgent: agent, accountName: me.name.slice(0, 160), lastUsedAt: now };
    await db.$transaction([
      db.lmsConnection.upsert({ where: { userId: viewer.id }, create: { userId: viewer.id, ...data }, update: data }),
      db.lmsExtensionLink.update({ where: { id: link.id }, data: { lastSyncAt: now, lastError: null, lastErrorAt: null } }),
    ]);
    return { accountName: me.name };
  } catch (error) {
    // Se guarda el motivo para mostrarlo en el asistente. Nunca la cookie.
    const message = error instanceof ExtensionError || error instanceof LmsError ? error.message : "Educai no pudo usar la sesión de Canvas.";
    console.warn(JSON.stringify({ event: "lms.extension.sync_failed", userId: viewer.id, kind: error instanceof LmsError ? error.kind : "other", status: error instanceof LmsError ? (error.status ?? null) : null }));
    await db.lmsExtensionLink.update({ where: { id: link.id }, data: { lastError: message.slice(0, 500), lastErrorAt: new Date() } }).catch(() => undefined);
    throw error;
  }
}

/**
 * En qué paso está la extensión, para la pantalla:
 * none: no hay vínculo; code: hay un código sin usar; linked: la extensión canjeó el código pero
 * todavía no mandó la sesión; error: mandó la sesión y falló (con el motivo); synced: funcionando.
 */
export type ExtensionStage = "none" | "code" | "linked" | "error" | "synced";

export async function getExtensionStatus(viewer: Viewer) {
  if (viewer.role !== "TEACHER" && viewer.role !== "STUDENT") throw new AccessDenied();
  const link = await db.lmsExtensionLink.findUnique({
    where: { userId: viewer.id },
    select: { keyHash: true, codeHash: true, codeExpiresAt: true, linkedAt: true, lastSyncAt: true, lastError: true, lastErrorAt: true },
  });
  let stage: ExtensionStage = "none";
  if (link?.keyHash) {
    const errorIsLatest = link.lastErrorAt && (!link.lastSyncAt || link.lastErrorAt > link.lastSyncAt);
    stage = errorIsLatest ? "error" : link.lastSyncAt ? "synced" : "linked";
  } else if (link?.codeHash && link.codeExpiresAt && link.codeExpiresAt > new Date()) {
    stage = "code";
  }
  return { stage, linked: Boolean(link?.keyHash), linkedAt: link?.linkedAt ?? null, lastSyncAt: link?.lastSyncAt ?? null, error: stage === "error" ? link?.lastError ?? null : null };
}
