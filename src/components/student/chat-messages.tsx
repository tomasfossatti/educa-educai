import { cn } from "@/lib/cn";
import { TEXT } from "@/lib/texts";
import type { MessageCitations } from "@/server/services/folder-chat";

export type ChatMessage = { id: string; role: "STUDENT" | "TUTOR"; content: string; citations: unknown };

/** Mensajes con sus fuentes; cada fuente muestra el texto citado (seleccionable para preguntar sobre él). */
export function ChatMessages({ messages, chunks }: { messages: ChatMessage[]; chunks: Map<string, string> }) {
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
