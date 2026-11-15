import type { Metadata } from "next";
import { StudentFileView } from "@/components/domain/student-file-view";
import { List, ListItem, PageHeader, Section } from "@/components/ui/layout";
import { formatDateTime } from "@/lib/format";
import { TEXT } from "@/lib/texts";
import { requireEnrolledStudent } from "@/server/auth/guards";
import { listAccessToMe } from "@/server/services/access-log";
import { loadProjectLinks, loadStudentFile } from "@/server/services/student-file";

export const metadata: Metadata = { title: TEXT.file.myTitle };

export default async function MyFilePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { user } = await requireEnrolledStudent(courseId);
  const viewer = { id: user.id, role: user.role };
  const [file, links, accesses] = await Promise.all([
    loadStudentFile(viewer, user.id, courseId),
    loadProjectLinks(viewer, user.id, courseId),
    listAccessToMe(viewer),
  ]);
  const t = TEXT.file;
  const courseAccesses = accesses.filter((a) => a.courseId === courseId);

  return (
    <>
      <PageHeader title={t.myTitle} description={t.myDescription} />
      <div className="space-y-10">
        <StudentFileView file={file} projectLinks={links} />
        <Section title={t.accessTitle}>
          {courseAccesses.length === 0 ? (
            <p className="text-sm text-muted">{t.accessNone}</p>
          ) : (
            <List>
              {courseAccesses.map((a) => (
                <ListItem key={a.id} className="text-sm">
                  <span className="text-ink">{a.viewerName}</span> {t.accessView[a.view]}
                  <span className="ml-2 text-xs text-muted">{formatDateTime(a.createdAt)}</span>
                </ListItem>
              ))}
            </List>
          )}
        </Section>
      </div>
    </>
  );
}
