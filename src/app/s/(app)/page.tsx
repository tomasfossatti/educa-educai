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
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#27251e]">
              <span>
                {invite.course.name} · <strong className="font-medium">{invite.course.teacher.user.name}</strong>
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
      <div className="w-full max-w-[900px] mx-auto space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#27251e]">
            Hola, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-[#72706b] font-normal">Bienvenido a tu espacio de aprendizaje.</p>
        </div>
        {inviteNotice}
        <EmptyState
          title="Todavía no estás en ninguna materia"
          action={
            <ButtonLink href="/s/join" variant="primary">
              Unirme con un código
            </ButtonLink>
          }
        >
          Sumate con el código que te compartió tu docente para empezar a estudiar.
        </EmptyState>
      </div>
    );
  }

  const primaryEnrollment = courses.find((c) => c.courseId === courseId) || courses[0];
  const activeCourse = primaryEnrollment.course;
  const home = await getStudentHome(user.id, activeCourse.id);
  const base = `/s/courses/${activeCourse.id}`;

  return (
    <div className="w-full max-w-[900px] mx-auto space-y-8">
      {/* ──────────────── CABECERA: SALUDO CALMO Y ACCESO A CONTEXTO ──────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#92918b]">
            Tu espacio de aprendizaje
          </span>
          <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#27251e] leading-snug">
            Hola, {user.name.split(" ")[0]}
          </h1>
        </div>
        <div>
          <Link
            href="/s/context"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#d1d1cd] bg-[#fdfbfa] px-3.5 py-1.5 text-xs font-normal text-[#72706b] hover:text-[#27251e] hover:border-[#27251e] transition-colors"
          >
            <span>Mi perfil y contexto</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      {inviteNotice}

      {/* ──────────────── 1. HERO CARD: CURSADA DE HOY (SOFT PAPER CARD) ──────────────── */}
      <section className="relative rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.08)] space-y-6">
        {/* Badge superior de cursada */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#016a71] px-3 py-0.5 text-[11px] font-medium text-white tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            CURSADA DE HOY
          </span>
          <span className="text-xs text-[#72706b] font-normal">
            Turno: 8:30 a 10:30 hs (o turno tarde)
          </span>
        </div>

        {/* Título y descripción */}
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#27251e] leading-snug">
            {activeCourse.name}
          </h2>
          <p className="text-sm sm:text-base text-[#72706b] max-w-2xl font-normal leading-relaxed">
            {activeCourse.description ||
              "Tomar decisiones de negocio con evidencia: segmentación, hipótesis falsables y experimentos simples."}
          </p>
        </div>

        {/* Metadatos en hairline divider */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#72706b] border-t border-[#d1d1cd] pt-4 font-normal">
          <span>
            Docente: <strong className="text-[#27251e] font-medium">{activeCourse.teacher.user.name}</strong>
          </span>
          <span>
            Institución: <strong className="text-[#27251e] font-medium">Universidad Demo</strong>
          </span>
          <span>
            Clase actual: <strong className="text-[#016a71] font-medium">Clase 4 de 8 (50%)</strong>
          </span>
        </div>

        {/* Botón de acción principal: Ink filled action button */}
        <div className="pt-1">
          <Link
            href={base}
            className="inline-flex items-center gap-2 rounded-xl bg-[#27251e] px-6 py-3 text-sm font-medium text-[#faf8f5] shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-[#3d3b32] active:scale-[0.99] transition-all duration-150"
          >
            <span>Entrar a la clase de hoy</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* ──────────────── SELECTOR DE OTRAS MATERIAS ──────────────── */}
      {courses.length > 1 && (
        <section className="space-y-3">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-[#92918b]">
            Otras materias inscriptas
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {courses
              .filter((c) => c.courseId !== activeCourse.id)
              .map((c) => (
                <div
                  key={c.courseId}
                  className="rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] space-y-3"
                >
                  <div>
                    <h4 className="text-sm font-medium text-[#27251e]">{c.course.name}</h4>
                    <p className="text-xs text-[#72706b] mt-0.5">{c.course.teacher.user.name}</p>
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

      {/* ──────────────── SECCIÓN: DESARROLLO Y CONTEXTO ──────────────── */}
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
          description="Lo que le contaste a Educai sobre tus objetivos y trabajo para personalizar ejemplos."
          action={<TextLink href="/s/context">Editar</TextLink>}
        >
          <div className="space-y-3 text-sm rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            <LayerTag layer="declared" />
            <dl className="space-y-2 text-[#72706b] text-sm leading-relaxed">
              {[
                ["Contexto laboral", profile.declaredCurrentContext],
                ["Intereses", profile.declaredInterests],
                ["Objetivo personal", profile.declaredGoals],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="inline text-[#72706b]">{label}: </dt>
                    <dd className="inline font-medium text-[#27251e]">{truncate(value!, 220)}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </Section>
      </div>
    </div>
  );
}
