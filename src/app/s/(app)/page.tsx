import type { Metadata } from "next";
import Link from "next/link";
import { EvidenceRow, InferenceRow } from "@/components/domain/rows";
import { LayerTag } from "@/components/domain/status";
import { NextStepItem } from "@/components/domain/next-step";
import { ButtonLink, TextLink } from "@/components/ui/button";
import { AutoRefresh, SubmitButton } from "@/components/ui/client";
import { EmptyState, List, ListItem, Notice, PageHeader, Section } from "@/components/ui/layout";
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

  if (!courseId) {
    return (
      <>
        <PageHeader title={`Hola, ${user.name.split(" ")[0]}`} />
        <div className="space-y-4">
          {inviteNotice}
          <EmptyState title="Todavía no estás en ninguna materia" action={<ButtonLink href="/s/join" variant="primary">Unirme con un código</ButtonLink>}>
            Sumate con el código que te compartió tu docente para empezar.
          </EmptyState>
        </div>
      </>
    );
  }

  const course = courses.find((c) => c.courseId === courseId)!.course;
  const home = await getStudentHome(user.id, courseId);
  const base = `/s/courses/${courseId}`;
  const hasNow =
    home.unseenFeedback.length + home.pendingActivities.length + home.processingRuns + home.failedRuns.length > 0 || invites.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={course.name}
        title={`Hola, ${user.name.split(" ")[0]}`}
        actions={
          courses.length > 1 ? (
            <div className="flex flex-wrap gap-1">
              {courses
                .filter((c) => c.courseId !== courseId)
                .map((c) => (
                  <form key={c.courseId} action={selectCourseAction.bind(null, c.courseId)}>
                    <SubmitButton size="sm" variant="secondary">
                      Ver {c.course.name}
                    </SubmitButton>
                  </form>
                ))}
            </div>
          ) : undefined
        }
      />
      <AutoRefresh active={home.processingRuns > 0} intervalMs={4000} />

      <div className="space-y-10">
        <Section title="Ahora" description="Lo que necesita tu atención.">
          {!hasNow ? (
            <p className="text-sm text-muted">Nada pendiente por ahora.</p>
          ) : (
            <div className="space-y-3">
              {inviteNotice}
              <List>
                {home.processingRuns > 0 && (
                  <ListItem className="text-sm text-ink-2">
                    Educai está analizando {home.processingRuns === 1 ? "una experiencia reciente" : `${home.processingRuns} experiencias recientes`}…
                  </ListItem>
                )}
                {home.unseenFeedback.map((f) => (
                  <ListItem key={f.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      Nuevo feedback sobre <span className="font-medium">{f.experience.title}</span>
                    </span>
                    <TextLink href={experienceHref(courseId, f.experience)}>Ver feedback</TextLink>
                  </ListItem>
                ))}
                {home.failedRuns.map((r) => (
                  <ListItem key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>No se pudo analizar «{r.experience.title}».</span>
                    <TextLink href={experienceHref(courseId, r.experience)}>Ver y reintentar</TextLink>
                  </ListItem>
                ))}
                {home.pendingActivities.map((a) => (
                  <ListItem key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      {activityKindLabel[a.kind]} pendiente: <span className="font-medium">{a.title}</span>
                    </span>
                    <TextLink href={`${base}/activities/${a.id}`}>Hacer actividad</TextLink>
                  </ListItem>
                ))}
              </List>
            </div>
          )}
        </Section>

        <Section
          title="Tu desarrollo"
          description="Lo que aparece respaldado por evidencia reciente. Son hipótesis, no verdades sobre vos."
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

        <Section title="Próximo paso" description="Qué convendría practicar, revisar o intentar.">
          {home.actions.length === 0 ? (
            <p className="text-sm text-muted">
              No hay próximos pasos sugeridos todavía. Podés <TextLink href={base}>conversar con el tutor</TextLink> sobre un tema de la materia.
            </p>
          ) : (
            <List>
              {home.actions.map((a) => (
                <ListItem key={a.id}>
                  <NextStepItem action={a} courseId={courseId} />
                </ListItem>
              ))}
            </List>
          )}
        </Section>

        <Section
          title="Evidencia"
          description="Por qué Educai muestra estas conclusiones: lo que produjiste, con su fuente."
          action={home.evidence.length > 0 ? <TextLink href={`${base}/development#evidencia`}>Ver toda</TextLink> : undefined}
        >
          {home.evidence.length === 0 ? (
            <p className="text-sm text-muted">Todavía no hay evidencia registrada.</p>
          ) : (
            <List>
              {home.evidence.map((e) => (
                <ListItem key={e.id}>
                  <EvidenceRow evidence={e} href={`${base}/evidence/${e.id}`} />
                </ListItem>
              ))}
            </List>
          )}
        </Section>

        <Section title="Tu contexto" description="Lo que declaraste sobre vos." action={<TextLink href="/s/context">Revisar o editar</TextLink>}>
          <div className="space-y-2 text-sm">
            <LayerTag layer="declared" />
            <dl className="space-y-1.5 text-ink-2">
              {[
                ["Contexto", profile.declaredCurrentContext],
                ["Intereses", profile.declaredInterests],
                ["Objetivos", profile.declaredGoals],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="inline text-muted">{label}: </dt>
                    <dd className="inline">{truncate(value!, 220)}</dd>
                  </div>
                ))}
            </dl>
            <p className="text-xs text-muted">
              Actualizado {formatRelative(profile.declaredUpdatedAt)}. {profile.shareContextWithTeachers ? "Tu docente puede verlo." : "Solo lo ves vos."}{" "}
              {!profile.consentAnalysisAt && (
                <>
                  El análisis de evidencia está desactivado: <Link href="/s/context" className="text-primary hover:underline">activarlo</Link>.
                </>
              )}
            </p>
          </div>
        </Section>
      </div>
    </>
  );
}
