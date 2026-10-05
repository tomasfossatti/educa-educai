"use client";

import { Field, Input, Textarea } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { createCourseAction } from "@/server/actions/teacher";

export function NewCourseForm() {
  const { state, pending, onSubmit } = useActionForm(createCourseAction);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Nombre de la materia" htmlFor="name" error={state?.fieldErrors?.name}>
        <Input id="name" name="name" required maxLength={160} placeholder="Ej.: Estrategia y Validación de Negocios" />
      </Field>
      <Field label="Descripción breve" htmlFor="description" optional error={state?.fieldErrors?.description}>
        <Textarea id="description" name="description" maxLength={1000} className="min-h-20" />
      </Field>
      <PendingButton pending={pending} pendingText="Creando…">
        Crear y cargar programa
      </PendingButton>
    </form>
  );
}
