"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface ClassDashboardProps {
  courseId: string;
  courseName: string;
  teacherName: string;
  totalClasses?: number;
  currentClassNumber?: number;
  learningGoal: string;
  personalizedApplication: string;
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
  learningGoal,
  personalizedApplication,
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
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-2.5 py-1.5 text-[11px] text-emerald-300">
              <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="truncate">Hito 1 superado: Segmentación</span>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-2.5 py-1.5 text-[11px] text-emerald-300">
              <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="truncate">Hito 2 superado: Propuesta</span>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] text-primary-soft font-semibold">
              <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse"></span>
              <span className="truncate">Hito 3: En curso hoy</span>
            </div>

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
                recreo en {minutesToBreak} min
              </span>
            ) : (
              <span className="text-white font-semibold">
                segunda parte · termina en {minutesToEnd} min
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

      {/* ──────────────── 3. SECCIÓN DE OBJETIVO ──────────────── */}
      <div className="rounded-3xl border border-line/80 bg-gradient-to-br from-surface-1/95 via-surface-2/80 to-surface-3/60 p-7 sm:p-9 shadow-xl backdrop-blur-xl space-y-4">
        <div className="space-y-2">
          <span className="inline-block text-xs font-semibold tracking-wider text-primary-hover">
            Objetivo de esta clase
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Hoy lograrás dominar cómo:{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-pink-200">
              {learningGoal}
            </span>
          </h1>
        </div>

        {/* ──────────────── 4. PARTE PERSONALIZADA (Refuerzo Positivo y Capacitación) ──────────────── */}
        <div className="rounded-2xl border border-primary/20 bg-primary-soft/40 p-4 sm:p-5 backdrop-blur-md">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Tu impacto directo y capacitación
              </span>
              <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Personalizado a tu contexto
              </span>
            </div>
            <p className="text-sm sm:text-base text-ink font-medium leading-relaxed">
              Al terminar esta clase, tendrás la herramienta exacta para {personalizedApplication}
            </p>
          </div>
        </div>
      </div>

      {/* ──────────────── 5. SECCIÓN HERRAMIENTAS (Bloqueada / Desbloqueada por la docente) ──────────────── */}
      <div className="rounded-2xl border border-line bg-surface/90 p-6 shadow-md backdrop-blur-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
          <div>
            <h2 className="text-lg font-bold text-ink">
              Herramientas y actividades de clase
            </h2>
            <p className="text-xs text-muted">
              Dinámicas guiadas preparadas por Educai para que la docente active durante la sesión.
            </p>
          </div>
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
          /* Estado Bloqueado: Con lenguaje motivador y anticipatorio */
          <div className="rounded-xl border border-dashed border-line-strong bg-surface-2/40 p-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-surface-3 flex items-center justify-center text-muted border border-line">
              <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <p className="font-semibold text-ink text-sm sm:text-base">
                Herramienta lista para activar
              </p>
              <p className="text-xs sm:text-sm text-muted">
                {teacherName} activará esta dinámica práctica en el momento exacto de la clase para que pongas a prueba lo aprendido.
              </p>
            </div>
            <span className="inline-block rounded-full bg-surface-2 border border-line px-3 py-1 text-[11px] font-mono text-muted">
              En espera de la consigna docente
            </span>
          </div>
        ) : (
          /* Estado Desbloqueado */
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Badge tone="success">
                Desbloqueado para la clase de hoy
              </Badge>
              <span className="text-xs text-emerald-400 font-medium">Actividad activa</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">{activity?.title || "Actividad de clase"}</h3>
              <p className="text-sm text-muted mt-1">{activity?.description || "Consigna práctica de aplicación."}</p>
            </div>
            <div className="pt-2">
              <Link
                href={`/s/courses/${courseId}/activities`}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-primary-hover transition-colors"
              >
                Abrir herramienta de trabajo →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ──────────────── 6. RECTÁNGULO: ADJUNTAR CONVERSACIÓN CON LA IA ──────────────── */}
      <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-r from-surface-1 via-surface-2 to-surface-1 p-6 shadow-lg backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-ink">
              Adjuntar conversación con la IA como evidencia
            </h3>
            <p className="text-xs sm:text-sm text-muted max-w-xl">
              Al adjuntar tu sesión de diálogo, Educai analiza tu razonamiento y le comparte a tu docente evidencia de tu progreso sin exponer tus mensajes privados.
            </p>
            {activeConversation && (
              <p className="text-xs font-mono text-primary pt-1">
                Sesión actual: «{activeConversation.title}» ({activeConversation.messageCount} mensajes)
              </p>
            )}
          </div>

          <div className="shrink-0">
            {attached ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-2.5 text-xs font-bold text-emerald-400 shadow">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>¡Gran avance! Evidencia registrada con éxito</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAttach}
                disabled={isAttaching}
                className="inline-flex items-center gap-2 rounded-xl border border-primary bg-primary/20 hover:bg-primary/30 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all active:scale-95"
              >
                {isAttaching ? "Adjuntando evidencia…" : "Adjuntar conversación"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
