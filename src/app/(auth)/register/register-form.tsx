"use client";

import { useState } from "react";
import { Field, Input, Radio } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { registerAction } from "@/server/actions/auth";

export function RegisterForm({ defaultRole }: { defaultRole: "STUDENT" | "TEACHER" }) {
  const { state, pending, onSubmit } = useActionForm(registerAction);
  const [role, setRole] = useState(defaultRole);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormMessage state={state} />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Soy</legend>
        <Radio name="role" value="STUDENT" label="Estudiante" checked={role === "STUDENT"} onChange={() => setRole("STUDENT")} />
        <Radio name="role" value="TEACHER" label="Docente" checked={role === "TEACHER"} onChange={() => setRole("TEACHER")} />
      </fieldset>
      <Field label="Nombre y apellido" htmlFor="name" error={state?.fieldErrors?.name}>
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Contraseña" htmlFor="password" hint="Al menos 10 caracteres." error={state?.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      {role === "TEACHER" && (
        <Field label="Institución" htmlFor="institution" error={state?.fieldErrors?.institution}>
          <Input id="institution" name="institution" required />
        </Field>
      )}
      <PendingButton pending={pending} className="w-full" pendingText="Creando cuenta…">
        Crear cuenta
      </PendingButton>
    </form>
  );
}
