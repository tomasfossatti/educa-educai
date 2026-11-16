"use client";

import { useState } from "react";
import { FormMessage, PendingButton, SubmitButton, useActionForm } from "@/components/ui/client";
import { Input, Textarea } from "@/components/ui/field";
import { TEXT } from "@/lib/texts";
import type { ProfilePrompt } from "@/domain/profile-prompts";
import { answerProfilePromptAction, skipProfilePromptAction } from "@/server/actions/student";

/** Una pregunta del perfil, dentro del chat, con "Guardar" y "Saltar". De a una por vez. */
export function ProfilePromptCard({ prompt }: { prompt: ProfilePrompt }) {
  const t = TEXT.student.profilePrompt;
  const { state, pending, onSubmit } = useActionForm(answerProfilePromptAction);
  const [focus, setFocus] = useState<"WORK" | "PROJECT" | null>(null);
  const formId = `perfil-${prompt}`;
  const question = { career: t.career, studyYear: t.year, project: t.project, focus: t.focus }[prompt];

  return (
    <section aria-label={t.title} className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <p className="text-sm text-muted">{t.title}</p>
      <form id={formId} method="post" onSubmit={onSubmit} className="space-y-3">
        <input type="hidden" name="prompt" value={prompt} />
        <FormMessage state={state} />
        {prompt === "focus" ? (
          <fieldset className="space-y-1">
            <legend className="mb-1 text-base font-medium text-ink">{question}</legend>
            {(["PROJECT", "WORK"] as const).map((value) => (
              <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-base text-ink hover:bg-surface-2">
                <input type="radio" name="value" value={value} required onChange={() => setFocus(value)} className="size-5 accent-primary" />
                {TEXT.profile.focus[value]}
              </label>
            ))}
            {focus === "WORK" && (
              <label className="block space-y-1 pt-2 text-sm text-ink">
                <span>{t.workQuestion}</span>
                <Textarea name="currentContext" maxLength={1500} className="min-h-16" />
              </label>
            )}
          </fieldset>
        ) : (
          <label className="block space-y-2">
            <span className="block text-base font-medium text-ink">{question}</span>
            {prompt === "project" ? (
              <Textarea name="value" required maxLength={600} className="min-h-20 text-base" />
            ) : (
              <Input
                name="value"
                required
                inputMode={prompt === "studyYear" ? "numeric" : undefined}
                maxLength={prompt === "studyYear" ? 2 : 120}
                className="h-11 text-base"
              />
            )}
          </label>
        )}
      </form>
      <div className="flex gap-3">
        <PendingButton form={formId} pending={pending} pendingText={t.saving} className="min-h-11 flex-1 text-base">
          {t.save}
        </PendingButton>
        <form action={skipProfilePromptAction.bind(null, prompt)} className="flex-1">
          <SubmitButton variant="secondary" pendingText={t.saving} className="min-h-11 w-full text-base">
            {t.skip}
          </SubmitButton>
        </form>
      </div>
    </section>
  );
}
