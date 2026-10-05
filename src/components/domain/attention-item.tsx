import type { SupportStatus } from "@prisma/client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { supportStatusLabel } from "@/domain/labels";
import { formatDate } from "@/lib/format";
import type { AttentionItem } from "@/server/services/attention";

const PRIORITY = { HIGH: "Prioridad alta", MEDIUM: "Prioridad media", LOW: "Informativo" } as const;
const KIND = {
  GAP: "Brecha comprensión / aplicación",
  PATTERN: "Patrón del curso",
  CONTRADICTION: "Señales contradictorias",
  STUDENT_DIFFICULTY: "Estudiante",
  FOLLOW_UP: "Seguimiento",
  NO_EVIDENCE: "Sin evidencia",
} as const;

function supportSummary(statuses: SupportStatus[]): string | null {
  if (statuses.length === 0) return null;
  const counts = new Map<SupportStatus, number>();
  for (const s of statuses) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()].map(([s, n]) => `${supportStatusLabel[s].toLowerCase()} (${n})`).join(" · ");
}

export function AttentionItemRow({ item }: { item: AttentionItem }) {
  const names = item.students.map((s) => s.name);
  const support = supportSummary(item.supportStatuses);
  return (
    <Link href={item.href} className="-mx-4 -my-3 block space-y-1.5 px-4 py-3 hover:bg-subtle/60">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={item.priority === "HIGH" ? "attention" : item.priority === "MEDIUM" ? "neutral" : "muted"}>{PRIORITY[item.priority]}</Badge>
        <span className="text-muted">{KIND[item.kind]}</span>
        {item.pendingReview > 0 && <span className="text-muted">· {item.pendingReview} por revisar</span>}
      </div>
      <p className="text-sm font-medium text-ink">{item.title}</p>
      <p className="text-sm text-ink-2">{item.description}</p>
      <p className="text-xs text-muted">
        {names.length > 0 && <>{names.slice(0, 5).join(", ")}{names.length > 5 ? ` y ${names.length - 5} más` : ""}</>}
        {support && <> · Respaldo: {support}</>}
      </p>
      {item.intervention && item.kind !== "FOLLOW_UP" && (
        <p className="text-xs text-primary">
          Intervención registrada el {formatDate(item.intervention.occurredAt)} ·{" "}
          {item.intervention.hasFollowUp ? "ya hay evidencia posterior" : "esperando evidencia nueva"}
        </p>
      )}
    </Link>
  );
}
