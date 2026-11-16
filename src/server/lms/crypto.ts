import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifrado de las credenciales del LMS (AES-256-GCM). La clave sale de LMS_ENCRYPTION_KEY (32 bytes
 * en base64). En producción es obligatoria; en local y en los tests, si falta, se usa una clave fija
 * de desarrollo que nunca protege datos reales.
 */
const DEV_KEY = createHash("sha256").update("educai-lms-solo-desarrollo").digest();

function key(): Buffer {
  const raw = process.env.LMS_ENCRYPTION_KEY?.trim();
  if (raw) {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length !== 32) throw new Error("LMS_ENCRYPTION_KEY tiene que ser de 32 bytes en base64.");
    return decoded;
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_LMS_KEY !== "true") {
    throw new Error("Falta LMS_ENCRYPTION_KEY: sin ella no se pueden guardar conexiones con el LMS.");
  }
  return DEV_KEY;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function decryptSecret(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Credencial cifrada con un formato desconocido.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
