import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmSubmit } from "@/components/ui/client";
import { EmptyState, List, ListItem, PageHeader, Section } from "@/components/ui/layout";
import { formatDate, formatRelative, plural } from "@/lib/format";
import { removeStudentAction } from "@/server/actions/teacher";
import { requireCourseTeacher } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getCourseRoster } from "@/server/services/roster";
import { InviteForm } from "./invite-form";
import { headers } from "next/headers";

export const metadata: Metadata = { title: "Estudiantes" };

export default async function StudentsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { course, user } = await requireCourseTeacher(courseId);
  // Todos los inscriptos, también los que no dieron consentimiento (de ellos, solo nombre y estado).
  const [students, invites] = await Promise.all([
    getCourseRoster({ id: user.id, role: user.role }, courseId),
    db.courseInvite.findMany({ where: { courseId, acceptedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);
  const base = `/t/courses/${courseId}`;
  const h = await headers();
  const joinLink = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/s/join?code=${course.joinCode}`;

  return (
    <>
      <PageHeader title="Estudiantes" description={`${plural(students.length, "inscripto", "inscriptos")}. Cada estudiante decide unirse y qué consentimiento da.`} />
      <div className="space-y-10">
        <Section title="Incorporar estudiantes">
          <p className="text-sm text-ink-2">
            Compartí el código <span className="rounded bg-subtle px-1.5 py-0.5 font-mono tracking-widest text-ink">{course.joinCode}</span>, el enlace{" "}
            <span className="break-all font-mono text-xs text-ink">{joinLink}</span> o invitá por email o CSV.
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
                return (
                  <ListItem key={s.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`${base}/students/${s.id}`} className="text-sm font-medium text-ink hover:text-primary">
                        {s.name}
                      </Link>
                      <p className="text-xs text-muted">
                        {s.onboardingCompleted ? "Onboarding completo" : "Onboarding pendiente"} ·{" "}
                        {s.consent ? "análisis activado" : "sin consentimiento de análisis"}
                        {s.stats && (
                          <>
                            {" "}
                            · {plural(s.stats.evidenceCount, "evidencia", "evidencias")} · última {formatRelative(s.stats.lastEvidenceAt)}
                          </>
                        )}{" "}
                        · se unió {formatDate(s.joinedAt)}
                      </p>
                      {s.stats && (s.stats.difficulties > 0 || s.stats.contradictions > 0 || s.stats.pending > 0) && (
                        <p className="text-xs text-ink-2">
                          {plural(s.stats.difficulties, "dificultad", "dificultades")} · {plural(s.stats.contradictions, "contradicción", "contradicciones")} ·{" "}
                          {s.stats.pending} por revisar
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
