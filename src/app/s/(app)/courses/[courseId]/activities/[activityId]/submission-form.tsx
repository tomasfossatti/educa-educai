"use client";

import type { Confidence, DeclaredAssistance } from "@prisma/client";
import { Field, Radio, Textarea } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import type { ActivityPrompt } from "@/domain/activity";
import { TEXT } from "@/lib/texts";
import { saveSubmissionAction } from "@/server/actions/student";

interface Draft {
  answers: Record<string, string>;
  declaredAssistance: DeclaredAssistance | null;
  assistanceNote: string | null;
  confidence: Confidence | null;
}

export function SubmissionForm({ activityId, prompts, draft }: { activityId: string; prompts: ActivityPrompt[]; draft: Draft | null }) {
  const t = TEXT.student.task;
  const { state, pending, onSubmit } = useActionForm(saveSubmissionAction);
  return (
    <form method="post" onSubmit={onSubmit} className="space-y-6">
      <input type="hidden" name="activityId" value={activityId} />
      {prompts.map((p) => (
        <Field key={p.key} label={p.label} htmlFor={`answer_${p.key}`} hint={p.help || undefined} error={state?.fieldErrors?.[`answer_${p.key}`]}>
          <Textarea id={`answer_${p.key}`} name={`answer_${p.key}`} defaultValue={draft?.answers[p.key] ?? ""} maxLength={8000} className="min-h-32" />
        </Field>
      ))}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">{t.help}</legend>
        <p className="text-xs text-muted">{t.helpHint}</p>
        {(Object.keys(t.helpOptions) as DeclaredAssistance[]).map((value) => (
          <Radio key={value} name="declaredAssistance" value={value} label={t.helpOptions[value]} defaultChecked={draft?.declaredAssistance === value} />
        ))}
        {state?.fieldErrors?.declaredAssistance && <p className="text-xs text-danger">{state.fieldErrors.declaredAssistance}</p>}
      </fieldset>

      <Field label={t.helpNote} htmlFor="assistanceNote" optional>
        <Textarea id="assistanceNote" name="assistanceNote" defaultValue={draft?.assistanceNote ?? ""} maxLength={1000} className="min-h-16" />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">
          {t.sure} <span className="font-normal text-muted">{t.optional}</span>
        </legend>
        <div className="flex flex-wrap gap-4">
          {(Object.keys(t.sureOptions) as Confidence[]).map((value) => (
            <Radio key={value} name="confidence" value={value} label={t.sureOptions[value]} defaultChecked={draft?.confidence === value} />
          ))}
        </div>
      </fieldset>

      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <PendingButton pending={pending} name="intent" value="submit" pendingText={t.submitting} className="min-h-11 px-6">
          {t.submit}
        </PendingButton>
        <PendingButton pending={pending} name="intent" value="draft" variant="secondary" className="min-h-11">
          {t.draft}
        </PendingButton>
      </div>
    </form>
  );
}
