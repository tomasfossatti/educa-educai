"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { triggerOpenSidebar } from "@/lib/sidebar";

export interface AttachedFile {
  id: string;
  name: string;
  size: string;
  time: string;
  extension: "txt" | "pdf" | "docx" | "md";
}

const INITIAL_ATTACHED_FILES: AttachedFile[] = [
  {
    id: "f-1",
    name: "Reporte_Validacion_Hipotesis_V1.pdf",
    size: "49.2 KB",
    time: "Hace 15 minutos",
    extension: "pdf",
  },
  {
    id: "f-2",
    name: "Entrevistas_Comensales_Rosario.docx",
    size: "128.4 KB",
    time: "Hace 2 horas",
    extension: "docx",
  },
];

interface ClassDashboardProps {
  courseId: string;
  courseName: string;
  teacherName: string;
  totalClasses?: number;
  currentClassNumber?: number;
  conceptTitle?: string;
  conceptDescription?: string;
  userOrganization?: string;
  learningGoal?: string;
  personalizedApplication?: string;
  activity?: {
    id: string;
    title: string;
    description: string;
    isUnlocked: boolean;
  } | null;
  activeConversation?: {
    id: string;
    title: string;
    messageCount: number;
  } | null;
  onAttachConversation?: (conversationId: string) => void;
}

const CLASS_QUESTIONS = [
  "¿Cómo sé si mi hipótesis se puede refutar o es solo un deseo?",
  "¿Qué métrica de validación elijo para medir la demanda real?",
  "¿Cómo defino el umbral de éxito antes de realizar la prueba?",
  "¿Qué diferencia existe entre un problema real y la solución imaginada?",
  "¿Qué experimento simple y de bajo costo puedo probar esta semana?",
  "¿En qué plazo exacto conviene medir los resultados del experimento?",
];

export function ClassDashboard({
  courseId,
  courseName,
  teacherName,
  totalClasses = 8,
  currentClassNumber = 4,
  conceptTitle = "hipótesis falsables",
  conceptDescription,
  userOrganization = "tu restaurante en el centro de Rosario",
  learningGoal,
  activity = {
    id: "practice-logistics",
    title: "Práctica: hipótesis falsables en logística de última milla",
    description:
      "Una empresa de logística quiere ofrecer entregas en franjas de una hora, con un costo extra, a clientes de comercios online. No sabe si alguien pagaría por ese servicio.",
    isUnlocked: false,
  },
  activeConversation,
  onAttachConversation,
}: ClassDashboardProps) {
  // Timer de clase
  const [classElapsedMinutes, setClassElapsedMinutes] = useState(38);
  const totalClassMinutes = 120; // 2 horas
  const breakMinute = 60; // Recreo a la 1 hora

  const [isUnlocked, setIsUnlocked] = useState(activity?.isUnlocked ?? false);
  const [attached, setAttached] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [activeButton, setActiveButton] = useState<"genera" | "adjunta" | "conversa" | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Estado para el desplegable de archivos adjuntos
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>(INITIAL_ATTACHED_FILES);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const attachDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (attachDropdownRef.current && !attachDropdownRef.current.contains(e.target as Node)) {
        setIsAttachOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsAttachOpen(false);
      }
    }
    if (isAttachOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAttachOpen]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFiles = (files: File[]) => {
    const allowed = [".txt", ".pdf", ".docx", ".md"];
    const newItems: AttachedFile[] = [];
    let hasInvalid = false;

    for (const f of files) {
      const ext = ("." + f.name.split(".").pop()?.toLowerCase()) as ".txt" | ".pdf" | ".docx" | ".md";
      if (!allowed.includes(ext)) {
        hasInvalid = true;
        continue;
      }
      newItems.push({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: f.name,
        size: formatFileSize(f.size),
        time: "Recién subido",
        extension: ext.replace(".", "") as "txt" | "pdf" | "docx" | "md",
      });
    }

    if (hasInvalid) {
      setUploadError("Solo se admiten documentos en formato .txt, .pdf, .docx o .md");
      setTimeout(() => setUploadError(null), 4000);
    } else {
      setUploadError(null);
    }

    if (newItems.length > 0) {
      setAttachedFiles((prev) => [...newItems, ...prev]);
      setAttached(true);
      if (activeConversation && onAttachConversation) {
        onAttachConversation(activeConversation.id);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const handleDeleteFile = (id: string) => {
    setAttachedFiles((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (next.length === 0) {
        setAttached(false);
      }
      return next;
    });
  };

  useEffect(() => {
    const handleSidebarOpen = () => setIsSidebarOpen(true);
    const handleSidebarClose = () => {
      setIsSidebarOpen(false);
      setActiveButton((prev) => (prev === "genera" ? null : prev));
    };
    const handleTutorOpen = () => setIsChatOpen(true);
    const handleTutorClose = () => {
      setIsChatOpen(false);
      setActiveButton((prev) => (prev === "conversa" ? null : prev));
    };

    window.addEventListener("educai:open-sidebar", handleSidebarOpen);
    window.addEventListener("educai:close-sidebar", handleSidebarClose);
    window.addEventListener("open-tutor", handleTutorOpen);
    window.addEventListener("close-tutor", handleTutorClose);
    return () => {
      window.removeEventListener("educai:open-sidebar", handleSidebarOpen);
      window.removeEventListener("educai:close-sidebar", handleSidebarClose);
      window.removeEventListener("open-tutor", handleTutorOpen);
      window.removeEventListener("close-tutor", handleTutorClose);
    };
  }, []);

  // Preguntas rotativas al lado del título (cambian cada 30 segundos)
  const [questionIndex, setQuestionIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setQuestionIndex((prev) => (prev + 1) % CLASS_QUESTIONS.length);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Avance de la materia
  const courseProgressPercent = Math.round((currentClassNumber / totalClasses) * 100);

  // Cálculos de bloques
  const block1Percent = Math.min(100, Math.round((Math.min(classElapsedMinutes, 60) / 60) * 100));
  const hasBlock2Started = classElapsedMinutes > 60;
  const block2Percent = hasBlock2Started
    ? Math.min(100, Math.round(((classElapsedMinutes - 60) / 60) * 100))
    : 0;

  // Tiempo y recreo
  const minutesToBreak = Math.max(0, breakMinute - classElapsedMinutes);
  const minutesToEnd = Math.max(0, totalClassMinutes - classElapsedMinutes);

  // Concepto y organización efectivos para el titular
  const effectiveConcept = conceptTitle || (learningGoal ? learningGoal.split(":")[0].trim() : "hipótesis falsables");
  const effectiveOrg = userOrganization || "tu restaurante en el centro de Rosario";
  const effectiveDescription =
    conceptDescription ||
    (learningGoal && learningGoal.includes(":")
      ? learningGoal.split(":").slice(1).join(":").trim()
      : "Hipótesis que pueden resultar falsas: definen métrica, umbral y plazo.");

  const handleGeneraClick = () => {
    setActiveButton("genera");
    triggerOpenSidebar();
  };

  const handleAttachClick = () => {
    setActiveButton("adjunta");
    setIsAttachOpen((prev) => !prev);
  };

  const handleConversaClick = () => {
    setActiveButton("conversa");
    setIsChatOpen(true);
    window.dispatchEvent(new CustomEvent("open-tutor"));
  };

  const handleAskQuestion = (question: string) => {
    window.dispatchEvent(
      new CustomEvent("ask-tutor", {
        detail: { question },
      })
    );
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-between gap-4 sm:gap-5 lg:gap-6 py-1">
      {/* ──────────────── 0. SECCIÓN DE AVANCE DE LA MATERIA (Hover para ver hitos) ──────────────── */}
      <div className="group relative space-y-1.5 shrink-0">
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70"></span>
            <span>Avance general de la materia</span>
          </span>
          <span className="font-mono font-medium text-ink-2">
            Clase {currentClassNumber} de {totalClasses}
          </span>
        </div>

        {/* Barra sutil y discreta */}
        <div className="h-1.5 w-full rounded-full bg-surface-2 border border-line/40 overflow-hidden cursor-pointer transition-all duration-200 group-hover:h-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500 ease-out"
            style={{ width: `${courseProgressPercent}%` }}
          />
        </div>

        {/* Micro-hitos: ocultos por defecto, visibles únicamente al posar el cursor sobre la barra */}
        <div className="max-h-0 opacity-0 overflow-hidden transition-all duration-300 ease-out group-hover:max-h-20 group-hover:opacity-100 group-hover:pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Hito 1: texto en blanco, detalles sutilmente verdes */}
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-2 py-1 text-[10px] sm:text-[11px]">
              <svg className="w-3 h-3 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="truncate text-white font-medium">Hito 1: Segmentación</span>
            </div>

            {/* Hito 2: texto en blanco, detalles sutilmente verdes */}
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-2 py-1 text-[10px] sm:text-[11px]">
              <svg className="w-3 h-3 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="truncate text-white font-medium">Hito 2: Propuesta</span>
            </div>

            {/* Hito 3: texto en blanco */}
            <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] sm:text-[11px]">
              <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse"></span>
              <span className="truncate text-white font-medium">Hito 3: En curso hoy</span>
            </div>

            {/* Hito 4 */}
            <div className="flex items-center gap-1.5 rounded-lg border border-line/50 bg-surface-2/40 px-2 py-1 text-[10px] sm:text-[11px] text-muted">
              <span className="w-2 h-2 rounded-full bg-muted/40 shrink-0"></span>
              <span className="truncate">Hito 4: Validación</span>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────── 0. SECCIÓN "CLASE EN CURSO" ──────────────── */}
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-b from-surface-2/90 to-surface/80 p-3.5 sm:p-4 lg:p-4.5 shadow-md backdrop-blur-md shrink-0 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Clase en curso
            </span>
          </div>

          <div className="text-[11px] sm:text-xs font-medium">
            {minutesToBreak > 0 ? (
              <span className="text-white font-semibold">
                Recreo en {minutesToBreak} min
              </span>
            ) : (
              <span className="text-white font-semibold">
                Segunda parte · Termina en {minutesToEnd} min
              </span>
            )}
          </div>
        </div>

        {/* Dos bloques limpios y sobrios */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Bloque 1: solo identificador del bloque */}
          <div className="space-y-1">
            <div className="text-[10px] sm:text-[11px] text-muted font-medium">
              <span>Bloque 1</span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-3/80 border border-line/60 overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_12px_rgba(52,211,153,0.5)] transition-all duration-300"
                style={{ width: `${block1Percent}%` }}
              />
            </div>
          </div>

          {/* Bloque 2: estado bloqueado/desactivado mientras el Bloque 1 esté en progreso */}
          <div
            className={`space-y-1 transition-opacity duration-300 ${
              !hasBlock2Started ? "opacity-40 select-none pointer-events-none" : ""
            }`}
          >
            <div className="text-[10px] sm:text-[11px] text-muted font-medium">
              <span>Bloque 2</span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-3/80 border border-line/60 overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_12px_rgba(52,211,153,0.5)] transition-all duration-300"
                style={{ width: `${block2Percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────── 1) TITULO Y DESCRIPCIÓN + BOTÓN PREGUNTAS GUÍA IA (Espacio al lado del título) ──────────────── */}
      <div className="rounded-2xl border border-line/80 bg-gradient-to-br from-surface-1 via-surface-2/80 to-surface-3/60 p-5 sm:p-6 lg:p-7 shadow-lg backdrop-blur-xl shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
          {/* Lado izquierdo: Título principal personalizado y descripción */}
          <div className="space-y-2 flex-1 max-w-2xl">
            <h1 className="text-xl sm:text-2xl lg:text-[26px] font-extrabold tracking-tight text-white leading-snug">
              Hoy vas a aplicar {effectiveConcept.toLowerCase()} en {effectiveOrg}
            </h1>
            {effectiveDescription && (
              <p className="text-xs sm:text-sm text-muted leading-relaxed line-clamp-2">
                {effectiveDescription}
              </p>
            )}
          </div>

          {/* Lado derecho: Botón interactivo que rota preguntas cada 30 segundos */}
          <div className="shrink-0 w-full lg:w-72 xl:w-80">
            <button
              type="button"
              onClick={() => handleAskQuestion(CLASS_QUESTIONS[questionIndex])}
              className="w-full text-left group relative flex flex-col justify-between gap-3 rounded-xl border border-primary/30 bg-surface-2/90 hover:bg-surface-3/90 p-4 sm:p-4.5 shadow-sm transition-all duration-300 hover:border-primary/60 hover:shadow-[0_0_20px_rgba(120,150,238,0.25)] hover:scale-[1.01] active:scale-[0.99]"
              aria-label="Preguntarle a la IA esta consulta"
            >
              {/* Pregunta */}
              <p className="text-xs sm:text-sm font-semibold text-white leading-snug min-h-[42px] transition-opacity duration-300">
                {CLASS_QUESTIONS[questionIndex]}
              </p>

              {/* Abajo a la derecha: flecha siempre visible, texto "Preguntale a la IA" visible únicamente en hover */}
              <div className="flex justify-end items-center w-full min-h-[20px]">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary group-hover:text-primary-hover transition-colors">
                  <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap transition-all duration-200 ease-out group-hover:max-w-[140px] group-hover:opacity-100">
                    Preguntale a la IA
                  </span>
                  <svg aria-hidden="true" className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ──────────────── 2) BOTONES: "Generá" - "Adjuntá" - "Conversá" (Negro por defecto, Violeta/Lila al clickear) ──────────────── */}
      {(() => {
        const baseBtnClass =
          "min-w-[140px] inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-3 text-sm sm:text-base font-bold transition-all duration-200 active:scale-[0.98] cursor-pointer";

        const blackBtnClass =
          "border border-white/[0.14] bg-black text-[#F7F8F8] hover:bg-[#121316] hover:border-white/[0.24] shadow-sm hover:shadow-[0_0_20px_rgba(255,255,255,0.06)]";

        const violetBtnClass =
          "border border-purple-400/60 bg-gradient-to-r from-[#6366F1] via-[#7C3AED] to-[#9333EA] text-white shadow-[0_0_25px_rgba(139,92,246,0.45),inset_0_1px_0_0_rgba(255,255,255,0.3)] hover:brightness-110";

        const isGeneraActive = activeButton === "genera" || isSidebarOpen;
        const isAdjuntaActive = activeButton === "adjunta" || isAttachOpen || attached || attachedFiles.length > 0;
        const isConversaActive = activeButton === "conversa" || isChatOpen;

        return (
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 py-1 shrink-0">
            {/* 1. Botón Generá */}
            <button
              type="button"
              onClick={handleGeneraClick}
              className={cn(baseBtnClass, isGeneraActive ? violetBtnClass : blackBtnClass)}
              title="Abrir menú lateral de proyectos y herramientas"
            >
              <svg
                className={cn("w-4.5 h-4.5 shrink-0 transition-colors", isGeneraActive ? "text-white" : "text-[#A78BFA]")}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" strokeWidth={1.8} />
                <path strokeLinecap="round" strokeWidth={1.8} d="M9 3v18" />
              </svg>
              <span>Generá</span>
            </button>

            {/* 2. Botón Adjuntá con Desplegable */}
            <div className="relative">
              <button
                type="button"
                onClick={handleAttachClick}
                className={cn(baseBtnClass, isAdjuntaActive ? violetBtnClass : blackBtnClass)}
                title="Adjuntar documentos a la clase"
                aria-expanded={isAttachOpen}
              >
                {attachedFiles.length > 0 ? (
                  <>
                    <svg className="w-4.5 h-4.5 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Adjuntado ({attachedFiles.length})</span>
                  </>
                ) : (
                  <>
                    <svg
                      className={cn("w-4.5 h-4.5 shrink-0 transition-colors", isAdjuntaActive ? "text-white" : "text-[#A78BFA]")}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span>Adjuntá</span>
                  </>
                )}
              </button>

              {/* Menú Desplegable de Documentos Adjuntos (Estilo Gemini) */}
              {isAttachOpen && (
                <div
                  ref={attachDropdownRef}
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-[360px] sm:w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/[0.14] bg-[#0E1013] p-4 shadow-[0px_16px_40px_rgba(0,0,0,0.75)] backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150 text-left"
                >
                  {/* Cabecera idéntica a la captura */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <h4 className="text-xs sm:text-sm font-bold text-[#F7F8F8]">Historial de archivos adjuntos</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAttachOpen(false)}
                      className="p-1 rounded-lg text-[#8A8F98] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                      title="Cerrar"
                      aria-label="Cerrar"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Zona Drag & Drop interactiva */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files) {
                        processFiles(Array.from(e.dataTransfer.files));
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "my-3 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-center cursor-pointer transition-all duration-150",
                      isDragging
                        ? "border-purple-400 bg-purple-500/10"
                        : "border-white/[0.12] bg-[#141619] hover:border-purple-400/50 hover:bg-[#181B1F]"
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.pdf,.docx,.md"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <div className="w-8 h-8 rounded-full bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-300">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#F7F8F8]">
                        Suelta los archivos aquí o <span className="text-purple-400 underline underline-offset-2">explora</span>
                      </p>
                      <p className="text-[10px] text-[#8A8F98] mt-0.5">
                        Acepta .txt, .pdf, .docx y .md (máx. 25 MB)
                      </p>
                    </div>
                  </div>

                  {uploadError && (
                    <div className="mb-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] text-center">
                      {uploadError}
                    </div>
                  )}

                  {/* Lista de archivos adjuntos (similar a la captura) */}
                  <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-0.5">
                    {attachedFiles.length === 0 ? (
                      <p className="py-4 text-center text-xs text-[#8A8F98]">No hay archivos adjuntos aún.</p>
                    ) : (
                      attachedFiles.map((file) => (
                        <div
                          key={file.id}
                          className="group/file flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#141619] p-2.5 hover:bg-[#191C20] hover:border-white/[0.12] transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0">
                              <svg className="w-3.5 h-3.5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[#F7F8F8] truncate" title={file.name}>
                                {file.name}
                              </p>
                              <p className="text-[10px] text-[#8A8F98] truncate">
                                <span className="uppercase font-mono text-[9px] px-1 py-0.2 rounded bg-white/[0.06] text-[#D0D6E0] mr-1">
                                  {file.extension}
                                </span>
                                {file.size} · {file.time}
                              </p>
                            </div>
                          </div>

                          {/* Botón eliminar archivo */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFile(file.id);
                            }}
                            className="p-1 rounded-lg text-[#8A8F98] hover:text-rose-400 hover:bg-rose-950/20 transition-colors opacity-70 group-hover/file:opacity-100 cursor-pointer"
                            title="Eliminar archivo"
                            aria-label="Eliminar archivo"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer con estado de confirmación */}
                  <div className="mt-3 pt-2.5 border-t border-white/[0.08] flex items-center justify-between text-[11px]">
                    <span className="text-[#8A8F98] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{attachedFiles.length} {attachedFiles.length === 1 ? "archivo adjunto" : "archivos adjuntos"}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAttachOpen(false)}
                      className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-semibold text-[11px] hover:brightness-110 transition-all shadow-sm cursor-pointer"
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Botón Conversá */}
            <button
              type="button"
              onClick={handleConversaClick}
              className={cn(baseBtnClass, isConversaActive ? violetBtnClass : blackBtnClass)}
              title="Abrir chat con el tutor"
            >
              <span>Conversá</span>
              <svg className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        );
      })()}

      {/* ──────────────── 3) ACTIVIDAD EN ESPERA / ACTIVIDAD ACTIVA (Mismo tamaño y estructura) ──────────────── */}
      <div className="space-y-1.5 shrink-0">
        <div className="flex justify-end">
          {/* Botón de control docente para simular desbloqueo en la demo */}
          <button
            type="button"
            onClick={() => setIsUnlocked(!isUnlocked)}
            className="text-[10px] sm:text-[11px] font-semibold text-muted hover:text-primary transition-colors underline"
          >
            {isUnlocked ? "Simular: Bloquear" : "Simular: Desbloquear como docente"}
          </button>
        </div>

        {/* Tarjeta con dimensiones, padding y estructura exactamente idénticas en ambos estados */}
        <div
          className={`rounded-2xl p-4 sm:p-5 lg:p-5.5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 transition-colors duration-300 ${
            isUnlocked
              ? "border border-emerald-500/30 bg-emerald-950/20"
              : "border border-line bg-surface-2/40"
          }`}
        >
          <div className="space-y-1.5 flex-1">
            <span
              className={`text-xs font-semibold transition-colors ${
                isUnlocked ? "text-white" : "text-muted"
              }`}
            >
              {isUnlocked ? "Actividad activa" : "Actividad en espera"}
            </span>
            <h3 className="text-sm sm:text-base font-bold text-ink">
              {activity?.title || "Práctica: hipótesis falsables en logística de última milla"}
            </h3>
            <p className="text-xs sm:text-sm text-muted max-w-2xl leading-relaxed line-clamp-2">
              {activity?.description ||
                "Una empresa de logística quiere ofrecer entregas en franjas de una hora, con un costo extra, a clientes de comercios online. No sabe si alguien pagaría por ese servicio."}
            </p>
          </div>

          <div className="shrink-0 sm:ml-auto">
            {isUnlocked ? (
              <Link
                href={`/s/courses/${courseId}/activities`}
                className="w-full sm:w-28 inline-flex items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow hover:bg-primary-hover transition-colors"
              >
                Abrir
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="w-full sm:w-28 inline-flex items-center justify-center rounded-xl bg-surface-3 border border-line/60 px-6 py-2.5 text-xs sm:text-sm font-bold text-muted cursor-not-allowed select-none"
              >
                Abrir
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
