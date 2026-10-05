import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, List, ListItem, PageHeader } from "@/components/ui/layout";
import { activityKindLabel, activityStatusLabel } from "@/domain/labels";
import { formatDate } from "@/lib/format";
import { requireCourseTeacher } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Actividades" };

export default async function TeacherActivitiesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await requireCourseTeacher(courseId);
  const activities = await db.activity.findMany({
    where: { courseId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { submissions: { where: { status: "SUBMITTED" } } } } },
  });
  const base = `/t/courses/${courseId}/activities`;
  return (
    <>
      <PageHeader
        title="Actividades"
        description="Challenges y prácticas para observar aplicación. Las conversaciones muestran cómo piensan; las actividades, qué hacen con lo que piensan."
        actions={<ButtonLink href={`${base}/new`} variant="primary">Crear actividad</ButtonLink>}
      />
      {activities.length === 0 ? (
        <EmptyState title="Todavía no hay actividades" action={<ButtonLink href={`${base}/new`} variant="primary">Crear actividad</ButtonLink>}>
          Un buen comienzo es un challenge inicial breve: genera el primer snapshot de cada estudiante.
        </EmptyState>
      ) : (
        <List>
          {activities.map((a) => (
            <ListItem key={a.id} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link href={`${base}/${a.id}`} className="text-sm font-medium text-ink hover:text-primary">
                  {a.title}
                </Link>
                <p className="text-xs text-muted">
                  {activityKindLabel[a.kind]} · {a._count.submissions} entregas · creada {formatDate(a.createdAt)}
                </p>
              </div>
              <Badge tone={a.status === "PUBLISHED" ? "primary" : "muted"}>{activityStatusLabel[a.status]}</Badge>
            </ListItem>
          ))}
        </List>
      )}
    </>
  );
}
