"use client";

import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { TEXT } from "@/lib/texts";
import { submitQuizAction } from "@/server/actions/folders";

export function QuizForm({
  quizId,
  questions,
}: {
  quizId: string;
  questions: { prompt: string; options: string[]; source: { fileName: string; page: number } }[];
}) {
  const t = TEXT.student.practice;
  const { state, pending, onSubmit } = useActionForm(submitQuizAction);
  return (
    <form method="post" onSubmit={onSubmit} className="space-y-6">
      <input type="hidden" name="quizId" value={quizId} />
      <input type="hidden" name="total" value={questions.length} />
      <FormMessage state={state} />
      <ol className="space-y-4">
        {questions.map((q, i) => (
          <li key={i} className="space-y-2 rounded-xl border border-line p-4">
            <fieldset className="space-y-2">
              <legend className="text-base font-medium text-ink">
                {i + 1}. {q.prompt}
              </legend>
              {q.options.map((o, j) => (
                <label key={j} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-base text-ink-2 hover:bg-surface-2">
                  <input type="radio" name={`q${i}`} value={j} className="size-5 shrink-0 accent-primary" /> {o}
                </label>
              ))}
              <p className="text-xs text-muted">{t.from(TEXT.student.ask.source(q.source.fileName, q.source.page))}</p>
            </fieldset>
          </li>
        ))}
      </ol>
      <PendingButton pending={pending} pendingText={t.submitting} className="min-h-11 w-full px-6 text-base sm:w-auto">
        {t.submit}
      </PendingButton>
    </form>
  );
}
