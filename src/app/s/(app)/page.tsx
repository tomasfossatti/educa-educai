import type { Metadata } from "next";
import { ArrowRight, User, CheckCircle2 } from "lucide-react";
import { EvidenceRow, InferenceRow } from "@/components/domain/rows";
import { LayerTag } from "@/components/domain/status";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, TextLink } from "@/components/ui/button";
import { AutoRefresh, SubmitButton } from "@/components/ui/client";
import { Card, EmptyState, List, ListItem, Notice, Section } from "@/components/ui/layout";
import { truncate } from "@/domain/text-guards";
import { acceptInviteAction, selectCourseAction } from "@/server/actions/student";
import { FoldersSection } from "@/components/student/folders-section";
import { formatDate } from "@/lib/format";
import { TEXT } from "@/lib/texts";
import { requireStudent } from "@/server/auth/guards";
import { closeInactiveConversations } from "@/server/engine/trigger";
import { nextApprovedSession } from "@/server/services/class-sessions";
import { getCurrentCourseId, getPendingInvites, getStudentCourses, getStudentHome } from "@/server/services/student-home";

export const metadata: Metadata = { title: "Inicio" };

export default async function StudentHome() {
  const { user, profile } = await requireStudent();
  await closeInactiveConversations({ studentId: user.id });
  const [courses, invites, courseId] = await Promise.all([
    getStudentCourses(user.id),
    getPendingInvites(user.email),
    getCurrentCourseId(user.id),
  ]);

  const inviteNotice =
    invites.length > 0 ? (
      <Notice title="Te invitaron a una materia">
        <ul className="mt-2 space-y-2">
          {invites.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {invite.course.name} · {invite.course.teacher.user.name}
              </span>
              <form action={acceptInviteAction.bind(null, invite.id)}>
                <SubmitButton size="sm" pendingText="Uniéndote…">
                  Unirme
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      </Notice>
    ) : null;

  if (!courseId || courses.length === 0) {
    return (
      <div className="shell student-home">
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-ink">Hola, {user.name.split(" ")[0]}</h1>
            <p className="text-muted">{TEXT.home.welcome}</p>
          </div>
          {inviteNotice}
          <FoldersSection studentId={user.id} />
          <EmptyState title="Todavía no estás en ninguna materia" action={<ButtonLink href="/s/join" variant="primary">Unirme con un código</ButtonLink>}>
            Sumate con el código que te compartió tu docente para empezar.
          </EmptyState>
        </div>
      </div>
    );
  }

  const primaryEnrollment = courses.find((c) => c.courseId === courseId) || courses[0];
  const activeCourse = primaryEnrollment.course;
  const home = await getStudentHome(user.id, activeCourse.id);
  const nextClass = await nextApprovedSession(activeCourse.id);
  const base = `/s/courses/${activeCourse.id}`;

  return (
    <div className="shell student-home space-y-8">
      {/* Saludo inicial y acceso al perfil */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-primary">Tu espacio de aprendizaje</span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink mt-0.5">Hola, {user.name.split(" ")[0]}</h1>
        </div>
        <ButtonLink
          href="/s/context"
          variant="secondary"
          size="sm"
        >
          Mi perfil y contexto →
        </ButtonLink>
      </div>

      {inviteNotice}

      <FoldersSection studentId={user.id} />

      {nextClass && (
        <Notice title={TEXT.classes.studentNext(formatDate(nextClass.date), nextClass.items.map((i) => i.curriculumItem.title).join(", "))}>
          {nextClass.objective}
        </Notice>
      )}

      {/* Tarjeta heroica de la materia activa del día (hairline card refinada) */}
      <section className="relative rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-xs">
        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge tone="neutral">{TEXT.home.yourCourse}</Badge>
          </div>

          {/* Título y descripción de la materia */}
          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              {activeCourse.name}
            </h2>
            {activeCourse.description && <p className="text-sm sm:text-base text-ink-2 max-w-2xl leading-relaxed">{activeCourse.description}</p>}
          </div>

          {/* Metadatos pedagógicos */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted border-t border-line pt-4">
            <span className="flex items-center gap-1.5">
              <User className="size-3.5 text-muted" />
              <span>Docente: <strong className="text-ink font-medium">{activeCourse.teacher.user.name}</strong></span>
            </span>
          </div>

          {/* Acción principal hacia el hub de la clase */}
          <div className="pt-2">
            <ButtonLink
              href={base}
              variant="primary"
              size="md"
              className="gap-2"
            >
              <span>{TEXT.home.enterCourse}</span>
              <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Otras materias inscriptas si las hubiere */}
      {courses.length > 1 && (
        <section className="space-y-3">
          <h3 className="text-xs font-mono font-medium text-muted">Otras materias inscriptas</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {courses
              .filter((c) => c.courseId !== activeCourse.id)
              .map((c) => (
                <Card key={c.courseId} className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-ink">{c.course.name}</h4>
                    <p className="text-xs text-muted mt-0.5">{c.course.teacher.user.name}</p>
                  </div>
                  <form action={selectCourseAction.bind(null, c.courseId)}>
                    <SubmitButton size="sm" variant="secondary">
                      Seleccionar esta materia
                    </SubmitButton>
                  </form>
                </Card>
              ))}
          </div>
        </section>
      )}

      <AutoRefresh active={home.processingRuns > 0} intervalMs={4000} />

      {/* Sección complementaria: Desarrollo y contexto */}
      <div className="space-y-8 pt-2">
        <Section
          title="Tu desarrollo en la materia"
          description="Lo que aparece respaldado por evidencia de tus conversaciones y entregas."
          action={<TextLink href={`${base}/development`}>Ver desarrollo completo</TextLink>}
        >
          {home.inferences.length === 0 ? (
            <EmptyState title="Todavía no hay evidencia suficiente">
              Las conclusiones aparecen después de tu primera conversación con el tutor o tu primera actividad.
            </EmptyState>
          ) : (
            <List>
              {home.inferences.map((i) => (
                <ListItem key={i.id}>
                  <InferenceRow
                    audience="student"
                    href={`${base}/inferences/${i.id}`}
                    inference={{ ...i, evidenceCount: new Set(i.supports.map((s) => s.evidenceId)).size }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Section>

        <Section
          title="Tu contexto declarado"
          description="Lo que le contaste a Educai sobre vos. La IA saca los ejemplos del foco que elegiste."
          action={<TextLink href="/s/context">Editar</TextLink>}
        >
          <Card className="space-y-2 text-sm">
            <LayerTag layer="declared" />
            <dl className="space-y-1.5 text-ink-2 mt-2">
              {[
                [TEXT.profile.focusLabel, TEXT.profile.focusShort[profile.personalizationFocus]],
                [TEXT.profile.project, profile.projectDescription],
                [TEXT.profile.work, profile.declaredCurrentContext],
                ["Intereses", profile.declaredInterests],
                ["Objetivos", profile.declaredGoals],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="inline text-muted">{label}: </dt>
                    <dd className="inline font-medium text-ink">{truncate(value!, 220)}</dd>
                  </div>
                ))}
            </dl>
          </Card>
        </Section>
      </div>
    </div>
  );
}
