"use client";

import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { Field, Input } from "@/components/ui/field";
import { TEXT } from "@/lib/texts";
import { createClassSessionAction } from "@/server/actions/teacher";

export function CreateClassForm({ courseId, topics }: { courseId: string; topics: { id: string; title: string }[] }) {
  const { state, pending, onSubmit, ref } = useActionForm(createClassSessionAction, { resetOnSuccess: true });
  const t = TEXT.classes;
  return (
    <form ref={ref} method="post" onSubmit={onSubmit} className="max-w-xl space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <FormMessage state={state} />
      <Field label={t.date} htmlFor="date" error={state?.fieldErrors?.date}>
        <Input id="date" name="date" type="date" required />
      </Field>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-ink">{t.topics}</legend>
        {state?.fieldErrors?.topicIds && <p className="text-xs text-danger">{state.fieldErrors.topicIds}</p>}
        {topics.map((topic) => (
          <label key={topic.id} className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" name="topicIds" value={topic.id} /> {topic.title}
          </label>
        ))}
      </fieldset>
      <Field label={t.objective} htmlFor="objective" optional>
        <Input id="objective" name="objective" maxLength={300} placeholder={t.objectivePlaceholder} />
      </Field>
      <PendingButton pending={pending} pendingText={t.creating}>
        {t.create}
      </PendingButton>
    </form>
  );
}
