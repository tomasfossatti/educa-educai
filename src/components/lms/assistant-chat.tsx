"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { TEXT } from "@/lib/texts";
import { lmsAssistantAction, lmsImportStatusAction } from "@/server/actions/lms";

interface ChatEntry {
  id: number;
  role: "user" | "assistant";
  content: string;
  href?: string;
  importId?: string;
}

const POLL_MS = 2000;

/**
 * Chat del asistente del LMS. Muestra el avance de la importación en el mismo mensaje que la anunció
 * y, al terminar, un enlace a la materia. El historial vive solo en esta pantalla.
 */
export function LmsAssistantChat({ welcome }: { welcome: string }) {
  const [entries, setEntries] = useState<ChatEntry[]>([{ id: 0, role: "assistant", content: welcome }]);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [tracking, setTracking] = useState<{ importId: string; entryId: number } | null>(null);
  const nextId = useRef(1);
  const bottom = useRef<HTMLDivElement>(null);
  const t = TEXT.lms.chat;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [entries]);

  useEffect(() => {
    if (!tracking) return;
    let cancelled = false;
    const tick = async () => {
      const status = await lmsImportStatusAction(tracking.importId);
      if (cancelled || !status) return;
      const line =
        status.status === "RUNNING"
          ? t.progress(status.done + status.failed, status.total)
          : status.status === "DONE"
            ? status.total === 0
              ? `${t.upToDate(status.name)}${status.note ? ` ${status.note}` : ""}`
              : `${t.done(status.name, status.done, status.modules, status.failed)}${status.note ? ` ${status.note}` : ""}`
            : t.failed(status.name, status.error ?? "");
      setEntries((list) => list.map((e) => (e.id === tracking.entryId ? { ...e, content: `${e.content.split("\n")[0]}\n${line}`, href: status.href } : e)));
      if (status.status !== "RUNNING") setTracking(null);
      else timer = setTimeout(tick, POLL_MS);
    };
    let timer = setTimeout(tick, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tracking, t]);

  function send(event?: FormEvent) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || pending) return;
    const history = entries.filter((e) => e.id !== 0).map(({ role, content }) => ({ role, content }));
    const userEntry: ChatEntry = { id: nextId.current++, role: "user", content: message };
    setEntries((list) => [...list, userEntry]);
    setDraft("");
    startTransition(async () => {
      const turn = await lmsAssistantAction(message, history);
      const entry: ChatEntry = { id: nextId.current++, role: "assistant", content: turn.reply, href: turn.importId ? undefined : turn.href, importId: turn.importId };
      setEntries((list) => [...list, entry]);
      if (turn.importId) setTracking({ importId: turn.importId, entryId: entry.id });
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4" data-testid="lms-chat">
      <div className="max-h-[28rem] space-y-3 overflow-y-auto" aria-live="polite">
        {entries.map((entry) => (
          <div key={entry.id} className={cn("flex", entry.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm",
                entry.role === "user" ? "bg-primary text-white" : "bg-surface-2 text-ink",
              )}
              data-role={entry.role}
            >
              {entry.content}
              {entry.href && (tracking?.entryId !== entry.id) && (
                <div className="mt-2">
                  <Link href={entry.href} className={buttonClass("secondary", "sm")}>
                    {t.open}
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}
        {pending && <p className="text-xs text-muted">{t.sending}</p>}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="flex items-end gap-2">
        <Textarea
          aria-label={t.placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) send(e as unknown as FormEvent);
          }}
          placeholder={t.placeholder}
          maxLength={1000}
          className="min-h-11 flex-1 py-2"
          rows={1}
        />
        <Button type="submit" disabled={pending || !draft.trim()}>
          {t.send}
        </Button>
      </form>
    </div>
  );
}
