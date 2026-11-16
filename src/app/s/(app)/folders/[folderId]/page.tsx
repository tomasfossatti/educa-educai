import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/client";
import { EmptyState, List, ListItem, Notice, PageHeader, Section } from "@/components/ui/layout";
import { formatRelative } from "@/lib/format";
import { TEXT } from "@/lib/texts";
import { startFolderConversationAction } from "@/server/actions/folders";
import { AccessDenied, assertFolderOwner, requireStudent } from "@/server/auth/guards";
import { db } from "@/server/db";
import { listFolderContext } from "@/server/services/folder-context";
import { listMaterials } from "@/server/services/material";
import { ContextSection } from "./context-section";
import { UploadConversationForm } from "./upload-form";
import { BudgetNotice } from "@/components/student/budget-notice";

export const metadata: Metadata = { title: TEXT.folders.sectionTitle };

export default async function FolderPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await params;
  const { user, profile } = await requireStudent();
  const folder = await assertFolderOwner({ id: user.id, role: user.role }, folderId).catch((e) => {
    if (e instanceof AccessDenied) notFound();
    throw e;
  });
  const conversations = await db.aIConversation.findMany({
    where: { folderId, studentId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, origin: true, createdAt: true, _count: { select: { messages: true } } },
  });
  const context = await listFolderContext({ id: user.id, role: user.role }, folderId);
  // Carpeta de una materia traída del LMS por el estudiante: su propio material (solo lo ve él).
  const ownMaterial = folder.kind === "SUBJECT" && !folder.courseId ? await listMaterials({ folderId }) : null;

  return (
    <div className="shell space-y-10">
      <PageHeader
        title={folder.name}
        description={TEXT.folders.kind[folder.kind]}
        actions={
          <form action={startFolderConversationAction.bind(null, folderId)}>
            <SubmitButton pendingText={TEXT.folders.starting}>{TEXT.folders.newConversation}</SubmitButton>
          </form>
        }
      />
      <BudgetNotice studentId={user.id} />
      {!folder.courseId && !ownMaterial?.length && <Notice>{TEXT.folders.projectNoMaterial}</Notice>}
      <Section title={TEXT.folders.conversations}>
        {conversations.length === 0 ? (
          <EmptyState title={TEXT.folders.noConversations} />
        ) : (
          <List>
            {conversations.map((c) => (
              <ListItem key={c.id}>
                <Link href={`/s/c/${c.id}`} className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-ink">{c.title}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    {c.origin === "UPLOAD" && <Badge tone="muted">{TEXT.folders.uploaded}</Badge>}
                    {formatRelative(c.createdAt)}
                  </span>
                </Link>
              </ListItem>
            ))}
          </List>
        )}
      </Section>
      {ownMaterial && (
        <Section title={TEXT.lms.material.title} description={TEXT.lms.material.description}>
          {ownMaterial.length === 0 ? (
            <EmptyState title={TEXT.lms.material.empty} />
          ) : (
            <List>
              {ownMaterial
                .slice()
                .sort((a, b) => a.fileName.localeCompare(b.fileName, "es", { numeric: true }))
                .map((m) => (
                  <ListItem key={m.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-ink">{m.fileName}</span>
                    <Badge tone={m.status === "READY" ? "muted" : "attention"}>{TEXT.material.status[m.status]}</Badge>
                  </ListItem>
                ))}
            </List>
          )}
        </Section>
      )}
      <ContextSection summary={context.summary} facts={context.facts} trace={context.trace} consent={Boolean(profile.consentAnalysisAt)} />
      <Section title={TEXT.upload.title} description={TEXT.upload.hint}>
        <UploadConversationForm folderId={folderId} />
      </Section>
    </div>
  );
}
