"use client";

import { useEffect, useState } from "react";
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
  // Timer de clase: 8:30 a 10:30 (ejemplo de 2 horas con recreo intermedio)
  const [classElapsedMinutes, setClassElapsedMinutes] = useState(38);
  const totalClassMinutes = 120; // 2 horas
  const breakMinute = 60; // Recreo a la 1 hora

  const [isUnlocked, setIsUnlocked] = useState(activity?.isUnlocked ?? false);
  const [attached, setAttached] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);

  // Progreso sutil de la materia
  const courseProgressPercent = Math.round((currentClassNumber / totalClasses) * 100);

  // Cálculos de la clase
  const block1Percent = Math.min(100, Math.round((Math.min(classElapsedMinutes, 60) / 60) * 100));
  const block2Percent = classElapsedMinutes > 60
    ? Math.min(100, Math.round(((classElapsedMinutes - 60) / 60) * 100))
    : 0;
  
  const minutesToBreak = Math.max(0, breakMinute - classElapsedMinutes);
  const minutesToEnd = Math.max(0, totalClassMinutes - classElapsedMinutes);

  const handleAttach = async () => {
    if (!activeConversation) return;
    setIsAttaching(true);
    // Simular o ejecutar adjuntar
    await new Promise((r) => setTimeout(r, 600));
    setAttached(true);
    setIsAttaching(false);
  };

  return (
    <div className="space-y-7 pb-24">
      {/* ──────────────── 1. BARRA SUTIL DE AVANCE DE LA MATERIA (Arriba del todo) ──────────────── */}
      <div className="space-y-1.5 opacity-85 hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70"></span>
            <span>Avance general de la materia</span>
          </span>
          <span className="font-mono font-medium text-ink-2">
            Clase {currentClassNumber} de {totalClasses} · {courseProgressPercent}% completado
          </span>
        </div>
        {/* Barra fina, sutil, discreta */}
        <div className="h-1.5 w-full rounded-full bg-surface-2 border border-line/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500 ease-out"
            style={{ width: `${courseProgressPercent}%` }}
          />
        </div>
      </div>

      {/* ──────────────── 2. BARRA VISIBLE CON COLOR FUERTE (Tiempo restante de clase y recreo) ──────────────── */}
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-b from-surface-2/90 to-surface/80 p-4.5 shadow-lg backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Clase en curso (8:30 a 10:30)
            </span>
          </div>
          <div className="text-xs font-medium text-ink-2">
            {minutesToBreak > 0 ? (
              <span className="text-amber-300 font-semibold">
                ☕ Recreo en {minutesToBreak} min
              </span>
            ) : (
              <span className="text-emerald-300">
                Segunda parte · Termina en {minutesToEnd} min
              </span>
            )}
          </div>
        </div>

        {/* Dos barras de 1 hora cada una */}
        <div className="grid grid-cols-2 gap-3">
          {/* Bloque 1: Primera Hora (8:30 a 9:30) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted">
              <span>Bloque 1 (1ra hora)</span>
              <span className="font-mono text-ink-2">{block1Percent}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-surface-3/80 border border-line/60 overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_12px_rgba(52,211,153,0.5)] transition-all duration-300"
                style={{ width: `${block1Percent}%` }}
              />
            </div>
          </div>

          {/* Bloque 2: Segunda Hora (9:30 a 10:30) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted">
              <span>Bloque 2 (2da hora)</span>
              <span className="font-mono text-ink-2">{block2Percent}%</span>
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

      {/* ──────────────── 3. TÍTULO GRANDE GENERAL: HOY VAS A ENTENDER CÓMO... ──────────────── */}
      <div className="rounded-3xl border border-line/80 bg-gradient-to-br from-surface-1/95 via-surface-2/80 to-surface-3/60 p-7 sm:p-9 shadow-xl backdrop-blur-xl space-y-4">
        <div className="space-y-2">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary-hover">
            🎯 Objetivo central de la clase de hoy
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Hoy vas a entender cómo:{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-pink-200">
              {learningGoal}
            </span>
          </h1>
        </div>

        {/* ──────────────── 4. PARTE PERSONALIZADA (TU TRABAJO / NEGOCIO) ──────────────── */}
        <div className="rounded-2xl border border-primary/20 bg-primary-soft/40 p-4 sm:p-5 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <span className="text-xl sm:text-2xl mt-0.5">💡</span>
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Aplicación personalizada a tu perfil
              </span>
              <p className="text-sm sm:text-base text-ink font-medium leading-relaxed">
                Vas a poder {personalizedApplication}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────── 5. SECCIÓN HERRAMIENTAS (Bloqueada / Desbloqueada por el docente) ──────────────── */}
      <div className="rounded-2xl border border-line bg-surface/90 p-6 shadow-md backdrop-blur-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
          <div>
            <h2 className="text-lg font-bold text-ink flex items-center gap-2">
              🛠️ Herramientas y actividades de clase
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
          /* Estado Bloqueado */
          <div className="rounded-xl border border-dashed border-line-strong bg-surface-2/40 p-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-surface-3 flex items-center justify-center text-muted border border-line">
              <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <p className="font-semibold text-ink text-sm sm:text-base">
                Herramienta en espera
              </p>
              <p className="text-xs sm:text-sm text-muted">
                {teacherName} habilitará esta sección cuando comience la dinámica práctica en clase.
              </p>
            </div>
            <span className="inline-block rounded-full bg-surface-2 border border-line px-3 py-1 text-[11px] font-mono text-muted">
              🔒 Bloqueado por la docente
            </span>
          </div>
        ) : (
          /* Estado Desbloqueado */
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Badge tone="success">
                🟢 Desbloqueado para la clase de hoy
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
            <div className="flex items-center gap-2">
              <span className="text-lg">📎</span>
              <h3 className="text-base font-bold text-ink">
                Adjuntar conversación con la IA como evidencia
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-muted max-w-xl">
              Al adjuntar tu sesión de diálogo socrático, Educai analiza tu razonamiento y le comparte a tu docente evidencia de tu progreso sin exponer tus mensajes privados.
            </p>
            {activeConversation && (
              <p className="text-xs font-mono text-primary pt-1">
                Sesión actual: «{activeConversation.title}» ({activeConversation.messageCount} mensajes)
              </p>
            )}
          </div>

          <div className="shrink-0">
            {attached ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-2.5 text-xs font-bold text-emerald-400 shadow">
                ✓ Conversación adjuntada con éxito
              </span>
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
