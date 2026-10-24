import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AttentionItemRow } from "@/components/domain/attention-item";
import { InferenceRow } from "@/components/domain/rows";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, List, ListItem, PageHeader, Section } from "@/components/ui/layout";
import { cn } from "@/lib/cn";
import { requireCourseTeacher } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getAttentionQueue } from "@/server/services/attention";
import { supportingEvidenceCounts } from "@/server/services/development";

export const metadata: Metadata = { title: "Atención" };

const FILTERS = {
  pending: { label: "Pendientes de revisión", where: { requiresReview: true, reviewStatus: "PENDING" } },
  contradictory: { label: "Contradicciones", where: { supportStatus: "CONTRADICTORY" } },
  context: { label: "Falta contexto", where: { reviewStatus: "NEEDS_CONTEXT" } },
  all: { label: "Todas", where: {} },
} satisfies Record<string, { label: string; where: Prisma.InferenceWhereInput }>;

export default async function AttentionPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { courseId } = await params;
  const { filter: rawFilter } = await searchParams;
  await requireCourseTeacher(courseId);
  const filter = (rawFilter && rawFilter in FILTERS ? rawFilter : "pending") as keyof typeof FILTERS;
  const base = `/t/courses/${courseId}`;

  const [queue, inferences] = await Promise.all([
    getAttentionQueue(courseId),
    db.inference.findMany({
      where: { courseId, state: "ACTIVE", ...FILTERS[filter].where },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 100,
      include: { curriculumItem: { select: { title: true } }, student: { include: { user: { select: { name: true } } } } },
    }),
  ]);
  const counts = await supportingEvidenceCounts(inferences.map((i) => i.id));

  return (
    <>
      <PageHeader title="Atención" description="Attention Queue: priorización → evidencia → decisión. Abrí cualquier ítem para ver la evidencia que lo originó." />
      <div className="space-y-10">
        <Section title="Requiere atención" description={`${queue.length} ${queue.length === 1 ? "ítem" : "ítems"} ordenados por prioridad.`}>
          {queue.length === 0 ? (
            <EmptyState title="Nada requiere atención por ahora" />
          ) : (
            <List>
              {queue.map((item) => (
                <ListItem key={item.key}>
                  <AttentionItemRow item={item} />
                </ListItem>
              ))}
            </List>
          )}
        </Section>

        <Section id="pendientes" title="Inferencias" description="Confirmá, corregí o contextualizá: tus revisiones calibran a Educai.">
          <nav className="flex flex-wrap gap-1 text-sm">
            {(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((key) => (
              <ButtonLink
                key={key}
                href={`${base}/attention?filter=${key}#pendientes`}
                variant={filter === key ? "secondary" : "ghost"}
                size="nav"
                className={filter === key ? "font-semibold text-ink" : undefined}
              >
                {FILTERS[key].label}
              </ButtonLink>
            ))}
          </nav>
          {inferences.length === 0 ? (
            <p className="text-sm text-muted">No hay inferencias en esta vista.</p>
          ) : (
            <List>
              {inferences.map((i) => (
                <ListItem key={i.id}>
                  <InferenceRow
                    audience="teacher"
                    href={`${base}/inferences/${i.id}`}
                    inference={{ ...i, studentName: i.student.user.name, evidenceCount: counts.get(i.id) ?? 0 }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Section>
      </div>
    </>
  );
}
