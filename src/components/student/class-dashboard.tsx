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

const INITIAL_ATTACHED_FILES: AttachedFile[] = [];

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

    for (const f of files) {
      const ext = ("." + f.name.split(".").pop()?.toLowerCase()) as ".txt" | ".pdf" | ".docx" | ".md";
      if (!allowed.includes(ext)) {
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

    if (newItems.length > 0) {
      setAttachedFiles((prev) => [...newItems, ...prev]);
      setAttached(true);
      setIsAttachOpen(false);
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
    <div className="w-full flex-1 flex flex-col justify-between gap-5 sm:gap-6 py-1">
      {/* ──────────────── 0. SECCIÓN DE AVANCE DE LA MATERIA (Hover para ver hitos) ──────────────── */}
      <div className="group relative space-y-1.5 shrink-0">
        <div className="flex items-center justify-between text-[11px] text-[#72706b]">
          <span className="flex items-center gap-1.5 font-normal">
            <span className="w-1.5 h-1.5 rounded-full bg-[#016a71]"></span>
            <span>Avance general de la materia</span>
          </span>
          <span className="font-mono text-[#92918b]">
            Clase {currentClassNumber} de {totalClasses}
          </span>
        </div>

        {/* Barra sutil en Warm Mist y Deep Teal */}
        <div className="h-1.5 w-full rounded-full bg-[#d1d1cd] overflow-hidden cursor-pointer transition-all duration-200 group-hover:h-2">
          <div
            className="h-full rounded-full bg-[#016a71] transition-all duration-500 ease-out"
            style={{ width: `${courseProgressPercent}%` }}
          />
        </div>

        {/* Micro-hitos: visibles al hover */}
        <div className="max-h-0 opacity-0 overflow-hidden transition-all duration-300 ease-out group-hover:max-h-20 group-hover:opacity-100 group-hover:pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Hito 1 */}
            <div className="flex items-center gap-1.5 rounded-full border border-[#016a71]/30 bg-[#f2f8f8] px-2.5 py-1 text-[11px] text-[#016a71]">
              <svg className="w-3 h-3 text-[#016a71] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="truncate font-medium">Hito 1: Segmentación</span>
            </div>

            {/* Hito 2 */}
            <div className="flex items-center gap-1.5 rounded-full border border-[#016a71]/30 bg-[#f2f8f8] px-2.5 py-1 text-[11px] text-[#016a71]">
              <svg className="w-3 h-3 text-[#016a71] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="truncate font-medium">Hito 2: Propuesta</span>
            </div>

            {/* Hito 3 */}
            <div className="flex items-center gap-1.5 rounded-full border border-[#27251e] bg-[#27251e] px-2.5 py-1 text-[11px] text-[#faf8f5]">
              <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>
              <span className="truncate font-medium">Hito 3: En curso hoy</span>
            </div>

            {/* Hito 4 */}
            <div className="flex items-center gap-1.5 rounded-full border border-[#d1d1cd] bg-[#fdfbfa] px-2.5 py-1 text-[11px] text-[#72706b]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d1d1cd] shrink-0"></span>
              <span className="truncate font-normal">Hito 4: Validación</span>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────── 0. SECCIÓN "CLASE EN CURSO" ──────────────── */}
      <div className="rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.08)] shrink-0 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#016a71] px-2.5 py-0.5 text-[11px] font-medium text-white tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              Clase en curso
            </span>
          </div>

          <div className="text-xs font-normal text-[#72706b]">
            {minutesToBreak > 0 ? (
              <span>Recreo en {minutesToBreak} min</span>
            ) : (
              <span>Segunda parte · Termina en {minutesToEnd} min</span>
            )}
          </div>
        </div>

        {/* Dos bloques limpios y sobrios */}
        <div className="grid grid-cols-2 gap-3">
          {/* Bloque 1 */}
          <div className="space-y-1">
            <div className="text-[11px] text-[#72706b] font-normal">
              <span>Bloque 1</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#d1d1cd] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#016a71] transition-all duration-300"
                style={{ width: `${block1Percent}%` }}
              />
            </div>
          </div>

          {/* Bloque 2 */}
          <div
            className={`space-y-1 transition-opacity duration-300 ${
              !hasBlock2Started ? "opacity-40 select-none pointer-events-none" : ""
            }`}
          >
            <div className="text-[11px] text-[#72706b] font-normal">
              <span>Bloque 2</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#d1d1cd] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#016a71] transition-all duration-300"
                style={{ width: `${block2Percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────── 1) TITULO Y DESCRIPCIÓN + BOTÓN PREGUNTAS GUÍA IA ──────────────── */}
      <div className="rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] p-5 sm:p-6 lg:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.08)] shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 sm:gap-6">
          {/* Lado izquierdo: Título principal en weight 500 y descripción */}
          <div className="space-y-2 flex-1 max-w-2xl">
            <h1 className="text-xl sm:text-2xl lg:text-[24px] font-medium tracking-tight text-[#27251e] leading-snug">
              Hoy vas a aplicar {effectiveConcept.toLowerCase()} en {effectiveOrg}
            </h1>
            {effectiveDescription && (
              <p className="text-xs sm:text-sm text-[#72706b] font-normal leading-relaxed line-clamp-2">
                {effectiveDescription}
              </p>
            )}
          </div>

          {/* Lado derecho: Botón rotativo de preguntas */}
          <div className="shrink-0 w-full lg:w-72 xl:w-80">
            <button
              type="button"
              onClick={() => handleAskQuestion(CLASS_QUESTIONS[questionIndex])}
              className="w-full text-left group relative flex flex-col justify-between gap-3 rounded-2xl border border-[#d1d1cd] bg-[#faf8f5] hover:bg-[#fdfbfa] hover:border-[#27251e] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 cursor-pointer"
              aria-label="Preguntarle a la IA esta consulta"
            >
              <p className="text-xs sm:text-sm font-normal text-[#27251e] leading-snug min-h-[42px] transition-opacity duration-300">
                {CLASS_QUESTIONS[questionIndex]}
              </p>

              <div className="flex justify-end items-center w-full min-h-[20px]">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#016a71] transition-colors">
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

      {/* ──────────────── 2) BOTONES: "Generá" - "Adjuntá" - "Conversá" (Ghost / Filled Action) ──────────────── */}
      {(() => {
        const baseBtnClass =
          "min-w-[130px] inline-flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-normal transition-all duration-150 active:scale-[0.99] cursor-pointer";

        const inactiveBtnClass =
          "border border-[#d1d1cd] bg-transparent text-[#72706b] hover:text-[#27251e] hover:border-[#27251e] hover:bg-[#fdfbfa] shadow-none";

        const activeBtnClass =
          "border border-[#27251e] bg-[#27251e] text-[#faf8f5] hover:bg-[#3d3b32] shadow-[0_1px_2px_rgba(0,0,0,0.08)]";

        const isGeneraActive = activeButton === "genera" || isSidebarOpen;
        const isAdjuntaActive = activeButton === "adjunta" || isAttachOpen || attached || attachedFiles.length > 0;
        const isConversaActive = activeButton === "conversa" || isChatOpen;

        return (
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 py-1 shrink-0">
            {/* 1. Botón Generá */}
            <button
              type="button"
              onClick={handleGeneraClick}
              className={cn(baseBtnClass, isGeneraActive ? activeBtnClass : inactiveBtnClass)}
              title="Abrir menú lateral de proyectos y herramientas"
            >
              <svg
                className={cn("w-4 h-4 shrink-0 transition-colors", isGeneraActive ? "text-[#faf8f5]" : "text-[#72706b]")}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <rect width="18" height="18" x="3" y="3" rx="3" strokeWidth={1.8} />
                <path strokeLinecap="round" strokeWidth={1.8} d="M9 3v18" />
              </svg>
              <span>Generá</span>
            </button>

            {/* 2. Botón Adjuntá con Desplegable */}
            <div className="relative">
              <button
                type="button"
                onClick={handleAttachClick}
                className={cn(baseBtnClass, isAdjuntaActive ? activeBtnClass : inactiveBtnClass)}
                title="Adjuntar documentos a la clase"
                aria-expanded={isAttachOpen}
              >
                {attachedFiles.length > 0 ? (
                  <>
                    <svg className="w-4 h-4 text-[#016a71] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Adjuntado</span>
                  </>
                ) : (
                  <>
                    <svg
                      className={cn("w-4 h-4 shrink-0 transition-colors", isAdjuntaActive ? "text-[#faf8f5]" : "text-[#72706b]")}
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

              {/* Menú Desplegable: Dropzone paper-like con 16px radius */}
              {isAttachOpen && (
                <div
                  ref={attachDropdownRef}
                  onClick={() => fileInputRef.current?.click()}
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
                  role="button"
                  tabIndex={0}
                  aria-label="Adjuntá tu conversación con la IA acá"
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2 top-full mt-3 w-[340px] sm:w-[380px] max-w-[calc(100vw-2rem)]",
                    "rounded-2xl border p-6 text-center cursor-pointer transition-colors duration-150 select-none",
                    "shadow-[0px_1px_2px_rgba(0,0,0,0.08)] z-50 animate-in fade-in zoom-in-95",
                    isDragging
                      ? "border-[#016a71] bg-[#f2f8f8]"
                      : "border-[#d1d1cd] bg-[#fdfbfa] hover:bg-[#faf8f5]"
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf,.docx,.md"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div className="flex flex-col items-center justify-center gap-3 pointer-events-none">
                    <div className="w-10 h-10 rounded-xl bg-[#faf8f5] border border-[#d1d1cd] flex items-center justify-center text-[#27251e]">
                      <svg className="w-5 h-5 text-[#72706b]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-[#27251e]">
                      Adjuntá tu conversación con la IA acá
                    </p>
                    <p className="text-xs text-[#72706b]">
                      Formatos compatibles: .pdf, .txt, .docx, .md
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Botón Conversá */}
            <button
              type="button"
              onClick={handleConversaClick}
              className={cn(baseBtnClass, isConversaActive ? activeBtnClass : inactiveBtnClass)}
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

      {/* ──────────────── 3) ACTIVIDAD EN ESPERA / ACTIVIDAD ACTIVA ──────────────── */}
      <div className="space-y-1.5 shrink-0">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setIsUnlocked(!isUnlocked)}
            className="text-xs font-normal text-[#72706b] hover:text-[#016a71] transition-colors underline cursor-pointer"
          >
            {isUnlocked ? "Simular: Bloquear" : "Simular: Desbloquear como docente"}
          </button>
        </div>

        {/* Tarjeta de actividad en Soft Paper */}
        <div
          className={`rounded-2xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.08)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors duration-200 border border-[#d1d1cd] bg-[#fdfbfa]`}
        >
          <div className="space-y-1.5 flex-1">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-none ${
                isUnlocked
                  ? "bg-[#016a71] text-white"
                  : "bg-[#faf8f5] border border-[#d1d1cd] text-[#72706b]"
              }`}
            >
              {isUnlocked ? "Actividad activa" : "Actividad en espera"}
            </span>
            <h3 className="text-base font-medium tracking-tight text-[#27251e]">
              {activity?.title || "Práctica: hipótesis falsables en logística de última milla"}
            </h3>
            <p className="text-xs sm:text-sm text-[#72706b] font-normal max-w-2xl leading-relaxed line-clamp-2">
              {activity?.description ||
                "Una empresa de logística quiere ofrecer entregas en franjas de una hora, con un costo extra, a clientes de comercios online. No sabe si alguien pagaría por ese servicio."}
            </p>
          </div>

          <div className="shrink-0 sm:ml-auto">
            {isUnlocked ? (
              <Link
                href={`/s/courses/${courseId}/activities`}
                className="w-full sm:w-28 inline-flex items-center justify-center rounded-xl bg-[#27251e] px-5 py-2.5 text-xs sm:text-sm font-medium text-[#faf8f5] shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-[#3d3b32] transition-colors"
              >
                Abrir
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="w-full sm:w-28 inline-flex items-center justify-center rounded-xl bg-transparent border border-[#d1d1cd] px-5 py-2.5 text-xs sm:text-sm font-normal text-[#92918b] cursor-not-allowed select-none"
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
