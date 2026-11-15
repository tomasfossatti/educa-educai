import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState, List, ListItem, PageHeader, Section } from "@/components/ui/layout";
import { formatDate } from "@/lib/format";
import { TEXT } from "@/lib/texts";
import { requireCourseTeacher } from "@/server/auth/guards";
import { db } from "@/server/db";
import { CreateClassForm } from "./create-form";

export const metadata: Metadata = { title: TEXT.classes.title };

export default async function ClassesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await requireCourseTeacher(courseId);
  const [sessions, topics] = await Promise.all([
    db.classSession.findMany({
      where: { courseId },
      orderBy: { date: "asc" },
      select: { id: true, date: true, objective: true, approvedAt: true, slidesDraft: true, items: { select: { curriculumItem: { select: { title: true } } } } },
    }),
    db.curriculumItem.findMany({ where: { courseId, status: "ACCEPTED", kind: "CONCEPT" }, orderBy: { position: "asc" }, select: { id: true, title: true } }),
  ]);
  const t = TEXT.classes;
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <div className="space-y-10">
        <Section title={t.create}>
          <CreateClassForm courseId={courseId} topics={topics} />
        </Section>
        <Section title={t.title}>
          {sessions.length === 0 ? (
            <EmptyState title={t.empty} />
          ) : (
            <List>
              {sessions.map((s) => (
                <ListItem key={s.id}>
                  <Link href={`/t/courses/${courseId}/clases/${s.id}`} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">
                        {formatDate(s.date)} · {s.items.map((i) => i.curriculumItem.title).join(", ")}
                      </span>
                      {s.objective && <span className="block text-xs text-muted">{s.objective}</span>}
                    </span>
                    <Badge tone={s.approvedAt ? "success" : s.slidesDraft ? "primary" : "muted"}>
                      {s.approvedAt ? t.status.approved : s.slidesDraft ? t.status.draft : t.status.none}
                    </Badge>
                  </Link>
                </ListItem>
              ))}
            </List>
          )}
        </Section>
      </div>
    </>
  );
}
