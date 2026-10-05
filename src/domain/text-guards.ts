/**
 * Guardas deterministas sobre texto generado por IA.
 */

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[“”«»"'`´]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * ¿El fragmento citado aparece realmente en el texto fuente?
 * Acepta elipsis ("…" o "...") como separador entre partes citadas.
 */
export function isVerbatimExcerpt(excerpt: string, source: string): boolean {
  const normalizedSource = normalize(source);
  const parts = excerpt
    .split(/\.\.\.|…|\[\.\.\.\]/)
    .map(normalize)
    .filter((p) => p.length > 0);
  if (parts.length === 0) return false;
  let cursor = 0;
  for (const part of parts) {
    const index = normalizedSource.indexOf(part, cursor);
    if (index === -1) return false;
    cursor = index + part.length;
  }
  return true;
}

/** Recorta texto largo sin cortar palabras. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

const ASSESSMENT_WORDS =
  /(comprensi|aplicaci|transfer|autonom|domin|nivel|progres|desempe|aprendiz|rendimient|avance|capacidad|habilidad|puntaje|score|confianza|competen|logro|desarroll)/i;
const PERCENT = /\d+(?:[.,]\d+)?\s?%/g;

/**
 * Detecta falsa precisión: porcentajes o puntajes numéricos *sobre el estudiante*
 * ("83% de comprensión", "aplicación 7/10", "nivel 4 de 5"). No marca números que
 * el estudiante usó en su propio trabajo (p. ej. "un umbral del 30% de recompra").
 */
export function containsFalsePrecision(text: string): boolean {
  if (/\bnivel\s+\d+\s+de\s+\d+\b|\bpuntaje\b|\b\d+(?:[.,]\d+)?\s?\/\s?(?:5|10|100)\b/i.test(text)) return true;
  for (const match of text.matchAll(PERCENT)) {
    const start = Math.max(0, (match.index ?? 0) - 40);
    const window = text.slice(start, (match.index ?? 0) + match[0].length + 40);
    if (ASSESSMENT_WORDS.test(window)) return true;
  }
  return false;
}

/** Elimina oraciones con falsa precisión cuando el reintento no alcanzó. */
export function stripFalsePrecision(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !containsFalsePrecision(sentence))
    .join(" ")
    .trim();
}
