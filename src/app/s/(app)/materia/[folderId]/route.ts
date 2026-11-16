import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CURRENT_COURSE_COOKIE, CURRENT_FOLDER_COOKIE } from "@/lib/constants";
import { assertFolderOwner, requireStudent } from "@/server/auth/guards";

/**
 * Elige una materia propia como la actual y abre su chat. La usan las direcciones viejas de una
 * materia o de una carpeta: solo cambia la preferencia de navegación (cookie), nunca datos.
 */
/** Pantallas del panel a las que se puede volver después de elegir la materia. */
const NEXT = new Set(["/s", "/s/practicar", "/s/avance", "/s/mis-datos"]);

export async function GET(request: Request, { params }: { params: Promise<{ folderId: string }> }) {
  const { user } = await requireStudent();
  const { folderId } = await params;
  const folder = await assertFolderOwner({ id: user.id, role: user.role }, folderId).catch(() => null);
  if (!folder) notFound();
  const jar = await cookies();
  const options = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 180 };
  jar.set(CURRENT_FOLDER_COOKIE, folder.id, options);
  if (folder.courseId) jar.set(CURRENT_COURSE_COOKIE, folder.courseId, options);
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/s";
  const section = url.searchParams.get("seccion");
  redirect(NEXT.has(next) ? `${next}${section && /^[a-z-]+$/.test(section) ? `#${section}` : ""}` : "/s");
}
