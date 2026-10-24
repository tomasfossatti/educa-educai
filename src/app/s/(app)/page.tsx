import type { Metadata } from "next";
import { ArrowRight, BookOpen, Clock, User, CheckCircle2 } from "lucide-react";
import { EvidenceRow, InferenceRow } from "@/components/domain/rows";
import { LayerTag } from "@/components/domain/status";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, TextLink } from "@/components/ui/button";
import { AutoRefresh, SubmitButton } from "@/components/ui/client";
import { Card, EmptyState, List, ListItem, Notice, Section } from "@/components/ui/layout";
import { truncate } from "@/domain/text-guards";
import { acceptInviteAction, selectCourseAction } from "@/server/actions/student";
import { requireStudent } from "@/server/auth/guards";
import { getCurrentCourseId, getPendingInvites, getStudentCourses, getStudentHome } from "@/server/services/student-home";

export const metadata: Metadata = { title: "Inicio" };

export default async function StudentHome() {
  const { user, profile } = await requireStudent();
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
            <p className="text-muted">Bienvenido a Educai.</p>
          </div>
          {inviteNotice}
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

      {/* Tarjeta heroica de la materia activa del día (hairline card refinada) */}
      <section className="relative rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-xs">
        <div className="relative z-10 space-y-5">
          {/* Badge de estado en vivo */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge tone="success">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-success" />
              </span>
              <span>Cursada de hoy</span>
            </Badge>
            <span className="text-xs font-mono text-muted flex items-center gap-1.5">
              <Clock className="size-3.5" />
              <span>Turno: 8:30 a 10:30 hs</span>
            </span>
          </div>

          {/* Título y descripción de la materia */}
          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              {activeCourse.name}
            </h2>
            <p className="text-sm sm:text-base text-ink-2 max-w-2xl leading-relaxed">
              {activeCourse.description || "Tomar decisiones de negocio con evidencia: segmentación, hipótesis falsables y experimentos simples."}
            </p>
          </div>

          {/* Metadatos pedagógicos */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted border-t border-line pt-4">
            <span className="flex items-center gap-1.5">
              <User className="size-3.5 text-muted" />
              <span>Docente: <strong className="text-ink font-medium">{activeCourse.teacher.user.name}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="size-3.5 text-muted" />
              <span>Clase actual: <strong className="text-primary font-mono font-medium">Clase 4 de 8 (50%)</strong></span>
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
              <span>Entrar a la clase de hoy</span>
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
          description="Lo que le contaste a Educai sobre tus objetivos y trabajo."
          action={<TextLink href="/s/context">Editar</TextLink>}
        >
          <Card className="space-y-2 text-sm">
            <LayerTag layer="declared" />
            <dl className="space-y-1.5 text-ink-2 mt-2">
              {[
                ["Contexto laboral", profile.declaredCurrentContext],
                ["Intereses", profile.declaredInterests],
                ["Objetivo personal", profile.declaredGoals],
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
