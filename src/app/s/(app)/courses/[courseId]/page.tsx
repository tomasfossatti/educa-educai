import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/client";
import { Field, Select } from "@/components/ui/field";
import { EmptyState, List, ListItem, Section } from "@/components/ui/layout";
import { ClassDashboard } from "@/components/student/class-dashboard";
import { FloatingTutor } from "@/components/student/floating-tutor";
import { curriculumKindPlural, runStatusLabel } from "@/domain/labels";
import { formatDate } from "@/lib/format";
import { startConversationAction } from "@/server/actions/student";
import { requireEnrolledStudent } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Clase de hoy" };

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { user, course } = await requireEnrolledStudent(courseId);

  const [items, conversations, profile, activity] = await Promise.all([
    db.curriculumItem.findMany({
      where: { courseId, status: "ACCEPTED", kind: { in: ["CONCEPT", "OBJECTIVE", "COMPETENCY"] } },
      orderBy: [{ kind: "asc" }, { position: "asc" }],
    }),
    db.aIConversation.findMany({
      where: { courseId, studentId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { messages: true } },
        experience: { include: { runs: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { evidence: true } } } },
      },
    }),
    db.studentProfile.findUnique({ where: { userId: user.id } }),
    db.activity.findFirst({
      where: { courseId, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const concepts = items.filter((i) => i.kind === "CONCEPT");
  const activeConversation = conversations.find((c) => c.status === "ACTIVE") || conversations[0];

  // Objetivo general de la clase de hoy (extraído de la currícula)
  const currentConcept = concepts.find((c) => c.title.toLowerCase().includes("hipótesis")) || concepts[0];
  const learningGoal = currentConcept
    ? `${currentConcept.title}: ${currentConcept.description}`
    : "Formular hipótesis de negocio falsables (métrica, umbral y plazo) para no perder tiempo ni plata en ideas que no funcionan.";

  // Personalización basada en el perfil declarado del estudiante
  let personalizedApplication = "aplicar hipótesis falsables a tus decisiones profesionales y proyectos personales.";
  if (profile?.declaredCurrentContext) {
    if (profile.declaredCurrentContext.toLowerCase().includes("restaurante")) {
      personalizedApplication = "formular hipótesis falsables para validar promociones, combos y el nuevo menú semanal en tu restaurante en Rosario.";
    } else if (profile.declaredCurrentContext.toLowerCase().includes("diseño") || profile.declaredCurrentContext.toLowerCase().includes("interfaces")) {
      personalizedApplication = "definir métricas de usabilidad y testear hipótesis de comportamiento antes de diseñar interfaces completas.";
    } else if (profile.declaredCurrentContext.toLowerCase().includes("logística") || profile.declaredCurrentContext.toLowerCase().includes("commerce")) {
      personalizedApplication = "medir hipótesis de entrega y satisfacción de clientes antes de modificar los flujos logísticos del e-commerce.";
    } else {
      personalizedApplication = `aplicar experimentos simples y supuestos falsables en: ${profile.declaredCurrentContext.slice(0, 120)}.`;
    }
  }

  return (
    <div className="relative">
      {/* ──────────────── 1. DASHBOARD DE CLASE PRINCIPAL ──────────────── */}
      <ClassDashboard
        courseId={courseId}
        courseName={course.name}
        teacherName={course.teacher.user.name}
        totalClasses={8}
        currentClassNumber={4}
        learningGoal={learningGoal}
        personalizedApplication={personalizedApplication}
        activity={
          activity
            ? {
                id: activity.id,
                title: activity.title,
                description: activity.scenario || activity.instructions || "Actividad práctica de aplicación de clase.",
                isUnlocked: false,
              }
            : null
        }
        activeConversation={
          activeConversation
            ? {
                id: activeConversation.id,
                title: activeConversation.title,
                messageCount: activeConversation._count.messages,
              }
            : null
        }
      />

      {/* ──────────────── 2. CHAT IA FLOTANTE EN LA ESQUINA INFERIOR DERECHA ──────────────── */}
      <FloatingTutor
        courseId={courseId}
        courseName={course.name}
        topicTitle={currentConcept?.title || "Hipótesis falsables"}
        initialConversationId={activeConversation?.id}
      />

      {/* ──────────────── 3. SECCIÓN COMPLEMENTARIA: HISTORIAL Y CURRÍCULA ──────────────── */}
      <div className="space-y-10 border-t border-line/60 pt-10">
        <Section
          title="Historial de sesiones con el tutor"
          description="Sesiones de diálogo guiado. El tutor formula preguntas para profundizar tu razonamiento."
        >
          <form action={startConversationAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="courseId" value={courseId} />
            <div className="sm:w-80">
              <Field label="Tema específico (opcional)" htmlFor="focusItemId">
                <Select id="focusItemId" name="focusItemId" defaultValue="">
                  <option value="">Tema libre de la materia</option>
                  {concepts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <SubmitButton pendingText="Abriendo…">Nueva sesión de estudio</SubmitButton>
          </form>

          {conversations.length > 0 && (
            <List>
              {conversations.map((c) => {
                const run = c.experience.runs[0];
                return (
                  <ListItem key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/s/courses/${courseId}/tutor/${c.id}`} className="text-sm font-semibold text-ink hover:text-primary">
                        {c.title}
                      </Link>
                      <p className="text-xs text-muted">
                        {formatDate(c.createdAt)} · {c._count.messages} mensajes
                        {c.experience._count.evidence > 0 ? ` · ${c.experience._count.evidence} evidencias registradas` : ""}
                      </p>
                    </div>
                    {c.status === "ACTIVE" ? (
                      <Badge tone="primary">En curso</Badge>
                    ) : (
                      <Badge tone={run?.status === "FAILED" ? "danger" : "muted"}>{run ? runStatusLabel[run.status] : "Cerrada"}</Badge>
                    )}
                  </ListItem>
                );
              })}
            </List>
          )}
        </Section>

        <Section title="Programa confirmado de la materia" description="Los contenidos, objetivos y competencias que estructuran el curso.">
          {items.length === 0 ? (
            <EmptyState title="Tu docente todavía no confirmó la currícula">Igual podés conversar con el tutor sobre la materia.</EmptyState>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {(["CONCEPT", "OBJECTIVE", "COMPETENCY"] as const).map((kind) => {
                const list = items.filter((i) => i.kind === kind);
                if (list.length === 0) return null;
                return (
                  <div key={kind} className="rounded-2xl border border-line bg-surface/80 p-5 backdrop-blur-sm">
                    <h3 className="mb-2 text-sm font-bold text-ink uppercase tracking-wide">{curriculumKindPlural[kind]}</h3>
                    <ul className="space-y-2 text-sm text-ink-2">
                      {list.map((i) => (
                        <li key={i.id} className="border-b border-line/40 pb-1.5 last:border-0">
                          <span className="font-semibold text-ink">{i.title}</span>
                          {i.description && <p className="text-xs text-muted mt-0.5">{i.description}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
