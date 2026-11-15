"use client";

import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { Field, Input } from "@/components/ui/field";
import { TEXT } from "@/lib/texts";
import { uploadMaterialAction } from "@/server/actions/teacher";

const ACCEPT = ".pdf,.docx,.pptx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation";

export function MaterialUploadForm({ courseId }: { courseId: string }) {
  const { state, pending, onSubmit, ref } = useActionForm(uploadMaterialAction, { resetOnSuccess: true });
  const t = TEXT.material;
  return (
    <form ref={ref} method="post" onSubmit={onSubmit} className="space-y-4" encType="multipart/form-data">
      <input type="hidden" name="courseId" value={courseId} />
      <FormMessage state={state} />
      <Field label={t.uploadLabel} htmlFor="file" hint={t.uploadHint} error={state?.fieldErrors?.file}>
        <Input id="file" name="file" type="file" accept={ACCEPT} className="h-auto py-1.5" required />
      </Field>
      <PendingButton pending={pending} pendingText={t.uploading}>
        {t.uploadButton}
      </PendingButton>
    </form>
  );
}
