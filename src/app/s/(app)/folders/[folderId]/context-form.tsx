"use client";

import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { Textarea } from "@/components/ui/field";
import { TEXT } from "@/lib/texts";
import { editContextAction } from "@/server/actions/folders";

export function EditContextForm({ id, content, label }: { id: string; content: string; label: string }) {
  const { state, pending, onSubmit } = useActionForm(editContextAction);
  return (
    <form method="post" onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="contextId" value={id} />
      <FormMessage state={state} />
      <Textarea name="content" defaultValue={content} maxLength={800} className="min-h-12 text-sm" aria-label={label} />
      <PendingButton pending={pending} pendingText={TEXT.context.saving} size="sm" variant="secondary">
        {TEXT.context.save}
      </PendingButton>
    </form>
  );
}
