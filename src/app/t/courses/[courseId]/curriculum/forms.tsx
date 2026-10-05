"use client";

import type { CurriculumKind } from "@prisma/client";
import { useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { curriculumKindLabel } from "@/domain/labels";
import { saveCurriculumItemAction, startExtractionAction } from "@/server/actions/teacher";

export function ProgramForm({ courseId, defaultText }: { courseId: string; defaultText: string }) {
  const { state, pending, onSubmit } = useActionForm(startExtractionAction);
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <form onSubmit={onSubmit} className="space-y-4" encType="multipart/form-data">
      <input type="hidden" name="courseId" value={courseId} />
      <FormMessage state={state} />
      <Field
        label="Programa de la materia"
        htmlFor="programText"
        hint="Pegá el programa completo: fundamentación, objetivos, contenidos, criterios de evaluación."
        error={state?.fieldErrors?.programText}
      >
        <Textarea id="programText" name="programText" defaultValue={defaultText} maxLength={60000} className="min-h-64 font-mono text-xs" />
      </Field>
      <Field label="O subí un archivo" htmlFor="programFile" optional hint="PDF, TXT o MD, hasta 8 MB. Si subís un archivo, se usa en lugar del texto." error={state?.fieldErrors?.programFile}>
        <Input
          id="programFile"
          name="programFile"
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          className="h-auto py-1.5"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </Field>
      {fileName && <p className="text-xs text-muted">Archivo seleccionado: {fileName}</p>}
      <PendingButton pending={pending} pendingText="Enviando…">
        Proponer mapeo curricular con IA
      </PendingButton>
    </form>
  );
}

export function ItemForm({
  courseId,
  parents,
  item,
  onDoneLabel,
}: {
  courseId: string;
  parents: { id: string; title: string }[];
  item?: { id: string; kind: CurriculumKind; title: string; description: string | null; parentId: string | null };
  onDoneLabel?: string;
}) {
  const { state, pending, onSubmit, ref } = useActionForm(saveCurriculumItemAction, { resetOnSuccess: !item });
  const [kind, setKind] = useState<CurriculumKind>(item?.kind ?? "CONCEPT");
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      {item && <input type="hidden" name="itemId" value={item.id} />}
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <Field label="Tipo" htmlFor={`kind-${item?.id ?? "new"}`}>
          <Select id={`kind-${item?.id ?? "new"}`} name="kind" value={kind} onChange={(e) => setKind(e.target.value as CurriculumKind)}>
            {(Object.keys(curriculumKindLabel) as CurriculumKind[]).map((k) => (
              <option key={k} value={k}>
                {curriculumKindLabel[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Título" htmlFor={`title-${item?.id ?? "new"}`} error={state?.fieldErrors?.title}>
          <Input id={`title-${item?.id ?? "new"}`} name="title" required maxLength={200} defaultValue={item?.title} />
        </Field>
      </div>
      <Field label="Descripción" htmlFor={`description-${item?.id ?? "new"}`} optional>
        <Textarea id={`description-${item?.id ?? "new"}`} name="description" maxLength={1500} defaultValue={item?.description ?? ""} className="min-h-16" />
      </Field>
      {kind === "CRITERION" && parents.length > 0 && (
        <Field label="Evalúa el objetivo o competencia" htmlFor={`parent-${item?.id ?? "new"}`} optional>
          <Select id={`parent-${item?.id ?? "new"}`} name="parentId" defaultValue={item?.parentId ?? ""}>
            <option value="">Ninguno</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <FormMessage state={state} />
      <PendingButton pending={pending} size="sm" variant="secondary">
        {onDoneLabel ?? (item ? "Guardar" : "Agregar ítem")}
      </PendingButton>
    </form>
  );
}
