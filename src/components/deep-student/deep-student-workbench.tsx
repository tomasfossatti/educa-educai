"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface AgentStep {
  id: string;
  phase: string;
  title: string;
  content: string;
  status: "completed" | "active" | "pending";
}

const INITIAL_STEPS: AgentStep[] = [
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
    status: "completed",
  },
  {
    id: "step-3",
    phase: "FASE 3: CONTRAEJEMPLOS",
    title: "Búsqueda de sesgos y fallas de diseño",
    content:
      "Riesgo detectado: Sesgo de cortesía. Si el cliente solo dice 'me parece buena idea' sin transferir ni abonar una seña, la prueba no cuenta como validación real.",
    status: "active",
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

export function DeepStudentWorkbench() {
  const [steps, setSteps] = useState<AgentStep[]>(INITIAL_STEPS);
  const [isRunning, setIsRunning] = useState(false);
  const [notes, setNotes] = useState(
    "Notas del estudiante sobre el experimento:\n- Definir el menú piloto de 2 opciones máx.\n- Contactar clientes entre las 10:30 y 11:15 am.",
  );

  const handleRunAgentStep = () => {
    setIsRunning(true);
    setTimeout(() => {
      setSteps((prev) =>
        prev.map((s) => {
          if (s.id === "step-3") return { ...s, status: "completed" };
          if (s.id === "step-4") return { ...s, status: "active" };
          return s;
        }),
      );
      setIsRunning(false);
    }, 600);
  };

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
            Workbench local de aprendizaje autónomo. Su agente de estudio descompone problemas complejos en pasos iterativos y verificables.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      {/* ──────────────── CONTENIDO DEL WORKBENCH ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 items-start">
        {/* COLUMNA 1 & 2: FLUJO DEL AGENTE DE ESTUDIO */}
        <div className="lg:col-span-2 rounded-2xl border border-line bg-surface-1/90 p-5 space-y-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-line/60 pb-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">Línea de Razonamiento del Agente</h2>
              <p className="text-xs text-muted">Descomposición y resolución guiada paso a paso.</p>
            </div>

            <button
              type="button"
              onClick={handleRunAgentStep}
              disabled={isRunning}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90 shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {isRunning ? "Procesando…" : "Avanzar siguiente paso"}
            </button>
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
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary">
                      {step.phase}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      step.status === "completed" && "text-emerald-400 bg-emerald-950/50 border border-emerald-500/30",
                      step.status === "active" && "text-indigo-300 bg-indigo-950/50 border border-indigo-500/30",
                      step.status === "pending" && "text-muted bg-surface-3",
                    )}
                  >
                    {step.status === "completed" ? "Completado" : step.status === "active" ? "En análisis" : "Pendiente"}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white">{step.title}</h3>
                <p className="text-xs text-ink-2 leading-relaxed">{step.content}</p>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMNA 3: SCRATCHPAD / LABORATORIO DE NOTAS */}
        <div className="lg:col-span-1 rounded-2xl border border-line bg-surface-1/90 p-5 space-y-4 shadow-sm">
          <div className="border-b border-line/60 pb-3">
            <h3 className="text-sm font-bold text-white">Laboratorio & Scratchpad</h3>
            <p className="text-[11px] text-muted">Anotaciones y supuestos del alumno.</p>
          </div>

          <textarea
            rows={12}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface-2 p-3 text-xs text-white placeholder-muted focus:outline-none focus:border-primary transition-colors resize-none leading-relaxed"
          />

          <div className="p-3 rounded-xl bg-surface-2/60 border border-line/40 space-y-1">
            <span className="text-[10px] font-bold uppercase text-primary">Estado del workbench</span>
            <p className="text-[11px] text-muted">
              Agente conectado al contexto de la Cursada 4. Respuestas deterministas y trazables.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
