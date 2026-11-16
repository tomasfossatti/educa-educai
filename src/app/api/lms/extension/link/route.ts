import { redeemExtensionCode, ExtensionError } from "@/server/services/lms-extension";

/**
 * La extensión cambia el código de un solo uso (que Educai le mostró al usuario logueado) por su
 * clave. Sin sesión: el código es la credencial.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { secret?: unknown };
  try {
    const { key, canvasUrl } = await redeemExtensionCode(String(body.secret ?? ""));
    return Response.json({ key, canvasUrl }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ExtensionError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
