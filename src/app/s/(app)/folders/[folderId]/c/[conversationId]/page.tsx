import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TextLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AutoRefresh, ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { EmptyState, List, ListItem, Notice, PageHeader, Quote, Section } from "@/components/ui/layout";
import { cn } from "@/lib/cn";
import { TEXT } from "@/lib/texts";
import { requireStudent } from "@/server/auth/guards";
import { db } from "@/server/db";
import { deleteFolderConversationAction, respondToDoubtAction } from "@/server/actions/folders";
import { closeConversationAction } from "@/server/actions/student";
import { listConversationDoubts } from "@/server/services/doubts";
import type { MessageCitations } from "@/server/services/folder-chat";
import { AskForm } from "./ask-form";
import { SelectionAsk } from "./selection-ask";

export const metadata: Metadata = { title: "Conversación" };

type Msg = { id: string; role: "STUDENT" | "TUTOR"; content: string; citations: unknown };

/** Mensajes con sus fuentes; cada fuente muestra el fragmento citado (seleccionable para un hilo). */
function Messages({ messages, chunks }: { messages: Msg[]; chunks: Map<string, string> }) {
  const t = TEXT.chat;
  return (
    <ol className="space-y-4">
      {messages.map((m) => {
        const citations = m.citations as MessageCitations | null;
        const isStudent = m.role === "STUDENT";
        return (
          <li key={m.id} className={cn("rounded-xl border p-4", isStudent ? "border-line bg-surface-2" : "border-line bg-surface")}>
            <p className="mb-1 text-xs font-medium text-muted">{isStudent ? t.you : t.tutor}</p>
            <p className="whitespace-pre-wrap text-sm text-ink">{m.content}</p>
            {!isStudent && citations?.items.length ? (
              <div className="mt-3 space-y-1 border-t border-line pt-2 text-xs text-muted">
                <span className="font-medium">{t.sources}:</span>
                {citations.items.map((c) => (
                  <details key={c.n}>
                    <summary className="cursor-pointer">
                      [{c.n}] {c.fileName}, {t.page(c.page)} · {TEXT.thread.showSource}
                    </summary>
                    <p className="mt-1 whitespace-pre-wrap text-ink-2">{chunks.get(c.chunkId) ?? "—"}</p>
                  </details>
                ))}
              </div>
            ) : null}
            {!isStudent && citations?.noSource && <p className="mt-3 text-xs text-attention">{t.noSource}</p>}
          </li>
        );
      })}
    </ol>
  );
}

export default async function FolderConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ folderId: string; conversationId: string }>;
  searchParams: Promise<{ hilo?: string }>;
}) {
  const { folderId, conversationId } = await params;
  const { hilo } = await searchParams;
  const { user } = await requireStudent();
  // Solo el dueño: la consulta filtra por estudiante y carpeta (V8).
  const conversation = await db.aIConversation.findFirst({
    where: { id: conversationId, folderId, studentId: user.id },
    include: {
      folder: { select: { name: true } },
      messages: { where: { threadId: null }, orderBy: { createdAt: "asc" } },
      threads: { orderBy: { createdAt: "asc" }, include: { messages: { orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!conversation) notFound();
  const openThread = hilo ? conversation.threads.find((th) => th.id === hilo) ?? null : null;
  const chunkIds = [...conversation.messages, ...(openThread?.messages ?? [])].flatMap(
    (m) => (m.citations as MessageCitations | null)?.items.map((c) => c.chunkId) ?? [],
  );
  const chunks = new Map(
    (await db.materialChunk.findMany({ where: { id: { in: chunkIds }, courseId: conversation.courseId ?? "" }, select: { id: true, text: true } })).map((c) => [c.id, c.text]),
  );
  const t = TEXT.chat;
  const d = TEXT.doubts;
  const doubts = await listConversationDoubts({ id: user.id, role: user.role }, conversation.id);
  const lastRun = await db.interpretationRun.findFirst({ where: { experienceId: conversation.experienceId }, orderBy: { createdAt: "desc" }, select: { status: true, statusNote: true, error: true } });
  const analyzing = lastRun?.status === "QUEUED" || lastRun?.status === "RUNNING";

  return (
    <div className="shell space-y-6">
      <PageHeader title={conversation.title} description={conversation.folder?.name} />
      <TextLink href={`/s/folders/${folderId}`}>{t.backToFolder}</TextLink>
      {conversation.messages.length === 0 ? (
        <EmptyState title={t.empty} />
      ) : (
        <div className={cn("grid gap-6", openThread && "lg:grid-cols-[1fr_22rem]")}>
          <div className="space-y-3">
            <p className="text-xs text-muted">{TEXT.thread.hint}</p>
            <SelectionAsk conversationId={conversation.id} folderId={folderId}>
              <Messages messages={conversation.messages} chunks={chunks} />
            </SelectionAsk>
          </div>
          {openThread && (
            <aside className="space-y-3 rounded-xl border border-primary/30 p-4" aria-label={TEXT.thread.title}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">{TEXT.thread.title}</h2>
                <TextLink href={`/s/folders/${folderId}/c/${conversation.id}`}>{TEXT.thread.close}</TextLink>
              </div>
              <Quote>{openThread.anchor}</Quote>
              <Messages messages={openThread.messages} chunks={chunks} />
              {conversation.status === "ACTIVE" && <AskForm conversationId={conversation.id} threadId={openThread.id} placeholder={TEXT.thread.placeholder} />}
            </aside>
          )}
        </div>
      )}
      {conversation.threads.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted">
            {TEXT.thread.list} ({conversation.threads.length})
          </summary>
          <ul className="mt-2 space-y-1 text-sm">
            {conversation.threads.map((th) => (
              <li key={th.id}>
                <TextLink href={`/s/folders/${folderId}/c/${conversation.id}?hilo=${th.id}`}>«{th.anchor.slice(0, 80)}»</TextLink>
              </li>
            ))}
          </ul>
        </details>
      )}
      {conversation.origin === "CHAT" && conversation.status === "ACTIVE" && <AskForm conversationId={conversation.id} />}
      {conversation.origin === "CHAT" && conversation.status === "ACTIVE" && conversation.courseId && conversation.messages.length > 0 && (
        <form action={closeConversationAction.bind(null, conversation.id)}>
          <SubmitButton variant="secondary" size="sm" pendingText={d.finishing}>
            {d.finish}
          </SubmitButton>
        </form>
      )}
      <AutoRefresh active={analyzing} />
      {analyzing && <p className="text-sm text-muted">{d.analyzing}</p>}
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
