"use server";

import { after } from "next/server";
import { refresh } from "@/server/next-refresh";
import { text, type ActionState } from "@/lib/forms";
import { TEXT } from "@/lib/texts";
import { requireUser } from "@/server/auth/guards";
import { LmsError } from "@/server/lms";
import { connectLms, disconnectLms, getLmsImportStatus, LmsServiceError, runLmsImport, type ImportStatus } from "@/server/services/lms";
import { lmsAssistantTurn, type AssistantMessage, type AssistantTurn } from "@/server/services/lms-assistant";

/** Docente o estudiante: cada uno conecta su propio LMS e importa a lo suyo. */
async function lmsViewer() {
  const user = await requireUser();
  return { id: user.id, role: user.role };
}

export async function connectLmsAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const viewer = await lmsViewer();
  const provider = text(formData, "provider") === "MOODLE" ? "MOODLE" : "CANVAS";
  const rawKind = text(formData, "authKind");
  const authKind = rawKind === "cookie" || rawKind === "password" ? rawKind : "token";
  try {
    const { accountName } = await connectLms(viewer, {
      provider,
      baseUrl: text(formData, "baseUrl"),
      authKind,
      token: text(formData, authKind === "cookie" ? "cookie" : "token"),
      username: text(formData, "username"),
      password: typeof formData.get("password") === "string" ? (formData.get("password") as string) : "",
    });
    refresh();
    return { ok: true, message: TEXT.lms.connection.connected(accountName) };
  } catch (error) {
    if (error instanceof LmsError || error instanceof LmsServiceError) return { error: error.message };
    throw error;
  }
}

export async function disconnectLmsAction(): Promise<void> {
  const viewer = await lmsViewer();
  await disconnectLms(viewer);
  refresh();
}

/** Un turno del chat. Si arranca una importación, la descarga corre después de responder. */
export async function lmsAssistantAction(message: string, history: AssistantMessage[]): Promise<AssistantTurn> {
  const viewer = await lmsViewer();
  try {
    const turn = await lmsAssistantTurn(viewer, String(message ?? ""), Array.isArray(history) ? history : []);
    if (turn.started && turn.importId) {
      const importId = turn.importId;
      after(() => runLmsImport(importId));
    }
    return { reply: turn.reply, importId: turn.importId, href: turn.href };
  } catch (error) {
    console.error("[lms] el asistente falló", error instanceof Error ? error.message : error);
    return { reply: TEXT.lms.chat.error };
  }
}

export async function lmsImportStatusAction(importId: string): Promise<ImportStatus | null> {
  const viewer = await lmsViewer();
  try {
    return await getLmsImportStatus(viewer, String(importId));
  } catch {
    return null;
  }
}
