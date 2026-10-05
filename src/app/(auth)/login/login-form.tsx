"use client";

import { Field, Input } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { loginAction } from "@/server/actions/auth";

export function LoginForm() {
  const { state, pending, onSubmit } = useActionForm(loginAction);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Email" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={state?.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <PendingButton pending={pending} className="w-full" pendingText="Ingresando…">
        Ingresar
      </PendingButton>
    </form>
  );
}
