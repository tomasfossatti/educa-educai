"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export type StudioTab = "chat" | "quiz" | "flashcards" | "notes" | "podcast" | "planner";

interface SourceItem {
  id: string;
  title: string;
  type: "text" | "note" | "curriculum";
  content: string;
  active: boolean;
}

const DEFAULT_SOURCES: SourceItem[] = [
  {
    id: "src-1",
    title: "Clase 4: Hipótesis Falsables y Validación",
    type: "curriculum",
    content:
      "Una hipótesis falsable define una métrica cuantitativa, un umbral de éxito y un plazo determinado. Para validar un modelo de negocio, se debe aislar el problema del cliente sin presuponer la solución. Los experimentos deben ser de bajo costo y buscar refutar supuestos clave.",
    active: true,
  },
  {
    id: "src-2",
    title: "Apuntes: Segmentación y Propuesta de Valor",
    type: "note",
    content:
      "Segmentar implica elegir a quién servir primero según necesidades y comportamientos reales, no meramente datos demográficos. La propuesta de valor responde qué dolor alivia la oferta y por qué supera a las alternativas actuales.",
    active: true,
  },
];

const INITIAL_QUIZ = [
  {
    id: "q1",
    question: "¿Qué elemento distingue fundamentalmente a una hipótesis falsable de una mera opinión?",
    options: [
      "Que contiene métrica, umbral y plazo verificables que pueden refutarla",
      "Que cuenta con respaldo de encuestas de satisfacción amplias",
      "Que asume que el cliente siempre pagará por la primera versión",
      "Que se basa únicamente en proyecciones financieras a tres años",
    ],
    correctIndex: 0,
    explanation:
      "Una hipótesis falsable debe poder ser refutada por la evidencia: exige definir métrica, umbral mínimo y plazo concreto de medición.",
  },
  {
    id: "q2",
    question: "Al diseñar una prueba de validación temprana para un restaurante, ¿cuál es el error más común?",
    options: [
      "Presuponer la solución antes de constatar el problema real del comensal",
      "Elegir un segmento de clientes demasiado acotado",
      "Medir los resultados en plazos cortos de una o dos semanas",
      "Usar promociones piloto en lugar de una campaña publicitaria masiva",
    ],
    correctIndex: 0,
    explanation:
      "El error clásico es diseñar la solución (ej. una app de menú o delivery premium) sin haber validado si el cliente realmente tiene esa dificultad prioritaria.",
  },
  {
    id: "q3",
    question: "¿Qué función cumple el umbral de éxito en un experimento de negocio?",
    options: [
      "Determinar antes de lanzar qué resultado mínimo validará o descartará la hipótesis",
      "Garantizar que no existan pérdidas operativas durante la prueba",
      "Fijar el precio de venta final del servicio de forma definitiva",
      "Definir el presupuesto total de marketing a largo plazo",
    ],
    correctIndex: 0,
    explanation:
      "Fijar el umbral previamente previene el sesgo de confirmación y evita racionalizar resultados desfavorables después de la prueba.",
  },
];

const INITIAL_FLASHCARDS = [
  {
    id: "fc1",
    front: "Hipótesis Falsable",
    back: "Supuesto formulado de modo que un experimento concreto pueda demostrar que es falso. Requiere métrica, umbral y plazo.",
  },
  {
    id: "fc2",
    front: "Problema vs. Solución",
    back: "El problema es la necesidad o dolor genuino del usuario. La solución es solo un intento específico de resolverlo; no deben confundirse al inicio.",
  },
  {
    id: "fc3",
    front: "Umbral de Decisión",
    back: "Número o porcentaje acordado previamente que dictamina si se itera, se pivota o se escala la propuesta.",
  },
  {
    id: "fc4",
    front: "Segmento Temprano (Early Adopter)",
    back: "Grupo de clientes que siente el problema con tanta urgencia que está dispuesto a probar una solución inicial imperfecta.",
  },
];

export function PageLMStudio() {
  const [activeTab, setActiveTab] = useState<StudioTab>("chat");
  const [sources, setSources] = useState<SourceItem[]>(DEFAULT_SOURCES);
  const [newSourceText, setNewSourceText] = useState("");
  const [newSourceTitle, setNewSourceTitle] = useState("");
  const [showAddSource, setShowAddSource] = useState(false);

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: "user" | "pagelm"; text: string; sourceQuote?: string }>
  >([
    {
      sender: "pagelm",
      text: "Hola. Cargué tus fuentes de estudio activas. Podés hacerme preguntas sobre el material, generar resúmenes, o cambiar a las solapas de Quiz, Flashcards y Podcast en la barra superior.",
    },
  ]);

  // Quiz state
  const [quizQuestions] = useState(INITIAL_QUIZ);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Flashcards state
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<string[]>([]);

  // Handlers
  const handleAddSource = () => {
    if (!newSourceTitle.trim() || !newSourceText.trim()) return;
    const newSrc: SourceItem = {
      id: `src-${Date.now()}`,
      title: newSourceTitle.trim(),
      type: "note",
      content: newSourceText.trim(),
      active: true,
    };
    setSources((prev) => [...prev, newSrc]);
    setNewSourceTitle("");
    setNewSourceText("");
    setShowAddSource(false);
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const q = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { sender: "user", text: q }]);

    setTimeout(() => {
      let reply = "Según tus fuentes de la materia: ";
      if (q.toLowerCase().includes("hipótesis") || q.toLowerCase().includes("falsable")) {
        reply +=
          "Una hipótesis falsable exige tres componentes indispensables: métrica medible, umbral de éxito y plazo acotado. Sin ellos, se convierte en un deseo no comprobable.";
      } else if (q.toLowerCase().includes("resumen") || q.toLowerCase().includes("resumir")) {
        reply +=
          "Los 3 puntos centrales son: 1) Elegir un segmento con dolor real comprobable. 2) Formular la hipótesis con umbral explícito. 3) Ejecutar un experimento barato para validar antes de invertir recursos.";
      } else {
        reply +=
          "El objetivo principal es tomar decisiones con evidencia directa de tu contexto, identificando si los clientes están dispuestos a validar la propuesta de valor.";
      }
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "pagelm",
          text: reply,
          sourceQuote: "Fuente: Clase 4 · Hipótesis Falsables",
        },
      ]);
    }, 400);
  };

  const handleSelectQuizOption = (qIdx: number, optIdx: number) => {
    if (quizSubmitted) return;
    setQuizAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const calculateScore = () => {
    let score = 0;
    quizQuestions.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correctIndex) score += 1;
    });
    return score;
  };

  const handleMarkCard = (known: boolean) => {
    const card = INITIAL_FLASHCARDS[cardIndex];
    if (known && !knownCards.includes(card.id)) {
      setKnownCards((prev) => [...prev, card.id]);
    } else if (!known && knownCards.includes(card.id)) {
      setKnownCards((prev) => prev.filter((id) => id !== card.id));
    }
    setIsFlipped(false);
    if (cardIndex < INITIAL_FLASHCARDS.length - 1) {
      setCardIndex((prev) => prev + 1);
    } else {
      setCardIndex(0);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col space-y-5 py-2">
      {/* ──────────────── CABECERA PRINCIPAL PAGELM ──────────────── */}
      <div className="rounded-2xl border border-line bg-gradient-to-r from-surface-1 via-surface-2 to-surface-3 p-4 sm:p-5 shadow-lg backdrop-blur-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="text-primary font-mono">PageLM</span>
              <span className="text-xs px-2 py-0.5 rounded-full border border-primary/40 bg-primary/10 text-primary font-medium tracking-normal">
                Studio de Estudio
              </span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted max-w-xl">
            Transformá tus apuntes y materiales de la cursada en conversaciones, cuestionarios, flashcards y guiones de audio interactivos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/s"
            className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-white hover:bg-surface-3 transition-colors"
          >
            ← Volver al curso
          </Link>
        </div>
      </div>

      {/* ──────────────── BARRA DE SOLAPAS / HERRAMIENTAS ──────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-line/60">
        {[
          { key: "chat", label: "Chat con fuentes", icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" },
          { key: "quiz", label: "Quiz interactivo", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
          { key: "flashcards", label: "Flashcards", icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
          { key: "notes", label: "Smart Notes", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
          { key: "podcast", label: "Podcast / Audio", icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" },
          { key: "planner", label: "Planner & Mapa", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as StudioTab)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all",
              activeTab === tab.key
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "text-muted hover:text-white hover:bg-surface-2",
            )}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ──────────────── CUERPO PRINCIPAL DEL STUDIO ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 flex-1 items-start">
        {/* PANEL IZQUIERDO: FUENTES / MATERIALES */}
        <div className="lg:col-span-1 rounded-2xl border border-line bg-surface-1/90 p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Fuentes ({sources.length})</span>
            <button
              type="button"
              onClick={() => setShowAddSource(!showAddSource)}
              className="text-[11px] font-semibold text-primary hover:text-primary-hover transition-colors"
            >
              {showAddSource ? "Cancelar" : "+ Agregar"}
            </button>
          </div>

          {showAddSource && (
            <div className="rounded-xl border border-primary/30 bg-surface-2 p-3 space-y-2 text-xs">
              <input
                type="text"
                placeholder="Título del apunte o fuente"
                value={newSourceTitle}
                onChange={(e) => setNewSourceTitle(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface-3 px-2.5 py-1.5 text-white placeholder-muted focus:outline-none focus:border-primary"
              />
              <textarea
                rows={3}
                placeholder="Pegá texto, resumen o enlace..."
                value={newSourceText}
                onChange={(e) => setNewSourceText(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface-3 px-2.5 py-1.5 text-white placeholder-muted focus:outline-none focus:border-primary resize-none"
              />
              <button
                type="button"
                onClick={handleAddSource}
                className="w-full rounded-lg bg-primary py-1.5 text-xs font-bold text-white hover:bg-primary-hover transition-colors"
              >
                Guardar fuente
              </button>
            </div>
          )}

          <div className="space-y-2">
            {sources.map((src) => (
              <div
                key={src.id}
                className="rounded-xl border border-line/60 bg-surface-2/60 p-2.5 text-xs space-y-1 hover:border-line transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white truncate">{src.title}</p>
                  <span className="text-[10px] font-mono text-muted uppercase">{src.type}</span>
                </div>
                <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">{src.content}</p>
              </div>
            ))}
          </div>
        </div>

        {/* PANEL DERECHO: HERRAMIENTA ACTIVA */}
        <div className="lg:col-span-3 rounded-2xl border border-line bg-surface-1/90 p-5 shadow-sm min-h-[460px] flex flex-col">
          {/* 1. MODO CHAT CON FUENTES */}
          {activeTab === "chat" && (
            <div className="flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-2">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex flex-col max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed space-y-1.5 shadow-sm",
                      msg.sender === "user"
                        ? "ml-auto bg-primary text-white rounded-br-none"
                        : "mr-auto bg-surface-2 text-ink border border-line/60 rounded-bl-none",
                    )}
                  >
                    <p>{msg.text}</p>
                    {msg.sourceQuote && (
                      <span className="text-[10px] text-muted italic font-mono pt-1 border-t border-line/30 block">
                        {msg.sourceQuote}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Sugerencias rápidas */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-line/40">
                {["¿Qué es una hipótesis falsable?", "Resumir en 3 puntos clave", "¿Cómo validar con bajo costo?"].map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setChatInput(suggestion);
                      }}
                      className="rounded-full border border-line bg-surface-2 px-3 py-1 text-[11px] text-muted hover:text-white hover:border-primary/50 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ),
                )}
              </div>

              {/* Input bar */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Hacé una pregunta sobre tus materiales..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  className="flex-1 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-xs sm:text-sm text-white placeholder-muted focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  className="rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-primary-hover shadow-md transition-colors"
                >
                  Enviar
                </button>
              </div>
            </div>
          )}

          {/* 2. MODO QUIZ INTERACTIVO */}
          {activeTab === "quiz" && (
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-line/60 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-white">Cuestionario de Validación de Conceptos</h2>
                    <p className="text-xs text-muted">Poné a prueba tu comprensión de hipótesis falsables y experimentos.</p>
                  </div>
                  {quizSubmitted && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/40 bg-emerald-950/40 text-emerald-400">
                      Puntaje: {calculateScore()} / {quizQuestions.length}
                    </span>
                  )}
                </div>

                <div className="space-y-5">
                  {quizQuestions.map((q, qIdx) => (
                    <div key={q.id} className="rounded-xl border border-line bg-surface-2/60 p-4 space-y-3">
                      <p className="text-xs sm:text-sm font-bold text-white">
                        {qIdx + 1}. {q.question}
                      </p>
                      <div className="space-y-2">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = quizAnswers[qIdx] === optIdx;
                          const isCorrect = q.correctIndex === optIdx;
                          let optStyle = "border-line bg-surface-3/50 text-ink-2 hover:border-line-strong hover:text-white";
                          if (quizSubmitted) {
                            if (isCorrect) optStyle = "border-emerald-500/50 bg-emerald-950/30 text-emerald-300 font-semibold";
                            else if (isSelected && !isCorrect) optStyle = "border-rose-500/50 bg-rose-950/30 text-rose-300";
                          } else if (isSelected) {
                            optStyle = "border-primary bg-primary/15 text-white font-semibold";
                          }

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => handleSelectQuizOption(qIdx, optIdx)}
                              className={cn(
                                "w-full text-left rounded-lg border p-2.5 text-xs transition-colors flex items-center justify-between",
                                optStyle,
                              )}
                            >
                              <span>{opt}</span>
                              {quizSubmitted && isCorrect && <span className="text-emerald-400 font-bold ml-2">✓</span>}
                            </button>
                          );
                        })}
                      </div>

                      {quizSubmitted && (
                        <p className="text-[11px] text-muted italic bg-surface-3 p-2 rounded-lg border border-line/40">
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-line/60 flex items-center justify-end gap-3">
                {quizSubmitted ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuizAnswers({});
                      setQuizSubmitted(false);
                    }}
                    className="rounded-xl border border-line bg-surface-2 px-5 py-2.5 text-xs font-bold text-white hover:bg-surface-3 transition-colors"
                  >
                    Reintentar cuestionario
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setQuizSubmitted(true)}
                    disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                    className="rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-white hover:bg-primary-hover shadow-md transition-colors disabled:opacity-50"
                  >
                    Finalizar y ver resultados
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 3. MODO FLASHCARDS */}
          {activeTab === "flashcards" && (
            <div className="space-y-6 flex-1 flex flex-col justify-between items-center text-center">
              <div className="w-full flex items-center justify-between border-b border-line/60 pb-3">
                <span className="text-xs text-muted">
                  Tarjeta {cardIndex + 1} de {INITIAL_FLASHCARDS.length}
                </span>
                <span className="text-xs font-semibold text-emerald-400">
                  Dominadas: {knownCards.length} / {INITIAL_FLASHCARDS.length}
                </span>
              </div>

              {/* Tarjeta volteable */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full max-w-md h-64 rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-surface-2 via-surface-3 to-surface-1 p-8 shadow-xl flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-300 hover:border-primary/60 hover:scale-[1.01]"
              >
                <span className="text-[10px] uppercase font-bold tracking-widest text-primary mb-3">
                  {isFlipped ? "Respuesta / Explicación" : "Concepto clave (Hacé clic para voltear)"}
                </span>
                <p className="text-base sm:text-lg font-bold text-white leading-relaxed">
                  {isFlipped ? INITIAL_FLASHCARDS[cardIndex].back : INITIAL_FLASHCARDS[cardIndex].front}
                </p>
              </div>

              {/* Controles de flashcard */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => handleMarkCard(false)}
                  className="rounded-xl border border-rose-500/30 bg-rose-950/20 px-5 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-950/40 transition-colors"
                >
                  Repasar de nuevo
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkCard(true)}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-6 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-950/50 transition-colors shadow-md"
                >
                  Ya lo domino ✓
                </button>
              </div>
            </div>
          )}

          {/* 4. MODO SMART NOTES */}
          {activeTab === "notes" && (
            <div className="space-y-4 flex-1">
              <div className="border-b border-line/60 pb-3">
                <h2 className="text-base font-bold text-white">Smart Notes: Resumen Sintetizado</h2>
                <p className="text-xs text-muted">Estructura automática generada a partir de las fuentes activas.</p>
              </div>

              <div className="space-y-3 text-xs sm:text-sm text-ink-2 leading-relaxed bg-surface-2/60 p-4 rounded-xl border border-line/60">
                <div>
                  <h3 className="font-bold text-white text-sm mb-1">1. Núcleo Conceptual</h3>
                  <p className="text-muted">
                    Validar una idea de negocio no consiste en recopilar aplausos, sino en someter la propuesta a un experimento falsable. Un experimento efectivo define qué métrica se observará, qué valor mínimo se exige y en qué plazo exacto.
                  </p>
                </div>

                <div className="border-t border-line/40 pt-2">
                  <h3 className="font-bold text-white text-sm mb-1">2. Falsabilidad Práctica</h3>
                  <p className="text-muted">
                    Si no hay forma de que el resultado salga mal o negativo, la afirmación no es una hipótesis de negocio, sino un dogma o una expresión de deseo.
                  </p>
                </div>

                <div className="border-t border-line/40 pt-2">
                  <h3 className="font-bold text-white text-sm mb-1">3. Aplicación en Negocios Locales</h3>
                  <p className="text-muted">
                    Para un comercio o emprendimiento (como un restaurante gastronómico), antes de invertir en una plataforma digital o nueva línea, se puede realizar una prueba manual o preventa acotada durante 7 días para contrastar la demanda verídica.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 5. MODO PODCAST / AUDIO OVERVIEW */}
          {activeTab === "podcast" && (
            <div className="space-y-5 flex-1">
              <div className="border-b border-line/60 pb-3">
                <h2 className="text-base font-bold text-white">Podcast Overview (Estilo NotebookLM)</h2>
                <p className="text-xs text-muted">Diálogo simulado entre dos especialistas analizando los materiales de estudio.</p>
              </div>

              <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-surface-2 to-surface-3 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm border border-primary/30">
                    ▶
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Episodio: Dominando Hipótesis Falsables</p>
                    <p className="text-[11px] text-muted">Voces: Alex y Sam · Duración estimada: 3:45 min</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-mono bg-surface-1 border border-line text-primary">
                  Audio Script Listo
                </span>
              </div>

              <div className="space-y-3 text-xs leading-relaxed max-h-[260px] overflow-y-auto pr-2">
                <div className="p-2.5 rounded-xl bg-surface-2/60 border border-line/40 space-y-1">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">Alex (Anfitrión)</span>
                  <p className="text-ink">
                    «Bienvenidos. Hoy estamos revisando la clase sobre validación temprana. Sam, lo primero que me llamó la atención es por qué la gente insiste tanto en no ponerle un número al éxito antes de lanzar.»
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-surface-2/60 border border-line/40 space-y-1">
                  <span className="text-[10px] font-bold text-cyan-400 uppercase">Sam (Especialista)</span>
                  <p className="text-ink">
                    «Exacto, Alex. Porque si no fijás el umbral de antemano, cuando conseguís solo dos clientes decís "bueno, al menos aprendimos". Pero si tu meta era diez para que los números cierren, dos significa que la hipótesis se cayó y hay que cambiar de dirección.»
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 6. MODO PLANNER & MAPA CONCEPTUAL */}
          {activeTab === "planner" && (
            <div className="space-y-4 flex-1">
              <div className="border-b border-line/60 pb-3">
                <h2 className="text-base font-bold text-white">Planner de Estudio y Mapa de Conceptos</h2>
                <p className="text-xs text-muted">Secuencia lógica recomendada para preparar la materia.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-line bg-surface-2 p-3 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Paso 1: Fundamentos</span>
                  <h4 className="text-xs font-bold text-white">Segmentación y Dolor</h4>
                  <p className="text-[11px] text-muted">Identificar el perfil de usuario que sufre el problema hoy.</p>
                </div>

                <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Paso 2: En curso</span>
                  <h4 className="text-xs font-bold text-white">Hipótesis Falsable</h4>
                  <p className="text-[11px] text-muted">Redactar supuesto con métrica, umbral y plazo temporal.</p>
                </div>

                <div className="rounded-xl border border-line/50 bg-surface-2/40 p-3 space-y-2 opacity-60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Paso 3: Próximo</span>
                  <h4 className="text-xs font-bold text-white">Experimento Piloto</h4>
                  <p className="text-[11px] text-muted">Ejecución en campo y toma de decisión con evidencia.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
