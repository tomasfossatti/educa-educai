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
import { UploadConversationForm } from "./upload-form";

export const metadata: Metadata = { title: TEXT.folders.sectionTitle };

export default async function FolderPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await params;
  const { user } = await requireStudent();
  const folder = await assertFolderOwner({ id: user.id, role: user.role }, folderId).catch((e) => {
    if (e instanceof AccessDenied) notFound();
    throw e;
  });
  const conversations = await db.aIConversation.findMany({
    where: { folderId, studentId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, origin: true, createdAt: true, _count: { select: { messages: true } } },
  });

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
      {!folder.courseId && <Notice>{TEXT.folders.projectNoMaterial}</Notice>}
      <Section title={TEXT.folders.conversations}>
        {conversations.length === 0 ? (
          <EmptyState title={TEXT.folders.noConversations} />
        ) : (
          <List>
            {conversations.map((c) => (
              <ListItem key={c.id}>
                <Link href={`/s/folders/${folderId}/c/${c.id}`} className="flex items-center justify-between gap-2">
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
      <Section title={TEXT.upload.title} description={TEXT.upload.hint}>
        <UploadConversationForm folderId={folderId} />
      </Section>
    </div>
  );
}
