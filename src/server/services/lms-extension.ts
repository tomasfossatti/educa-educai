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
): Promise<{ accountName: string }> {
  if (typeof cookies !== "string" || !/(?:^|;\s*)canvas_session=/.test(cookies) || cookies.length > 16_000) {
    throw new ExtensionError("Falta la sesión de Canvas: entrá a Canvas e iniciá sesión.");
  }
  const client = makeClient({ provider: "CANVAS", baseUrl: link.baseUrl, credential: cookies, authKind: "cookie" });
  let me: { name: string };
  try {
    me = await client.whoAmI();
  } catch (error) {
    if (error instanceof LmsError && error.kind === "auth") throw new ExtensionError("Canvas cerró la sesión: entrá a Canvas e iniciá sesión de nuevo.");
    throw error;
  }
  const now = new Date();
  const data = { provider: "CANVAS" as const, baseUrl: link.baseUrl, credential: encryptSecret(cookies), authKind: "cookie", accountName: me.name.slice(0, 160), lastUsedAt: now };
  await db.$transaction([
    db.lmsConnection.upsert({ where: { userId: viewer.id }, create: { userId: viewer.id, ...data }, update: data }),
    db.lmsExtensionLink.update({ where: { id: link.id }, data: { lastSyncAt: now } }),
  ]);
  return { accountName: me.name };
}

/** Para la pantalla: si hay una extensión vinculada y cuándo sincronizó por última vez. */
export async function getExtensionStatus(viewer: Viewer) {
  if (viewer.role !== "TEACHER" && viewer.role !== "STUDENT") throw new AccessDenied();
  const link = await db.lmsExtensionLink.findUnique({ where: { userId: viewer.id }, select: { keyHash: true, linkedAt: true, lastSyncAt: true } });
  return { linked: Boolean(link?.keyHash), linkedAt: link?.linkedAt ?? null, lastSyncAt: link?.lastSyncAt ?? null };
}
