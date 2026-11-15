import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TextLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/client";
import { Notice, PageHeader } from "@/components/ui/layout";
import { formatDate } from "@/lib/format";
import { TEXT } from "@/lib/texts";
import { approveSlidesAction, generateSlidesAction } from "@/server/actions/teacher";
import { AccessDenied, requireCourseTeacher } from "@/server/auth/guards";
import { getClassSession } from "@/server/services/class-sessions";
import { SlidesEditor } from "./slides-editor";

export const metadata: Metadata = { title: "Slides" };

export default async function ClassSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; sessionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { courseId, sessionId } = await params;
  const { error } = await searchParams;
  const { user } = await requireCourseTeacher(courseId);
  const session = await getClassSession({ id: user.id, role: user.role }, sessionId).catch((e) => {
    if (e instanceof AccessDenied) notFound();
    throw e;
  });
  if (session.courseId !== courseId) notFound();
  const t = TEXT.classes;
  const topics = session.items.map((i) => i.curriculumItem.title).join(", ");

  return (
    <>
      <PageHeader
        eyebrow={<TextLink href={`/t/courses/${courseId}/clases`}>← {t.title}</TextLink>}
        title={`${formatDate(session.date)} · ${topics}`}
        description={session.objective ?? undefined}
        actions={
          <form action={generateSlidesAction.bind(null, courseId, session.id)}>
            <SubmitButton variant={session.slides.length ? "secondary" : "primary"} pendingText={t.generating}>
              {session.slides.length ? t.regenerate : t.generate}
            </SubmitButton>
          </form>
        }
      />
      <div className="space-y-6">
        {error && <Notice tone="error">{error}</Notice>}
        {session.slides.length > 0 && <p className="text-xs text-muted">{t.regenerateNote}</p>}
        {session.approvedAt && <Notice tone="success">{t.approved(formatDate(session.approvedAt))}</Notice>}
        {session.slides.length > 0 && (
          <>
            <SlidesEditor courseId={courseId} sessionId={session.id} slides={session.slides} />
            <div className="flex flex-wrap gap-3">
              {!session.approvedAt && (
                <form action={approveSlidesAction.bind(null, courseId, session.id)}>
                  <SubmitButton>{t.approve}</SubmitButton>
                </form>
              )}
              <a
                href={`/t/courses/${courseId}/clases/${session.id}/pptx`}
                className="inline-flex h-9 items-center rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-surface-2"
              >
                {t.download}
              </a>
            </div>
          </>
        )}
      </div>
    </>
  );
}
