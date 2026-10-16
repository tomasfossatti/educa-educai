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
    <div className="w-full max-w-[900px] mx-auto flex-1 flex flex-col space-y-6 py-2">
      {/* Cabecera */}
      <div className="rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.08)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-medium text-[#27251e] tracking-tight">
              DeepStudent
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full border border-[#016a71]/30 bg-[#016a71]/10 text-[#016a71] font-medium">
              Documentación & Guía
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#72706b] mt-1.5 font-normal leading-relaxed">
            Arquitectura de agentes de aprendizaje local-first, integración de herramientas y resolución socrática.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/s/deep-student"
            className="rounded-xl bg-[#27251e] px-4 py-2 text-xs font-medium text-[#faf8f5] shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-[#3d3b32] transition-colors"
          >
            Abrir Workbench →
          </Link>
          <Link
            href="/s"
            className="rounded-xl border border-[#d1d1cd] bg-[#faf8f5] px-3.5 py-2 text-xs font-normal text-[#72706b] hover:text-[#27251e] hover:border-[#27251e] transition-colors"
          >
            ← Volver al curso
          </Link>
        </div>
      </div>

      {/* Secciones de documentación */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] p-6 space-y-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#016a71]">
            01 · Principio de Aprendizaje Local-First
          </span>
          <h2 className="text-base font-medium text-[#27251e]">Privacidad y Soberanía de Datos</h2>
          <p className="text-xs sm:text-sm text-[#72706b] font-normal leading-relaxed">
            DeepStudent está diseñado con filosofía local-first: los apuntes, borradores y transcripciones se procesan en el entorno del estudiante sin requerir exportación de datos sensibles a servidores de terceros.
          </p>
        </div>

        <div className="rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] p-6 space-y-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#016a71]">
            02 · Agente de Estudio Autónomo
          </span>
          <h2 className="text-base font-medium text-[#27251e]">Descomposición en Fases</h2>
          <p className="text-xs sm:text-sm text-[#72706b] font-normal leading-relaxed">
            En lugar de dar la respuesta final de forma inmediata, el agente guía al estudiante a través de cuatro etapas: diagnóstico del problema, formulación de hipótesis, búsqueda activa de contraejemplos y verificación con evidencia.
          </p>
        </div>

        <div className="rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] p-6 space-y-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#016a71]">
            03 · Integración con Educai
          </span>
          <h2 className="text-base font-medium text-[#27251e]">Alineación Curricular</h2>
          <p className="text-xs sm:text-sm text-[#72706b] font-normal leading-relaxed">
            Las sesiones de DeepStudent consumen directamente los objetivos de aprendizaje configurados por el docente para la clase en curso, garantizando que el razonamiento del alumno refuerce las competencias de la materia.
          </p>
        </div>

        <div className="rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] p-6 space-y-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#016a71]">
            04 · Repositorios de Referencia
          </span>
          <h2 className="text-base font-medium text-[#27251e]">Código Abierto y Comunidad</h2>
          <p className="text-xs sm:text-sm text-[#72706b] font-normal leading-relaxed">
            Inspirado en los proyectos de código abierto de helixnow (DeepStudent) y CaviraOSS (PageLM), combinando la potencia de agentes de estudio con herramientas interactivas de síntesis.
          </p>
        </div>
      </div>
    </div>
  );
}
