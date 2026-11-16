import { notFound, redirect } from "next/navigation";
import { assertFolderOwner, requireStudent } from "@/server/auth/guards";

/**
 * Dirección vieja de una carpeta: la carpeta es una materia del selector. Si es propia, se elige como
 * la actual y se abre su chat; si no, "no encontramos esta página" (V8).
 */
export default async function OldFolderPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { user } = await requireStudent();
  const { folderId } = await params;
  const folder = await assertFolderOwner({ id: user.id, role: user.role }, folderId).catch(() => null);
  if (!folder) notFound();
  redirect(`/s/materia/${folder.id}`);
}
