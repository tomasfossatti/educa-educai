import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TextLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { cn } from "@/lib/cn";
import { TEXT } from "@/lib/texts";
import { requireStudent } from "@/server/auth/guards";
import { db } from "@/server/db";
import type { MessageCitations } from "@/server/services/folder-chat";
import { AskForm } from "./ask-form";

export const metadata: Metadata = { title: "Conversación" };

export default async function FolderConversationPage({ params }: { params: Promise<{ folderId: string; conversationId: string }> }) {
  const { folderId, conversationId } = await params;
  const { user } = await requireStudent();
  // Solo el dueño: la consulta filtra por estudiante y carpeta (V8).
  const conversation = await db.aIConversation.findFirst({
    where: { id: conversationId, folderId, studentId: user.id },
    include: { folder: { select: { name: true } }, messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) notFound();
  const t = TEXT.chat;

  return (
    <div className="shell space-y-6">
      <PageHeader title={conversation.title} description={conversation.folder?.name} />
      <TextLink href={`/s/folders/${folderId}`}>{t.backToFolder}</TextLink>
      {conversation.messages.length === 0 ? (
        <EmptyState title={t.empty} />
      ) : (
        <ol className="space-y-4">
          {conversation.messages.map((m) => {
            const citations = m.citations as unknown as MessageCitations | null;
            const isStudent = m.role === "STUDENT";
            return (
              <li key={m.id} className={cn("rounded-xl border p-4", isStudent ? "border-line bg-surface-2" : "border-line bg-surface")}>
                <p className="mb-1 text-xs font-medium text-muted">{isStudent ? t.you : t.tutor}</p>
                <p className="whitespace-pre-wrap text-sm text-ink">{m.content}</p>
                {!isStudent && citations?.items.length ? (
                  <div className="mt-3 border-t border-line pt-2 text-xs text-muted">
                    <span className="font-medium">{t.sources}: </span>
                    {citations.items.map((c) => (
                      <span key={c.n} className="mr-3">
                        [{c.n}] {c.fileName}, {t.page(c.page)}
                      </span>
                    ))}
                  </div>
                ) : null}
                {!isStudent && citations?.noSource && <p className="mt-3 text-xs text-attention">{t.noSource}</p>}
              </li>
            );
          })}
        </ol>
      )}
      {conversation.origin === "CHAT" && <AskForm conversationId={conversation.id} />}
    </div>
  );
}
