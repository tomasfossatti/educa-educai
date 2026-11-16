"use client";

import { Field, Textarea } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { TEXT } from "@/lib/texts";
import { respondToInferenceAction } from "@/server/actions/student";

const STANCES = ["AGREE", "DISAGREE", "MISSING_CONTEXT"] as const;

export function StudentResponseForm({ inferenceId }: { inferenceId: string }) {
  const t = TEXT.student.conclusion;
  const { state, pending, onSubmit, ref } = useActionForm(respondToInferenceAction, { resetOnSuccess: true });
  return (
    <form ref={ref} method="post" onSubmit={onSubmit} className="max-w-xl space-y-4">
      <input type="hidden" name="inferenceId" value={inferenceId} />
      <fieldset className="space-y-1">
        <legend className="sr-only">{t.stanceLegend}</legend>
        {STANCES.map((stance) => (
          <label key={stance} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-base text-ink hover:bg-surface-2">
            <input type="radio" name="stance" value={stance} required className="size-5 shrink-0 accent-primary" />
            {t.stance[stance]}
          </label>
        ))}
      </fieldset>
      <Field label={t.note} htmlFor="note" optional>
        <Textarea id="note" name="note" maxLength={1500} className="min-h-16" placeholder={t.notePlaceholder} />
      </Field>
      <FormMessage state={state} />
      <PendingButton pending={pending} pendingText={t.sending} className="min-h-11 px-6">
        {t.send}
      </PendingButton>
    </form>
  );
}
