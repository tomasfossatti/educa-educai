import type { Metadata } from "next";
import { AskForm } from "@/components/student/ask-form";
import { BudgetNotice } from "@/components/student/budget-notice";
import { ChatMessages } from "@/components/student/chat-messages";
import { CourseSelector } from "@/components/student/course-selector";
import { SelectionAsk } from "@/components/student/selection-ask";
import { SubmitButton } from "@/components/ui/client";
import { formatDate } from "@/lib/format";
import { TEXT } from "@/lib/texts";
import { acceptInviteAction, closeConversationAction } from "@/server/actions/student";
import { requireStudent } from "@/server/auth/guards";
import { closeInactiveConversations, expireStaleRuns } from "@/server/engine/trigger";
import { nextApprovedSession } from "@/server/services/class-sessions";
import { getPendingInvites } from "@/server/services/student-home";
import { citedChunks, getActiveConversation, getPanelState } from "@/server/services/student-panel";
import { JoinForm } from "./join/join-form";

export const metadata: Metadata = { title: "Preguntar" };

/**
 * Preguntar: la pantalla de inicio es el chat de la materia actual (decisión de Tomás del 2026-11-16).
 * Una caja grande y un botón. Sin materia, una sola pantalla con el código.
 */
export default async function StudentHome() {
  const { user } = await requireStudent();
  const viewer = { id: user.id, role: user.role };
  await closeInactiveConversations({ studentId: user.id });
  await expireStaleRuns(user.id);
  const [{ options, current }, invites] = await Promise.all([getPanelState(viewer), getPendingInvites(user.email)]);
  const s = TEXT.student;

  const inviteCards = invites.map((invite) => (
    <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-surface p-4">
      <p className="text-base text-ink">{s.invite.text(invite.course.name, invite.course.teacher.user.name)}</p>
      <form action={acceptInviteAction.bind(null, invite.id)}>
        <SubmitButton pendingText={s.invite.joining} className="min-h-11 px-6 text-base">
          {s.invite.join}
        </SubmitButton>
      </form>
    </div>
  ));

  if (!current) {
    return (
      <div className="shell mx-auto max-w-md space-y-6">
        {inviteCards}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-ink">{s.noCourse.title}</h1>
          <p className="text-muted">{s.noCourse.hint}</p>
        </div>
        <JoinForm autoFocus={invites.length === 0} />
      </div>
    );
  }

  const [conversation, nextClass] = await Promise.all([
    getActiveConversation(viewer, current.folderId),
    current.courseId ? nextApprovedSession(current.courseId) : null,
  ]);
  const chunks = conversation ? await citedChunks(current, conversation.messages.map((m) => m.citations)) : new Map<string, string>();
  const hasMessages = Boolean(conversation && conversation.messages.length > 0);

  return (
    <div className="shell mx-auto max-w-3xl space-y-5">
      {inviteCards}
      <CourseSelector options={options} current={current} next="/s" />
      {nextClass && (
        <p className="text-sm text-muted">
          {s.ask.nextClass(formatDate(nextClass.date), nextClass.items.map((i) => i.curriculumItem.title).join(", "))}
          {nextClass.objective ? ` · ${nextClass.objective}` : ""}
        </p>
      )}
      {current.kind === "PROJECT" && <p className="text-sm text-muted">{s.ask.noMaterial}</p>}
      <BudgetNotice studentId={user.id} />
      {conversation && hasMessages && (
        <SelectionAsk conversationId={conversation.id}>
          <ChatMessages messages={conversation.messages} chunks={chunks} />
        </SelectionAsk>
      )}
      <AskForm conversationId={conversation?.id} folderId={current.folderId} autoFocus />
      {conversation && hasMessages && (
        <form action={closeConversationAction.bind(null, conversation.id)}>
          <SubmitButton variant="ghost" pendingText={s.ask.finishing} className="min-h-11">
            {s.ask.finish}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
