/**
 * Foco de personalización: el estudiante elige si los ejemplos de la IA salen de su trabajo actual
 * o de su proyecto personal. Nunca de los dos a la vez (decisión de Tomás para el MVP): mezclarlos
 * confunde cuando no tienen relación, por ejemplo una petrolera y un centro de kinesiología.
 * Es la única fuente de ese contexto para todos los prompts (chat, detección de dudas y devolución).
 */
export type PersonalizationFocus = "WORK" | "PROJECT";

export interface FocusProfile {
  personalizationFocus: PersonalizationFocus;
  declaredCurrentContext: string | null;
  projectDescription: string | null;
}

/** El texto del foco elegido; si está vacío, el otro como respaldo para no quedarse sin contexto. */
export function focusText(profile: FocusProfile): { focus: PersonalizationFocus; text: string | null } {
  const work = profile.declaredCurrentContext?.trim() || null;
  const project = profile.projectDescription?.trim() || null;
  if (profile.personalizationFocus === "WORK") return work ? { focus: "WORK", text: work } : { focus: "PROJECT", text: project };
  return project ? { focus: "PROJECT", text: project } : { focus: "WORK", text: work };
}

/** Bloque para el prompt: un solo contexto, con la instrucción de no mezclar con el otro. */
export function personalizationPrompt(profile: FocusProfile): string {
  const { focus, text } = focusText(profile);
  if (!text) return "";
  return focus === "WORK"
    ? `FOCO PARA EJEMPLOS: el trabajo actual del estudiante («${text}»). Sacá los ejemplos y las aplicaciones de ese trabajo. No uses su proyecto personal salvo que él lo mencione.`
    : `FOCO PARA EJEMPLOS: el proyecto personal del estudiante («${text}»). Sacá los ejemplos y las aplicaciones de ese proyecto. No uses su trabajo actual salvo que él lo mencione.`;
}
