import { redirect } from "next/navigation";
import { requireStudent } from "@/server/auth/guards";
import { getPanelState } from "@/server/services/student-panel";

/** Provisorio hasta el PR 7: los temas para practicar están en la página de la materia actual. */
export default async function PracticePage() {
  const { user } = await requireStudent();
  const { current } = await getPanelState({ id: user.id, role: user.role });
  redirect(current ? `/s/folders/${current.folderId}` : "/s");
}
