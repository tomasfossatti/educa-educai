"use client";

import type { StudentStance } from "@prisma/client";
import { Field, Radio, Textarea } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { studentStanceLabel } from "@/domain/labels";
import { respondToInferenceAction } from "@/server/actions/student";

export function StudentResponseForm({ inferenceId }: { inferenceId: string }) {
  const { state, pending, onSubmit, ref } = useActionForm(respondToInferenceAction, { resetOnSuccess: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="max-w-xl space-y-4">
      <input type="hidden" name="inferenceId" value={inferenceId} />
      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">Tu postura</legend>
        {(Object.keys(studentStanceLabel) as StudentStance[]).map((stance) => (
          <Radio key={stance} name="stance" value={stance} label={studentStanceLabel[stance]} required />
        ))}
      </fieldset>
      <Field label="Contexto o comentario" htmlFor="note" optional>
        <Textarea id="note" name="note" maxLength={1500} className="min-h-16" placeholder="Ej.: Esa actividad la hice con muy poco tiempo." />
      </Field>
      <FormMessage state={state} />
      <PendingButton pending={pending} variant="secondary">
        Enviar respuesta
      </PendingButton>
    </form>
  );
}
