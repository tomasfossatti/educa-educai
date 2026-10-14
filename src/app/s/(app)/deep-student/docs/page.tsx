import type { Metadata } from "next";
import Link from "next/link";
import { requireStudent } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "DeepStudent - Documentación",
  description: "Guía de arquitectura y capacidades de DeepStudent.",
};

export default async function DeepStudentDocsPage() {
  await requireStudent();

  return (
    <div className="w-full flex-1 flex flex-col space-y-6 py-2">
      {/* Cabecera */}
      <div className="rounded-2xl border border-line bg-gradient-to-r from-surface-1 via-surface-2 to-surface-3 p-5 shadow-lg flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>DeepStudent</span>
            <span className="text-xs px-2 py-0.5 rounded-full border border-indigo-400/40 bg-indigo-950/40 text-indigo-300 font-medium">
              Documentación & Guía
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Arquitectura de agentes de aprendizaje local-first, integración de herramientas y resolución socrática.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/s/deep-student"
            className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-white hover:bg-primary-hover transition-colors"
          >
            Abrir Workbench →
          </Link>
          <Link
            href="/s"
            className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-white transition-colors"
          >
            ← Volver al curso
          </Link>
        </div>
      </div>

      {/* Secciones de documentación */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-line bg-surface-1/90 p-5 space-y-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary">
            01 · Principio de Aprendizaje Local-First
          </span>
          <h2 className="text-base font-bold text-white">Privacidad y Soberanía de Datos</h2>
          <p className="text-xs text-muted leading-relaxed">
            DeepStudent está diseñado con filosofía local-first: los apuntes, borradores y transcripciones se procesan en el entorno del estudiante sin requerir exportación de datos sensibles a servidores de terceros.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface-1/90 p-5 space-y-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
            02 · Agente de Estudio Autónomo
          </span>
          <h2 className="text-base font-bold text-white">Descomposición en Fases</h2>
          <p className="text-xs text-muted leading-relaxed">
            En lugar de dar la respuesta final de forma inmediata, el agente guía al estudiante a través de cuatro etapas: diagnóstico del problema, formulación de hipótesis, búsqueda activa de contraejemplos y verificación con evidencia.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface-1/90 p-5 space-y-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
            03 · Integración con Educai
          </span>
          <h2 className="text-base font-bold text-white">Alineación Curricular</h2>
          <p className="text-xs text-muted leading-relaxed">
            Las sesiones de DeepStudent consumen directamente los objetivos de aprendizaje configurados por el docente para la clase en curso, garantizando que el razonamiento del alumno refuerce las competencias de la materia.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface-1/90 p-5 space-y-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400">
            04 · Repositorios de Referencia
          </span>
          <h2 className="text-base font-bold text-white">Código Abierto y Comunidad</h2>
          <p className="text-xs text-muted leading-relaxed">
            Inspirado en los proyectos de código abierto de helixnow (DeepStudent) y CaviraOSS (PageLM), combinando la potencia de agentes de estudio con herramientas interactivas de síntesis.
          </p>
        </div>
      </div>
    </div>
  );
}
