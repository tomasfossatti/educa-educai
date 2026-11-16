"use client";

import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { Textarea } from "@/components/ui/field";
import { TEXT } from "@/lib/texts";
import { askInFolderAction } from "@/server/actions/folders";

export function AskForm({ conversationId, threadId }: { conversationId: string; threadId?: string }) {
  const t = TEXT.student.ask;
  const { state, pending, onSubmit, ref } = useActionForm(askInFolderAction, { resetOnSuccess: true });
  return (
    <form ref={ref} method="post" onSubmit={onSubmit} className="space-y-2 border-t border-line pt-4">
      <input type="hidden" name="conversationId" value={conversationId} />
      {threadId && <input type="hidden" name="threadId" value={threadId} />}
      <FormMessage state={state} />
      <Textarea name="question" aria-label={t.inputLabel} placeholder={t.placeholder} required maxLength={4000} className="min-h-28 text-base" />
      <PendingButton pending={pending} pendingText={t.sending} className="min-h-11 w-full px-6 text-base sm:w-auto">
        {t.send}
      </PendingButton>
    </form>
  );
}
