import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InferenceTrace } from "@/components/domain/inference-trace";
import { InterventionList } from "@/components/domain/interventions";
import { InterventionForm, ReviewForm } from "@/components/domain/teacher-forms";
import { TextLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/client";
import { List, ListItem, PageHeader, Section } from "@/components/ui/layout";
import { actionTypeLabel } from "@/domain/labels";
import { setTeacherActionStatusAction } from "@/server/actions/teacher";
import { requireCourseTeacher } from "@/server/auth/guards";
import { db } from "@/server/db";
import { EVENT, track } from "@/server/events";
import { getInferenceDetail } from "@/server/services/development";

export const metadata: Metadata = { title: "Inferencia" };

export default async function TeacherInferencePage({ params }: { params: Promise<{ courseId: string; inferenceId: string }> }) {
  const { courseId, inferenceId } = await params;
  const { user } = await requireCourseTeacher(courseId);
  const inference = await getInferenceDetail(inferenceId, courseId, "teacher");
  if (!inference) notFound();
  const base = `/t/courses/${courseId}`;
  await track(EVENT.teacherInsightOpened, {
    userId: user.id,
    courseId,
    studentId: inference.studentId,
    dedupeKey: `insight_opened:${user.id}:inference:${inference.id}`,
    properties: { key: `inference:${inference.id}` },
  });

  const [activities, enrolled] = await Promise.all([
    db.activity.findMany({ where: { courseId, status: "PUBLISHED" }, select: { id: true, title: true }, orderBy: { publishedAt: "desc" } }),
    db.enrollment.findMany({ where: { courseId, status: "ACTIVE" }, include: { student: { include: { user: { select: { name: true } } } } } }),
  ]);
  const openActions = inference.suggestedActions.filter((a) => a.status === "OPEN");

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <TextLink href={`${base}/students/${inference.studentId}`}>{inference.student.user.name}</TextLink> · inferencia
          </>
        }
        title="¿Por qué Educai cree esto?"
      />
      <div className="space-y-10">
        <InferenceTrace inference={inference} viewer="teacher" base={base} />

        <Section title="Tu revisión" description="Confirmar, corregir o contextualizar. Las correcciones se guardan y Educai las considera en análisis futuros.">
          <ReviewForm inferenceId={inference.id} />
        </Section>

        {openActions.length > 0 && (
          <Section title="Acción sugerida">
            <List>
              {openActions.map((a) => (
                <ListItem key={a.id} className="space-y-2">
                  <p className="text-xs text-muted">{actionTypeLabel[a.type]} · sugerida por Educai</p>
                  <p className="text-sm text-ink">{a.description}</p>
                  <form action={setTeacherActionStatusAction.bind(null, a.id, "DISMISSED")}>
                    <SubmitButton size="sm" variant="ghost">
                      Descartar sugerencia
                    </SubmitButton>
                  </form>
                </ListItem>
              ))}
            </List>
          </Section>
        )}

        {inference.interventions.length > 0 && (
          <Section title="Intervenciones y seguimiento">
            <InterventionList interventions={inference.interventions} courseId={courseId} />
          </Section>
        )}

        <Section title="Registrar una intervención" description="Qué vas a hacer con esta información. Educai relacionará la evidencia nueva con esta decisión.">
          <InterventionForm
            courseId={courseId}
            inferenceId={inference.id}
            curriculumItemId={inference.curriculumItemId}
            activities={activities}
            suggestion={openActions[0]?.description}
            students={enrolled
              .map((e) => ({ id: e.studentId, name: e.student.user.name, selected: e.studentId === inference.studentId }))
              .sort((a, b) => a.name.localeCompare(b.name))}
          />
        </Section>
      </div>
    </>
  );
}
