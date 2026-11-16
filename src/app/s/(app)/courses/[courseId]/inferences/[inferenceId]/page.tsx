import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TextLink } from "@/components/ui/button";
import { List, ListItem, Quote } from "@/components/ui/layout";
import { formatDate } from "@/lib/format";
import { TEXT } from "@/lib/texts";
import { requireEnrolledStudent } from "@/server/auth/guards";
import { getInferenceDetail } from "@/server/services/development";
import { StudentResponseForm } from "./response-form";

export const metadata: Metadata = { title: "¿Estás de acuerdo?" };

/**
 * Una conclusión sobre el estudiante, con las partes de sus charlas de donde sale, para que la
 * responda (de acuerdo, en desacuerdo o falta contexto). Su respuesta la ve el docente.
 */
export default async function StudentInferencePage({ params }: { params: Promise<{ courseId: string; inferenceId: string }> }) {
  const { courseId, inferenceId } = await params;
  const { user } = await requireEnrolledStudent(courseId);
  const inference = await getInferenceDetail(inferenceId, courseId, "student", user.id);
  if (!inference) notFound();
  const t = TEXT.student.conclusion;

  return (
    <div className="shell mx-auto max-w-3xl space-y-6">
      <TextLink href="/s/mis-datos#docente">{t.back}</TextLink>
      <h1 className="text-xl font-bold text-ink sm:text-2xl">{inference.studentStatement ?? inference.statement}</h1>
      {inference.curriculumItem && <p className="text-sm text-muted">{inference.curriculumItem.title}</p>}
      {inference.supports.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer py-2 text-sm text-muted">{TEXT.student.myData.seeMore}</summary>
          <p className="mt-2 text-sm text-ink-2">{t.basedOn}</p>
          <ul className="mt-2 space-y-2">
            {inference.supports.map((s) => (
              <li key={s.id}>
                <Quote>{s.evidence.content}</Quote>
              </li>
            ))}
          </ul>
        </details>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">{t.title}</h2>
        <p className="text-sm text-muted">{t.hint}</p>
        <StudentResponseForm inferenceId={inference.id} />
      </section>
      {inference.studentResponses.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-ink">{t.yourAnswers}</h2>
          <List>
            {inference.studentResponses.map((r) => (
              <ListItem key={r.id} className="text-sm">
                <span className="text-ink">{t.stance[r.stance]}</span>
                {r.note && <span className="text-ink-2"> · {r.note}</span>}
                <span className="ml-2 text-xs text-muted">{formatDate(r.createdAt)}</span>
              </ListItem>
            ))}
          </List>
        </section>
      )}
    </div>
  );
}
