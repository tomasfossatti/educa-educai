import type { Metadata } from "next";
import Link from "next/link";
import { EvidenceRow, InferenceRow } from "@/components/domain/rows";
import { LayerTag } from "@/components/domain/status";
import { NextStepItem } from "@/components/domain/next-step";
import { ButtonLink, TextLink } from "@/components/ui/button";
import { AutoRefresh, SubmitButton } from "@/components/ui/client";
import { EmptyState, List, ListItem, Notice, Section } from "@/components/ui/layout";
import { activityKindLabel } from "@/domain/labels";
import { truncate } from "@/domain/text-guards";
import { formatRelative } from "@/lib/format";
import { acceptInviteAction, selectCourseAction } from "@/server/actions/student";
import { requireStudent } from "@/server/auth/guards";
import { getCurrentCourseId, getPendingInvites, getStudentCourses, getStudentHome } from "@/server/services/student-home";

export const metadata: Metadata = { title: "Inicio" };

function experienceHref(courseId: string, experience: { submission: { activityId: string } | null; conversation: { id: string } | null }) {
  if (experience.submission) return `/s/courses/${courseId}/activities/${experience.submission.activityId}`;
  if (experience.conversation) return `/s/courses/${courseId}/tutor/${experience.conversation.id}`;
  return `/s/courses/${courseId}/development`;
}

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
            <h1 className="text-3xl font-extrabold text-white">Hola, {user.name.split(" ")[0]}</h1>
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
  const hasNow =
    home.unseenFeedback.length + home.pendingActivities.length + home.processingRuns + home.failedRuns.length > 0 || invites.length > 0;

  return (
    <div className="shell student-home space-y-10">
      {/* Saludo inicial */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Tu espacio de aprendizaje</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Hola, {user.name.split(" ")[0]}</h1>
        </div>
        <Link
          href="/s/context"
          className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink transition-colors"
        >
          Mi perfil y contexto →
        </Link>
      </div>

      {inviteNotice}

      {/* ──────────────── 1. MATERIA QUE CURSA ESE DÍA (HERO CARD BIEN GRANDE) ──────────────── */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-primary/40 bg-gradient-to-br from-surface-1 via-surface-2/95 to-surface-3 p-8 sm:p-12 shadow-2xl backdrop-blur-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Badge de estado en vivo */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-1 text-xs font-bold text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              CURSADA DE HOY
            </span>
            <span className="text-xs font-mono text-muted">
              Turno: 8:30 a 10:30 hs (o turno tarde)
            </span>
          </div>

          {/* Título de la materia en grande */}
          <div className="space-y-2">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              {activeCourse.name}
            </h2>
            <p className="text-base sm:text-lg text-ink-2 max-w-2xl font-normal leading-relaxed">
              {activeCourse.description || "Tomar decisiones de negocio con evidencia: segmentación, hipótesis falsables y experimentos simples."}
            </p>
          </div>

          {/* Docente y metadatos */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted border-t border-line/60 pt-4">
            <span>Docente: <strong className="text-ink">{activeCourse.teacher.user.name}</strong></span>
            <span>Institución: <strong className="text-ink">Universidad Demo</strong></span>
            <span>Clase actual: <strong className="text-primary font-mono">Clase 4 de 8 (50%)</strong></span>
          </div>

          {/* Botón principal prominente */}
          <div className="pt-2">
            <Link
              href={base}
              className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 px-8 py-4 text-base sm:text-lg font-extrabold text-white shadow-xl hover:shadow-[0_0_30px_rgba(120,150,238,0.5)] hover:scale-[1.02] active:scale-98 transition-all duration-200"
            >
              <span>Entrar a la clase de hoy</span>
              <span className="text-xl" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Si cursa más de una materia, selector adicional */}
      {courses.length > 1 && (
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Otras materias inscriptas</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {courses
              .filter((c) => c.courseId !== activeCourse.id)
              .map((c) => (
                <div key={c.courseId} className="rounded-2xl border border-line bg-surface/80 p-5 backdrop-blur-sm space-y-3">
                  <div>
                    <h4 className="text-base font-bold text-ink">{c.course.name}</h4>
                    <p className="text-xs text-muted mt-0.5">{c.course.teacher.user.name}</p>
                  </div>
                  <form action={selectCourseAction.bind(null, c.courseId)}>
                    <SubmitButton size="sm" variant="secondary">
                      Seleccionar esta materia
                    </SubmitButton>
                  </form>
                </div>
              ))}
          </div>
        </section>
      )}

      <AutoRefresh active={home.processingRuns > 0} intervalMs={4000} />

      {/* ──────────────── SECCIÓN COMPLEMENTARIA: DESARROLLO Y CONTEXTO ──────────────── */}
      <div className="space-y-10 pt-4">
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

        <Section title="Tu contexto declarado" description="Lo que le contaste a Educai sobre tus objetivos y trabajo." action={<TextLink href="/s/context">Editar</TextLink>}>
          <div className="space-y-2 text-sm rounded-2xl border border-line bg-surface/70 p-5">
            <LayerTag layer="declared" />
            <dl className="space-y-1.5 text-ink-2">
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
          </div>
        </Section>
      </div>
    </div>
  );
}
