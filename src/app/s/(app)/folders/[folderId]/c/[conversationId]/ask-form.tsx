"use client";

import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { Textarea } from "@/components/ui/field";
import { TEXT } from "@/lib/texts";
import { askInFolderAction } from "@/server/actions/folders";

export function AskForm({ conversationId }: { conversationId: string }) {
  const { state, pending, onSubmit, ref } = useActionForm(askInFolderAction, { resetOnSuccess: true });
  return (
    <form ref={ref} method="post" onSubmit={onSubmit} className="space-y-2 border-t border-line pt-4">
      <input type="hidden" name="conversationId" value={conversationId} />
      <FormMessage state={state} />
      <Textarea name="question" aria-label={TEXT.chat.placeholder} placeholder={TEXT.chat.placeholder} required maxLength={4000} className="min-h-24" />
      <PendingButton pending={pending} pendingText={TEXT.chat.sending}>
        {TEXT.chat.send}
      </PendingButton>
    </form>
  );
}
