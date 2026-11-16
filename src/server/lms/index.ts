import "server-only";
import { CanvasClient } from "./canvas";
import { decryptSecret } from "./crypto";
import { MoodleClient } from "./moodle";
import type { LmsClient, LmsProviderName } from "./types";

export { LmsError, normalizeBaseUrl } from "./net";
export type { LmsClient, LmsCourse, LmsModule, LmsItem, LmsProviderName } from "./types";

export function createLmsClient(params: { provider: LmsProviderName; baseUrl: string; credential: string; authKind?: string }): LmsClient {
  if (params.provider === "MOODLE") return new MoodleClient(params.baseUrl, params.credential);
  return new CanvasClient(params.baseUrl, params.credential, params.authKind === "cookie" ? "cookie" : "token");
}

/** Cliente a partir de la conexión guardada (credencial cifrada). */
export function clientForConnection(connection: { provider: LmsProviderName; baseUrl: string; credential: string; authKind: string }): LmsClient {
  return createLmsClient({ ...connection, credential: decryptSecret(connection.credential) });
}
