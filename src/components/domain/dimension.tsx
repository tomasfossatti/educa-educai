import type { SnapshotDimension, SupportStatus } from "@prisma/client";
import Link from "next/link";
import type { DimensionDetails, DimensionItem } from "@/domain/snapshot";
import { assistanceLevelLabel, dimensionLabel, snapshotDimensionLabel, snapshotDimensionQuestion } from "@/domain/labels";
import { formatDate } from "@/lib/format";
import { SupportBadge } from "./status";

const DIRECTION_LABEL = { STRENGTH: "Fortaleza", DIFFICULTY: "Dificultad", MIXED: "Señales mixtas" } as const;
const TREND_LABEL: Record<DimensionItem["trend"], string | null> = {
  IMPROVING: "mejora reciente",
  DECLINING: "cambio a revisar",
  STABLE: null,
  UNKNOWN: null,
};

export interface DimensionView {
  dimension: SnapshotDimension;
  status: SupportStatus;
  summary: string;
  details: DimensionDetails;
  evidenceIds: string[];
}

/** Una dimensión del snapshot, con la evidencia que la sostiene (no solo una etiqueta). */
export function DimensionBlock({ dimension, evidenceHref }: { dimension: DimensionView; evidenceHref: (id: string) => string }) {
  const items = dimension.details.items ?? [];
  const showItemDimension = dimension.dimension === "CONSISTENCY" || dimension.dimension === "EVOLUTION";
  return (
    <div className="space-y-2.5 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-[#27251e]">{snapshotDimensionLabel[dimension.dimension]}</h3>
          <p className="text-xs text-[#72706b]">{snapshotDimensionQuestion[dimension.dimension]}</p>
        </div>
        <SupportBadge status={dimension.status} />
      </div>
      <p className="text-sm text-[#72706b] leading-relaxed">{dimension.summary}</p>

      {dimension.details.assistance && (
        <p className="text-xs text-[#92918b]">
          Asistencia registrada:{" "}
          {(["NONE", "LOW", "MEDIUM", "HIGH", "UNKNOWN"] as const)
            .filter((k) => dimension.details.assistance![k] > 0)
            .map((k) => `${assistanceLevelLabel[k].toLowerCase()} (${dimension.details.assistance![k]})`)
            .join(" · ") || "sin datos"}
        </p>
      )}

      {items.length > 0 && (
        <details className="group text-sm">
          <summary className="cursor-pointer select-none text-[#016a71] hover:underline font-normal">
            Ver evidencia ({dimension.evidenceIds.length})
          </summary>
          <ul className="mt-2 space-y-2 border-l border-[#d1d1cd] pl-3">
            {items.map((item, i) => (
              <li key={`${item.curriculumItemId ?? "general"}-${item.dimension}-${i}`} className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#72706b]">
                  <span className="font-medium text-[#27251e]">{item.title}</span>
                  {showItemDimension && <span>· {dimensionLabel[item.dimension]}</span>}
                  <span className={item.direction === "DIFFICULTY" ? "text-attention" : undefined}>· {DIRECTION_LABEL[item.direction]}</span>
                  {TREND_LABEL[item.trend] && <span>· {TREND_LABEL[item.trend]}</span>}
                  <span>
                    · {item.signalCount} {item.signalCount === 1 ? "señal" : "señales"} en {item.experienceCount}{" "}
                    {item.experienceCount === 1 ? "experiencia" : "experiencias"}
                  </span>
                  <span>
                    · {formatDate(item.firstSeenAt)}
                    {item.firstSeenAt.slice(0, 10) !== item.lastSeenAt.slice(0, 10) ? ` → ${formatDate(item.lastSeenAt)}` : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {item.evidenceIds.map((id, n) => (
                    <Link key={id} href={evidenceHref(id)} className="text-[#016a71] hover:underline font-normal">
                      Evidencia {n + 1}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
