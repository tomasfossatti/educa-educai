import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState, List, ListItem, PageHeader } from "@/components/ui/layout";
import { activityKindLabel, runStatusLabel } from "@/domain/labels";
import { formatDate } from "@/lib/format";
import { requireEnrolledStudent } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Actividades" };

export default async function StudentActivitiesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { user, course } = await requireEnrolledStudent(courseId);
  const activities = await db.activity.findMany({
    where: { courseId, status: { in: ["PUBLISHED", "CLOSED"] } },
    orderBy: { publishedAt: "desc" },
    include: {
      submissions: {
        where: { studentId: user.id },
        orderBy: { attempt: "desc" },
        take: 1,
        include: { experience: { include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } } } },
      },
    },
  });

  return (
    <>
      <PageHeader
        eyebrow={course.name}
        title="Actividades"
        description="Challenges y prácticas para aplicar lo que estás aprendiendo. Cada entrega genera evidencia sobre qué hacés con lo que pensás."
      />
      {activities.length === 0 ? (
        <EmptyState title="Todavía no hay actividades publicadas">Cuando tu docente publique una, aparecerá acá.</EmptyState>
      ) : (
        <List>
          {activities.map((a) => {
            const submission = a.submissions[0];
            const run = submission?.experience.runs[0];
            let status: { label: string; tone: "primary" | "muted" | "neutral" | "danger" } = { label: "Pendiente", tone: "primary" };
            if (submission?.status === "DRAFT") status = { label: "Borrador guardado", tone: "neutral" };
            if (submission?.status === "SUBMITTED")
              status = { label: run ? `Entregada · ${runStatusLabel[run.status]}` : "Entregada", tone: run?.status === "FAILED" ? "danger" : "muted" };
            if (!submission && a.status === "CLOSED") status = { label: "Cerrada", tone: "muted" };
            return (
              <ListItem key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/s/courses/${courseId}/activities/${a.id}`} className="text-sm font-medium text-[#27251e] hover:text-[#016a71] transition-colors">
                    {a.title}
                  </Link>
                  <p className="text-xs text-[#72706b] font-normal">
                    {activityKindLabel[a.kind]} · publicada {formatDate(a.publishedAt)}
                  </p>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
              </ListItem>
            );
          })}
        </List>
      )}
    </>
  );
}
