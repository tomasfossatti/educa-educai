"use client";

import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { Textarea } from "@/components/ui/field";
import { TEXT } from "@/lib/texts";
import { askInFolderAction } from "@/server/actions/folders";

/**
 * Caja de pregunta del chat. Con `conversationId` pregunta en esa charla (o en un hilo con `threadId`);
 * con `folderId` y sin charla, la primera pregunta abre una charla nueva en esa materia.
 */
export function AskForm({
  conversationId,
  folderId,
  threadId,
  autoFocus,
}: {
  conversationId?: string;
  folderId?: string;
  threadId?: string;
  autoFocus?: boolean;
}) {
  const t = TEXT.student.ask;
  const { state, pending, onSubmit, ref } = useActionForm(askInFolderAction, { resetOnSuccess: true });
  return (
    <form ref={ref} method="post" onSubmit={onSubmit} className="space-y-2 border-t border-line pt-4">
      {conversationId && <input type="hidden" name="conversationId" value={conversationId} />}
      {!conversationId && folderId && <input type="hidden" name="folderId" value={folderId} />}
      {threadId && <input type="hidden" name="threadId" value={threadId} />}
      <FormMessage state={state} />
      <Textarea
        name="question"
        aria-label={t.inputLabel}
        placeholder={t.placeholder}
        required
        maxLength={4000}
        autoFocus={autoFocus}
        className="min-h-28 text-base"
      />
      <PendingButton pending={pending} pendingText={t.sending} className="min-h-11 w-full px-6 text-base sm:w-auto">
        {t.send}
      </PendingButton>
    </form>
  );
}
