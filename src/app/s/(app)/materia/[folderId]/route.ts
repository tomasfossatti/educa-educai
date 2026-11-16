import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CURRENT_COURSE_COOKIE, CURRENT_FOLDER_COOKIE } from "@/lib/constants";
import { assertFolderOwner, requireStudent } from "@/server/auth/guards";

/**
 * Elige una materia propia como la actual y abre su chat. La usan las direcciones viejas de una
 * materia o de una carpeta: solo cambia la preferencia de navegación (cookie), nunca datos.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ folderId: string }> }) {
  const { user } = await requireStudent();
  const { folderId } = await params;
  const folder = await assertFolderOwner({ id: user.id, role: user.role }, folderId).catch(() => null);
  if (!folder) notFound();
  const jar = await cookies();
  const options = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 180 };
  jar.set(CURRENT_FOLDER_COOKIE, folder.id, options);
  if (folder.courseId) jar.set(CURRENT_COURSE_COOKIE, folder.courseId, options);
  redirect("/s");
}
