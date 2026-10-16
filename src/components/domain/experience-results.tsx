import type { Dimension } from "@prisma/client";
import { EvidenceRow, InferenceRow } from "@/components/domain/rows";
import { RunStatusPanel } from "@/components/domain/run-status";
import { EvaluationBadge, LayerTag } from "@/components/domain/status";
import { NextStepItem } from "@/components/domain/next-step";
import { List, ListItem, Section } from "@/components/ui/layout";
import { dimensionLabel } from "@/domain/labels";
import { db } from "@/server/db";
import { expireStaleRuns } from "@/server/engine/trigger";
import { EVENT, track } from "@/server/events";

/**
 * Resultado del loop para una experiencia del estudiante:
 * estado del análisis → feedback → inferencias → evaluación → evidencia → próximos pasos.
 */
export async function ExperienceResults({ experienceId, studentId, courseId }: { experienceId: string; studentId: string; courseId: string }) {
  await expireStaleRuns(studentId);
  const run = await db.interpretationRun.findFirst({
    where: { experienceId, studentId },
    orderBy: { createdAt: "desc" },
    include: { feedback: true },
  });
  if (!run) return null;
  const base = `/s/courses/${courseId}`;

  if (run.status !== "COMPLETED") return <RunStatusPanel run={run} canRetry />;

  const feedback = run.feedback;
  if (feedback && !feedback.viewedAt) {
    await db.feedback.update({ where: { id: feedback.id }, data: { viewedAt: new Date() } });
    await track(EVENT.studentFeedbackViewed, {
      userId: studentId,
      studentId,
      courseId,
      dedupeKey: `feedback_viewed:${feedback.id}`,
      properties: { feedbackId: feedback.id },
    });
  }

  const [inferences, evaluations, evidence, nextSteps, items] = await Promise.all([
    db.inference.findMany({
      where: { id: { in: feedback?.inferenceIds ?? [] }, reviewStatus: { not: "INCORRECT" } },
      include: { curriculumItem: { select: { title: true } }, supports: { select: { evidenceId: true } } },
    }),
    db.evaluation.findMany({ where: { runId: run.id }, include: { criterion: { select: { title: true } }, evidence: true } }),
    db.evidenceObject.findMany({ where: { runId: run.id }, orderBy: { occurredAt: "asc" }, include: { experience: { select: { title: true } } } }),
    db.suggestedAction.findMany({
      where: { runId: run.id, audience: "STUDENT", status: "OPEN" },
      include: { curriculumItem: { select: { id: true, title: true } }, activity: { select: { id: true, title: true } } },
    }),
    db.curriculumItem.findMany({ where: { courseId }, select: { id: true, title: true } }),
  ]);
  const insufficient = (Array.isArray(run.insufficient) ? run.insufficient : []) as { curriculumItemId: string | null; dimension: Dimension; note: string }[];
  const itemTitle = new Map(items.map((i) => [i.id, i.title]));

  return (
    <div className="space-y-8">
      {feedback && (
        <Section title="Feedback" description="Basado en la evidencia de esta experiencia.">
          <div className="space-y-3 rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            <p className="prose-plain text-sm text-[#27251e] leading-relaxed">{feedback.summary}</p>
            {feedback.contrastWithDeclared && (
              <div className="space-y-1.5 border-t border-[#d1d1cd] pt-3.5">
                <div className="flex items-center gap-2">
                  <LayerTag layer="declared" />
                  <span className="text-xs text-[#72706b]">vs.</span>
                  <LayerTag layer="observed" />
                </div>
                <p className="prose-plain text-sm text-[#72706b] leading-relaxed">{feedback.contrastWithDeclared}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {inferences.length > 0 && (
        <Section title="Qué sugiere la evidencia" action={<LayerTag layer="inferred" />}>
          <List>
            {inferences.map((i) => (
              <ListItem key={i.id}>
                <InferenceRow
                  audience="student"
                  href={`${base}/inferences/${i.id}`}
                  inference={{ ...i, evidenceCount: new Set(i.supports.map((s) => s.evidenceId)).size }}
                />
              </ListItem>
            ))}
          </List>
        </Section>
      )}

      {insufficient.length > 0 && (
        <Section title="Todavía no hay evidencia suficiente sobre…">
          <ul className="space-y-1 text-sm text-[#72706b]">
            {insufficient.map((a, i) => (
              <li key={i}>
                <span className="text-[#27251e] font-medium">
                  {a.curriculumItemId ? (itemTitle.get(a.curriculumItemId) ?? "Un tema") : "General"} · {dimensionLabel[a.dimension]}
                </span>
                : {a.note}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {evaluations.length > 0 && (
        <Section
          title="Comparación con los criterios de la actividad"
          description="No es una nota: compara tu producción con cada criterio explícito."
          action={<LayerTag layer="evaluated" />}
        >
          <List>
            {evaluations.map((e) => (
              <ListItem key={e.id} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[#27251e]">{e.criterion.title}</span>
                  <EvaluationBadge result={e.result} />
                </div>
                <p className="text-sm text-[#72706b] leading-relaxed">{e.rationale}</p>
              </ListItem>
            ))}
          </List>
        </Section>
      )}

      {nextSteps.length > 0 && (
        <Section title="Próximo paso">
          <List>
            {nextSteps.map((a) => (
              <ListItem key={a.id}>
                <NextStepItem action={a} courseId={courseId} />
              </ListItem>
            ))}
          </List>
        </Section>
      )}

      {evidence.length > 0 && (
        <Section title="Evidencia registrada" description="Fragmentos de lo que produjiste, con su contexto." action={<LayerTag layer="observed" />}>
          <List>
            {evidence.map((e) => (
              <ListItem key={e.id}>
                <EvidenceRow evidence={e} href={`${base}/evidence/${e.id}`} />
              </ListItem>
            ))}
          </List>
        </Section>
      )}
    </div>
  );
}
