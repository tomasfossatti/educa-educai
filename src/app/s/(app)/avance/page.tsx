import { redirect } from "next/navigation";
import { requireStudent } from "@/server/auth/guards";
import { getPanelState } from "@/server/services/student-panel";

/** Provisorio hasta el PR 8: el avance por tema está en la página de la materia actual. */
export default async function ProgressPage() {
  const { user } = await requireStudent();
  const { current } = await getPanelState({ id: user.id, role: user.role });
  redirect(current ? `/s/folders/${current.folderId}` : "/s");
}
