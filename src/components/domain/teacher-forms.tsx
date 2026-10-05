"use client";

import type { InterventionType, ReviewVerdict } from "@prisma/client";
import { Checkbox, Field, Input, Radio, Select, Textarea } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { interventionTypeLabel, reviewVerdictLabel } from "@/domain/labels";
import { toDateInputValue } from "@/lib/format";
import { createInterventionAction, reviewInferenceAction } from "@/server/actions/teacher";

const VERDICT_HINT: Record<ReviewVerdict, string> = {
  CONFIRMED: "La evidencia y la conclusión coinciden con lo que observás.",
  PARTIALLY_CORRECT: "Algo es correcto, pero la conclusión exagera o se queda corta.",
  INCORRECT: "La conclusión no corresponde. Deja de mostrarse al estudiante y no cuenta para su snapshot.",
  NEEDS_CONTEXT: "Falta información que Educai no tiene (condiciones, situación personal, consigna).",
};

/** Teacher Review: confirmar, parcialmente correcto, incorrecto o falta contexto. */
export function ReviewForm({ inferenceId, compact = false }: { inferenceId: string; compact?: boolean }) {
  const { state, pending, onSubmit } = useActionForm(reviewInferenceAction);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="inferenceId" value={inferenceId} />
      <fieldset className={compact ? "flex flex-wrap gap-x-4 gap-y-2" : "space-y-2"}>
        <legend className="sr-only">Tu revisión</legend>
        {(Object.keys(reviewVerdictLabel) as ReviewVerdict[]).map((v) => (
          <Radio key={v} name="verdict" value={v} label={reviewVerdictLabel[v]} hint={compact ? undefined : VERDICT_HINT[v]} required />
        ))}
      </fieldset>
      <Field label="Comentario" htmlFor={`comment-${inferenceId}`} optional hint="Obligatorio si marcás «Incorrecto» o «Falta contexto»." error={state?.fieldErrors?.comment}>
        <Textarea id={`comment-${inferenceId}`} name="comment" maxLength={2000} className="min-h-16" />
      </Field>
      <FormMessage state={state} />
      <PendingButton pending={pending} variant="secondary" size="sm">
        Guardar revisión
      </PendingButton>
    </form>
  );
}

export function InterventionForm({
  courseId,
  students,
  activities,
  inferenceId,
  insightKey,
  curriculumItemId,
  suggestion,
}: {
  courseId: string;
  students: { id: string; name: string; selected: boolean }[];
  activities: { id: string; title: string }[];
  inferenceId?: string;
  insightKey?: string;
  curriculumItemId?: string | null;
  suggestion?: string;
}) {
  const { state, pending, onSubmit } = useActionForm(createInterventionAction);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      {inferenceId && <input type="hidden" name="inferenceId" value={inferenceId} />}
      {insightKey && <input type="hidden" name="insightKey" value={insightKey} />}
      {curriculumItemId && <input type="hidden" name="curriculumItemId" value={curriculumItemId} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de intervención" htmlFor="type" error={state?.fieldErrors?.type}>
          <Select id="type" name="type" defaultValue="EXPLAIN">
            {(Object.keys(interventionTypeLabel) as InterventionType[]).map((t) => (
              <option key={t} value={t}>
                {interventionTypeLabel[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha" htmlFor="occurredAt" error={state?.fieldErrors?.occurredAt}>
          <Input id="occurredAt" name="occurredAt" type="date" defaultValue={toDateInputValue()} max={toDateInputValue()} />
        </Field>
      </div>
      <Field label="Qué vas a hacer (o hiciste)" htmlFor="description" error={state?.fieldErrors?.description}>
        <Textarea id="description" name="description" required maxLength={2000} defaultValue={suggestion ?? ""} className="min-h-20" />
      </Field>
      <Field
        label="Mensaje para los estudiantes"
        htmlFor="messageToStudents"
        optional
        hint="Si lo completás, aparece como próximo paso en el inicio de cada estudiante."
        error={state?.fieldErrors?.messageToStudents}
      >
        <Textarea id="messageToStudents" name="messageToStudents" maxLength={2000} className="min-h-16" />
      </Field>
      {activities.length > 0 && (
        <Field label="Proponer una actividad" htmlFor="activityId" optional>
          <Select id="activityId" name="activityId" defaultValue="">
            <option value="">Ninguna</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">Estudiantes</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {students.map((s) => (
            <Checkbox key={s.id} name="studentIds" value={s.id} defaultChecked={s.selected} label={s.name} />
          ))}
        </div>
        {state?.fieldErrors?.studentIds && <p className="text-xs text-danger">{state.fieldErrors.studentIds}</p>}
      </fieldset>
      <FormMessage state={state} />
      <PendingButton pending={pending} pendingText="Registrando…">
        Registrar intervención
      </PendingButton>
    </form>
  );
}
