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
  // Timer de clase
  const [classElapsedMinutes, setClassElapsedMinutes] = useState(38);
  const totalClassMinutes = 120; // 2 horas
  const breakMinute = 60; // Recreo a la 1 hora

  const [isUnlocked, setIsUnlocked] = useState(activity?.isUnlocked ?? false);
  const [attached, setAttached] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);

  // 1. Efecto Gradiente de Meta (Goal-Gradient Effect)
  const courseProgressPercent = Math.round((currentClassNumber / totalClasses) * 100);
  const courseProgressHeadline =
    courseProgressPercent === 50
      ? "¡Medio camino completado! Vas a excelente ritmo."
      : courseProgressPercent > 50
      ? `¡Ya completaste el ${courseProgressPercent}% de la materia! Estás a paso firme de la meta.`
      : `¡Ya avanzaste el ${courseProgressPercent}% de la materia! Vas a excelente ritmo.`;

  // 2. Efecto de Progreso Otorgado (Endowed Progress Effect)
  // El estudiante no arranca de cero: cuenta con un 10% otorgado por iniciar sesión y encuadre
  const endowedBonus = 10;
  const block1Percent = Math.min(
    100,
    Math.round(endowedBonus + (Math.min(classElapsedMinutes, 60) / 60) * (100 - endowedBonus))
  );
  const isBlock1Done = classElapsedMinutes >= 60;

  const hasBlock2Started = classElapsedMinutes > 60;
  const block2Percent = hasBlock2Started
    ? Math.min(
        100,
        Math.round(endowedBonus + ((classElapsedMinutes - 60) / 60) * (100 - endowedBonus))
      )
    : 0;

  // 3. Reencuadre Cognitivo del Tiempo y Pausas (Reframing)
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
      {/* ──────────────── 1. BARRA SUTIL DE AVANCE + MICRO-HITOS (Goal-Gradient Effect) ──────────────── */}
      <div className="space-y-2 opacity-90 hover:opacity-100 transition-opacity">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            <span>Avance general de la materia</span>
          </span>
          <span className="font-semibold text-emerald-400">
            Clase {currentClassNumber} de {totalClasses} · {courseProgressHeadline}
          </span>
        </div>

        {/* Barra sutil y discreta */}
        <div className="h-1.5 w-full rounded-full bg-surface-2 border border-line/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/60 via-primary to-emerald-400 transition-all duration-500 ease-out"
            style={{ width: `${courseProgressPercent}%` }}
          />
        </div>

        {/* Micro-hitos (Logros alcanzados que generan picos de dopamina) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
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

      {/* ──────────────── 2. BARRA VISIBLE CON COLOR FUERTE (Tiempo, Recreo ganado y Progreso otorgado) ──────────────── */}
      <div className="rounded-2xl border border-primary/25 bg-gradient-to-b from-surface-2/90 to-surface/80 p-4.5 shadow-lg backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Clase en curso
            </span>
            {/* Feedback visual directo de progreso otorgado */}
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Paso inicial completado (+10%)
            </span>
          </div>

          {/* Reencuadre cognitivo del descanso como recompensa ganada */}
          <div className="text-xs">
            {minutesToBreak > 0 ? (
              <span className="text-white font-semibold">
                Tu descanso ganado en {minutesToBreak} min
              </span>
            ) : (
              <span className="text-white font-semibold">
                Segunda parte · Meta de clase en {minutesToEnd} min de foco
              </span>
            )}
          </div>
        </div>

        {/* Dos bloques con lenguaje de avance y no de vacío */}
        <div className="grid grid-cols-2 gap-3">
          {/* Bloque 1 */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-muted flex items-center gap-1">
                {isBlock1Done ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Bloque 1 superado
                  </span>
                ) : (
                  <span>Bloque 1 · ¡Gran avance!</span>
                )}
              </span>
              <span className="font-mono text-emerald-400 font-medium">{block1Percent}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-surface-3/80 border border-line/60 overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_12px_rgba(52,211,153,0.5)] transition-all duration-300"
                style={{ width: `${block1Percent}%` }}
              />
            </div>
          </div>

          {/* Bloque 2: Redacción positiva (Tu siguiente logro / Listo para comenzar) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-muted">
                {hasBlock2Started ? (
                  block2Percent >= 100 ? "¡Bloque 2 superado!" : "Bloque 2 en desarrollo"
                ) : (
                  <span className="text-ink-2 font-medium">Bloque 2: Tu siguiente logro</span>
                )}
              </span>
              <span className="font-mono text-ink-2">
                {hasBlock2Started ? `${block2Percent}%` : "Listo para comenzar"}
              </span>
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

      {/* ──────────────── 3. TÍTULO GRANDE GENERAL: HOY LOGRARÁS DOMINAR CÓMO... (Autoeficacia) ──────────────── */}
      <div className="rounded-3xl border border-line/80 bg-gradient-to-br from-surface-1/95 via-surface-2/80 to-surface-3/60 p-7 sm:p-9 shadow-xl backdrop-blur-xl space-y-4">
        <div className="space-y-2">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary-hover">
            Objetivo central de la clase de hoy
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

        {/* ──────────────── Feedback visual de sub-tareas completadas (Endowed Progress) ──────────────── */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="flex items-center gap-2 rounded-xl bg-surface-2/60 border border-emerald-500/20 px-3 py-2 text-xs text-ink">
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="font-semibold text-emerald-300">¡Gran avance! Encuadre listo</p>
              <p className="text-[10px] text-muted">Sesión iniciada (+10% otorgado)</p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-surface-2/60 border border-primary/25 px-3 py-2 text-xs text-ink">
            <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-ping"></span>
            <div>
              <p className="font-semibold text-white">Comprensión en acción</p>
              <p className="text-[10px] text-muted">Explorando hipótesis y métricas</p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-surface-2/60 border border-line px-3 py-2 text-xs text-muted">
            <span className="w-2 h-2 rounded-full bg-muted/40 shrink-0"></span>
            <div>
              <p className="font-semibold text-ink-2">Validación práctica</p>
              <p className="text-[10px] text-muted">Evidencia lista para adjuntar</p>
            </div>
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

      {/* ──────────────── 6. RECTÁNGULO: ADJUNTAR CONVERSACIÓN CON LA IA (Feedback directo) ──────────────── */}
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
