/**
 * Reglas del contexto de carpeta (docs/SPEC.md, "Contexto de cada carpeta"). Puras, sin base de datos.
 * El proceso automático nunca borra: archiva hechos viejos o contradichos y respeta lo que el estudiante editó.
 */

export interface ActiveFact {
  id: string;
  ref: string;
  content: string;
  editedByStudent: boolean;
}

export interface FactsProposal {
  add: { content: string; courseRefs?: string[] }[];
  archive: { ref: string; reason: string }[];
}

export interface FactsPlan {
  create: { content: string; courseIds: string[] }[];
  archiveIds: string[];
}

/**
 * Convierte la propuesta del modelo en operaciones seguras:
 * - solo archiva refs que existen y que el estudiante no editó;
 * - no agrega hechos vacíos ni repetidos (mismo texto que uno activo);
 * - las cátedras vinculadas tienen que ser refs conocidas.
 */
export function planFactsUpdate(active: ActiveFact[], proposal: FactsProposal, courseRefs: Record<string, string> = {}): FactsPlan {
  const byRef = new Map(active.map((f) => [f.ref, f]));
  const archiveIds = [...new Set(proposal.archive.map((a) => byRef.get(a.ref.trim())).filter((f): f is ActiveFact => Boolean(f && !f.editedByStudent)).map((f) => f.id))];
  const existing = new Set(active.filter((f) => !archiveIds.includes(f.id)).map((f) => normalize(f.content)));
  const create: FactsPlan["create"] = [];
  for (const a of proposal.add) {
    const content = a.content.trim();
    if (!content || existing.has(normalize(content))) continue;
    existing.add(normalize(content));
    create.push({ content, courseIds: [...new Set((a.courseRefs ?? []).map((r) => courseRefs[r.trim()]).filter(Boolean))] });
  }
  return { create, archiveIds };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export const SUMMARY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** El resumen se regenera una vez por día, solo si hay hechos nuevos y si el estudiante no lo editó. */
export function summaryIsStale(summary: { updatedAt: Date; editedByStudent: boolean } | null, latestFactAt: Date | null, now: Date = new Date()): boolean {
  if (!latestFactAt) return false;
  if (!summary) return true;
  if (summary.editedByStudent) return false;
  return now.getTime() - summary.updatedAt.getTime() >= SUMMARY_MAX_AGE_MS && latestFactAt > summary.updatedAt;
}
