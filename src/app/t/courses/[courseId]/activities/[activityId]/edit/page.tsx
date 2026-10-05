import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TextLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/layout";
import { parseActivityPrompts } from "@/domain/activity";
import { requireCourseTeacher } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ActivityForm } from "../../activity-form";

export const metadata: Metadata = { title: "Editar actividad" };

export default async function EditActivityPage({ params }: { params: Promise<{ courseId: string; activityId: string }> }) {
  const { courseId, activityId } = await params;
  await requireCourseTeacher(courseId);
  const activity = await db.activity.findFirst({
    where: { id: activityId, courseId },
    include: { curriculumLinks: true, _count: { select: { submissions: { where: { status: "SUBMITTED" } } } } },
  });
  if (!activity) notFound();
  const items = await db.curriculumItem.findMany({
    where: { courseId, status: "ACCEPTED" },
    orderBy: [{ kind: "asc" }, { position: "asc" }],
    select: { id: true, kind: true, title: true },
  });
  return (
    <>
      <PageHeader eyebrow={<TextLink href={`/t/courses/${courseId}/activities/${activityId}`}>← {activity.title}</TextLink>} title="Editar actividad" />
      <ActivityForm
        courseId={courseId}
        items={items}
        promptsLocked={activity._count.submissions > 0}
        defaults={{
          id: activity.id,
          title: activity.title,
          kind: activity.kind,
          scenario: activity.scenario,
          instructions: activity.instructions,
          prompts: parseActivityPrompts(activity.prompts),
          itemIds: activity.curriculumLinks.map((l) => l.curriculumItemId),
          status: activity.status,
        }}
      />
    </>
  );
}
