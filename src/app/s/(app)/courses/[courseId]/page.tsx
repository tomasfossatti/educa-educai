import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/client";
import { Field, Select } from "@/components/ui/field";
import { EmptyState, List, ListItem, PageHeader, Section } from "@/components/ui/layout";
import { curriculumKindPlural, runStatusLabel } from "@/domain/labels";
import { formatDate } from "@/lib/format";
import { startConversationAction } from "@/server/actions/student";
import { requireEnrolledStudent } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Materia" };

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { user, course } = await requireEnrolledStudent(courseId);
  const [items, conversations] = await Promise.all([
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
  ]);
  const concepts = items.filter((i) => i.kind === "CONCEPT");

  return (
    <>
      <PageHeader title={course.name} eyebrow="Materia" description={course.description ?? `Docente: ${course.teacher.user.name}`} />
      <div className="space-y-10">
        <Section
          title="Conversar con el tutor"
          description="El tutor te ayuda a pensar, no te da respuestas para copiar. Cada sesión puede generar evidencia sobre tu razonamiento; conversar no demuestra aprendizaje por sí solo."
        >
          <form action={startConversationAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="courseId" value={courseId} />
            <div className="sm:w-80">
              <Field label="Tema (opcional)" htmlFor="focusItemId">
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
            <SubmitButton pendingText="Abriendo…">Nueva sesión</SubmitButton>
          </form>

          {conversations.length > 0 && (
            <List>
              {conversations.map((c) => {
                const run = c.experience.runs[0];
                return (
                  <ListItem key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/s/courses/${courseId}/tutor/${c.id}`} className="text-sm font-medium text-ink hover:text-primary">
                        {c.title}
                      </Link>
                      <p className="text-xs text-muted">
                        {formatDate(c.createdAt)} · {c._count.messages} mensajes
                        {c.experience._count.evidence > 0 ? ` · ${c.experience._count.evidence} evidencias` : ""}
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

        <Section title="Qué trabaja la materia" description="La currícula que tu docente confirmó. Es la referencia con la que Educai interpreta la evidencia.">
          {items.length === 0 ? (
            <EmptyState title="Tu docente todavía no confirmó la currícula">Igual podés conversar con el tutor sobre la materia.</EmptyState>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {(["CONCEPT", "OBJECTIVE", "COMPETENCY"] as const).map((kind) => {
                const list = items.filter((i) => i.kind === kind);
                if (list.length === 0) return null;
                return (
                  <div key={kind}>
                    <h3 className="mb-2 text-sm font-medium text-ink">{curriculumKindPlural[kind]}</h3>
                    <ul className="space-y-1.5 text-sm text-ink-2">
                      {list.map((i) => (
                        <li key={i.id}>
                          <span className="text-ink">{i.title}</span>
                          {i.description && <span className="text-muted"> — {i.description}</span>}
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
    </>
  );
}
