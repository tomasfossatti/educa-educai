import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/client";
import { EmptyState, List, ListItem, Notice, PageHeader, Section } from "@/components/ui/layout";
import { formatRelative } from "@/lib/format";
import { TEXT } from "@/lib/texts";
import { startFolderConversationAction, startQuizAction } from "@/server/actions/folders";
import { AccessDenied, assertFolderOwner, requireStudent } from "@/server/auth/guards";
import { db } from "@/server/db";
import { UploadConversationForm } from "./upload-form";

export const metadata: Metadata = { title: TEXT.folders.sectionTitle };

export default async function FolderPage({
  params,
  searchParams,
}: {
  params: Promise<{ folderId: string }>;
  searchParams: Promise<{ quizError?: string }>;
}) {
  const { folderId } = await params;
  const { quizError } = await searchParams;
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
  const topics = folder.courseId
    ? await db.curriculumItem.findMany({
        where: { courseId: folder.courseId, status: "ACCEPTED", kind: "CONCEPT" },
        orderBy: { position: "asc" },
        select: { id: true, title: true, masteryRecords: { where: { studentId: user.id }, select: { score: true } } },
      })
    : [];

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
      {folder.courseId && topics.length > 0 && (
        <Section title={TEXT.quiz.practiceTitle} description={TEXT.quiz.practiceDescription}>
          {quizError && <Notice tone="attention">{quizError}</Notice>}
          <List>
            {topics.map((topic) => (
              <ListItem key={topic.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-ink">{topic.title}</span>
                <span className="flex items-center gap-2">
                  <Badge tone="muted">{topic.masteryRecords[0] ? TEXT.quiz.mastery(topic.masteryRecords[0].score) : TEXT.quiz.noMastery}</Badge>
                  <form action={startQuizAction.bind(null, folderId, topic.id)}>
                    <SubmitButton size="sm" variant="secondary" pendingText={TEXT.quiz.starting}>
                      {TEXT.quiz.start}
                    </SubmitButton>
                  </form>
                </span>
              </ListItem>
            ))}
          </List>
        </Section>
      )}
      <Section title={TEXT.upload.title} description={TEXT.upload.hint}>
        <UploadConversationForm folderId={folderId} />
      </Section>
    </div>
  );
}
