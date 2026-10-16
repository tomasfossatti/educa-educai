"use client";

import type { Confidence, DeclaredAssistance } from "@prisma/client";
import { Field, Radio, Textarea } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import type { ActivityPrompt } from "@/domain/activity";
import { confidenceLabel, declaredAssistanceLabel } from "@/domain/labels";
import { saveSubmissionAction } from "@/server/actions/student";

interface Draft {
  answers: Record<string, string>;
  declaredAssistance: DeclaredAssistance | null;
  assistanceNote: string | null;
  confidence: Confidence | null;
}

export function SubmissionForm({ activityId, prompts, draft }: { activityId: string; prompts: ActivityPrompt[]; draft: Draft | null }) {
  const { state, pending, onSubmit } = useActionForm(saveSubmissionAction);
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <input type="hidden" name="activityId" value={activityId} />
      {prompts.map((p) => (
        <Field key={p.key} label={p.label} htmlFor={`answer_${p.key}`} hint={p.help || undefined} error={state?.fieldErrors?.[`answer_${p.key}`]}>
          <Textarea id={`answer_${p.key}`} name={`answer_${p.key}`} defaultValue={draft?.answers[p.key] ?? ""} maxLength={8000} className="min-h-32" />
        </Field>
      ))}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">¿Usaste ayuda para responder?</legend>
        <p className="text-xs text-muted">
          No cambia cómo se te evalúa: es contexto para interpretar la evidencia con honestidad (por ejemplo, para no confundir lo que hiciste con lo
          que hizo una IA).
        </p>
        {(Object.keys(declaredAssistanceLabel) as DeclaredAssistance[]).map((value) => (
          <Radio key={value} name="declaredAssistance" value={value} label={declaredAssistanceLabel[value]} defaultChecked={draft?.declaredAssistance === value} />
        ))}
        {state?.fieldErrors?.declaredAssistance && <p className="text-xs text-danger">{state.fieldErrors.declaredAssistance}</p>}
      </fieldset>

      <Field label="Detalle sobre la ayuda" htmlFor="assistanceNote" optional>
        <Textarea id="assistanceNote" name="assistanceNote" defaultValue={draft?.assistanceNote ?? ""} maxLength={1000} className="min-h-16" />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">
          ¿Cuánta confianza tenés en tu respuesta? <span className="font-normal text-muted">(opcional)</span>
        </legend>
        <div className="flex flex-wrap gap-4">
          {(Object.keys(confidenceLabel) as Confidence[]).map((value) => (
            <Radio key={value} name="confidence" value={value} label={confidenceLabel[value]} defaultChecked={draft?.confidence === value} />
          ))}
        </div>
      </fieldset>

      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <PendingButton pending={pending} name="intent" value="submit" pendingText="Enviando…">
          Entregar
        </PendingButton>
        <PendingButton pending={pending} name="intent" value="draft" variant="secondary">
          Guardar borrador
        </PendingButton>
      </div>
    </form>
  );
}
