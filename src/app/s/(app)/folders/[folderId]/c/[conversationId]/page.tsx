import { redirect } from "next/navigation";
import { requireStudent } from "@/server/auth/guards";

/** Dirección vieja del chat de una carpeta: hay un solo chat, en /s/c/[id]. Conserva el hilo abierto. */
export default async function OldFolderConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ folderId: string; conversationId: string }>;
  searchParams: Promise<{ hilo?: string }>;
}) {
  await requireStudent();
  const { conversationId } = await params;
  const { hilo } = await searchParams;
  redirect(`/s/c/${encodeURIComponent(conversationId)}${hilo ? `?hilo=${encodeURIComponent(hilo)}` : ""}`);
}
