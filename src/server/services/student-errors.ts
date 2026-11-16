import "server-only";
import { TEXT } from "@/lib/texts";
import { AIError } from "@/server/ai";
import { budgetResetLabel } from "@/server/ai/budget";

/** Error de una entrada del estudiante, con un mensaje pensado para mostrarle (desde `TEXT`). */
export class StudentInputError extends Error {}

/**
 * Mensaje para el estudiante ante un error de una acción de sus carpetas. Solo se muestran los
 * mensajes propios; un error inesperado (de la base, del proveedor de IA…) nunca llega tal cual a la
 * pantalla: se registra en el log del servidor, sin su texto (puede traer contenido del estudiante).
 */
export function studentErrorMessage(error: unknown, action: string, opts: { budgetMessage?: (resets: string) => string } = {}): string {
  if (error instanceof StudentInputError) return error.message;
  if (error instanceof AIError) {
    return error.kind === "budget_exceeded" ? (opts.budgetMessage ?? TEXT.budget.exceeded)(budgetResetLabel()) : TEXT.chat.aiUnavailable;
  }
  const name = error instanceof Error ? error.name : typeof error;
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  console.error(`[${action}] error inesperado: ${name}${code ? ` (${code})` : ""}`);
  return TEXT.common.unexpected;
}
