"use client";

import { Field, Input } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { TEXT } from "@/lib/texts";
import { joinCourseAction } from "@/server/actions/student";

export function JoinForm({ defaultCode, autoFocus }: { defaultCode?: string; autoFocus?: boolean }) {
  const t = TEXT.student.noCourse;
  const { state, pending, onSubmit } = useActionForm(joinCourseAction);
  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <FormMessage state={state} />
      <Field label={t.code} htmlFor="joinCode" error={state?.fieldErrors?.joinCode}>
        <Input
          id="joinCode"
          name="joinCode"
          defaultValue={defaultCode}
          required
          maxLength={8}
          autoFocus={autoFocus}
          className="h-11 text-base uppercase tracking-widest"
          autoCapitalize="characters"
        />
      </Field>
      <PendingButton pending={pending} pendingText={t.joining} className="min-h-11 w-full px-6 text-base sm:w-auto">
        {t.join}
      </PendingButton>
    </form>
  );
}
