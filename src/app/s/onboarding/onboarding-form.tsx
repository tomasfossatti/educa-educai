"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { Notice } from "@/components/ui/layout";
import { cn } from "@/lib/cn";
import { completeOnboardingAction } from "@/server/actions/student";

const STEPS = ["Cómo funciona", "Tu contexto", "Intereses y objetivos", "Cómo te ves", "Tu materia"] as const;

const FIELD_STEP: Record<string, number> = {
  currentContext: 1,
  interests: 2,
  goals: 2,
  strengths: 3,
  difficulties: 3,
  workPreferences: 3,
  joinCode: 4,
};

export function OnboardingForm({
  firstName,
  invites,
}: {
  firstName: string;
  invites: { id: string; courseName: string; teacherName: string }[];
}) {
  const { state, pending, ref: formRef, onSubmit } = useActionForm(completeOnboardingAction);
  const [step, setStep] = useState(0);

  // Ante un error del servidor, volver al paso que contiene el primer campo con error.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    const firstError = Object.keys(state?.fieldErrors ?? {})[0];
    if (firstError && FIELD_STEP[firstError] !== undefined) setStep(FIELD_STEP[firstError]);
  }

  function next() {
    // Validación nativa de los campos visibles antes de avanzar.
    const visible = formRef.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(`[data-step="${step}"] [required]`);
    for (const el of visible ?? []) {
      if (!el.reportValidity()) return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  const panel = (index: number) => cn("space-y-5", step !== index && "hidden");

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-8" noValidate={false}>
      <div>
        <p className="text-xs text-muted">
          Paso {step + 1} de {STEPS.length} · {STEPS[step]}
        </p>
        <div className="mt-2 flex gap-1" aria-hidden>
          {STEPS.map((_, i) => (
            <div key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-line")} />
          ))}
        </div>
      </div>

      <FormMessage state={state} />

      <section data-step="0" className={panel(0)}>
        <h1 className="text-xl font-semibold">Hola, {firstName}</h1>
        <div className="space-y-3 text-sm text-ink-2">
          <p>
            Educai observa la evidencia que generás mientras aprendés —tus conversaciones con el tutor y tus actividades— para ayudarte a
            entender qué estás desarrollando y qué conviene practicar después.
          </p>
          <p>
            Educai separa siempre <strong className="text-ink">lo que declarás</strong>, <strong className="text-ink">lo que hacés</strong> y{" "}
            <strong className="text-ink">lo que infiere</strong>. Sus conclusiones son hipótesis: podés ver la evidencia detrás de cada una,
            cuestionarlas y corregir tu información cuando quieras.
          </p>
        </div>
        <Notice title="Quién ve qué">
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>Tus conversaciones completas: solo vos.</li>
            <li>Evidencia (fragmentos de lo que produjiste) e inferencias: vos y el docente de esa materia.</li>
            <li>Lo que declares en este formulario: vos, y tu docente solo si lo autorizás.</li>
          </ul>
        </Notice>
        <div className="space-y-3">
          <Checkbox
            name="consent"
            label="Acepto que Educai analice mis conversaciones con el tutor y mis entregas en esta plataforma para generar evidencia y feedback."
            hint="Si no aceptás, igual podés usar el tutor y entregar actividades, pero no vas a recibir feedback basado en evidencia. Podés cambiarlo después."
            defaultChecked
          />
          <Checkbox
            name="shareContext"
            label="Compartir con mis docentes lo que declare sobre mi contexto, intereses y objetivos."
            hint="Les ayuda a proponer ejemplos y actividades más relevantes."
          />
        </div>
      </section>

      <section data-step="1" className={panel(1)}>
        <div>
          <h2 className="text-lg font-semibold">Tu contexto actual</h2>
          <p className="mt-1 text-sm text-ink-2">Sirve para que los ejemplos tengan relación con lo que vivís. No es una evaluación.</p>
        </div>
        <Field
          label="¿En qué estás hoy?"
          htmlFor="currentContext"
          hint="Trabajo, organización, industria, rol, proyectos o emprendimientos."
          error={state?.fieldErrors?.currentContext}
        >
          <Textarea id="currentContext" name="currentContext" required minLength={3} maxLength={1500} placeholder="Ej.: Trabajo en el área comercial de un restaurante y estoy armando un emprendimiento de catering." />
        </Field>
      </section>

      <section data-step="2" className={panel(2)}>
        <h2 className="text-lg font-semibold">Intereses y objetivos</h2>
        <Field label="¿Qué te interesa?" htmlFor="interests" hint="Problemas, industrias, disciplinas, tipos de actividad." optional error={state?.fieldErrors?.interests}>
          <Textarea id="interests" name="interests" maxLength={1500} />
        </Field>
        <Field
          label="¿Qué querés lograr?"
          htmlFor="goals"
          hint="Capacidades que querés desarrollar, roles o proyectos a futuro."
          error={state?.fieldErrors?.goals}
        >
          <Textarea id="goals" name="goals" required minLength={3} maxLength={1500} />
        </Field>
      </section>

      <section data-step="3" className={panel(3)}>
        <div>
          <h2 className="text-lg font-semibold">Cómo te ves hoy</h2>
          <p className="mt-1 text-sm text-ink-2">
            Es tu punto de partida declarado. Más adelante vas a poder contrastarlo con lo que muestra la evidencia.
          </p>
        </div>
        <Field label="¿En qué te sentís fuerte?" htmlFor="strengths" optional error={state?.fieldErrors?.strengths}>
          <Textarea id="strengths" name="strengths" maxLength={1500} />
        </Field>
        <Field label="¿Qué te cuesta?" htmlFor="difficulties" optional error={state?.fieldErrors?.difficulties}>
          <Textarea id="difficulties" name="difficulties" maxLength={1500} />
        </Field>
        <Field label="¿Cómo preferís trabajar?" htmlFor="workPreferences" optional error={state?.fieldErrors?.workPreferences}>
          <Textarea id="workPreferences" name="workPreferences" maxLength={1500} className="min-h-16" />
        </Field>
      </section>

      <section data-step="4" className={panel(4)}>
        <h2 className="text-lg font-semibold">Tu materia</h2>
        {invites.length > 0 && (
          <Notice title="Tenés invitaciones pendientes">
            <ul className="mt-1 space-y-0.5">
              {invites.map((i) => (
                <li key={i.id}>
                  {i.courseName} · {i.teacherName}
                </li>
              ))}
            </ul>
            <p className="mt-1">Vas a poder aceptarlas en tu inicio.</p>
          </Notice>
        )}
        <Field
          label="Código de la materia"
          htmlFor="joinCode"
          hint="Tu docente te lo comparte. Si no lo tenés ahora, podés sumarte después."
          optional
          error={state?.fieldErrors?.joinCode}
        >
          <Input id="joinCode" name="joinCode" maxLength={8} autoCapitalize="characters" className="uppercase tracking-widest" />
        </Field>
      </section>

      <div className="flex items-center justify-between border-t border-line pt-4">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Atrás
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Continuar
          </Button>
        ) : (
          <PendingButton pending={pending} pendingText="Guardando…">
            Empezar
          </PendingButton>
        )}
      </div>
    </form>
  );
}
