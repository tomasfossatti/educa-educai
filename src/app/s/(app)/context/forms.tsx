"use client";

import { Field, Input, Textarea } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { deleteAccountAction, updateContextAction } from "@/server/actions/student";

const FIELDS = [
  { name: "currentContext", label: "Contexto actual", hint: "Trabajo, organización, rol, proyectos.", required: true },
  { name: "interests", label: "Intereses", hint: "Problemas, industrias, disciplinas, actividades.", required: false },
  { name: "goals", label: "Objetivos", hint: "Qué querés desarrollar o lograr.", required: true },
  { name: "strengths", label: "Fortalezas que percibís", hint: "", required: false },
  { name: "difficulties", label: "Dificultades que percibís", hint: "", required: false },
  { name: "workPreferences", label: "Cómo preferís trabajar", hint: "", required: false },
] as const;

type Defaults = Record<(typeof FIELDS)[number]["name"], string>;

export function ContextForm({ defaults }: { defaults: Defaults }) {
  const { state, pending, onSubmit } = useActionForm(updateContextAction);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormMessage state={state} />
      {FIELDS.map((f) => (
        <Field key={f.name} label={f.label} htmlFor={f.name} hint={f.hint || undefined} optional={!f.required} error={state?.fieldErrors?.[f.name]}>
          <Textarea id={f.name} name={f.name} defaultValue={defaults[f.name]} required={f.required} maxLength={1500} className="min-h-16" />
        </Field>
      ))}
      <PendingButton pending={pending}>Guardar cambios</PendingButton>
    </form>
  );
}

export function DeleteAccountForm({ email }: { email: string }) {
  const { state, pending, onSubmit } = useActionForm(deleteAccountAction);
  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-3">
      <FormMessage state={state} />
      <Field label={`Para confirmar, escribí tu email (${email})`} htmlFor="confirmEmail" error={state?.fieldErrors?.confirmEmail}>
        <Input id="confirmEmail" name="confirmEmail" type="email" autoComplete="off" required />
      </Field>
      <PendingButton pending={pending} variant="danger" pendingText="Eliminando…">
        Eliminar cuenta y datos
      </PendingButton>
    </form>
  );
}
