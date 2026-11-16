"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { refresh } from "@/server/next-refresh";
import { text, type ActionState } from "@/lib/forms";
import { TEXT } from "@/lib/texts";
import { requireUser } from "@/server/auth/guards";
import { LmsError } from "@/server/lms";
import { createExtensionCode, getExtensionStatus, type ExtensionStage } from "@/server/services/lms-extension";
import { connectLms, disconnectLms, getLmsConnection, getLmsImportStatus, LmsServiceError, runLmsImport, type ImportStatus } from "@/server/services/lms";
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
  if (rawKind === "extension") return { error: TEXT.lms.extension.step3 };
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

/** Origen público de Educai para el código (Vercel lo manda en x-forwarded-*). */
async function serverOrigin(): Promise<string> {
  const configured = process.env.APP_URL?.trim();
  if (configured) return new URL(configured).origin;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function createExtensionCodeAction(baseUrl: string): Promise<{ code: string; expiresAt: string } | { error: string }> {
  const viewer = await lmsViewer();
  try {
    const { code, expiresAt } = await createExtensionCode(viewer, { baseUrl: String(baseUrl ?? ""), serverOrigin: await serverOrigin() });
    return { code, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    if (error instanceof LmsError) return { error: error.message };
    throw error;
  }
}

/** Para que la pantalla se entere cuando la extensión terminó de conectar. */
export async function lmsConnectionStatusAction(): Promise<{
  connected: boolean;
  accountName: string | null;
  extensionLinked: boolean;
  extensionStage: ExtensionStage;
  extensionError: string | null;
}> {
  const viewer = await lmsViewer();
  const [connection, extension] = await Promise.all([getLmsConnection(viewer), getExtensionStatus(viewer)]);
  return {
    connected: Boolean(connection),
    accountName: connection?.accountName ?? null,
    extensionLinked: extension.linked,
    extensionStage: extension.stage,
    extensionError: extension.error,
  };
}
