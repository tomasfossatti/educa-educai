"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Card } from "@/components/ui/layout";
import { cn } from "@/lib/cn";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

interface FloatingTutorProps {
  courseId: string;
  courseName: string;
  topicTitle?: string;
  conceptTitle?: string;
  conceptDescription?: string;
  initialConversationId?: string;
  initialMessageCount?: number;
}

export function FloatingTutor({
  courseId,
  courseName,
  topicTitle,
  conceptTitle,
  conceptDescription,
  initialConversationId,
  initialMessageCount = 0,
}: FloatingTutorProps) {
  const activeTopic = topicTitle ?? conceptTitle ?? "hipótesis falsables";
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hola. Estoy acá para acompañarte a pensar cómo aplicar "${activeTopic}" a tu caso real. ¿Qué situación de tu trabajo querés analizar hoy?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    function handleOpenEvent(e: Event) {
      const customEvent = e as CustomEvent<{
        courseId?: string;
        courseName?: string;
        conceptTitle?: string;
        conceptDescription?: string;
        initialQuestion?: string;
      }>;
      setIsOpen(true);
      if (customEvent.detail?.initialQuestion) {
        sendQuestion(customEvent.detail.initialQuestion);
      }
    }

    function handleCloseEvent() {
      setIsOpen(false);
    }

    window.addEventListener("educai:open-floating-tutor", handleOpenEvent);
    window.addEventListener("close-tutor", handleCloseEvent);
    return () => {
      window.removeEventListener("educai:open-floating-tutor", handleOpenEvent);
      window.removeEventListener("close-tutor", handleCloseEvent);
    };
  }, []);

  const sendQuestion = async (userText: string) => {
    if (!userText.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: userText.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          messages: [...messages, userMessage],
          conceptTitle,
          conceptDescription,
        }),
      });

      if (!response.ok) {
        throw new Error("Error en la respuesta del tutor");
      }

      if (!response.body) {
        throw new Error("Sin contenido");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        assistantText += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantText };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "¿Qué métrica observable elegirías para poner a prueba esa idea esta semana?",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendQuestion(input);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <Button
          variant="primary"
          size="icon-round"
          onClick={() => setIsOpen(true)}
          className="size-12"
          aria-label="Abrir tutor de la materia"
        >
          <MessageSquare className="size-5 text-white" />
        </Button>
      ) : (
        <Card padding="none" className="flex flex-col w-80 sm:w-96 h-96 max-h-full overflow-hidden animate-in fade-in duration-150">
          {/* Header de la ventana */}
          <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-ink leading-tight">
                Tutor de la materia
              </h3>
              <p className="text-xs text-muted">
                {courseName} · Método socrático
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsOpen(false);
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("close-tutor"));
                }
              }}
              aria-label="Cerrar ventana"
            >
              <X className="size-4 text-muted" />
            </Button>
          </div>

          {/* Área de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs sm:text-sm">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-xs sm:max-w-sm rounded-lg p-3 text-xs sm:text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-white"
                      : "bg-surface-2 text-ink-2"
                  )}
                >
                  <p className="prose-plain">{m.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-1.5 text-xs text-muted pl-2 py-1">
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                <span className="ml-1 text-xs">Pensando pregunta guía…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulario de Entrada */}
          <form onSubmit={handleSend} className="border-t border-line bg-surface-2/60 p-3">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribí tu consulta o idea…"
                className="flex-1 text-xs"
              />
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={!input.trim() || isLoading}
              >
                <Send className="size-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted text-center pt-1.5">
              El tutor formula preguntas para ayudarte a deducir el concepto.
            </p>
          </form>
        </Card>
      )}
    </div>
  );
}
