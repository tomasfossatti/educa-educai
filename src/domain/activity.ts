import { z } from "zod";

/** Consignas estructuradas de una actividad. Diseñadas para observar aplicación, decisiones, justificación y autonomía. */
export const activityPromptSchema = z.object({
  key: z.string().regex(/^p\d+$/),
  label: z.string().trim().min(3).max(300),
  help: z.string().trim().max(500).default(""),
});

export const activityPromptsSchema = z.array(activityPromptSchema).min(1).max(6);

export type ActivityPrompt = z.infer<typeof activityPromptSchema>;

export const DEFAULT_ACTIVITY_PROMPTS: ActivityPrompt[] = [
  { key: "p1", label: "¿Qué decidirías hacer y por qué?", help: "Elegí una opción concreta." },
  { key: "p2", label: "¿Qué evidencia o supuestos sostienen tu decisión?", help: "Distinguí lo que sabés de lo que suponés." },
  { key: "p3", label: "¿Cómo comprobarías si tu decisión fue correcta?", help: "Qué mirarías, en qué plazo." },
  { key: "p4", label: "¿Qué parte te resultó más difícil o te genera más dudas?", help: "" },
];

export function parseActivityPrompts(value: unknown): ActivityPrompt[] {
  const parsed = activityPromptsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export const answersSchema = z.record(z.string(), z.string().max(8000));

export function parseAnswers(value: unknown): Record<string, string> {
  const parsed = answersSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}
