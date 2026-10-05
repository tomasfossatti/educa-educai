import type {
  AssistanceLevel,
  Dimension,
  EvidenceSource,
  Polarity,
  SnapshotDimension,
  SupportStatus,
} from "@prisma/client";
import { dimensionLabel } from "./labels";

/**
 * Development Snapshot — cálculo determinista y transparente.
 *
 * No usa IA: agrega señales (ya vinculadas a evidencia) por dimensión e ítem
 * curricular. Así cada estado del snapshot se puede explicar exactamente con
 * las señales y evidencias que lo produjeron.
 */

export interface SnapshotSignal {
  id: string;
  evidenceId: string;
  experienceId: string;
  occurredAt: Date;
  source: EvidenceSource;
  assistanceLevel: AssistanceLevel;
  dimension: Dimension;
  polarity: Polarity;
  curriculumItemId: string | null;
  curriculumItemTitle: string | null;
}

export interface SnapshotEvidence {
  id: string;
  experienceId: string;
  occurredAt: Date;
  assistanceLevel: AssistanceLevel;
}

export type Direction = "STRENGTH" | "DIFFICULTY" | "MIXED";
export type Trend = "IMPROVING" | "DECLINING" | "STABLE" | "UNKNOWN";

export interface DimensionItem {
  curriculumItemId: string | null;
  title: string;
  dimension: Dimension;
  direction: Direction;
  status: SupportStatus;
  trend: Trend;
  signalCount: number;
  experienceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  signalIds: string[];
  evidenceIds: string[];
}

export interface DimensionDetails {
  items: DimensionItem[];
  assistance?: Record<AssistanceLevel, number>;
  assistanceTrend?: Trend;
}

export interface ComputedDimension {
  dimension: SnapshotDimension;
  status: SupportStatus;
  summary: string;
  details: DimensionDetails;
  signalIds: string[];
  evidenceIds: string[];
}

export interface ComputedSnapshot {
  evidenceCount: number;
  experienceCount: number;
  dimensions: ComputedDimension[];
}

const CORE_DIMENSIONS: Dimension[] = ["COMPREHENSION", "APPLICATION", "TRANSFER", "AUTONOMY"];
const GENERAL_TITLE = "General (sin ítem curricular)";

/** Puntaje interno por experiencia (no se muestra): fortaleza +1, mixta 0, dificultad −1. */
function experienceScore(signals: SnapshotSignal[]): -1 | 0 | 1 {
  if (signals.every((s) => s.polarity === "STRENGTH")) return 1;
  if (signals.every((s) => s.polarity === "DIFFICULTY")) return -1;
  return 0;
}

const SCORE_DIRECTION: Record<-1 | 0 | 1, Direction> = { 1: "STRENGTH", 0: "MIXED", [-1]: "DIFFICULTY" };

/** Estado de un ítem curricular dentro de una dimensión, a partir de sus señales. */
export function computeItem(signals: SnapshotSignal[]): DimensionItem {
  const sorted = [...signals].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const byExperience = new Map<string, SnapshotSignal[]>();
  for (const s of sorted) {
    const list = byExperience.get(s.experienceId) ?? [];
    list.push(s);
    byExperience.set(s.experienceId, list);
  }
  const sequence = [...byExperience.values()].map(experienceScore);
  const firstScore = sequence[0];
  const lastScore = sequence[sequence.length - 1];
  const rises = sequence.some((v, i) => i > 0 && v > sequence[i - 1]);
  const falls = sequence.some((v, i) => i > 0 && v < sequence[i - 1]);

  let direction: Direction = SCORE_DIRECTION[lastScore];
  let status: SupportStatus;
  let trend: Trend = sequence.length >= 2 ? "STABLE" : "UNKNOWN";

  if (!rises && !falls) {
    // Misma dirección en todas las experiencias.
    status = sequence.length >= 2 && firstScore !== 0 ? "CONSISTENT" : "PARTIAL";
  } else if (rises && falls) {
    // Va y vuelve: las señales no permiten una conclusión.
    direction = "MIXED";
    status = "CONTRADICTORY";
    trend = "UNKNOWN";
  } else if (rises) {
    // Trayectoria de mejora (dificultad → mixta/fortaleza).
    trend = "IMPROVING";
    const confirmed = lastScore === 1 && sequence.length >= 3 && sequence[sequence.length - 2] === 1;
    status = confirmed ? "CONSISTENT" : "PARTIAL";
  } else {
    // Retroceso: si pasa de fortaleza a dificultad es una señal a examinar, no una conclusión.
    trend = "DECLINING";
    status = firstScore === 1 && lastScore === -1 ? "CONTRADICTORY" : "PARTIAL";
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return {
    curriculumItemId: first.curriculumItemId,
    title: first.curriculumItemTitle ?? GENERAL_TITLE,
    dimension: first.dimension,
    direction,
    status,
    trend,
    signalCount: sorted.length,
    experienceCount: byExperience.size,
    firstSeenAt: first.occurredAt.toISOString(),
    lastSeenAt: last.occurredAt.toISOString(),
    signalIds: sorted.map((s) => s.id),
    evidenceIds: [...new Set(sorted.map((s) => s.evidenceId))],
  };
}

/** Agrupa señales de una dimensión por ítem curricular. */
export function computeItems(signals: SnapshotSignal[], dimension: Dimension): DimensionItem[] {
  const groups = new Map<string, SnapshotSignal[]>();
  for (const s of signals) {
    if (s.dimension !== dimension) continue;
    const key = s.curriculumItemId ?? "_general";
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  return [...groups.values()].map(computeItem).sort(byRelevance);
}

const STATUS_ORDER: Record<SupportStatus, number> = { CONTRADICTORY: 0, CONSISTENT: 1, PARTIAL: 2, INSUFFICIENT: 3 };

function byRelevance(a: DimensionItem, b: DimensionItem): number {
  return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.lastSeenAt.localeCompare(a.lastSeenAt);
}

function aggregateStatus(items: DimensionItem[]): SupportStatus {
  if (items.length === 0) return "INSUFFICIENT";
  if (items.some((i) => i.status === "CONTRADICTORY")) return "CONTRADICTORY";
  if (items.some((i) => i.status === "CONSISTENT")) return "CONSISTENT";
  return "PARTIAL";
}

const directionPhrase: Record<Direction, string> = {
  STRENGTH: "fortaleza",
  DIFFICULTY: "dificultad",
  MIXED: "señales mixtas",
};

const statusPhrase: Record<SupportStatus, string> = {
  CONSISTENT: "evidencia consistente",
  PARTIAL: "evidencia parcial",
  INSUFFICIENT: "evidencia insuficiente",
  CONTRADICTORY: "señales contradictorias",
};

function describeItem(item: DimensionItem): string {
  const trend =
    item.trend === "IMPROVING" ? ", con mejora reciente" : item.trend === "DECLINING" ? ", con un cambio reciente a revisar" : "";
  return `${capitalize(directionPhrase[item.direction])} en ${item.title} (${statusPhrase[item.status]}${trend})`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function collect(items: DimensionItem[]): { signalIds: string[]; evidenceIds: string[] } {
  return {
    signalIds: [...new Set(items.flatMap((i) => i.signalIds))],
    evidenceIds: [...new Set(items.flatMap((i) => i.evidenceIds))],
  };
}

const ASSISTANCE_WEIGHT: Record<AssistanceLevel, number | null> = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, UNKNOWN: null };

/**
 * Tendencia de asistencia: compara la última experiencia con las anteriores
 * (promedio por experiencia, para no sobrerrepresentar experiencias con muchas evidencias).
 */
function assistanceTrend(evidence: SnapshotEvidence[]): Trend {
  const byExperience = new Map<string, { at: number; weights: number[] }>();
  for (const e of evidence) {
    const weight = ASSISTANCE_WEIGHT[e.assistanceLevel];
    if (weight === null) continue;
    const entry = byExperience.get(e.experienceId) ?? { at: e.occurredAt.getTime(), weights: [] };
    entry.at = Math.min(entry.at, e.occurredAt.getTime());
    entry.weights.push(weight);
    byExperience.set(e.experienceId, entry);
  }
  const means = [...byExperience.values()]
    .sort((a, b) => a.at - b.at)
    .map((x) => x.weights.reduce((sum, w) => sum + w, 0) / x.weights.length);
  if (means.length < 2) return "UNKNOWN";
  const last = means[means.length - 1];
  const previous = means.slice(0, -1).reduce((sum, m) => sum + m, 0) / (means.length - 1);
  const delta = last - previous;
  // Criterio conservador: solo cuenta un cambio de más de un nivel (p. ej. alta → baja, media → ninguna).
  if (delta <= -1.5) return "IMPROVING";
  if (delta >= 1.5) return "DECLINING";
  return "STABLE";
}

function coreDimension(dimension: Dimension, signals: SnapshotSignal[], evidence: SnapshotEvidence[]): ComputedDimension {
  const items = computeItems(signals, dimension);
  const label = dimensionLabel[dimension].toLowerCase();
  const details: DimensionDetails = { items };
  let status = aggregateStatus(items);
  let summary =
    items.length === 0
      ? `Todavía no hay evidencia sobre ${label}.`
      : items.slice(0, 3).map(describeItem).join(". ") + ".";

  if (dimension === "AUTONOMY") {
    const assistance: Record<AssistanceLevel, number> = { NONE: 0, LOW: 0, MEDIUM: 0, HIGH: 0, UNKNOWN: 0 };
    for (const e of evidence) assistance[e.assistanceLevel] += 1;
    const known = evidence.length - assistance.UNKNOWN;
    details.assistance = assistance;
    details.assistanceTrend = assistanceTrend(evidence);
    if (items.length === 0) {
      if (known < 2) {
        status = "INSUFFICIENT";
        summary = "Todavía no hay evidencia suficiente sobre cuánta asistencia necesita.";
      } else {
        status = "PARTIAL";
        summary = `En ${known} evidencias con asistencia conocida: ${assistance.NONE + assistance.LOW} sin asistencia o con asistencia baja, ${assistance.MEDIUM + assistance.HIGH} con asistencia media o alta.`;
      }
    }
    if (details.assistanceTrend === "IMPROVING") summary += " En la experiencia más reciente aparece menos asistencia que en las anteriores.";
    if (details.assistanceTrend === "DECLINING") summary += " En la experiencia más reciente aparece más asistencia que en las anteriores.";
  }

  return { dimension, status, summary, details, ...collect(items) };
}

function consistencyDimension(allItems: DimensionItem[], experienceCount: number): ComputedDimension {
  if (experienceCount < 2) {
    return {
      dimension: "CONSISTENCY",
      status: "INSUFFICIENT",
      summary: "Hace falta evidencia de al menos dos experiencias para saber si un patrón se repite.",
      details: { items: [] },
      signalIds: [],
      evidenceIds: [],
    };
  }
  // Un patrón consistente se repite sin cambiar de dirección (una mejora es evolución, no consistencia).
  const patterns = allItems.filter((i) => i.experienceCount >= 2 && i.trend === "STABLE" && i.direction !== "MIXED");
  return {
    dimension: "CONSISTENCY",
    status: patterns.length > 0 ? "CONSISTENT" : "PARTIAL",
    summary:
      patterns.length > 0
        ? "Se repite en más de una experiencia: " +
          patterns
            .slice(0, 3)
            .map((p) => `${directionPhrase[p.direction]} en ${p.title} (${dimensionLabel[p.dimension].toLowerCase()})`)
            .join("; ") +
          "."
        : "Todavía no aparecen patrones que se repitan entre experiencias.",
    details: { items: patterns },
    ...collect(patterns),
  };
}

function evolutionDimension(allItems: DimensionItem[]): ComputedDimension {
  const evaluable = allItems.filter((i) => i.experienceCount >= 2);
  if (evaluable.length === 0) {
    return {
      dimension: "EVOLUTION",
      status: "INSUFFICIENT",
      summary: "Hace falta evidencia en distintos momentos sobre un mismo tema para observar evolución.",
      details: { items: [] },
      signalIds: [],
      evidenceIds: [],
    };
  }
  const changes = evaluable.filter((i) => i.trend === "IMPROVING" || i.trend === "DECLINING");
  const shown = changes.length > 0 ? changes : evaluable;
  const parts = shown.slice(0, 3).map((i) => {
    const dim = dimensionLabel[i.dimension].toLowerCase();
    if (i.trend === "IMPROVING") return `mejora en ${i.title} (${dim}): antes aparecía dificultad, ahora fortaleza`;
    if (i.trend === "DECLINING") return `cambio a revisar en ${i.title} (${dim}): antes fortaleza, ahora dificultad`;
    return i.direction === "MIXED" ? `se mantienen señales mixtas en ${i.title} (${dim})` : `se mantiene ${directionPhrase[i.direction]} en ${i.title} (${dim})`;
  });
  const confirmed = changes.some((i) => i.trend === "IMPROVING" && i.status === "CONSISTENT");
  return {
    dimension: "EVOLUTION",
    status: confirmed ? "CONSISTENT" : "PARTIAL",
    summary: capitalize(parts.join("; ")) + ".",
    details: { items: shown },
    ...collect(shown),
  };
}

export function computeSnapshot(signals: SnapshotSignal[], evidence: SnapshotEvidence[]): ComputedSnapshot {
  const experienceCount = new Set(evidence.map((e) => e.experienceId)).size;
  const core = CORE_DIMENSIONS.map((d) => coreDimension(d, signals, evidence));
  const allItems = core.flatMap((d) => d.details.items);
  return {
    evidenceCount: evidence.length,
    experienceCount,
    dimensions: [...core, consistencyDimension(allItems, experienceCount), evolutionDimension(allItems)],
  };
}

export interface Transition {
  curriculumItemId: string | null;
  title: string;
  dimension: Dimension;
  trend: "IMPROVING" | "DECLINING";
  lastSeenAt: string;
  evidenceIds: string[];
}

/** Cambios de dirección (mejora / retroceso) observables en las señales. */
export function computeTransitions(signals: SnapshotSignal[]): Transition[] {
  return CORE_DIMENSIONS.flatMap((d) => computeItems(signals, d))
    .filter((i): i is DimensionItem & { trend: "IMPROVING" | "DECLINING" } => i.trend === "IMPROVING" || i.trend === "DECLINING")
    .map((i) => ({
      curriculumItemId: i.curriculumItemId,
      title: i.title,
      dimension: i.dimension,
      trend: i.trend,
      lastSeenAt: i.lastSeenAt,
      evidenceIds: i.evidenceIds,
    }));
}
