import type { Metadata } from "next";
import { ButtonLink, TextLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, Section } from "@/components/ui/layout";
import { formatDate } from "@/lib/format";
import { TEXT } from "@/lib/texts";
import { requireEnrolledStudent } from "@/server/auth/guards";
import { db } from "@/server/db";
import { nextApprovedSession } from "@/server/services/class-sessions";
import { ensureStudentFolders } from "@/server/services/folders";

export const metadata: Metadata = { title: "Materia" };

/**
 * Página de una materia: solo datos reales (próxima clase aprobada, última tarea publicada y
 * última conversación). Sin dato, un estado vacío honesto; nunca valores de ejemplo.
 */
export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { user, course } = await requireEnrolledStudent(courseId);
  const t = TEXT.coursePage;

  await ensureStudentFolders(user.id);
  const [folder, nextClass, activity, lastConversation] = await Promise.all([
    db.folder.findFirst({ where: { studentId: user.id, courseId }, select: { id: true } }),
    nextApprovedSession(courseId),
    db.activity.findFirst({
      where: { courseId, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
    db.aIConversation.findFirst({
      where: { courseId, studentId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, folderId: true },
    }),
  ]);

  const conversationHref = lastConversation
    ? lastConversation.folderId
      ? `/s/folders/${lastConversation.folderId}/c/${lastConversation.id}`
      : `/s/courses/${courseId}/tutor/${lastConversation.id}`
    : null;

  return (
    <div className="shell space-y-6">
      <PageHeader
        title={course.name}
        description={t.teacher(course.teacher.user.name)}
        actions={
          folder ? (
            <ButtonLink href={`/s/folders/${folder.id}`} variant="primary">
              {t.ask}
            </ButtonLink>
          ) : null
        }
      />
      <p className="text-muted">{t.askHint}</p>

      <Section title={t.nextClass}>
        {nextClass ? (
          <Card>
            <p className="font-semibold text-ink">
              {formatDate(nextClass.date)} · {nextClass.items.map((i) => i.curriculumItem.title).join(", ")}
            </p>
            {nextClass.objective && <p className="mt-1 text-sm text-muted">{nextClass.objective}</p>}
          </Card>
        ) : (
          <EmptyState title={t.noNextClass} />
        )}
      </Section>

      <Section title={t.task}>
        {activity ? (
          <Card>
            <p className="font-semibold text-ink">{activity.title}</p>
            <TextLink href={`/s/courses/${courseId}/activities/${activity.id}`}>{t.openTask}</TextLink>
          </Card>
        ) : (
          <EmptyState title={t.noTask} />
        )}
      </Section>

      <Section title={t.lastConversation}>
        {lastConversation && conversationHref ? (
          <Card>
            <p className="font-semibold text-ink">{lastConversation.title}</p>
            <TextLink href={conversationHref}>{t.openConversation}</TextLink>
          </Card>
        ) : (
          <EmptyState title={t.noConversation} />
        )}
      </Section>
    </div>
  );
}
