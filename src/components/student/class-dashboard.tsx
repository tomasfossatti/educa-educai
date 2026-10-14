"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
    <div className="space-y-7 pb-24">
      {/* ──────────────── 0. SECCIÓN DE AVANCE DE LA MATERIA (Hover para ver hitos) ──────────────── */}
      <div className="group relative space-y-2">
        <div className="flex items-center justify-between text-xs text-muted">
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
        <div className="max-h-0 opacity-0 overflow-hidden transition-all duration-300 ease-out group-hover:max-h-24 group-hover:opacity-100 group-hover:pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Hito 1: texto en blanco, detalles sutilmente verdes */}
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-2.5 py-1.5 text-[11px]">
              <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="truncate text-white font-medium">Hito 1 superado: Segmentación</span>
            </div>

            {/* Hito 2: texto en blanco, detalles sutilmente verdes */}
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-2.5 py-1.5 text-[11px]">
              <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="truncate text-white font-medium">Hito 2 superado: Propuesta</span>
            </div>

            {/* Hito 3: texto en blanco */}
            <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse"></span>
              <span className="truncate text-white font-medium">Hito 3: En curso hoy</span>
            </div>

            {/* Hito 4 */}
            <div className="flex items-center gap-1.5 rounded-lg border border-line/50 bg-surface-2/40 px-2.5 py-1.5 text-[11px] text-muted">
              <span className="w-2 h-2 rounded-full bg-muted/40 shrink-0"></span>
              <span className="truncate">Hito 4: Validación (Próximo)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────── 0. SECCIÓN "CLASE EN CURSO" ──────────────── */}
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-b from-surface-2/90 to-surface/80 p-4.5 shadow-lg backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Clase en curso
            </span>
          </div>

          <div className="text-xs font-medium">
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
        <div className="grid grid-cols-2 gap-3">
          {/* Bloque 1: solo identificador del bloque */}
          <div className="space-y-1.5">
            <div className="text-[11px] text-muted font-medium">
              <span>Bloque 1</span>
            </div>
            <div className="h-3 w-full rounded-full bg-surface-3/80 border border-line/60 overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_12px_rgba(52,211,153,0.5)] transition-all duration-300"
                style={{ width: `${block1Percent}%` }}
              />
            </div>
          </div>

          {/* Bloque 2: estado bloqueado/desactivado mientras el Bloque 1 esté en progreso */}
          <div
            className={`space-y-1.5 transition-opacity duration-300 ${
              !hasBlock2Started ? "opacity-40 select-none pointer-events-none" : ""
            }`}
          >
            <div className="text-[11px] text-muted font-medium">
              <span>Bloque 2</span>
            </div>
            <div className="h-3 w-full rounded-full bg-surface-3/80 border border-line/60 overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_12px_rgba(52,211,153,0.5)] transition-all duration-300"
                style={{ width: `${block2Percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────── 1) TITULO Y DESCRIPCIÓN + BOTÓN PREGUNTAS GUÍA IA (Espacio al lado del título) ──────────────── */}
      <div className="rounded-3xl border border-line/80 bg-gradient-to-br from-surface-1 via-surface-2/80 to-surface-3/60 p-6 sm:p-8 lg:p-9 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Lado izquierdo: Título principal personalizado y descripción */}
          <div className="space-y-3 flex-1 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Hoy vas a aplicar {effectiveConcept.toLowerCase()} en {effectiveOrg}
            </h1>
            {effectiveDescription && (
              <p className="text-sm sm:text-base text-muted leading-relaxed">
                {effectiveDescription}
              </p>
            )}
          </div>

          {/* Lado derecho: Botón interactivo que rota preguntas cada 30 segundos */}
          <div className="shrink-0 w-full lg:w-80 xl:w-96">
            <button
              type="button"
              onClick={() => handleAskQuestion(CLASS_QUESTIONS[questionIndex])}
              className="w-full text-left group relative flex flex-col justify-between gap-3.5 rounded-2xl border border-primary/30 bg-surface-2/90 hover:bg-surface-3/90 p-5 shadow-md transition-all duration-300 hover:border-primary/60 hover:shadow-[0_0_25px_rgba(120,150,238,0.25)] hover:scale-[1.01] active:scale-[0.99]"
              aria-label="Preguntarle a la IA esta consulta"
            >
              {/* Pregunta más grande */}
              <p className="text-sm sm:text-base font-semibold text-white leading-snug min-h-[48px] transition-opacity duration-300">
                «{CLASS_QUESTIONS[questionIndex]}»
              </p>

              {/* Abajo a la derecha: Preguntale a la IA */}
              <div className="flex justify-end items-center w-full pt-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:text-primary-hover transition-colors">
                  <span>Preguntale a la IA</span>
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ──────────────── 2) BOTONES: "Adjuntá" - "Conversá" (Lado a lado con separación) ──────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 py-1">
        {attached ? (
          <div className="min-w-[140px] inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-7 py-3.5 text-base font-bold text-emerald-400 shadow-lg">
            <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span>Adjuntado</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAttach}
            disabled={isAttaching}
            className="min-w-[140px] inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-primary/50 bg-surface-2 hover:bg-surface-3 px-8 py-3.5 text-base font-bold text-white shadow-xl hover:shadow-[0_0_20px_rgba(120,150,238,0.25)] transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isAttaching ? "Adjuntando…" : "Adjuntá"}
          </button>
        )}

        <button
          type="button"
          onClick={handleOpenChat}
          className="min-w-[140px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-500 px-8 py-3.5 text-base font-bold text-white shadow-xl hover:shadow-[0_0_25px_rgba(120,150,238,0.35)] transition-all active:scale-[0.98]"
        >
          <span>Conversá</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {/* ──────────────── 3) ACTIVIDAD EN ESPERA / ACTIVIDAD ACTIVA (Mismo tamaño y estructura) ──────────────── */}
      <div className="space-y-2">
        <div className="flex justify-end">
          {/* Botón de control docente para simular desbloqueo en la demo */}
          <button
            type="button"
            onClick={() => setIsUnlocked(!isUnlocked)}
            className="text-[11px] font-semibold text-muted hover:text-primary transition-colors underline"
          >
            {isUnlocked ? "Simular: Bloquear" : "Simular: Desbloquear como docente"}
          </button>
        </div>

        {/* Tarjeta con dimensiones, padding y estructura exactamente idénticas en ambos estados */}
        <div
          className={`rounded-2xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors duration-300 ${
            isUnlocked
              ? "border border-emerald-500/30 bg-emerald-950/20"
              : "border border-line bg-surface-2/40"
          }`}
        >
          <div className="space-y-1.5 flex-1">
            <span
              className={`text-sm font-semibold transition-colors ${
                isUnlocked ? "text-white" : "text-muted"
              }`}
            >
              {isUnlocked ? "Actividad activa" : "Actividad en espera"}
            </span>
            <h3 className="text-base sm:text-lg font-bold text-ink">
              {activity?.title || "Práctica: hipótesis falsables en logística de última milla"}
            </h3>
            <p className="text-sm text-muted max-w-2xl leading-relaxed">
              {activity?.description ||
                "Una empresa de logística quiere ofrecer entregas en franjas de una hora, con un costo extra, a clientes de comercios online. No sabe si alguien pagaría por ese servicio."}
            </p>
          </div>

          <div className="shrink-0 sm:ml-auto">
            {isUnlocked ? (
              <Link
                href={`/s/courses/${courseId}/activities`}
                className="w-full sm:w-28 inline-flex items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-primary-hover transition-colors"
              >
                Abrir
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="w-full sm:w-28 inline-flex items-center justify-center rounded-xl bg-surface-3 border border-line/60 px-6 py-2.5 text-sm font-bold text-muted cursor-not-allowed select-none"
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
