import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TextLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AutoRefresh, ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { EmptyState, List, ListItem, Notice, PageHeader, Quote, Section } from "@/components/ui/layout";
import { cn } from "@/lib/cn";
import { TEXT } from "@/lib/texts";
import { requireStudent } from "@/server/auth/guards";
import { deleteFolderConversationAction, respondToDoubtAction } from "@/server/actions/folders";
import { closeConversationAction } from "@/server/actions/student";
import { listConversationDoubts } from "@/server/services/doubts";
import { getOwnFolderConversation, type MessageCitations } from "@/server/services/folder-chat";
import { AskForm } from "./ask-form";
import { SelectionAsk } from "./selection-ask";
import { BudgetNotice } from "@/components/student/budget-notice";

export const metadata: Metadata = { title: "Charla" };

type Msg = { id: string; role: "STUDENT" | "TUTOR"; content: string; citations: unknown };

/** Mensajes con sus fuentes; cada fuente muestra el texto citado (seleccionable para preguntar sobre él). */
function Messages({ messages, chunks }: { messages: Msg[]; chunks: Map<string, string> }) {
  const t = TEXT.student.ask;
  return (
    <ol className="space-y-4">
      {messages.map((m) => {
        const citations = m.citations as MessageCitations | null;
        const isStudent = m.role === "STUDENT";
        return (
          <li key={m.id} className={cn("rounded-xl border p-4", isStudent ? "border-line bg-surface-2" : "border-line bg-surface")}>
            <p className="mb-1 text-xs font-medium text-muted">{isStudent ? t.you : t.ai}</p>
            <p className="whitespace-pre-wrap text-base text-ink">{m.content}</p>
            {!isStudent && citations?.items.length ? (
              <div className="mt-3 space-y-1 border-t border-line pt-2 text-sm text-muted">
                <span className="font-medium">{t.sources}</span>
                {citations.items.map((c) => (
                  <details key={c.n}>
                    <summary className="cursor-pointer py-1">
                      [{c.n}] {t.source(c.fileName, c.page)} · {t.seeText}
                    </summary>
                    <p className="mt-1 whitespace-pre-wrap text-ink-2">{chunks.get(c.chunkId) ?? "—"}</p>
                  </details>
                ))}
              </div>
            ) : null}
            {!isStudent && citations?.noSource && <p className="mt-3 text-sm text-attention">{t.noSource}</p>}
          </li>
        );
      })}
    </ol>
  );
}

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
  const d = TEXT.doubts;
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
            <Messages messages={conversation.messages} chunks={chunks} />
          </SelectionAsk>
          {openThread && (
            <aside className="space-y-3 rounded-xl border border-primary/30 p-4" aria-label={t.threadTitle}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">{t.threadTitle}</h2>
                <TextLink href={base}>{t.closeThread}</TextLink>
              </div>
              <Quote>{openThread.anchor}</Quote>
              <Messages messages={openThread.messages} chunks={chunks} />
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
      {analyzing && <p className="text-sm text-muted">{TEXT.student.doubtCard.analyzing}</p>}
      {lastRun && !analyzing && (lastRun.statusNote || lastRun.error) && <Notice>{lastRun.statusNote ?? lastRun.error}</Notice>}

      {conversation.courseId && (
        <Section title={d.title} description={d.description}>
          {doubts.length === 0 ? (
            <p className="text-sm text-muted">{d.none}</p>
          ) : (
            <List>
              {doubts.map((s) => (
                <ListItem key={s.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{s.curriculumItem ? d.topic(s.curriculumItem.title) : s.description}</span>
                    <Badge tone={s.studentStatus === "CONFIRMED" ? "attention" : "muted"}>{d.status[s.studentStatus]}</Badge>
                  </div>
                  <Quote>{s.evidence.content}</Quote>
                  {s.studentStatus === "PENDING" && (
                    <div className="flex gap-2">
                      <form action={respondToDoubtAction.bind(null, s.id, "CONFIRMED")}>
                        <SubmitButton size="sm" variant="secondary">{d.confirm}</SubmitButton>
                      </form>
                      <form action={respondToDoubtAction.bind(null, s.id, "DISCARDED")}>
                        <SubmitButton size="sm" variant="ghost">{d.discard}</SubmitButton>
                      </form>
                    </div>
                  )}
                </ListItem>
              ))}
            </List>
          )}
        </Section>
      )}

      <form action={deleteFolderConversationAction.bind(null, conversation.id)}>
        <ConfirmSubmit variant="ghost" size="sm" message={d.deleteConfirm}>
          {d.deleteConversation}
        </ConfirmSubmit>
      </form>
    </div>
  );
}
