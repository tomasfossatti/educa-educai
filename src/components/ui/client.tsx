"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/forms";
import { Button } from "./button";
import { Notice } from "./layout";

type FormAction = (prev: ActionState | null, formData: FormData) => Promise<ActionState>;

/**
 * Formulario con acción de servidor que NO se resetea al terminar (React 19 resetea
 * los <form action>), para no perder respuestas largas ante un error de validación.
 */
export function useActionForm(action: FormAction, options?: { resetOnSuccess?: boolean }) {
  const [state, dispatch, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const resetOnSuccess = options?.resetOnSuccess ?? false;
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  };
  return { state, pending, ref, onSubmit };
}

export function PendingButton({
  pending,
  pendingText,
  children,
  ...props
}: ComponentProps<typeof Button> & { pending: boolean; pendingText?: string }) {
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? (pendingText ?? "Guardando…") : children}
    </Button>
  );
}

/** Botón de envío con estado pendiente. */
export function SubmitButton({
  children,
  pendingText,
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? (pendingText ?? "Guardando…") : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState | null }) {
  if (!state) return null;
  if (state.error) return <Notice tone="error">{state.error}</Notice>;
  if (state.ok && state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

/** Refresca la página mientras haya trabajo de IA en curso. */
export function AutoRefresh({ active, intervalMs = 3000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);
  return null;
}

/** Botón que pide confirmación antes de enviar su formulario (acciones destructivas o irreversibles). */
export function ConfirmSubmit({ message, children, ...props }: ComponentProps<typeof Button> & { message: string; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      {...props}
    >
      {pending ? "Procesando…" : children}
    </Button>
  );
}
