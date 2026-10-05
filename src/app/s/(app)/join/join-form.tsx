"use client";

import { Field, Input } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { joinCourseAction } from "@/server/actions/student";

export function JoinForm() {
  const { state, pending, onSubmit } = useActionForm(joinCourseAction);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Código" htmlFor="joinCode" error={state?.fieldErrors?.joinCode}>
        <Input id="joinCode" name="joinCode" required maxLength={8} className="uppercase tracking-widest" autoCapitalize="characters" />
      </Field>
      <PendingButton pending={pending} pendingText="Buscando…">
        Unirme
      </PendingButton>
    </form>
  );
}
