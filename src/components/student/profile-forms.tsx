"use client";

import { ImprovableTextarea } from "@/components/student/improvable-textarea";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { TEXT } from "@/lib/texts";
import { deleteAccountAction, updateContextAction } from "@/server/actions/student";

const L = TEXT.student.profileForm;
const FIELDS = [
  { name: "currentContext", label: TEXT.profile.work, hint: TEXT.profile.workHint, required: false },
  { name: "interests", label: L.interests, hint: TEXT.profile.hints.interests, required: false },
  { name: "goals", label: L.goals, hint: TEXT.profile.hints.goals, required: false },
  { name: "strengths", label: L.strengths, hint: TEXT.profile.hints.strengths, required: false },
  { name: "difficulties", label: L.difficulties, hint: TEXT.profile.hints.difficulties, required: false },
] as const;

type Defaults = Record<(typeof FIELDS)[number]["name"] | "workPreferences", string>;

export function ContextForm({ defaults, focus }: { defaults: Defaults; focus: "WORK" | "PROJECT" }) {
  const { state, pending, onSubmit } = useActionForm(updateContextAction);
  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <FormMessage state={state} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">{TEXT.profile.focusQuestion}</legend>
        <p className="text-xs text-muted">{TEXT.profile.focusHint}</p>
        {(["PROJECT", "WORK"] as const).map((value) => (
          <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="personalizationFocus" value={value} defaultChecked={focus === value} required /> {TEXT.profile.focus[value]}
          </label>
        ))}
        {state?.fieldErrors?.personalizationFocus && <p className="text-xs text-attention">{state.fieldErrors.personalizationFocus}</p>}
      </fieldset>
      {FIELDS.map((f) => (
        <Field key={f.name} label={f.label} htmlFor={f.name} hint={f.hint || undefined} optional={!f.required} error={state?.fieldErrors?.[f.name]}>
          <ImprovableTextarea field={f.name} id={f.name} name={f.name} defaultValue={defaults[f.name]} required={f.required} maxLength={1500} className="min-h-16" />
        </Field>
      ))}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">{L.workPreferences}</legend>
        <p className="text-xs text-muted">{TEXT.profile.hints.workPreferences}</p>
        {TEXT.profile.workPreferenceOptions.map((option) => (
          <Checkbox key={option} name="workPreferences" value={option} label={option} defaultChecked={defaults.workPreferences.split("; ").includes(option)} />
        ))}
      </fieldset>
      <PendingButton pending={pending} pendingText={L.saving} className="min-h-11">
        {L.save}
      </PendingButton>
    </form>
  );
}

export function DeleteAccountForm({ email }: { email: string }) {
  const { state, pending, onSubmit } = useActionForm(deleteAccountAction);
  return (
    <form method="post" onSubmit={onSubmit} className="max-w-md space-y-3">
      <FormMessage state={state} />
      <Field label={L.confirmEmail(email)} htmlFor="confirmEmail" error={state?.fieldErrors?.confirmEmail}>
        <Input id="confirmEmail" name="confirmEmail" type="email" autoComplete="off" required />
      </Field>
      <PendingButton pending={pending} variant="danger" pendingText={L.deleting} className="min-h-11">
        {L.deleteButton}
      </PendingButton>
    </form>
  );
}
