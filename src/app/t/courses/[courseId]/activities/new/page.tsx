import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/layout";
import { DEFAULT_ACTIVITY_PROMPTS } from "@/domain/activity";
import { requireCourseTeacher } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ActivityForm } from "../activity-form";

export const metadata: Metadata = { title: "Crear actividad" };

export default async function NewActivityPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await requireCourseTeacher(courseId);
  const items = await db.curriculumItem.findMany({
    where: { courseId, status: "ACCEPTED" },
    orderBy: [{ kind: "asc" }, { position: "asc" }],
    select: { id: true, kind: true, title: true },
  });
  return (
    <>
      <PageHeader title="Crear actividad" />
      <ActivityForm
        courseId={courseId}
        items={items}
        promptsLocked={false}
        defaults={{ title: "", kind: "CHALLENGE", scenario: "", instructions: "", prompts: DEFAULT_ACTIVITY_PROMPTS, itemIds: [] }}
      />
    </>
  );
}
