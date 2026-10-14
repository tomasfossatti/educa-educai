"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface FloatingTutorProps {
  courseId: string;
  courseName: string;
  topicTitle?: string;
  initialConversationId?: string | null;
}

export function FloatingTutor({
  courseId,
  courseName,
  topicTitle = "Hipótesis de negocio falsables",
  initialConversationId,
}: FloatingTutorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `¡Hola! Soy tu tutor socrático para la clase de hoy en **${courseName}**.\n\nNo te voy a dar respuestas directas para copiar, sino que te voy a guiar con preguntas para que construyas tu propio razonamiento sobre **${topicTitle}**.\n\n¿Qué parte del tema o qué duda te gustaría pensar juntos?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      if (conversationId) {
        // Enviar al endpoint real en streaming
        const res = await fetch(`/api/tutor/${conversationId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed }),
        });

        if (res.ok && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let assistantText = "";
          setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            assistantText += chunk;
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: "assistant", content: assistantText };
              return next;
            });
          }
          setIsLoading(false);
          return;
        }
      }

      // Si no hay id activo o fallo temporal, respuesta socrática de fallback contextual
      await new Promise((r) => setTimeout(r, 900));
      let response = "";
      if (trimmed.toLowerCase().includes("hipotesis") || trimmed.toLowerCase().includes("hipótesis")) {
        response = `Interesante punto. Para que esa hipótesis sea verdaderamente **falsable**, ¿cuál es la métrica exacta que vas a medir y qué número concreto demostraría que tu supuesto era incorrecto?`;
      } else if (trimmed.toLowerCase().includes("segmento") || trimmed.toLowerCase().includes("cliente")) {
        response = `Bien. ¿Ese segmento lo estás definiendo solo por datos demográficos (edad, lugar) o por una **necesidad concreta** o comportamiento que tienen en común?`;
      } else {
        response = `¿Qué evidencia concreta te llevó a pensar eso y cómo podríamos diseñar un experimento simple y barato para comprobarlo antes de invertir?`;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "¿Qué supuesto clave tendrías que comprobar primero para ver si tu idea se sostiene?" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        /* Botón Flotante Cerrado */
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-2.5 rounded-full bg-gradient-to-r from-primary to-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(120,150,238,0.5)] active:scale-95 border border-white/20"
          aria-label="Abrir tutor socrático"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-80"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
          </span>
          <span className="text-base">✨</span>
          <span>Tutor Socrático</span>
        </button>
      ) : (
        /* Ventana Flotante Abierta */
        <div className="flex flex-col w-[380px] sm:w-[420px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[82vh] rounded-3xl border border-primary/30 bg-surface-1/95 shadow-2xl backdrop-blur-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header de la ventana */}
          <div className="flex items-center justify-between border-b border-line bg-surface-2/80 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-sm">
                ✨
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink leading-tight">
                  Tutor Socrático
                </h3>
                <p className="text-[11px] text-muted">
                  {courseName} · Método dialéctico
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-surface-3 transition-colors text-xs font-bold"
              aria-label="Cerrar ventana"
            >
              ✕
            </button>
          </div>

          {/* Área de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs sm:text-sm">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 whitespace-pre-wrap leading-relaxed shadow-sm ${
                    m.role === "user"
                      ? "bg-primary text-white rounded-br-none"
                      : "bg-surface-2 border border-line text-ink rounded-bl-none"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-1.5 text-xs text-muted pl-2 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]"></span>
                <span className="ml-1 text-[11px]">Pensando pregunta guía…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulario de Entrada */}
          <form onSubmit={handleSend} className="border-t border-line bg-surface-2/60 p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribí tu consulta o idea…"
                className="flex-1 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs sm:text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                Enviar
              </button>
            </div>
            <p className="text-[10px] text-muted text-center pt-1.5">
              El tutor formula preguntas para ayudarte a deducir el concepto.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
