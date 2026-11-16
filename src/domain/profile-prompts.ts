/**
 * Perfil progresivo del estudiante (alta mínima del panel simple). Carrera, año, proyecto y de dónde
 * salen los ejemplos son opcionales y se preguntan de a uno, dentro del chat, después de la primera
 * charla, con "Saltar". Pura, sin base de datos.
 */
export const PROFILE_PROMPTS = ["career", "studyYear", "project", "focus"] as const;
export type ProfilePrompt = (typeof PROFILE_PROMPTS)[number];

export interface ProfileForPrompts {
  career: string | null;
  studyYear: number | null;
  projectDescription: string | null;
  profilePromptsDone: string[];
}

/**
 * La próxima pregunta del perfil, o null. Nada antes de la primera charla. Se saltea lo que ya tiene
 * dato o lo que el estudiante respondió o salteó antes. El foco tiene un valor por defecto en la base,
 * así que cuenta como respondido solo si figura en `profilePromptsDone`.
 */
export function nextProfilePrompt(profile: ProfileForPrompts, hasConversation: boolean): ProfilePrompt | null {
  if (!hasConversation) return null;
  const done = new Set(profile.profilePromptsDone);
  const filled: Record<ProfilePrompt, boolean> = {
    career: Boolean(profile.career?.trim()),
    studyYear: profile.studyYear !== null,
    project: Boolean(profile.projectDescription?.trim()),
    focus: false,
  };
  return PROFILE_PROMPTS.find((p) => !filled[p] && !done.has(p)) ?? null;
}

export function isProfilePrompt(value: string): value is ProfilePrompt {
  return (PROFILE_PROMPTS as readonly string[]).includes(value);
}
