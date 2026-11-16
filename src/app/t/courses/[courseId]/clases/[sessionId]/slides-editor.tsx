"use client";

import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { Field, Input, Textarea } from "@/components/ui/field";
import { TEXT } from "@/lib/texts";
import { saveSlidesAction } from "@/server/actions/teacher";
import type { Slide } from "@/server/services/class-sessions";

export function SlidesEditor({ courseId, sessionId, slides }: { courseId: string; sessionId: string; slides: Slide[] }) {
  const { state, pending, onSubmit } = useActionForm(saveSlidesAction);
  const t = TEXT.classes;
  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="count" value={slides.length} />
      <FormMessage state={state} />
      <ol className="space-y-4">
        {slides.map((s, i) => (
          <li key={i} className="space-y-3 rounded-xl border border-line p-4">
            <p className="text-xs font-medium text-primary">
              {i + 1}. {t.kind[s.kind]}
            </p>
            <Field label={t.slideTitle} htmlFor={`title${i}`}>
              <Input id={`title${i}`} name={`title${i}`} defaultValue={s.title} maxLength={120} required />
            </Field>
            <Field label={t.bullets} htmlFor={`bullets${i}`}>
              <Textarea id={`bullets${i}`} name={`bullets${i}`} defaultValue={s.bullets.join("\n")} className="min-h-24" required />
            </Field>
            <Field label={t.notes} htmlFor={`notes${i}`} optional>
              <Textarea id={`notes${i}`} name={`notes${i}`} defaultValue={s.notes} className="min-h-16" />
            </Field>
            <p className="text-xs text-muted">{t.source(s.sources.map((src) => TEXT.citation.source(src.fileName, src.page)).join("; "))}</p>
          </li>
        ))}
      </ol>
      <PendingButton pending={pending} pendingText={t.saving}>
        {t.save}
      </PendingButton>
    </form>
  );
}
