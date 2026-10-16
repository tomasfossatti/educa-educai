"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  askChatAction,
  generateFlashcardsAction,
  generateNotesAction,
  generatePodcastAction,
  generateQuizAction,
  type SourceInput,
} from "@/server/actions/pagelm";

export type StudioActiveView = "grid" | "podcast" | "quiz" | "flashcards" | "notes" | "planner" | "table";

interface SourceItem {
  id: string;
  title: string;
  type: "text" | "note" | "curriculum";
  content: string;
  active: boolean;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
}

interface SmartNotesData {
  title: string;
  sections: Array<{ heading: string; body: string }>;
}

interface PodcastDialogue {
  episodeTitle: string;
  estimatedDuration: string;
  lines: Array<{ speaker: "Alex" | "Sam"; text: string }>;
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

const INITIAL_QUIZ: QuizQuestion[] = [
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

const INITIAL_FLASHCARDS: Flashcard[] = [
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
    front: "Early Adopter (Adoptante Temprano)",
    back: "Grupo de clientes que siente el problema con tanta urgencia que está dispuesto a probar una solución inicial imperfecta.",
  },
];

const INITIAL_NOTES: SmartNotesData = {
  title: "Smart Notes: Hipótesis Falsables y Validación Temprana",
  sections: [
    {
      heading: "1. Núcleo Conceptual",
      body: "Validar una idea de negocio no consiste en recopilar aplausos, sino en someter la propuesta a un experimento falsable. Un experimento efectivo define qué métrica se observará, qué valor mínimo se exige y en qué plazo exacto.",
    },
    {
      heading: "2. Falsabilidad Práctica",
      body: "Si no hay forma de que el resultado salga mal o negativo, la afirmación no es una hipótesis de negocio, sino un dogma o una expresión de deseo.",
    },
    {
      heading: "3. Aplicación en Negocios Locales",
      body: "Para un comercio o emprendimiento (como un restaurante gastronómico), antes de invertir en una plataforma digital o nueva línea, se puede realizar una prueba manual o preventa acotada durante 7 días para contrastar la demanda verídica.",
    },
  ],
};

const INITIAL_PODCAST: PodcastDialogue = {
  episodeTitle: "Episodio: Dominando Hipótesis Falsables",
  estimatedDuration: "2:50 min",
  lines: [
    {
      speaker: "Alex",
      text: "Bienvenidos. Hoy estamos revisando la clase sobre validación temprana. Sam, lo primero que me llamó la atención es por qué la gente insiste tanto en no ponerle un número al éxito antes de lanzar.",
    },
    {
      speaker: "Sam",
      text: "Exacto, Alex. Porque si no fijás el umbral de antemano, cuando conseguís solo dos clientes decís que al menos aprendiste. Pero si tu meta era diez para que los números cierren, dos significa que la hipótesis se cayó y hay que cambiar de dirección.",
    },
    {
      speaker: "Alex",
      text: "Claro, sin umbral previo cualquier resultado se disfraza de aprendizaje positivo.",
    },
    {
      speaker: "Sam",
      text: "Tal cual. Y lo segundo es aislar el problema real del usuario antes de ponerse a programar o comprar equipamiento.",
    },
  ],
};

export function PageLMStudio() {
  const [notebookTitle, setNotebookTitle] = useState("Cuaderno de Validación e Hipótesis");
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Pilar 1: Fuentes
  const [sources, setSources] = useState<SourceItem[]>(DEFAULT_SOURCES);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceTitle, setNewSourceTitle] = useState("");
  const [newSourceText, setNewSourceText] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");

  // Pilar 2: Chat central
  const [chatInput, setChatInput] = useState("");
  const [isChatTyping, setIsChatTyping] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: "user" | "pagelm"; text: string; sourceQuote?: string }>
  >([]);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Pilar 3: Studio (Herramientas)
  const [activeStudioView, setActiveStudioView] = useState<StudioActiveView>("grid");

  // Estados de IA y herramientas
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);

  // Quiz
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(INITIAL_QUIZ);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Flashcards
  const [flashcards, setFlashcards] = useState<Flashcard[]>(INITIAL_FLASHCARDS);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<string[]>([]);

  // Notes
  const [notesData, setNotesData] = useState<SmartNotesData>(INITIAL_NOTES);
  const [notesCopied, setNotesCopied] = useState(false);

  // Podcast / Audio
  const [podcastData, setPodcastData] = useState<PodcastDialogue>(INITIAL_PODCAST);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // Planner
  const [plannerMilestones, setPlannerMilestones] = useState([
    { id: "m1", title: "Segmentación y Dolor", description: "Identificar el perfil de usuario que sufre el problema hoy.", done: true },
    { id: "m2", title: "Hipótesis Falsable", description: "Redactar supuesto con métrica, umbral y plazo temporal.", done: true },
    { id: "m3", title: "Diseño de Prueba de Bajo Costo", description: "Construir experimento piloto sin inversión de capital previo.", done: false },
    { id: "m4", title: "Recolección y Contrastación", description: "Contrastar resultados empíricos con el umbral predeterminado.", done: false },
  ]);

  // Cargar persistencia
  useEffect(() => {
    try {
      const savedSources = localStorage.getItem("pagelm_sources");
      if (savedSources) setSources(JSON.parse(savedSources));
    } catch {
      // Ignorar
    }
  }, []);

  const saveSourcesToStorage = (updated: SourceItem[]) => {
    setSources(updated);
    try {
      localStorage.setItem("pagelm_sources", JSON.stringify(updated));
    } catch {
      // Ignorar
    }
  };

  const getActiveSourceInputs = (): SourceInput[] => {
    return sources.filter((s) => s.active).map((s) => ({ title: s.title, content: s.content }));
  };

  const handleAddSource = () => {
    if (!newSourceTitle.trim() || !newSourceText.trim()) return;
    const newSrc: SourceItem = {
      id: `src-${Date.now()}`,
      title: newSourceTitle.trim(),
      type: "note",
      content: newSourceText.trim(),
      active: true,
    };
    const next = [...sources, newSrc];
    saveSourcesToStorage(next);
    setNewSourceTitle("");
    setNewSourceText("");
    setShowAddSource(false);
  };

  const handleToggleSource = (id: string) => {
    const next = sources.map((s) => (s.id === id ? { ...s, active: !s.active } : s));
    saveSourcesToStorage(next);
  };

  const handleDeleteSource = (id: string) => {
    const next = sources.filter((s) => s.id !== id);
    saveSourcesToStorage(next);
  };

  /* ──────────────── CHAT ACTIONS ──────────────── */
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || chatInput;
    if (!textToSend.trim() || isChatTyping) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { sender: "user", text: textToSend }]);
    setIsChatTyping(true);

    try {
      const activeInputs = getActiveSourceInputs();
      const res = await askChatAction({
        prompt: textToSend,
        sources: activeInputs,
        history: chatMessages.slice(-4),
      });

      setChatMessages((prev) => [
        ...prev,
        {
          sender: "pagelm",
          text: res.reply,
          sourceQuote: res.sourceQuote,
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "pagelm",
          text: "No se pudo procesar la respuesta en este momento. Verificá tus fuentes de estudio.",
        },
      ]);
    } finally {
      setIsChatTyping(false);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  /* ──────────────── QUIZ ACTIONS ──────────────── */
  const handleGenerateQuiz = async () => {
    setIsGenerating(true);
    setGenerationNotice("Generando cuestionario con IA a partir de las fuentes activas…");
    try {
      const res = await generateQuizAction(getActiveSourceInputs());
      if (res.success && res.questions?.length) {
        setQuizQuestions(res.questions);
        setQuizAnswers({});
        setQuizSubmitted(false);
      }
    } finally {
      setIsGenerating(false);
      setGenerationNotice(null);
    }
  };

  const calculateScore = () => {
    let score = 0;
    quizQuestions.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correctIndex) score += 1;
    });
    return score;
  };

  /* ──────────────── FLASHCARDS ACTIONS ──────────────── */
  const handleGenerateFlashcards = async () => {
    setIsGenerating(true);
    setGenerationNotice("Sintetizando tarjetas conceptuales con IA…");
    try {
      const res = await generateFlashcardsAction(getActiveSourceInputs());
      if (res.success && res.cards?.length) {
        setFlashcards(res.cards);
        setCardIndex(0);
        setIsFlipped(false);
        setKnownCards([]);
      }
    } finally {
      setIsGenerating(false);
      setGenerationNotice(null);
    }
  };

  /* ──────────────── NOTES ACTIONS ──────────────── */
  const handleGenerateNotes = async () => {
    setIsGenerating(true);
    setGenerationNotice("Construyendo Smart Notes analíticas con IA…");
    try {
      const res = await generateNotesAction(getActiveSourceInputs());
      if (res.success && res.notes) {
        setNotesData(res.notes);
      }
    } finally {
      setIsGenerating(false);
      setGenerationNotice(null);
    }
  };

  const handleCopyNotes = () => {
    const text = `${notesData.title}\n\n` + notesData.sections.map((s) => `${s.heading}\n${s.body}`).join("\n\n");
    navigator.clipboard.writeText(text);
    setNotesCopied(true);
    setTimeout(() => setNotesCopied(false), 2000);
  };

  /* ──────────────── PODCAST ACTIONS (Audio con SpeechSynthesis) ──────────────── */
  const handleGeneratePodcast = async () => {
    handleStopAudio();
    setIsGenerating(true);
    setGenerationNotice("Creando guion de diálogo para audio con IA…");
    try {
      const res = await generatePodcastAction(getActiveSourceInputs());
      if (res.success && res.podcast) {
        setPodcastData(res.podcast);
        setCurrentLineIndex(-1);
      }
    } finally {
      setIsGenerating(false);
      setGenerationNotice(null);
    }
  };

  const handlePlayAudio = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Tu navegador no soporta síntesis de audio directa.");
      return;
    }

    window.speechSynthesis.cancel();
    setIsPlayingAudio(true);

    let lineIdx = currentLineIndex >= 0 && currentLineIndex < podcastData.lines.length ? currentLineIndex : 0;
    setCurrentLineIndex(lineIdx);

    const speakNextLine = () => {
      if (lineIdx >= podcastData.lines.length) {
        setIsPlayingAudio(false);
        setCurrentLineIndex(-1);
        return;
      }

      const item = podcastData.lines[lineIdx];
      setCurrentLineIndex(lineIdx);

      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.lang = "es-ES";
      utterance.rate = playbackRate;
      utterance.pitch = item.speaker === "Alex" ? 1.05 : 0.88;

      utterance.onend = () => {
        lineIdx += 1;
        speakNextLine();
      };

      utterance.onerror = () => {
        lineIdx += 1;
        speakNextLine();
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNextLine();
  };

  const handlePauseAudio = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
      setIsPlayingAudio(false);
    }
  };

  const handleResumeAudio = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
      setIsPlayingAudio(true);
    }
  };

  const handleStopAudio = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
    setCurrentLineIndex(-1);
  };

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const activeSources = sources.filter((s) => s.active);
  const filteredSources = sources.filter((s) =>
    s.title.toLowerCase().includes(sourceSearch.toLowerCase()) ||
    s.content.toLowerCase().includes(sourceSearch.toLowerCase())
  );

  return (
    <div className="w-full flex-1 flex flex-col h-[calc(100vh-5.5rem)] text-ink overflow-hidden">
      {/* ──────────────── CABECERA ESTILO NOTEBOOKLM ──────────────── */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-[#cdcdc9] bg-[#f2f1ed] shrink-0">
        <div className="flex items-center gap-3">
          {/* Logo circular de cuaderno */}
          <div className="w-8 h-8 rounded bg-[#26251e] flex items-center justify-center text-[#f7f7f4] border border-[#26251e]">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>

          {/* Título editable */}
          {isEditingTitle ? (
            <input
              type="text"
              value={notebookTitle}
              autoFocus
              onBlur={() => setIsEditingTitle(false)}
              onChange={(e) => setNotebookTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setIsEditingTitle(false)}
              className="rounded bg-[#f7f7f4] border border-[#26251e] px-2.5 py-1 text-sm font-normal text-[#26251e] focus:outline-none focus:ring-1 focus:ring-[#26251e]"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-normal text-[#26251e] hover:text-[#f54e00] transition-colors flex items-center gap-2 group"
            >
              <span>{notebookTitle}</span>
              <svg className="w-3.5 h-3.5 text-[#7a7974] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>

        {/* Acciones de cabecera */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setChatMessages([]);
              setActiveStudioView("grid");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#cdcdc9] bg-[#e6e5e0] hover:bg-[#deddd8] text-xs font-normal text-[#26251e] transition-colors"
          >
            <span>+ Crear cuaderno</span>
          </button>
          <Link
            href="/s"
            className="px-3 py-1.5 rounded border border-[#cdcdc9] bg-[#e6e5e0] hover:bg-[#deddd8] text-xs font-normal text-[#26251e] transition-colors"
          >
            ← Volver al curso
          </Link>
        </div>
      </header>

      {/* ──────────────── AVISO DE GENERACIÓN EN CURSO ──────────────── */}
      {isGenerating && (
        <div className="px-4 py-2 border-b border-primary/30 bg-primary/10 flex items-center justify-between text-xs text-primary shrink-0 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span>{generationNotice || "Procesando solicitud con IA…"}</span>
          </div>
          <span className="font-mono text-[11px] opacity-80">Gemini / Educai AI</span>
        </div>
      )}

      {/* ──────────────── ESTRUCTURA DE 3 PILARES ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 p-3 flex-1 min-h-0">
        {/* ══════════════════════════════════════════════════════
            PILAR 1 (IZQUIERDA): AGREGAR FUENTES
           ══════════════════════════════════════════════════════ */}
        <aside className="lg:col-span-3 rounded-2xl border border-line/80 bg-surface-1/90 p-3.5 flex flex-col justify-between shadow-sm min-h-0 overflow-hidden">
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            {/* Cabecera del pilar */}
            <div className="flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-white tracking-wide">
                Fuentes ({activeSources.length}/{sources.length})
              </span>
              <button
                type="button"
                className="text-muted hover:text-white p-1 rounded-lg"
                title="Colapsar panel"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </button>
            </div>

            {/* Botón principal "+ Agregar fuentes" */}
            <button
              type="button"
              onClick={() => setShowAddSource(!showAddSource)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-line-strong bg-surface-2 hover:bg-surface-3 text-xs font-bold text-white shadow-sm transition-all shrink-0 hover:border-primary/50"
            >
              <span className="text-primary font-bold">+</span>
              <span>{showAddSource ? "Cerrar formulario" : "Agregar fuentes"}</span>
            </button>

            {/* Formulario desplegable para agregar fuente */}
            {showAddSource && (
              <div className="rounded-xl border border-primary/40 bg-surface-2 p-3 space-y-2 text-xs shrink-0">
                <input
                  type="text"
                  placeholder="Título del apunte o fuente"
                  value={newSourceTitle}
                  onChange={(e) => setNewSourceTitle(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface-3 px-2.5 py-1.5 text-white placeholder-muted focus:outline-none focus:border-primary"
                />
                <textarea
                  rows={3}
                  placeholder="Pegá texto, resumen o apunte de clase…"
                  value={newSourceText}
                  onChange={(e) => setNewSourceText(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface-3 px-2.5 py-1.5 text-white placeholder-muted focus:outline-none focus:border-primary resize-none"
                />
                <button
                  type="button"
                  onClick={handleAddSource}
                  className="w-full rounded-lg bg-primary py-1.5 text-xs font-bold text-white hover:bg-primary-hover transition-colors"
                >
                  Guardar en este cuaderno
                </button>
              </div>
            )}

            {/* Buscador / filtro rápido de fuentes */}
            <div className="relative shrink-0">
              <input
                type="text"
                placeholder="Buscar fuentes en cuaderno…"
                value={sourceSearch}
                onChange={(e) => setSourceSearch(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface-2/80 pl-8 pr-3 py-1.5 text-xs text-white placeholder-muted focus:outline-none focus:border-primary"
              />
              <svg className="w-3.5 h-3.5 text-muted absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Lista scrollable de fuentes guardadas */}
            <div className="space-y-2 flex-1 overflow-y-auto pr-1 min-h-0">
              {filteredSources.length > 0 ? (
                filteredSources.map((src) => (
                  <div
                    key={src.id}
                    className={cn(
                      "rounded-xl border p-2.5 text-xs space-y-1.5 transition-colors group",
                      src.active
                        ? "border-line/80 bg-surface-2/80"
                        : "border-line/40 bg-surface-2/30 opacity-60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <label className="flex items-center gap-2 truncate cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={src.active}
                          onChange={() => handleToggleSource(src.id)}
                          className="rounded border-line bg-surface-3 text-primary focus:ring-0 cursor-pointer"
                        />
                        <span className="font-semibold text-white truncate text-[11px]">{src.title}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleDeleteSource(src.id)}
                        className="text-muted hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                        title="Eliminar fuente"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-[10px] text-muted line-clamp-2 leading-relaxed pl-5">{src.content}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 px-3 space-y-2 text-muted">
                  <svg className="w-8 h-8 mx-auto text-line-strong" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-[11px] leading-relaxed">
                    Las fuentes que guardes aparecerán aquí.
                  </p>
                  <p className="text-[10px] opacity-70">
                    Agregá archivos, sitios web o apuntes. Luego hacé preguntas o creá contenido con base en estas fuentes.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Pie del pilar izquierdo */}
          <div className="pt-2 border-t border-line/40 shrink-0">
            <span className="text-[10px] text-muted block text-center">
              {activeSources.length} fuente(s) activa(s) vinculada(s)
            </span>
          </div>
        </aside>

        {/* ══════════════════════════════════════════════════════
            PILAR 2 (CENTRO): CHAT CON FUENTES
           ══════════════════════════════════════════════════════ */}
        <main className="lg:col-span-5 rounded-2xl border border-line/80 bg-surface-1/90 p-4 flex flex-col justify-between shadow-sm min-h-0 overflow-hidden">
          {/* Si no hay mensajes: Pantalla de inicio estilo NotebookLM */}
          {chatMessages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 max-w-lg mx-auto space-y-5 my-auto">
              {/* Ícono de bienvenida */}
              <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-line flex items-center justify-center text-primary shadow-sm">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                </svg>
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Iniciemos tu cuaderno…
                </h2>
                <p className="text-xs sm:text-sm text-muted leading-relaxed">
                  Este es tu lienzo en blanco para comprender, crear o avanzar en algún tema nuevo.
                  Puedo ayudarte a comenzar o puedes agregar tus propias fuentes.
                </p>
              </div>

              <div className="w-full space-y-2 pt-2">
                <p className="text-xs font-semibold text-white/90">
                  ¿Con qué te gustaría que te ayude en este cuaderno?
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    "Aprende sobre un tema nuevo",
                    "¿Qué es una hipótesis falsable?",
                    "Resumí en 3 puntos clave los supuestos",
                    "¿Cómo defino el umbral de éxito antes de probar?",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleSendMessage(chip)}
                      className="w-full text-left rounded-xl border border-line bg-surface-2/80 hover:bg-surface-3 px-3.5 py-2 text-xs text-muted hover:text-white transition-colors flex items-center justify-between"
                    >
                      <span>{chip}</span>
                      <span className="text-muted">→</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Stream de mensajes conversacional */
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 min-h-0">
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
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.sourceQuote && (
                    <span className="text-[10px] text-muted italic font-mono pt-1.5 border-t border-line/30 block">
                      {msg.sourceQuote}
                    </span>
                  )}
                </div>
              ))}

              {isChatTyping && (
                <div className="mr-auto bg-surface-2 text-muted border border-line/60 rounded-2xl p-3 text-xs italic flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span>PageLM está razonando con tus fuentes…</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
          )}

          {/* Barra inferior de entrada de texto (Estilo NotebookLM) */}
          <div className="pt-3 shrink-0 space-y-1.5">
            <div className="flex items-center gap-2 rounded-2xl border border-line-strong bg-surface-2/95 px-3 py-2 shadow-md focus-within:border-primary transition-all">
              <input
                type="text"
                placeholder="Haz una pregunta o crea algo…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-muted focus:outline-none"
              />

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-surface-3 border border-line text-muted">
                  {activeSources.length} fuentes
                </span>
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!chatInput.trim() || isChatTyping}
                  className="w-7 h-7 rounded-full bg-primary hover:bg-primary-hover text-white flex items-center justify-center font-bold text-xs disabled:opacity-40 transition-colors shadow-sm"
                  title="Enviar mensaje"
                >
                  ↑
                </button>
              </div>
            </div>

            <p className="text-[10px] text-muted text-center tracking-tight">
              PageLM Studio puede cometer errores, así que verifica las respuestas.
            </p>
          </div>
        </main>

        {/* ══════════════════════════════════════════════════════
            PILAR 3 (DERECHA): MÁS TOOLS (STUDIO)
           ══════════════════════════════════════════════════════ */}
        <section className="lg:col-span-4 rounded-2xl border border-line/80 bg-surface-1/90 p-3.5 flex flex-col justify-between shadow-sm min-h-0 overflow-hidden">
          {/* Cabecera del pilar Studio */}
          <div className="flex items-center justify-between border-b border-line/60 pb-2.5 shrink-0">
            <div className="flex items-center gap-2">
              {activeStudioView !== "grid" && (
                <button
                  type="button"
                  onClick={() => setActiveStudioView("grid")}
                  className="text-xs font-semibold text-primary hover:text-white transition-colors"
                >
                  ← Volver
                </button>
              )}
              <span className="text-xs font-bold text-white tracking-wide">
                {activeStudioView === "grid"
                  ? "Studio"
                  : activeStudioView === "podcast"
                  ? "Resumen en audio / Podcast"
                  : activeStudioView === "quiz"
                  ? "Cuestionario / Quiz"
                  : activeStudioView === "flashcards"
                  ? "Tarjetas didácticas"
                  : activeStudioView === "notes"
                  ? "Smart Notes / Informes"
                  : "Mapa mental / Planner"}
              </span>
            </div>

            <button
              type="button"
              className="text-muted hover:text-white p-1 rounded-lg"
              title="Colapsar panel"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
          </div>

          {/* VISTA 1: GRID DE TOOLS (Como la imagen de NotebookLM) */}
          {activeStudioView === "grid" && (
            <div className="space-y-4 flex-1 flex flex-col justify-between min-h-0 overflow-y-auto py-2 pr-1">
              {/* Parrilla de 2 columnas con las herramientas */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* 1. Resumen en audio */}
                <button
                  type="button"
                  onClick={() => setActiveStudioView("podcast")}
                  className="rounded-xl border border-line/80 bg-surface-2/70 hover:bg-surface-3 hover:border-primary/50 p-3 text-left transition-all space-y-2 group shadow-sm"
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 group-hover:scale-105 transition-transform">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                      Resumen en audio
                    </p>
                    <p className="text-[10px] text-muted leading-tight">Diálogo de 2 especialistas</p>
                  </div>
                </button>

                {/* 2. Cuestionario */}
                <button
                  type="button"
                  onClick={() => setActiveStudioView("quiz")}
                  className="rounded-xl border border-line/80 bg-surface-2/70 hover:bg-surface-3 hover:border-primary/50 p-3 text-left transition-all space-y-2 group shadow-sm"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                      Cuestionario
                    </p>
                    <p className="text-[10px] text-muted leading-tight">Quiz interactivo con IA</p>
                  </div>
                </button>

                {/* 3. Tarjetas didácticas */}
                <button
                  type="button"
                  onClick={() => setActiveStudioView("flashcards")}
                  className="rounded-xl border border-line/80 bg-surface-2/70 hover:bg-surface-3 hover:border-primary/50 p-3 text-left transition-all space-y-2 group shadow-sm"
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-105 transition-transform">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                      Tarjetas didácticas
                    </p>
                    <p className="text-[10px] text-muted leading-tight">Flashcards y memorización</p>
                  </div>
                </button>

                {/* 4. Smart Notes / Informes */}
                <button
                  type="button"
                  onClick={() => setActiveStudioView("notes")}
                  className="rounded-xl border border-line/80 bg-surface-2/70 hover:bg-surface-3 hover:border-primary/50 p-3 text-left transition-all space-y-2 group shadow-sm"
                >
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20 group-hover:scale-105 transition-transform">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                      Smart Notes
                    </p>
                    <p className="text-[10px] text-muted leading-tight">Síntesis y estructura</p>
                  </div>
                </button>

                {/* 5. Mapa mental / Planner */}
                <button
                  type="button"
                  onClick={() => setActiveStudioView("planner")}
                  className="rounded-xl border border-line/80 bg-surface-2/70 hover:bg-surface-3 hover:border-primary/50 p-3 text-left transition-all space-y-2 group shadow-sm"
                >
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20 group-hover:scale-105 transition-transform">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                      Mapa mental
                    </p>
                    <p className="text-[10px] text-muted leading-tight">Planner y conceptos</p>
                  </div>
                </button>

                {/* 6. Tabla de datos / Métricas */}
                <button
                  type="button"
                  onClick={() => setActiveStudioView("notes")}
                  className="rounded-xl border border-line/80 bg-surface-2/70 hover:bg-surface-3 hover:border-primary/50 p-3 text-left transition-all space-y-2 group shadow-sm"
                >
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 group-hover:scale-105 transition-transform">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                      Tabla de datos
                    </p>
                    <p className="text-[10px] text-muted leading-tight">Métricas y umbrales</p>
                  </div>
                </button>
              </div>

              {/* Texto de pie de Studio idéntico al screenshot */}
              <div className="text-center py-4 px-3 space-y-2 text-muted">
                <svg className="w-6 h-6 mx-auto text-line-strong" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <p className="text-[11px] leading-relaxed">
                  Los resultados de Studio se guardarán aquí.
                </p>
                <p className="text-[10px] opacity-70">
                  Luego de agregar fuentes, haz clic para agregar un Resumen en audio, cuestionario, flashcards y más.
                </p>
              </div>

              {/* Botón "+ Agregar nota" */}
              <div className="pt-2 border-t border-line/40">
                <button
                  type="button"
                  onClick={() => setShowAddSource(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-line bg-surface-2 hover:bg-surface-3 text-xs font-semibold text-white transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Agregar nota</span>
                </button>
              </div>
            </div>
          )}

          {/* VISTA 2: PODCAST / AUDIO OVERVIEW */}
          {activeStudioView === "podcast" && (
            <div className="space-y-4 flex-1 flex flex-col justify-between min-h-0 overflow-y-auto py-2 pr-1">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400">
                    Audio Overview
                  </span>
                  <button
                    type="button"
                    onClick={handleGeneratePodcast}
                    disabled={isGenerating}
                    className="text-[11px] font-bold text-primary hover:underline"
                  >
                    Regenerar con IA
                  </button>
                </div>

                {/* Reproductor de audio Web Speech */}
                <div className="rounded-xl border border-primary/30 bg-surface-2 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={isPlayingAudio ? handlePauseAudio : currentLineIndex >= 0 ? handleResumeAudio : handlePlayAudio}
                        className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shadow-md hover:bg-primary-hover transition-colors"
                        title={isPlayingAudio ? "Pausar" : "Reproducir"}
                      >
                        {isPlayingAudio ? (
                          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                      {isPlayingAudio && (
                        <button
                          type="button"
                          onClick={handleStopAudio}
                          className="w-7 h-7 rounded-full border border-line bg-surface-3 text-muted hover:text-white flex items-center justify-center text-[10px]"
                          title="Detener"
                        >
                          <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                            <rect x="5" y="5" width="14" height="14" rx="2" />
                          </svg>
                        </button>
                      )}
                      <div>
                        <p className="text-xs font-bold text-white truncate">{podcastData.episodeTitle}</p>
                        <p className="text-[10px] text-muted">{podcastData.estimatedDuration} · Alex y Sam</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-line/40 text-[11px]">
                    <span className="text-muted">Velocidad:</span>
                    <div className="flex items-center gap-1">
                      {[1.0, 1.2, 1.5].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setPlaybackRate(rate)}
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-mono border",
                            playbackRate === rate
                              ? "border-primary bg-primary/20 text-primary font-bold"
                              : "border-line bg-surface-3 text-muted hover:text-white",
                          )}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Guion de diálogo sincronizado */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {podcastData.lines.map((item, idx) => {
                    const isCurrent = currentLineIndex === idx;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "p-2.5 rounded-xl border text-xs leading-relaxed transition-all",
                          isCurrent
                            ? "bg-primary/15 border-primary shadow-sm"
                            : "bg-surface-2/60 border-line/40",
                        )}
                      >
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase block mb-1",
                            item.speaker === "Alex" ? "text-emerald-400" : "text-cyan-400",
                          )}
                        >
                          {item.speaker === "Alex" ? "Alex (Anfitrión)" : "Sam (Especialista)"}
                        </span>
                        <p className={isCurrent ? "text-white font-medium" : "text-ink"}>{item.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VISTA 3: QUIZ INTERACTIVO */}
          {activeStudioView === "quiz" && (
            <div className="space-y-4 flex-1 flex flex-col justify-between min-h-0 overflow-y-auto py-2 pr-1">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                    Preguntas ({quizQuestions.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateQuiz}
                    disabled={isGenerating}
                    className="text-[11px] font-bold text-primary hover:underline"
                  >
                    Generar nuevo con IA
                  </button>
                </div>

                <div className="space-y-3.5">
                  {quizQuestions.map((q, qIdx) => (
                    <div key={q.id} className="rounded-xl border border-line bg-surface-2/70 p-3 space-y-2 text-xs">
                      <p className="font-bold text-white">
                        {qIdx + 1}. {q.question}
                      </p>
                      <div className="space-y-1.5">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = quizAnswers[qIdx] === optIdx;
                          const isCorrect = q.correctIndex === optIdx;
                          let style = "border-line bg-surface-3/50 text-ink hover:text-white";
                          if (quizSubmitted) {
                            if (isCorrect) style = "border-emerald-500 bg-emerald-950/30 text-emerald-300 font-bold";
                            else if (isSelected && !isCorrect) style = "border-rose-500 bg-rose-950/30 text-rose-300";
                          } else if (isSelected) {
                            style = "border-primary bg-primary/20 text-white font-semibold";
                          }

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => !quizSubmitted && setQuizAnswers((p) => ({ ...p, [qIdx]: optIdx }))}
                              className={cn("w-full text-left rounded-lg border p-2 text-xs transition-colors", style)}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>

                      {quizSubmitted && (
                        <p className="text-[10px] text-muted italic bg-surface-3 p-2 rounded border border-line/40">
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-line/40 flex items-center justify-between">
                {quizSubmitted ? (
                  <span className="text-xs font-bold text-emerald-400">
                    Puntaje: {calculateScore()} / {quizQuestions.length}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted">
                    {Object.keys(quizAnswers).length} de {quizQuestions.length} respondidas
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setQuizSubmitted(!quizSubmitted)}
                  className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-hover shadow-sm"
                >
                  {quizSubmitted ? "Reintentar" : "Finalizar quiz"}
                </button>
              </div>
            </div>
          )}

          {/* VISTA 4: FLASHCARDS */}
          {activeStudioView === "flashcards" && (
            <div className="space-y-4 flex-1 flex flex-col justify-between min-h-0 overflow-y-auto py-2 pr-1">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                    Tarjeta {cardIndex + 1} de {flashcards.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateFlashcards}
                    disabled={isGenerating}
                    className="text-[11px] font-bold text-primary hover:underline"
                  >
                    Regenerar con IA
                  </button>
                </div>

                {/* Tarjeta volteable */}
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="w-full h-44 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-surface-2 to-surface-3 p-5 flex flex-col items-center justify-center text-center cursor-pointer select-none hover:border-primary/60 transition-all shadow-md"
                >
                  <span className="text-[9px] uppercase font-bold tracking-widest text-primary mb-2">
                    {isFlipped ? "Definición / Explicación" : "Concepto (Clic para voltear)"}
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-white leading-relaxed">
                    {flashcards[cardIndex]
                      ? isFlipped
                        ? flashcards[cardIndex].back
                        : flashcards[cardIndex].front
                      : "Sin tarjetas"}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFlipped(false);
                      setCardIndex((prev) => (prev > 0 ? prev - 1 : flashcards.length - 1));
                    }}
                    className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-white"
                  >
                    ← Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFlipped(false);
                      setCardIndex((prev) => (prev < flashcards.length - 1 ? prev + 1 : 0));
                    }}
                    className="rounded-xl border border-primary/40 bg-primary/20 px-4 py-1.5 text-xs font-bold text-white hover:bg-primary/30"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VISTA 5: SMART NOTES */}
          {activeStudioView === "notes" && (
            <div className="space-y-4 flex-1 flex flex-col justify-between min-h-0 overflow-y-auto py-2 pr-1">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400">
                    Smart Notes
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyNotes}
                      className="text-[11px] font-bold text-muted hover:text-white"
                    >
                      {notesCopied ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateNotes}
                      disabled={isGenerating}
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      Regenerar con IA
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 bg-surface-2/60 p-3 rounded-xl border border-line/60 text-xs leading-relaxed max-h-[300px] overflow-y-auto pr-1">
                  {notesData.sections.map((sec, idx) => (
                    <div key={idx} className={idx > 0 ? "border-t border-line/40 pt-2" : ""}>
                      <h4 className="font-bold text-white text-[11px] mb-1">{sec.heading}</h4>
                      <p className="text-muted text-[11px]">{sec.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VISTA 6: PLANNER & MAPA */}
          {activeStudioView === "planner" && (
            <div className="space-y-4 flex-1 flex flex-col justify-between min-h-0 overflow-y-auto py-2 pr-1">
              <div className="space-y-3">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                  Hitos y Mapa de Conceptos
                </span>

                <div className="space-y-2">
                  {plannerMilestones.map((m, idx) => (
                    <div
                      key={m.id}
                      onClick={() =>
                        setPlannerMilestones((p) =>
                          p.map((item) => (item.id === m.id ? { ...item, done: !item.done } : item))
                        )
                      }
                      className={cn(
                        "rounded-xl border p-2.5 space-y-1 cursor-pointer transition-all text-xs",
                        m.done
                          ? "border-emerald-500/40 bg-emerald-950/20"
                          : "border-line bg-surface-2 hover:border-line-strong",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted uppercase">Paso {idx + 1}</span>
                        <span className={cn("text-[10px] font-bold", m.done ? "text-emerald-400" : "text-muted")}>
                          {m.done ? "Completado" : "Pendiente"}
                        </span>
                      </div>
                      <p className="font-bold text-white text-[11px]">{m.title}</p>
                      <p className="text-[10px] text-muted">{m.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
