import { redirect } from "next/navigation";
import { requireStudent } from "@/server/auth/guards";

/** Dirección vieja del tutor de la materia: sus charlas pasaron al único chat, en /s/c/[id]. */
export default async function OldTutorConversationPage({ params }: { params: Promise<{ courseId: string; conversationId: string }> }) {
  await requireStudent();
  const { conversationId } = await params;
  redirect(`/s/c/${encodeURIComponent(conversationId)}`);
}
