import type { z } from "zod";

/** Estado estándar de las acciones con formulario (useActionState). */
export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

export function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function optionalText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}
