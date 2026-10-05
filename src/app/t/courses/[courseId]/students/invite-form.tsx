"use client";

import { Field, Textarea } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { inviteStudentsAction } from "@/server/actions/teacher";

export function InviteForm({ courseId }: { courseId: string }) {
  const { state, pending, onSubmit, ref } = useActionForm(inviteStudentsAction, { resetOnSuccess: true });
  return (
    <form ref={ref} onSubmit={onSubmit} className="max-w-xl space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      <Field label="Emails" htmlFor="emails" hint="Separados por coma o salto de línea." error={state?.fieldErrors?.emails}>
        <Textarea id="emails" name="emails" className="min-h-16" />
      </Field>
      <FormMessage state={state} />
      <PendingButton pending={pending} variant="secondary" size="sm">
        Invitar
      </PendingButton>
    </form>
  );
}
