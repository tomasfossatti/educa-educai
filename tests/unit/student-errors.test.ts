/** Mensajes de error para el estudiante: nunca el texto crudo de un error inesperado. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { TEXT } from "@/lib/texts";
import { AIError } from "@/server/ai/types";
import { StudentInputError, studentErrorMessage } from "@/server/services/student-errors";

describe("studentErrorMessage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("muestra los mensajes propios de una entrada inválida", () => {
    expect(studentErrorMessage(new StudentInputError(TEXT.upload.empty), "upload")).toBe(TEXT.upload.empty);
  });

  it("no muestra el error del proveedor de IA, sino un aviso propio", () => {
    const message = studentErrorMessage(new AIError("provider", "No se pudo conectar con Groq: ECONNRESET 10.0.0.3", true), "upload");
    expect(message).toBe(TEXT.chat.aiUnavailable);
  });

  it("usa el aviso de tope semanal que corresponda", () => {
    const budget = new AIError("budget_exceeded", "tope");
    expect(studentErrorMessage(budget, "upload", { budgetMessage: TEXT.budget.uploadTooLarge })).toMatch(/^Analizar esta conversación superaría/);
    expect(studentErrorMessage(budget, "context.edit")).toMatch(/^Llegaste al tope semanal/);
  });

  it("ante un error inesperado muestra un texto genérico y no deja el contenido en el log", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const prismaLike = Object.assign(new Error('Invalid `prisma.message.create()` invocation: content: "mi duda privada"'), { code: "P2002" });
    expect(studentErrorMessage(prismaLike, "upload")).toBe(TEXT.common.unexpected);
    expect(log).toHaveBeenCalledOnce();
    const logged = String(log.mock.calls[0][0]);
    expect(logged).toContain("P2002");
    expect(logged).not.toContain("mi duda privada");
  });
});
