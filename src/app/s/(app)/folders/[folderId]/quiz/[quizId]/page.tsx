import { redirect } from "next/navigation";
import { requireStudent } from "@/server/auth/guards";

/** Dirección vieja de un quiz: Practicar vive en /s/practicar. */
export default async function OldQuizPage({ params }: { params: Promise<{ folderId: string; quizId: string }> }) {
  await requireStudent();
  const { quizId } = await params;
  redirect(`/s/practicar/${encodeURIComponent(quizId)}`);
}
