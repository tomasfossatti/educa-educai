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
  initialMessageCount?: number;
}

export function FloatingTutor({
  courseId,
  courseName,
  topicTitle = "Hipótesis de negocio falsables",
  initialConversationId,
  initialMessageCount = 0,
}: FloatingTutorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null);
  const [hasInteracted, setHasInteracted] = useState<boolean>(Boolean(initialConversationId && initialMessageCount > 0));

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hola. Soy tu tutor para la clase de hoy en **${courseName}**.\n\nNo te daré respuestas directas para copiar, sino preguntas para ayudarte a construir tu propio razonamiento sobre **${topicTitle}**.\n\n¿Qué parte del tema o qué duda te gustaría pensar juntos?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  const sendQuestion = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoadingRef.current) return;

    setIsOpen(true);
    const userMessage: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setHasInteracted(true);

    try {
      const activeId = conversationIdRef.current;
      if (activeId) {
        const res = await fetch(`/api/tutor/${activeId}`, {
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

      await new Promise((r) => setTimeout(r, 800));
      let response = "";
      if (trimmed.toLowerCase().includes("hipotesis") || trimmed.toLowerCase().includes("hipótesis")) {
        response = `Para que esa hipótesis sea verdaderamente **falsable**, ¿cuál es la métrica exacta que vas a medir y qué número concreto demostraría que tu supuesto era incorrecto?`;
      } else if (trimmed.toLowerCase().includes("segmento") || trimmed.toLowerCase().includes("cliente")) {
        response = `¿Ese segmento lo estás definiendo solo por datos demográficos o por una **necesidad concreta** que tienen en común?`;
      } else {
        response = `¿Qué evidencia concreta te llevó a pensar eso y cómo podríamos diseñar un experimento simple para comprobarlo antes de invertir?`;
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

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleAsk = (e: Event) => {
      const customEvent = e as CustomEvent<{ question?: string }>;
      if (customEvent.detail?.question) {
        void sendQuestion(customEvent.detail.question);
      } else {
        setIsOpen(true);
      }
    };

    window.addEventListener("open-tutor", handleOpen);
    window.addEventListener("ask-tutor", handleAsk);
    return () => {
      window.removeEventListener("open-tutor", handleOpen);
      window.removeEventListener("ask-tutor", handleAsk);
    };
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendQuestion(input);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        /* Botón Flotante Cerrado */
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#27251e] text-[#faf8f5] shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-150 hover:bg-[#3d3b32] active:scale-95 cursor-pointer"
          aria-label="Abrir tutor de la materia"
        >
          {/* Ícono de bot de chat */}
          <svg className="w-5 h-5 text-[#faf8f5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </button>
      ) : (
        /* Ventana Flotante Abierta */
        <div className="flex flex-col w-[380px] sm:w-[430px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[82vh] rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] shadow-[0_1px_2px_rgba(0,0,0,0.08)] overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-150">
          {/* Header de la ventana */}
          <div className="flex items-center justify-between border-b border-[#d1d1cd] bg-[#fdfbfa] px-4 py-3">
            <div>
              <h3 className="text-sm font-medium text-[#27251e] leading-tight">
                Tutor de la materia
              </h3>
              <p className="text-[11px] text-[#72706b] font-normal">
                {courseName} · Método socrático
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("close-tutor"));
                }
              }}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[#72706b] hover:text-[#27251e] hover:bg-[#faf8f5] transition-colors cursor-pointer"
              aria-label="Cerrar ventana"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Área de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs sm:text-sm bg-[#faf8f5]">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#27251e] text-[#faf8f5]"
                      : "bg-[#fdfbfa] border border-[#d1d1cd] text-[#27251e] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-1.5 text-xs text-[#72706b] pl-2 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#016a71] animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#016a71] animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#016a71] animate-bounce [animation-delay:0.4s]"></span>
                <span className="ml-1 text-[11px] font-normal text-[#72706b]">Pensando pregunta guía…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulario de Entrada */}
          <form onSubmit={handleSend} className="border-t border-[#d1d1cd] bg-[#fdfbfa] p-3.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribí tu consulta o idea…"
                className="flex-1 rounded-xl border border-[#d1d1cd] bg-[#faf8f5] px-3.5 py-2 text-xs sm:text-sm text-[#27251e] placeholder:text-[#92918b] focus:border-[#016a71] focus:ring-1 focus:ring-[#016a71] focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="rounded-xl bg-[#27251e] px-4 py-2 text-xs font-medium text-[#faf8f5] hover:bg-[#3d3b32] disabled:opacity-40 transition-colors cursor-pointer"
              >
                Enviar
              </button>
            </div>
            <p className="text-[11px] text-[#72706b] text-center pt-2 font-normal">
              El tutor formula preguntas para ayudarte a deducir el concepto.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
