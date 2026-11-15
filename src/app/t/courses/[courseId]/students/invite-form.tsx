"use client";

import { Field, Input, Textarea } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { inviteStudentsAction } from "@/server/actions/teacher";

export function InviteForm({ courseId }: { courseId: string }) {
  const { state, pending, onSubmit, ref } = useActionForm(inviteStudentsAction, { resetOnSuccess: true });
  return (
    <form ref={ref} method="post" onSubmit={onSubmit} className="max-w-xl space-y-3" encType="multipart/form-data">
      <input type="hidden" name="courseId" value={courseId} />
      <Field label="Emails" htmlFor="emails" hint="Separados por coma o salto de línea. También podés pegar filas de una planilla: se toman solo los emails." error={state?.fieldErrors?.emails}>
        <Textarea id="emails" name="emails" className="min-h-16" />
      </Field>
      <Field label="O subí un CSV" htmlFor="csv" optional hint="Cualquier CSV con una columna de emails (por ejemplo, el listado de inscriptos)." error={state?.fieldErrors?.csv}>
        <Input id="csv" name="csv" type="file" accept=".csv,text/csv" className="h-auto py-1.5" />
      </Field>
      <FormMessage state={state} />
      <PendingButton pending={pending} variant="secondary" size="sm">
        Invitar
      </PendingButton>
    </form>
  );
}
