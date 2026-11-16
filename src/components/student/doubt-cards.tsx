import { SubmitButton } from "@/components/ui/client";
import { TEXT } from "@/lib/texts";
import { respondToDoubtAction } from "@/server/actions/folders";

type PendingDoubt = { id: string; curriculumItem: { title: string } | null; evidence: { content: string } };

/**
 * Dudas detectadas, dentro del chat: "Parece que te costó «tema». ¿Es así?" con "Sí" y "No".
 * Solo lo confirmado (o lo no respondido en 7 días con confianza alta) le llega al docente.
 */
export function DoubtCards({ doubts }: { doubts: PendingDoubt[] }) {
  if (doubts.length === 0) return null;
  const t = TEXT.student.doubtCard;
  return (
    <section aria-label={t.title} className="space-y-3">
      {doubts.map((d) => (
        <div key={d.id} className="space-y-3 rounded-xl border border-primary/30 bg-surface p-4" data-doubt={d.id}>
          <p className="text-base font-medium text-ink">{t.question(d.curriculumItem?.title ?? "")}</p>
          <details>
            <summary className="cursor-pointer text-sm text-muted">{TEXT.student.myData.seeMore}</summary>
            <blockquote className="mt-2 border-l-2 border-line pl-3 text-sm text-ink-2">{d.evidence.content}</blockquote>
          </details>
          <div className="flex gap-3">
            <form action={respondToDoubtAction.bind(null, d.id, "CONFIRMED")} className="flex-1">
              <SubmitButton className="min-h-11 w-full text-base">{t.yes}</SubmitButton>
            </form>
            <form action={respondToDoubtAction.bind(null, d.id, "DISCARDED")} className="flex-1">
              <SubmitButton variant="secondary" className="min-h-11 w-full text-base">
                {t.no}
              </SubmitButton>
            </form>
          </div>
        </div>
      ))}
    </section>
  );
}
