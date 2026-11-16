"use client";

import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { Field, Input, Textarea } from "@/components/ui/field";
import { TEXT } from "@/lib/texts";
import { uploadConversationAction } from "@/server/actions/folders";

export function UploadConversationForm({ folderId }: { folderId: string }) {
  const { state, pending, onSubmit, ref } = useActionForm(uploadConversationAction, { resetOnSuccess: true });
  const t = TEXT.upload;
  return (
    <form ref={ref} method="post" onSubmit={onSubmit} className="space-y-4" encType="multipart/form-data">
      <input type="hidden" name="folderId" value={folderId} />
      <FormMessage state={state} />
      <Field label={t.titleLabel} htmlFor="title" optional>
        <Input id="title" name="title" maxLength={120} placeholder={t.titlePlaceholder} />
      </Field>
      <Field label={t.fileLabel} htmlFor="file" optional error={state?.fieldErrors?.file}>
        <Input id="file" name="file" type="file" accept=".txt,text/plain" className="h-auto py-1.5" />
      </Field>
      <Field label={t.textLabel} htmlFor="text" optional>
        <Textarea id="text" name="text" className="min-h-32 font-mono text-xs" />
      </Field>
      <PendingButton pending={pending} pendingText={t.uploading}>
        {t.button}
      </PendingButton>
    </form>
  );
}
