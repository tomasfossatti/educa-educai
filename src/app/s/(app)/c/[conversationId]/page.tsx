import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TextLink } from "@/components/ui/button";
import { AutoRefresh, ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { EmptyState, PageHeader, Quote } from "@/components/ui/layout";
import { cn } from "@/lib/cn";
import { ChatMessages } from "@/components/student/chat-messages";
import { TEXT } from "@/lib/texts";
import { requireStudent } from "@/server/auth/guards";
import { deleteFolderConversationAction } from "@/server/actions/folders";
import { DoubtCards } from "@/components/student/doubt-cards";
import { closeConversationAction } from "@/server/actions/student";
import { listConversationDoubts } from "@/server/services/doubts";
import { getOwnFolderConversation } from "@/server/services/folder-chat";
import { AskForm } from "@/components/student/ask-form";
import { SelectionAsk } from "@/components/student/selection-ask";
import { BudgetNotice } from "@/components/student/budget-notice";

export const metadata: Metadata = { title: "Charla" };

/** Una charla del estudiante: el único chat, con citas del material y preguntas sobre un pedazo de texto. */
export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ hilo?: string }>;
}) {
  const { conversationId } = await params;
  const { hilo } = await searchParams;
  const { user } = await requireStudent();
  const viewer = { id: user.id, role: user.role };
  // Solo el dueño: el servicio filtra por estudiante (V8) y no expone conversaciones ajenas.
  const found = await getOwnFolderConversation(viewer, conversationId, hilo);
  if (!found) notFound();
  const { conversation, openThread, chunks, lastRun } = found;
  const t = TEXT.student.ask;
  const doubts = await listConversationDoubts(viewer, conversation.id);
  const analyzing = lastRun?.status === "QUEUED" || lastRun?.status === "RUNNING";
  const base = `/s/c/${conversation.id}`;
  const active = conversation.origin === "CHAT" && conversation.status === "ACTIVE";

  return (
    <div className="shell space-y-6">
      <PageHeader title={conversation.title} description={conversation.folder.name} />
      {active && <BudgetNotice studentId={user.id} />}
      {conversation.messages.length === 0 ? (
        <EmptyState title={t.empty} />
      ) : (
        <div className={cn("grid gap-6", openThread && "lg:grid-cols-[1fr_22rem]")}>
          <SelectionAsk conversationId={conversation.id}>
            <ChatMessages messages={conversation.messages} chunks={chunks} />
          </SelectionAsk>
          {openThread && (
            <aside className="space-y-3 rounded-xl border border-primary/30 p-4" aria-label={t.threadTitle}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">{t.threadTitle}</h2>
                <TextLink href={base}>{t.closeThread}</TextLink>
              </div>
              <Quote>{openThread.anchor}</Quote>
              <ChatMessages messages={openThread.messages} chunks={chunks} />
              {conversation.status === "ACTIVE" && <AskForm conversationId={conversation.id} threadId={openThread.id} />}
            </aside>
          )}
        </div>
      )}
      {conversation.threads.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted">{t.threads(conversation.threads.length)}</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {conversation.threads.map((th) => (
              <li key={th.id}>
                <TextLink href={`${base}?hilo=${th.id}`}>«{th.anchor.slice(0, 80)}»</TextLink>
              </li>
            ))}
          </ul>
        </details>
      )}
      {active && <AskForm conversationId={conversation.id} />}
      {!active && conversation.origin === "CHAT" && <p className="text-sm text-muted">{t.closed}</p>}
      {active && conversation.courseId && conversation.messages.length > 0 && (
        <form action={closeConversationAction.bind(null, conversation.id)}>
          <SubmitButton variant="secondary" pendingText={t.finishing}>
            {t.finish}
          </SubmitButton>
        </form>
      )}
      <AutoRefresh active={analyzing} />
      {analyzing && <p className="text-sm text-muted" role="status">{TEXT.student.doubtCard.analyzing}</p>}
      <DoubtCards doubts={doubts.filter((d) => d.studentStatus === "PENDING")} />

      <form action={deleteFolderConversationAction.bind(null, conversation.id)}>
        <ConfirmSubmit variant="ghost" size="sm" message={TEXT.student.myData.conversationsHint} className="min-h-11">
          {TEXT.student.myData.deleteConversation}
        </ConfirmSubmit>
      </form>
    </div>
  );
}
