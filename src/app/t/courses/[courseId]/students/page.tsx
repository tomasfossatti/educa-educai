import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmSubmit } from "@/components/ui/client";
import { EmptyState, List, ListItem, PageHeader, Section } from "@/components/ui/layout";
import { formatDate, formatRelative, plural } from "@/lib/format";
import { removeStudentAction } from "@/server/actions/teacher";
import { requireCourseTeacher } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getCourseOverview } from "@/server/services/attention";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Estudiantes" };

export default async function StudentsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { course } = await requireCourseTeacher(courseId);
  const [overview, enrollments, invites] = await Promise.all([
    getCourseOverview(courseId),
    db.enrollment.findMany({
      where: { courseId, status: "ACTIVE" },
      include: { student: { select: { onboardingCompletedAt: true, consentAnalysisAt: true } } },
    }),
    db.courseInvite.findMany({ where: { courseId, acceptedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);
  const meta = new Map(enrollments.map((e) => [e.studentId, e]));
  const students = [...overview.students].sort((a, b) => a.name.localeCompare(b.name));
  const base = `/t/courses/${courseId}`;

  return (
    <>
      <PageHeader title="Estudiantes" description={`${students.length} inscriptos. Cada estudiante decide unirse y qué consentimiento da.`} />
      <div className="space-y-10">
        <Section title="Incorporar estudiantes">
          <p className="text-sm text-ink-2">
            Compartí el código <span className="rounded bg-subtle px-1.5 py-0.5 font-mono tracking-widest text-ink">{course.joinCode}</span> o invitá por email.
          </p>
          <InviteForm courseId={courseId} />
          {invites.length > 0 && (
            <p className="text-xs text-muted">
              Invitaciones pendientes: {invites.map((i) => i.email).join(", ")}
            </p>
          )}
        </Section>

        <Section title="Inscriptos">
          {students.length === 0 ? (
            <EmptyState title="Todavía no hay estudiantes">Cuando se sumen con el código o acepten la invitación, aparecerán acá.</EmptyState>
          ) : (
            <List>
              {students.map((s) => {
                const m = meta.get(s.id);
                return (
                  <ListItem key={s.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`${base}/students/${s.id}`} className="text-sm font-medium text-ink hover:text-primary">
                        {s.name}
                      </Link>
                      <p className="text-xs text-muted">
                        {m?.student.onboardingCompletedAt ? "Onboarding completo" : "Onboarding pendiente"} ·{" "}
                        {m?.student.consentAnalysisAt ? "análisis activado" : "sin consentimiento de análisis"} · {s.evidenceCount} evidencias · última{" "}
                        {formatRelative(s.lastEvidenceAt)} · se unió {formatDate(m?.joinedAt)}
                      </p>
                      {(s.difficulties > 0 || s.contradictions > 0 || s.pending > 0) && (
                        <p className="text-xs text-ink-2">
                          {plural(s.difficulties, "dificultad", "dificultades")} · {plural(s.contradictions, "contradicción", "contradicciones")} · {s.pending} por revisar
                        </p>
                      )}
                    </div>
                    <form action={removeStudentAction.bind(null, courseId, s.id)}>
                      <ConfirmSubmit variant="ghost" size="sm" message={`¿Quitar a ${s.name} de la materia? Dejarás de ver su información en este curso.`}>
                        Quitar
                      </ConfirmSubmit>
                    </form>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Section>
      </div>
    </>
  );
}
