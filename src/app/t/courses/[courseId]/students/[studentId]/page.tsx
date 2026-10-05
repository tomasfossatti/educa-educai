import type { Metadata } from "next";
import Link from "next/link";
import { DevelopmentView } from "@/components/domain/development-view";
import { InterventionList } from "@/components/domain/interventions";
import { LayerTag } from "@/components/domain/status";
import { InterventionForm } from "@/components/domain/teacher-forms";
import { Badge } from "@/components/ui/badge";
import { TextLink } from "@/components/ui/button";
import { KeyValue, List, ListItem, Notice, PageHeader, Section } from "@/components/ui/layout";
import { runStatusLabel } from "@/domain/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireTeacherStudent } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Estudiante" };

export default async function TeacherStudentPage({ params }: { params: Promise<{ courseId: string; studentId: string }> }) {
  const { courseId, studentId } = await params;
  const { student } = await requireTeacherStudent(courseId, studentId);
  const base = `/t/courses/${courseId}`;
  const [submissions, interventions, activities, conversations] = await Promise.all([
    db.submission.findMany({
      where: { studentId, status: "SUBMITTED", activity: { courseId } },
      orderBy: { submittedAt: "desc" },
      include: { activity: { select: { title: true } }, experience: { include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } } } },
    }),
    db.intervention.findMany({
      where: { courseId, targets: { some: { studentId } } },
      orderBy: { occurredAt: "desc" },
      include: { targets: { include: { student: { include: { user: { select: { name: true } } } } } } },
    }),
    db.activity.findMany({ where: { courseId, status: "PUBLISHED" }, select: { id: true, title: true } }),
    db.aIConversation.count({ where: { courseId, studentId } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={<TextLink href={`${base}/students`}>← Estudiantes</TextLink>}
        title={student.user.name}
        description={`${submissions.length} entregas · ${conversations} conversaciones con el tutor (solo ves la evidencia derivada, no las conversaciones completas).`}
      />
      <div className="space-y-10">
        <Section title="Contexto declarado" action={<LayerTag layer="declared" />}>
          {student.shareContextWithTeachers ? (
            <dl>
              <KeyValue label="Contexto actual">{student.declaredCurrentContext ?? "—"}</KeyValue>
              <KeyValue label="Intereses">{student.declaredInterests ?? "—"}</KeyValue>
              <KeyValue label="Objetivos">{student.declaredGoals ?? "—"}</KeyValue>
              <KeyValue label="Fortalezas percibidas">{student.declaredStrengths ?? "—"}</KeyValue>
              <KeyValue label="Dificultades percibidas">{student.declaredDifficulties ?? "—"}</KeyValue>
              <KeyValue label="Cómo prefiere trabajar">{student.declaredWorkPreferences ?? "—"}</KeyValue>
            </dl>
          ) : (
            <p className="text-sm text-muted">El estudiante no compartió su contexto declarado.</p>
          )}
          {!student.consentAnalysisAt && (
            <Notice tone="attention">Este estudiante no dio consentimiento para el análisis: sus experiencias nuevas no generan evidencia.</Notice>
          )}
        </Section>

        <DevelopmentView studentId={studentId} courseId={courseId} viewer="teacher" base={base} />

        <Section title="Entregas" description="Producción original y su análisis.">
          {submissions.length === 0 ? (
            <p className="text-sm text-muted">Todavía no hay entregas.</p>
          ) : (
            <List>
              {submissions.map((s) => {
                const run = s.experience.runs[0];
                return (
                  <ListItem key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Link href={`${base}/submissions/${s.id}`} className="text-sm font-medium text-ink hover:text-primary">
                        {s.activity.title}
                        {s.attempt > 1 ? ` (intento ${s.attempt})` : ""}
                      </Link>
                      <p className="text-xs text-muted">Entregada {formatDateTime(s.submittedAt)}</p>
                    </div>
                    {run && <Badge tone={run.status === "FAILED" ? "danger" : "muted"}>{runStatusLabel[run.status]}</Badge>}
                  </ListItem>
                );
              })}
            </List>
          )}
        </Section>

        {interventions.length > 0 && (
          <Section title="Intervenciones" description={`Última: ${formatDate(interventions[0].occurredAt)}`}>
            <InterventionList interventions={interventions} courseId={courseId} />
          </Section>
        )}

        <Section title="Registrar una intervención">
          <InterventionForm courseId={courseId} activities={activities} students={[{ id: studentId, name: student.user.name, selected: true }]} />
        </Section>
      </div>
    </>
  );
}
