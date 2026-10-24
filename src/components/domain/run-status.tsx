import type { RunStatus } from "@prisma/client";
import { AutoRefresh, SubmitButton } from "@/components/ui/client";
import { Notice } from "@/components/ui/layout";
import { runStatusLabel } from "@/domain/labels";
import { retryRunAction } from "@/server/actions/student";

const STEP_LABEL: Record<string, string> = {
  precheck: "Recibiendo la evidencia",
  observe: "Identificando observaciones",
  signals: "Extrayendo señales y vinculándolas con la currícula",
  evaluate: "Comparando con criterios",
  history: "Contrastando con evidencia anterior",
  infer: "Generando inferencias",
  feedback: "Preparando feedback y próximos pasos",
  persist: "Guardando",
  snapshot: "Actualizando tu snapshot de desarrollo",
};

interface RunLike {
  id: string;
  status: RunStatus;
  steps: unknown;
  error: string | null;
  statusNote: string | null;
}

/** Estado del procesamiento IA de una experiencia (con reintento si falló). */
export function RunStatusPanel({ run, canRetry }: { run: RunLike | null; canRetry: boolean }) {
  if (!run) return null;
  const steps = (Array.isArray(run.steps) ? run.steps : []) as { step: string; status: string; note?: string }[];
  const pending = run.status === "QUEUED" || run.status === "RUNNING";

  if (pending) {
    const last = steps[steps.length - 1];
    return (
      <>
        <AutoRefresh active />
        <Notice title={runStatusLabel[run.status]}>
          <p>Educai está procesando esta experiencia. Puede tardar un minuto; podés seguir navegando.</p>
          {steps.length > 0 && (
            <ol className="mt-2 space-y-0.5 text-xs text-muted">
              {steps.map((s, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{STEP_LABEL[s.step] ?? s.step}</span>
                  {s.note ? ` — ${s.note}` : ""}
                </li>
              ))}
              <li className="text-ink-2">… {last ? "siguiente paso" : "iniciando"}</li>
            </ol>
          )}
        </Notice>
      </>
    );
  }
  if (run.status === "FAILED") {
    return (
      <Notice tone="error" title={runStatusLabel.FAILED}>
        <p>{run.error ?? "Ocurrió un error durante el análisis."} Tu trabajo quedó guardado.</p>
        {canRetry && (
          <form action={retryRunAction.bind(null, run.id)} className="mt-2">
            <SubmitButton size="sm" variant="secondary" pendingText="Reintentando…">
              Reintentar análisis
            </SubmitButton>
          </form>
        )}
      </Notice>
    );
  }
  if (run.status === "INSUFFICIENT") {
    return (
      <Notice title="Todavía no hay evidencia suficiente">
        {run.statusNote ?? "Esta experiencia no alcanzó para generar evidencia."}
      </Notice>
    );
  }
  if (run.status === "SKIPPED") {
    return <Notice title={runStatusLabel.SKIPPED}>{run.statusNote}</Notice>;
  }
  return null;
}
