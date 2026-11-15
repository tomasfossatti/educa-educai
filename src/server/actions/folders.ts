"use server";

import { refresh } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { text, type ActionState } from "@/lib/forms";
import { TEXT } from "@/lib/texts";
import { AIError } from "@/server/ai";
import { AccessDenied, requireStudent } from "@/server/auth/guards";
import { askInFolder, MAX_UPLOAD_BYTES, startFolderConversation, uploadExternalConversation } from "@/server/services/folder-chat";

async function viewer() {
  const { user } = await requireStudent();
  return { id: user.id, role: user.role };
}

function denyAsNotFound(error: unknown): never {
  if (error instanceof AccessDenied) notFound();
  throw error;
}

export async function startFolderConversationAction(folderId: string): Promise<void> {
  const v = await viewer();
  const conversation = await startFolderConversation(v, folderId).catch(denyAsNotFound);
  redirect(`/s/folders/${folderId}/c/${conversation.id}`);
}

export async function askInFolderAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const v = await viewer();
  const conversationId = text(formData, "conversationId");
  const question = text(formData, "question");
  if (!question) return { error: TEXT.chat.emptyQuestion, fieldErrors: { question: TEXT.chat.emptyQuestion } };
  try {
    await askInFolder(v, conversationId, question.slice(0, 4000));
  } catch (error) {
    if (error instanceof AIError) return { error: TEXT.chat.aiUnavailable };
    denyAsNotFound(error);
  }
  refresh();
  return { ok: true };
}

export async function uploadConversationAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const v = await viewer();
  const folderId = text(formData, "folderId");
  const file = formData.get("file");
  let body = text(formData, "text");
  if (file instanceof File && file.size > 0) {
    if (!file.name.toLowerCase().endsWith(".txt")) return { error: TEXT.upload.onlyTxt, fieldErrors: { file: TEXT.upload.onlyTxt } };
    if (file.size > MAX_UPLOAD_BYTES) return { error: "La conversación supera los 2 MB.", fieldErrors: { file: "Máximo 2 MB." } };
    body = await file.text();
  }
  if (!body.trim()) return { error: TEXT.upload.missing };
  try {
    await uploadExternalConversation(v, folderId, { title: text(formData, "title"), text: body });
  } catch (error) {
    if (error instanceof AccessDenied) notFound();
    return { error: error instanceof Error ? error.message : String(error) };
  }
  refresh();
  return { ok: true, message: TEXT.upload.done };
}
