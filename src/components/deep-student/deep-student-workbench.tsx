"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  runDeepStudentAgentAction,
  type DeepStudentStep,
} from "@/server/actions/deepstudent";

const INITIAL_STEPS: DeepStudentStep[] = [
  {
    id: "step-1",
    phase: "FASE 1: DIAGNÓSTICO",
    title: "Descomposición del problema y contexto",
    content:
      "Analizando el contexto laboral declarado (restaurante en el centro de Rosario). El objetivo es diseñar una prueba de bajo costo para validar si existe disposición de pago por menú ejecutivo saludable sin realizar inversiones de cocina previas.",
    status: "completed",
  },
  {
    id: "step-2",
    phase: "FASE 2: HIPÓTESIS",
    title: "Formulación de supuesto falsable",
    content:
      "Hipótesis: 'Si ofrecemos una preventa manual por WhatsApp a los 40 clientes habituales de la zona bancaria durante 5 días hábiles, al menos 8 confirmarán su pedido anticipado a $7.500'. Métrica: pedidos confirmados. Umbral: 8 (20%). Plazo: 5 días.",
    status: "active",
  },
  {
    id: "step-3",
    phase: "FASE 3: CONTRAEJEMPLOS",
    title: "Búsqueda de sesgos y fallas de diseño",
    content:
      "Riesgo detectado: Sesgo de cortesía. Si el cliente solo dice 'me parece buena idea' sin transferir ni abonar una seña, la prueba no cuenta como validación real.",
    status: "pending",
  },
  {
    id: "step-4",
    phase: "FASE 4: VERIFICACIÓN",
    title: "Protocolo de recolección de evidencia",
    content:
      "Registro en planilla de respuestas afirmativas con seña abonada vs. rechazos o dudas recurrentes.",
    status: "pending",
  },
];

const PRESETS = [
  {
    label: "Restaurante: Menú Saludable",
    topic: "Validación de menú ejecutivo saludable para restaurante céntrico",
    notes:
      "Contexto: Restaurante en Rosario con clientela de oficina.\nObjetivo: Validar demanda de viandas saludables a $7.500 sin comprar equipamiento previo.\nRestricción: Máximo 5 días de prueba piloto.",
  },
  {
    label: "SaaS: Gestión Académica",
    topic: "Software de seguimiento para institutos terciarios",
    notes:
      "Contexto: Directores de institutos con planillas manuales dispersas.\nObjetivo: Validar si pagarían abono mensual de $45.000 por centralizar asistencias.\nRestricción: Prueba con prototipo clickeable en 7 entrevistas.",
  },
  {
    label: "Comercio: Envíos Programados",
    topic: "Servicio de suscripción semanal para verdulería premium",
    notes:
      "Contexto: Barrio residencial con compras semanales recurrentes.\nObjetivo: Validar 15 pedidos semanales fijos con cobro automático.\nRestricción: Comunicar solo por lista de difusión de WhatsApp.",
  },
];

export function DeepStudentWorkbench() {
  const [topic, setTopic] = useState("Validación de menú ejecutivo saludable para restaurante céntrico");
  const [notes, setNotes] = useState(PRESETS[0].notes);
  const [steps, setSteps] = useState<DeepStudentStep[]>(INITIAL_STEPS);
  const [isRunning, setIsRunning] = useState(false);
  const [copiedProtocol, setCopiedProtocol] = useState(false);

  // Cargar de localStorage
  useEffect(() => {
    try {
      const savedTopic = localStorage.getItem("deepstudent_topic");
      const savedNotes = localStorage.getItem("deepstudent_notes");
      if (savedTopic) setTopic(savedTopic);
      if (savedNotes) setNotes(savedNotes);
    } catch {
      // Ignorar
    }
  }, []);

  const handleSaveToStorage = (newTopic: string, newNotes: string) => {
    setTopic(newTopic);
    setNotes(newNotes);
    try {
      localStorage.setItem("deepstudent_topic", newTopic);
      localStorage.setItem("deepstudent_notes", newNotes);
    } catch {
      // Ignorar
    }
  };

  const handleApplyPreset = (p: (typeof PRESETS)[number]) => {
    handleSaveToStorage(p.topic, p.notes);
  };

  /* ──────────────── ACCIÓN: EJECUTAR RAZONAMIENTO COMPLETO CON IA ──────────────── */
  const handleRunAgentReasoning = async () => {
    setIsRunning(true);
    try {
      const res = await runDeepStudentAgentAction({ topic, notes });
      if (res.success && res.steps?.length === 4) {
        setSteps(res.steps);
      }
    } finally {
      setIsRunning(false);
    }
  };

  /* ──────────────── ACCIÓN: AVANZAR SIGUIENTE PASO ──────────────── */
  const handleAdvanceStep = () => {
    setSteps((prev) => {
      const activeIdx = prev.findIndex((s) => s.status === "active");
      if (activeIdx === -1) {
        // Si no hay ninguno activo, activar el primero pendiente
        const pendingIdx = prev.findIndex((s) => s.status === "pending");
        if (pendingIdx !== -1) {
          return prev.map((s, idx) => (idx === pendingIdx ? { ...s, status: "active" } : s));
        }
        return prev;
      }

      return prev.map((s, idx) => {
        if (idx === activeIdx) return { ...s, status: "completed" };
        if (idx === activeIdx + 1) return { ...s, status: "active" };
        return s;
      });
    });
  };

  const handleResetSteps = () => {
    setSteps((prev) =>
      prev.map((s, idx) => ({
        ...s,
        status: idx === 0 ? "completed" : idx === 1 ? "active" : "pending",
      })),
    );
  };

  const handleExportProtocol = () => {
    const text =
      `# Protocolo de Razonamiento DeepStudent: ${topic}\n\n` +
      `## Notas Contextuales\n${notes}\n\n` +
      `## Fases de Razonamiento\n` +
      steps.map((s) => `### ${s.phase} · ${s.title}\nEstado: ${s.status}\n\n${s.content}\n`).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedProtocol(true);
    setTimeout(() => setCopiedProtocol(false), 2000);
  };

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="w-full flex-1 flex flex-col space-y-5 py-2">
      {/* ──────────────── CABECERA DEEPSTUDENT ──────────────── */}
      <div className="rounded-2xl border border-line bg-gradient-to-r from-surface-1 via-surface-2 to-surface-3 p-4 sm:p-5 shadow-lg backdrop-blur-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="text-indigo-400 font-mono">DeepStudent</span>
              <span className="text-xs px-2 py-0.5 rounded-full border border-indigo-400/40 bg-indigo-950/40 text-indigo-300 font-medium tracking-normal">
                AI Learning Workbench
              </span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted max-w-xl">
            Workbench local de aprendizaje autónomo. El agente descompone problemas y proyectos en fases iterativas, falsables y verificables con IA.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/s/deep-student/docs"
            className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-white hover:bg-surface-3 transition-colors"
          >
            Ver documentación →
          </Link>
          <Link
            href="/s"
            className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-white hover:bg-surface-3 transition-colors"
          >
            ← Volver al curso
          </Link>
        </div>
      </div>

      {/* ──────────────── BARRA DE PRESETS Y TEMA DE ESTUDIO ──────────────── */}
      <div className="rounded-xl border border-line bg-surface-1/80 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Casos de estudio predefinidos:
          </span>
          <div className="flex items-center gap-2">
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-[11px] text-muted hover:text-white hover:border-indigo-400/50 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <input
            type="text"
            value={topic}
            onChange={(e) => handleSaveToStorage(e.target.value, notes)}
            placeholder="Definí el tema o desafío a resolver con el agente…"
            className="w-full sm:flex-1 rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-xs sm:text-sm text-white placeholder-muted focus:outline-none focus:border-indigo-400 transition-colors"
          />
          <button
            type="button"
            onClick={handleRunAgentReasoning}
            disabled={isRunning}
            className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-indigo-500 to-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90 shadow-md transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
          >
            {isRunning ? "Analizando con IA…" : "Ejecutar Razonamiento con IA"}
          </button>
        </div>
      </div>

      {/* ──────────────── CONTENIDO DEL WORKBENCH ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 items-start">
        {/* COLUMNA 1 & 2: LÍNEA DE RAZONAMIENTO DEL AGENTE */}
        <div className="lg:col-span-2 rounded-2xl border border-line bg-surface-1/90 p-5 space-y-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-line/60 pb-3 flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white">Línea de Razonamiento del Agente</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono border border-indigo-400/30 bg-indigo-950/40 text-indigo-300">
                  Progreso: {progressPercent}%
                </span>
              </div>
              <p className="text-xs text-muted">Descomposición y resolución guiada paso a paso.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportProtocol}
                className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-white transition-colors"
              >
                {copiedProtocol ? "Copiado ✓" : "Exportar protocolo"}
              </button>
              <button
                type="button"
                onClick={handleAdvanceStep}
                disabled={completedCount === steps.length}
                className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-white hover:bg-primary-hover shadow-md transition-all active:scale-95 disabled:opacity-40"
              >
                Avanzar siguiente paso →
              </button>
            </div>
          </div>

          <div className="space-y-3.5">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className={cn(
                  "rounded-xl border p-4 space-y-2 transition-all",
                  step.status === "completed" && "border-emerald-500/30 bg-emerald-950/20",
                  step.status === "active" && "border-indigo-500/50 bg-indigo-950/20 shadow-md",
                  step.status === "pending" && "border-line/40 bg-surface-2/40 opacity-60",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-300">
                      {step.phase}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      step.status === "completed" && "text-emerald-400 bg-emerald-950/50 border border-emerald-500/30",
                      step.status === "active" && "text-indigo-300 bg-indigo-950/50 border border-indigo-500/30 animate-pulse",
                      step.status === "pending" && "text-muted bg-surface-3",
                    )}
                  >
                    {step.status === "completed" ? "Completado ✓" : step.status === "active" ? "En curso" : "Pendiente"}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white">{step.title}</h3>
                <p className="text-xs text-ink-2 leading-relaxed">{step.content}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-line/40 text-xs text-muted">
            <span>{completedCount} de {steps.length} fases completadas</span>
            <button
              type="button"
              onClick={handleResetSteps}
              className="text-muted hover:text-white transition-colors underline"
            >
              Reiniciar progreso
            </button>
          </div>
        </div>

        {/* COLUMNA 3: SCRATCHPAD / LABORATORIO DE NOTAS */}
        <div className="lg:col-span-1 rounded-2xl border border-line bg-surface-1/90 p-5 space-y-4 shadow-sm">
          <div className="border-b border-line/60 pb-3">
            <h3 className="text-sm font-bold text-white">Laboratorio & Scratchpad</h3>
            <p className="text-[11px] text-muted">Anotaciones, restricciones y supuestos del alumno.</p>
          </div>

          <textarea
            rows={12}
            value={notes}
            onChange={(e) => handleSaveToStorage(topic, e.target.value)}
            className="w-full rounded-xl border border-line bg-surface-2 p-3 text-xs text-white placeholder-muted focus:outline-none focus:border-indigo-400 transition-colors resize-none leading-relaxed"
          />

          <div className="p-3 rounded-xl bg-surface-2/60 border border-line/40 space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-indigo-300">Estado del motor de razonamiento</span>
            <p className="text-[11px] text-muted leading-relaxed">
              El agente ejecuta validaciones socráticas contra supuestos no contrastados y formula umbrales cuantitativos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
