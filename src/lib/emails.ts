/** Emails únicos, en minúscula, encontrados en un texto o CSV (ignora las demás columnas). */
export function extractEmails(raw: string): string[] {
  return [...new Set((raw.match(/[^\s,;"'<>()]+@[^\s,;"'<>()]+/g) ?? []).map((e) => e.toLowerCase()))];
}
