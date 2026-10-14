"use client";

import { useState } from "react";
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
    id: "challenge-1",
    title: "Challenge de clase: Validación de viandas saludables",
    description: "Definí el segmento objetivo y formulá una hipótesis falsable con métrica, umbral y plazo.",
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
    (learningGoal && learningGoal.includes(":") ? learningGoal.split(":").slice(1).join(":").trim() : "");

  const handleAttach = async () => {
    if (!activeConversation) return;
    setIsAttaching(true);
    await new Promise((r) => setTimeout(r, 600));
    setAttached(true);
    setIsAttaching(false);
  };

  return (
    <div className="space-y-7 pb-24">
      {/* ──────────────── 1. SECCIÓN DE AVANCE DE LA MATERIA (Hover para ver hitos) ──────────────── */}
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

      {/* ──────────────── 2. SECCIÓN "CLASE EN CURSO" ──────────────── */}
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

      {/* ──────────────── 3. TÍTULO PRINCIPAL PERSONALIZADO AL CONTEXTO ONBOARDING ──────────────── */}
      <div className="rounded-3xl border border-line/80 bg-gradient-to-br from-surface-1 via-surface-2/80 to-surface-3/60 p-7 sm:p-9 shadow-xl backdrop-blur-xl space-y-3">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
          Hoy vas a aplicar{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-pink-200">
            {effectiveConcept.toLowerCase()}
          </span>{" "}
          en{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300">
            {effectiveOrg}
          </span>
        </h1>
        {effectiveDescription && (
          <p className="text-sm sm:text-base text-muted leading-relaxed max-w-3xl">
            {effectiveDescription}
          </p>
        )}
      </div>

      {/* ──────────────── 4. SECCIÓN ACTIVIDAD DE CLASE ──────────────── */}
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

        {!isUnlocked ? (
          /* Estado Bloqueado */
          <div className="rounded-2xl border border-dashed border-line-strong bg-surface-2/40 p-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-surface-3 flex items-center justify-center text-muted border border-line">
              <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <p className="font-semibold text-ink text-sm sm:text-base">
                Actividad en espera
              </p>
              <p className="text-xs sm:text-sm text-muted">
                {teacherName} activará esta dinámica práctica en el momento exacto de la clase.
              </p>
            </div>
            <span className="inline-block rounded-full bg-surface-2 border border-line px-3 py-1 text-[11px] font-mono text-muted">
              En espera de la consigna docente
            </span>
          </div>
        ) : (
          /* Estado Desbloqueado: Actividad activa en blanco, botón "Abrir" a la derecha */
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 sm:p-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5">
              <span className="text-sm font-semibold text-white">
                Actividad activa
              </span>
              <h3 className="text-base sm:text-lg font-bold text-ink">
                {activity?.title || "Actividad de clase"}
              </h3>
              <p className="text-sm text-muted max-w-2xl">
                {activity?.description || "Consigna práctica de aplicación."}
              </p>
            </div>
            <div className="shrink-0 sm:ml-auto">
              <Link
                href={`/s/courses/${courseId}/activities`}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-primary-hover transition-colors"
              >
                Abrir
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ──────────────── 5. BOTÓN: ADJUNTÁ CONVERSACIÓN (Sin textos extra) ──────────────── */}
      <div className="flex justify-center pt-2">
        {attached ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-8 py-3.5 text-base font-bold text-emerald-400 shadow-lg">
            <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span>Conversación adjuntada</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAttach}
            disabled={isAttaching}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-primary/50 bg-gradient-to-r from-primary/30 via-primary/20 to-primary/30 hover:from-primary/40 hover:to-primary/40 px-8 py-3.5 text-base font-bold text-white shadow-xl hover:shadow-[0_0_25px_rgba(120,150,238,0.35)] transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isAttaching ? "Adjuntando conversación…" : "Adjuntá conversación"}
          </button>
        )}
      </div>
    </div>
  );
}
