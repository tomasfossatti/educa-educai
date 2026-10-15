"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { triggerOpenSidebar } from "@/lib/sidebar";

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
}: ClassDashboardProps) {
  // Timer de clase
  const [classElapsedMinutes, setClassElapsedMinutes] = useState(38);
  const totalClassMinutes = 120; // 2 horas
  const breakMinute = 60; // Recreo a la 1 hora

  const [isUnlocked, setIsUnlocked] = useState(activity?.isUnlocked ?? false);
  const [attached, setAttached] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);

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

  const handleAttach = async () => {
    if (!activeConversation) return;
    setIsAttaching(true);
    await new Promise((r) => setTimeout(r, 600));
    setAttached(true);
    setIsAttaching(false);
  };

  const handleOpenChat = () => {
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

      {/* ──────────────── 2) BOTONES: "Generá" - "Adjuntá" - "Conversá" ──────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 py-1 shrink-0">
        {/* Botón Generá: a la izquierda, abre el menú lateral */}
        <button
          type="button"
          onClick={triggerOpenSidebar}
          className="min-w-[140px] inline-flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-[#121414] hover:bg-[#18191B] hover:border-white/[0.22] px-8 py-3 text-sm sm:text-base font-bold text-[#F7F8F8] shadow-sm hover:shadow-[0_0_20px_rgba(255,255,255,0.06)] transition-all active:scale-[0.98] cursor-pointer"
          title="Abrir menú lateral de proyectos y herramientas"
        >
          <svg className="w-4.5 h-4.5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect width="18" height="18" x="3" y="3" rx="2" strokeWidth={1.8} />
            <path strokeLinecap="round" strokeWidth={1.8} d="M9 3v18" />
          </svg>
          <span>Generá</span>
        </button>

        {attached ? (
          <div className="min-w-[140px] inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-7 py-3 text-sm sm:text-base font-bold text-emerald-400 shadow-sm">
            <svg className="w-4.5 h-4.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span>Adjuntado</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAttach}
            disabled={isAttaching}
            className="min-w-[140px] inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/50 bg-surface-2 hover:bg-surface-3 px-8 py-3 text-sm sm:text-base font-bold text-white shadow hover:shadow-[0_0_20px_rgba(120,150,238,0.25)] transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {isAttaching ? "Adjuntando…" : "Adjuntá"}
          </button>
        )}

        <button
          type="button"
          onClick={handleOpenChat}
          className="min-w-[140px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-500 px-8 py-3 text-sm sm:text-base font-bold text-white shadow hover:shadow-[0_0_25px_rgba(120,150,238,0.35)] transition-all active:scale-[0.98] cursor-pointer"
        >
          <span>Conversá</span>
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>

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
