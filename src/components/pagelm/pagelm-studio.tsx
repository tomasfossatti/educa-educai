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

export type StudioTab = "chat" | "quiz" | "flashcards" | "notes" | "podcast" | "planner";

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
    front: "Segmento Temprano (Early Adopter)",
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
  const [activeTab, setActiveTab] = useState<StudioTab>("chat");
  const [sources, setSources] = useState<SourceItem[]>(DEFAULT_SOURCES);
  const [newSourceText, setNewSourceText] = useState("");
  const [newSourceTitle, setNewSourceTitle] = useState("");
  const [showAddSource, setShowAddSource] = useState(false);

  // Estados de generación y carga de IA
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [isChatTyping, setIsChatTyping] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: "user" | "pagelm"; text: string; sourceQuote?: string }>
  >([
    {
      sender: "pagelm",
      text: "Hola. Cargué tus fuentes de estudio activas. Podés hacerme preguntas sobre el material, generar cuestionarios, flashcards, resúmenes o un podcast de audio interactivo con la IA.",
    },
  ]);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(INITIAL_QUIZ);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Flashcards state
  const [flashcards, setFlashcards] = useState<Flashcard[]>(INITIAL_FLASHCARDS);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<string[]>([]);

  // Notes state
  const [notesData, setNotesData] = useState<SmartNotesData>(INITIAL_NOTES);
  const [notesCopied, setNotesCopied] = useState(false);

  // Podcast / Audio player state
  const [podcastData, setPodcastData] = useState<PodcastDialogue>(INITIAL_PODCAST);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const audioSpeechRef = useRef<{ cancel: () => void } | null>(null);

  // Planner state
  const [plannerMilestones, setPlannerMilestones] = useState([
    { id: "m1", title: "Segmentación y Dolor", description: "Identificar el perfil de usuario que sufre el problema hoy.", done: true },
    { id: "m2", title: "Hipótesis Falsable", description: "Redactar supuesto con métrica, umbral y plazo temporal.", done: true },
    { id: "m3", title: "Diseño de Prueba de Bajo Costo", description: "Construir experimento piloto sin inversión de capital previo.", done: false },
    { id: "m4", title: "Recolección y Contrastación", description: "Contrastar resultados empíricos con el umbral predeterminado.", done: false },
  ]);

  // Cargar persistencia local si existe
  useEffect(() => {
    try {
      const savedSources = localStorage.getItem("pagelm_sources");
      if (savedSources) setSources(JSON.parse(savedSources));
    } catch {
      // Ignorar errores de localStorage
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

  /* ──────────────── ACCIÓN CHAT ──────────────── */
  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatTyping) return;
    const q = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { sender: "user", text: q }]);
    setIsChatTyping(true);

    try {
      const activeInputs = getActiveSourceInputs();
      const res = await askChatAction({
        prompt: q,
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
    }
  };

  /* ──────────────── ACCIÓN GENERAR QUIZ ──────────────── */
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

  /* ──────────────── ACCIÓN GENERAR FLASHCARDS ──────────────── */
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

  const handleMarkCard = (known: boolean) => {
    const card = flashcards[cardIndex];
    if (card) {
      if (known && !knownCards.includes(card.id)) {
        setKnownCards((prev) => [...prev, card.id]);
      } else if (!known && knownCards.includes(card.id)) {
        setKnownCards((prev) => prev.filter((id) => id !== card.id));
      }
    }
    setIsFlipped(false);
    if (cardIndex < flashcards.length - 1) {
      setCardIndex((prev) => prev + 1);
    } else {
      setCardIndex(0);
    }
  };

  /* ──────────────── ACCIÓN GENERAR SMART NOTES ──────────────── */
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

  /* ──────────────── ACCIÓN GENERAR PODCAST ──────────────── */
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

  /* ──────────────── REPRODUCTOR DE AUDIO REAL (Web Speech API) ──────────────── */
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

    audioSpeechRef.current = {
      cancel: () => {
        window.speechSynthesis.cancel();
      },
    };
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

  // Limpiar síntesis al desmontar
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const activeSourcesCount = sources.filter((s) => s.active).length;

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
            Transformá tus apuntes y materiales de la cursada en conversaciones, cuestionarios, flashcards y guiones de audio interactivos generados con IA.
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

      {/* ──────────────── AVISO DE GENERACIÓN EN CURSO ──────────────── */}
      {isGenerating && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 flex items-center justify-between text-xs text-primary animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span>{generationNotice || "Procesando solicitud con IA…"}</span>
          </div>
          <span className="font-mono text-[11px] opacity-80">Gemini / Educai AI</span>
        </div>
      )}

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
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Fuentes ({activeSourcesCount}/{sources.length})
            </span>
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
                placeholder="Pegá texto, resumen o transcripción…"
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

          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {sources.map((src) => (
              <div
                key={src.id}
                className={cn(
                  "rounded-xl border p-2.5 text-xs space-y-1.5 transition-colors",
                  src.active
                    ? "border-line/70 bg-surface-2/70"
                    : "border-line/30 bg-surface-2/30 opacity-60",
                )}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 truncate">
                    <input
                      type="checkbox"
                      checked={src.active}
                      onChange={() => handleToggleSource(src.id)}
                      className="rounded border-line bg-surface-3 text-primary focus:ring-0 cursor-pointer"
                    />
                    <p className="font-semibold text-white truncate text-[11px]">{src.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteSource(src.id)}
                    className="text-muted hover:text-rose-400 text-xs px-1"
                    title="Eliminar fuente"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[10px] text-muted line-clamp-2 leading-relaxed pl-5">{src.content}</p>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-line/40">
            <p className="text-[10px] text-muted text-center">
              Las herramientas activas consumen solo las fuentes marcadas.
            </p>
          </div>
        </div>

        {/* PANEL DERECHO: HERRAMIENTA ACTIVA */}
        <div className="lg:col-span-3 rounded-2xl border border-line bg-surface-1/90 p-5 shadow-sm min-h-[480px] flex flex-col">
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

                {isChatTyping && (
                  <div className="mr-auto bg-surface-2 text-muted border border-line/60 rounded-2xl p-3 text-xs italic flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span>PageLM está razonando con tus fuentes…</span>
                  </div>
                )}
              </div>

              {/* Sugerencias rápidas */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-line/40">
                {[
                  "¿Cómo defino el umbral de éxito?",
                  "Resumí en 3 puntos clave",
                  "¿Cómo evito el sesgo de confirmación?",
                  "¿Qué experimento de bajo costo sugieren?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setChatInput(suggestion);
                    }}
                    className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-[11px] text-muted hover:text-white hover:border-primary/50 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {/* Entrada de texto */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Hacé una pregunta sobre tus materiales…"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-xs sm:text-sm text-white placeholder-muted focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isChatTyping}
                  className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-primary-hover shadow-md transition-colors disabled:opacity-40"
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
                <div className="flex items-center justify-between border-b border-line/60 pb-3 flex-wrap gap-3">
                  <div>
                    <h2 className="text-base font-bold text-white">Cuestionario de Validación de Conceptos</h2>
                    <p className="text-xs text-muted">Preguntas generadas dinámicamente sobre tus fuentes activas.</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {quizSubmitted && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/40 bg-emerald-950/40 text-emerald-400">
                        Puntaje: {calculateScore()} / {quizQuestions.length}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleGenerateQuiz}
                      disabled={isGenerating}
                      className="rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
                    >
                      <span>Generar nuevo Quiz con IA</span>
                    </button>
                  </div>
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
              <div className="w-full flex items-center justify-between border-b border-line/60 pb-3 flex-wrap gap-2">
                <span className="text-xs text-muted">
                  Tarjeta {cardIndex + 1} de {flashcards.length}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-emerald-400">
                    Dominadas: {knownCards.length} / {flashcards.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateFlashcards}
                    disabled={isGenerating}
                    className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
                  >
                    Generar Flashcards con IA
                  </button>
                </div>
              </div>

              {/* Tarjeta volteable */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full max-w-md h-64 rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-surface-2 via-surface-3 to-surface-1 p-8 shadow-xl flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-300 hover:border-primary/60 hover:scale-[1.01]"
              >
                <span className="text-[10px] uppercase font-bold tracking-widest text-primary mb-3">
                  {isFlipped ? "Definición / Explicación" : "Concepto clave (Hacé clic para voltear)"}
                </span>
                <p className="text-base sm:text-lg font-bold text-white leading-relaxed">
                  {flashcards[cardIndex] ? (isFlipped ? flashcards[cardIndex].back : flashcards[cardIndex].front) : "Sin tarjetas"}
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
              <div className="border-b border-line/60 pb-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-bold text-white">{notesData.title}</h2>
                  <p className="text-xs text-muted">Estructura automática generada a partir de las fuentes activas.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyNotes}
                    className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-white transition-colors"
                  >
                    {notesCopied ? "Copiado ✓" : "Copiar apunte"}
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateNotes}
                    disabled={isGenerating}
                    className="rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
                  >
                    Regenerar con IA
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-xs sm:text-sm text-ink-2 leading-relaxed bg-surface-2/60 p-4 rounded-xl border border-line/60">
                {notesData.sections.map((sec, idx) => (
                  <div key={idx} className={idx > 0 ? "border-t border-line/40 pt-3" : ""}>
                    <h3 className="font-bold text-white text-sm mb-1">{sec.heading}</h3>
                    <p className="text-muted leading-relaxed">{sec.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. MODO PODCAST / AUDIO OVERVIEW */}
          {activeTab === "podcast" && (
            <div className="space-y-5 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="border-b border-line/60 pb-3 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-base font-bold text-white">Podcast Overview (Estilo NotebookLM)</h2>
                    <p className="text-xs text-muted">Diálogo simulado y reproducido por síntesis de voz en el navegador.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGeneratePodcast}
                    disabled={isGenerating}
                    className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
                  >
                    Generar nuevo episodio con IA
                  </button>
                </div>

                {/* Reproductor de audio */}
                <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-surface-2 to-surface-3 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={isPlayingAudio ? handlePauseAudio : currentLineIndex >= 0 ? handleResumeAudio : handlePlayAudio}
                      className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base shadow-lg hover:bg-primary-hover transition-colors"
                    >
                      {isPlayingAudio ? "⏸" : "▶"}
                    </button>
                    {isPlayingAudio && (
                      <button
                        type="button"
                        onClick={handleStopAudio}
                        className="w-8 h-8 rounded-full border border-line bg-surface-3 text-muted hover:text-white flex items-center justify-center text-xs"
                        title="Detener audio"
                      >
                        ⏹
                      </button>
                    )}
                    <div>
                      <p className="text-xs font-bold text-white">{podcastData.episodeTitle}</p>
                      <p className="text-[11px] text-muted">
                        Voces: Alex y Sam · Duración aprox: {podcastData.estimatedDuration}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[11px] text-muted">
                      <span>Vel:</span>
                      {[1.0, 1.2, 1.5].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setPlaybackRate(rate)}
                          className={cn(
                            "px-2 py-0.5 rounded border text-[10px] font-mono",
                            playbackRate === rate
                              ? "border-primary bg-primary/20 text-primary font-bold"
                              : "border-line bg-surface-2 text-muted hover:text-white",
                          )}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>

                    <span className="px-3 py-1 rounded-full text-[10px] font-mono bg-surface-1 border border-line text-primary">
                      {isPlayingAudio ? "Reproduciendo…" : "Audio Listo"}
                    </span>
                  </div>
                </div>

                {/* Transcripción interactiva con resaltado activo */}
                <div className="space-y-3 text-xs leading-relaxed max-h-[250px] overflow-y-auto pr-2">
                  {podcastData.lines.map((item, idx) => {
                    const isCurrent = currentLineIndex === idx;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "p-3 rounded-xl border transition-all",
                          isCurrent
                            ? "bg-primary/10 border-primary shadow-md scale-[1.01]"
                            : "bg-surface-2/60 border-line/40",
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={cn(
                              "text-[10px] font-bold uppercase",
                              item.speaker === "Alex" ? "text-emerald-400" : "text-cyan-400",
                            )}
                          >
                            {item.speaker === "Alex" ? "Alex (Anfitrión)" : "Sam (Especialista)"}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-mono text-primary font-bold animate-pulse">
                              [En reproducción]
                            </span>
                          )}
                        </div>
                        <p className={isCurrent ? "text-white font-medium" : "text-ink"}>{item.text}</p>
                      </div>
                    );
                  })}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {plannerMilestones.map((m, idx) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      setPlannerMilestones((prev) =>
                        prev.map((item) => (item.id === m.id ? { ...item, done: !item.done } : item)),
                      );
                    }}
                    className={cn(
                      "rounded-xl border p-3.5 space-y-2 cursor-pointer transition-all",
                      m.done
                        ? "border-emerald-500/40 bg-emerald-950/20"
                        : "border-line bg-surface-2 hover:border-line-strong",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        Paso {idx + 1}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-bold",
                          m.done ? "text-emerald-400" : "text-muted",
                        )}
                      >
                        {m.done ? "Completado ✓" : "Pendiente"}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white">{m.title}</h4>
                    <p className="text-[11px] text-muted">{m.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
