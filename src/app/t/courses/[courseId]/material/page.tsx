import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { EmptyState, List, ListItem, PageHeader, Section } from "@/components/ui/layout";
import { formatDate } from "@/lib/format";
import { TEXT } from "@/lib/texts";
import { requireCourseTeacher } from "@/server/auth/guards";
import { listMaterials } from "@/server/services/material";
import { MaterialUploadForm } from "./upload-form";

export const metadata: Metadata = { title: TEXT.material.title };

const STATUS_TONE = { PROCESSING: "muted", READY: "success", FAILED: "danger" } as const;

export default async function MaterialPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await requireCourseTeacher(courseId);
  const materials = await listMaterials(courseId);
  const t = TEXT.material;

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <div className="space-y-10">
        <Section title={t.uploadLabel}>
          <MaterialUploadForm courseId={courseId} />
        </Section>
        <Section title={t.title}>
          {materials.length === 0 ? (
            <EmptyState title={t.empty}>{t.emptyHint}</EmptyState>
          ) : (
            <List>
              {materials.map((m) => (
                <ListItem key={m.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{m.fileName}</p>
                      <p className="text-xs text-muted">
                        {t.version(m.version)} · {formatDate(m.createdAt)}
                        {m.status === "READY" && m.pageCount != null && ` · ${t.pages(m.pageCount, m.fileName)} · ${t.fragments(m._count.chunks)}`}
                      </p>
                      {m.status === "FAILED" && m.error && <p className="mt-1 text-xs text-danger">{m.error}</p>}
                    </div>
                    <Badge tone={STATUS_TONE[m.status]}>{t.status[m.status]}</Badge>
                  </div>
                </ListItem>
              ))}
            </List>
          )}
        </Section>
      </div>
    </>
  );
}
