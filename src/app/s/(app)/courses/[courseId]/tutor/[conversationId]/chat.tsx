"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/layout";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";

interface ChatMessage {
  id: string;
  role: "STUDENT" | "TUTOR";
  content: string;
}

const ERROR_MARK = "\u0000";

export function Chat({ conversationId, initialMessages, active }: { conversationId: string; initialMessages: ChatMessage[]; active: boolean }) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const content = input.trim();
    if (!content || streaming) return;
    setError(null);
    setStreaming(true);
    setInput("");
    const studentId = `local-s-${Date.now()}`;
    const tutorId = `local-t-${Date.now()}`;
    setMessages((m) => [...m, { id: studentId, role: "STUDENT", content }, { id: tutorId, role: "TUTOR", content: "" }]);

    const dropPending = (restoreInput: boolean) => {
      setMessages((m) => m.filter((msg) => msg.id !== tutorId && (!restoreInput || msg.id !== studentId)));
      if (restoreInput) setInput(content);
    };

    try {
      const response = await fetch(`/api/tutor/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        dropPending(true);
        setError(data?.error ?? "No se pudo enviar el mensaje.");
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        const [visible, failure] = text.split(ERROR_MARK);
        setMessages((m) => m.map((msg) => (msg.id === tutorId ? { ...msg, content: visible } : msg)));
        if (failure !== undefined) {
          setError(failure || "El tutor no pudo responder.");
          if (!visible) dropPending(false);
          break;
        }
      }
      // Sincroniza el estado del servidor (p. ej. habilitar "Terminar sesión").
      router.refresh();
    } catch {
      dropPending(true);
      setError("Se perdió la conexión. Revisá tu red e intentá de nuevo.");
    } finally {
      setStreaming(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-muted">
            Contale al tutor qué estás intentando entender o resolver. Por ejemplo: “No me queda clara la diferencia entre un problema y una
            solución”.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "STUDENT" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "prose-plain max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed",
                m.role === "STUDENT"
                  ? "bg-[#27251e] text-[#faf8f5] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                  : "border border-[#d1d1cd] bg-[#fdfbfa] text-[#27251e] shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
              )}
            >
              {m.role === "TUTOR" && <span className="mb-1 block text-xs font-medium text-[#72706b]">Tutor</span>}
              {m.content || <span className="text-[#92918b]">Pensando…</span>}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {active && (
        <form onSubmit={send} className="space-y-2 border-t border-[#d1d1cd] pt-4">
          <label htmlFor="message" className="sr-only">
            Tu mensaje
          </label>
          <Textarea
            id="message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={4000}
            placeholder="Escribí tu mensaje. Enter para enviar, Shift+Enter para salto de línea."
            className="min-h-24"
            disabled={streaming}
          />
          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={streaming || !input.trim()}>
              {streaming ? "El tutor está respondiendo…" : "Enviar"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
