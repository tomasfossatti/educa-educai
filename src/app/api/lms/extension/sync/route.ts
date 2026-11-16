import { AccessDenied, assertExtensionKey } from "@/server/auth/guards";
import { LmsError } from "@/server/lms";
import { ExtensionError, syncExtensionCookies } from "@/server/services/lms-extension";

/** La extensión manda la cookie de sesión de Canvas. Autenticada con su clave (Bearer). */
export async function POST(request: Request) {
  let auth: Awaited<ReturnType<typeof assertExtensionKey>>;
  try {
    auth = await assertExtensionKey(request.headers.get("authorization"));
  } catch (error) {
    if (error instanceof AccessDenied) return Response.json({ error: "La extensión ya no está vinculada. Pedí un código nuevo en Educai.", unlinked: true }, { status: 401 });
    throw error;
  }
  const body = (await request.json().catch(() => ({}))) as { cookies?: unknown };
  try {
    const { accountName } = await syncExtensionCookies(auth.viewer, auth.link, body.cookies);
    return Response.json({ ok: true, accountName, canvasUrl: auth.link.baseUrl }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ExtensionError || error instanceof LmsError) return Response.json({ error: error.message }, { status: 422 });
    throw error;
  }
}
