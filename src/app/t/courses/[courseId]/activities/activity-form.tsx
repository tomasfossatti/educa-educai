"use client";

import type { ActivityKind, CurriculumKind } from "@prisma/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import type { ActivityPrompt } from "@/domain/activity";
import { activityKindLabel, curriculumKindPlural } from "@/domain/labels";
import { saveActivityAction } from "@/server/actions/teacher";

interface Item {
  id: string;
  kind: CurriculumKind;
  title: string;
}

export interface ActivityDefaults {
  id?: string;
  title: string;
  kind: ActivityKind;
  scenario: string;
  instructions: string;
  prompts: ActivityPrompt[];
  itemIds: string[];
  status?: "DRAFT" | "PUBLISHED" | "CLOSED";
}

export function ActivityForm({ courseId, items, defaults, promptsLocked }: { courseId: string; items: Item[]; defaults: ActivityDefaults; promptsLocked: boolean }) {
  const { state, pending, onSubmit } = useActionForm(saveActivityAction);
  const [promptCount, setPromptCount] = useState(Math.max(1, defaults.prompts.length));
  const groups = (["CONCEPT", "OBJECTIVE", "COMPETENCY"] as const).map((k) => ({ kind: k, items: items.filter((i) => i.kind === k) }));
  const criteria = items.filter((i) => i.kind === "CRITERION");

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <input type="hidden" name="courseId" value={courseId} />
      {defaults.id && <input type="hidden" name="activityId" value={defaults.id} />}
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <Field label="Título" htmlFor="title" error={state?.fieldErrors?.title}>
          <Input id="title" name="title" required maxLength={200} defaultValue={defaults.title} />
        </Field>
        <Field label="Tipo" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue={defaults.kind}>
            {(Object.keys(activityKindLabel) as ActivityKind[]).map((k) => (
              <option key={k} value={k}>
                {activityKindLabel[k]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field
        label="Situación o caso"
        htmlFor="scenario"
        hint="Un problema concreto donde el estudiante tenga que decidir. Para observar transferencia, usá un contexto distinto al trabajado en clase."
        error={state?.fieldErrors?.scenario}
      >
        <Textarea id="scenario" name="scenario" required maxLength={4000} defaultValue={defaults.scenario} className="min-h-28" />
      </Field>
      <Field label="Consigna general" htmlFor="instructions" error={state?.fieldErrors?.instructions}>
        <Textarea id="instructions" name="instructions" required maxLength={2000} defaultValue={defaults.instructions} className="min-h-16" />
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-ink">Consignas estructuradas</legend>
        <p className="text-xs text-muted">
          Pedí decisiones y su justificación: así Educai puede observar aplicación, criterio y autonomía (no solo respuestas correctas).
          {promptsLocked && " Hay entregas: las consignas ya no se pueden cambiar."}
        </p>
        {state?.fieldErrors?.prompts && <p className="text-xs text-danger">{state.fieldErrors.prompts}</p>}
        {Array.from({ length: promptCount }, (_, i) => (
          <div key={i} className="grid gap-2 rounded-md border border-line bg-surface p-3 sm:grid-cols-2">
            <Input
              name={`prompt_label_${i + 1}`}
              aria-label={`Consigna ${i + 1}`}
              placeholder={`Consigna ${i + 1}`}
              defaultValue={defaults.prompts[i]?.label ?? ""}
              maxLength={300}
              readOnly={promptsLocked}
            />
            <Input
              name={`prompt_help_${i + 1}`}
              aria-label={`Ayuda de la consigna ${i + 1}`}
              placeholder="Aclaración (opcional)"
              defaultValue={defaults.prompts[i]?.help ?? ""}
              maxLength={500}
              readOnly={promptsLocked}
            />
          </div>
        ))}
        {!promptsLocked && promptCount < 6 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setPromptCount((n) => n + 1)}>
            Agregar consigna
          </Button>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-ink">Qué trabaja</legend>
        {items.length === 0 ? (
          <p className="text-xs text-muted">Confirmá la currícula para vincular la actividad con conceptos y criterios.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-3">
            {groups.map(
              (g) =>
                g.items.length > 0 && (
                  <div key={g.kind} className="space-y-2">
                    <p className="text-xs font-medium text-muted">{curriculumKindPlural[g.kind]}</p>
                    {g.items.map((i) => (
                      <Checkbox key={i.id} name="items" value={i.id} label={i.title} defaultChecked={defaults.itemIds.includes(i.id)} />
                    ))}
                  </div>
                ),
            )}
          </div>
        )}
      </fieldset>

      {criteria.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">Criterios de evaluación</legend>
          <p className="text-xs text-muted">Educai compara cada entrega con estos criterios (no es una nota) y lo deja trazable a la evidencia.</p>
          {criteria.map((i) => (
            <Checkbox key={i.id} name="items" value={i.id} label={i.title} defaultChecked={defaults.itemIds.includes(i.id)} />
          ))}
        </fieldset>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        {defaults.status !== "PUBLISHED" && defaults.status !== "CLOSED" && (
          <PendingButton pending={pending} name="intent" value="publish" pendingText="Publicando…">
            Publicar
          </PendingButton>
        )}
        <PendingButton pending={pending} name="intent" value="draft" variant={defaults.status === "PUBLISHED" ? "primary" : "secondary"}>
          {defaults.status === "PUBLISHED" || defaults.status === "CLOSED" ? "Guardar cambios" : "Guardar borrador"}
        </PendingButton>
      </div>
    </form>
  );
}
