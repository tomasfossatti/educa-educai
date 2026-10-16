import type { AssistanceLevel, Dimension, EvidenceKind, EvidenceSource, Polarity, ReviewStatus, SupportStatus } from "@prisma/client";
import Link from "next/link";
import { assistanceLevelLabel, dimensionLabel, evidenceKindLabel, evidenceSourceLabel, polarityLabel } from "@/domain/labels";
import { truncate } from "@/domain/text-guards";
import { formatDate } from "@/lib/format";
import { ReviewBadge, SupportBadge } from "./status";

export interface InferenceRowData {
  id: string;
  statement: string;
  studentStatement: string;
  dimension: Dimension;
  polarity: Polarity;
  supportStatus: SupportStatus;
  reviewStatus: ReviewStatus;
  createdAt: Date;
  curriculumItem: { title: string } | null;
  evidenceCount: number;
  studentName?: string;
}

/** Una conclusión con su respaldo y el acceso a "¿Por qué Educai cree esto?". */
export function InferenceRow({ inference, href, audience }: { inference: InferenceRowData; href: string; audience: "student" | "teacher" }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {inference.studentName && <span className="font-medium text-ink-2">{inference.studentName}</span>}
        <span>{dimensionLabel[inference.dimension]}</span>
        <span aria-hidden>·</span>
        <span className={inference.polarity === "DIFFICULTY" ? "text-attention" : undefined}>{polarityLabel[inference.polarity]}</span>
        {inference.curriculumItem && (
          <>
            <span aria-hidden>·</span>
            <span>{inference.curriculumItem.title}</span>
          </>
        )}
        <span aria-hidden>·</span>
        <span>{formatDate(inference.createdAt)}</span>
      </div>
      <p className="text-sm text-ink">{audience === "student" ? inference.studentStatement : inference.statement}</p>
      <div className="flex flex-wrap items-center gap-2">
        <SupportBadge status={inference.supportStatus} />
        <ReviewBadge status={inference.reviewStatus} audience={audience} />
        <Link href={href} className="text-sm text-primary hover:underline">
          ¿Por qué Educai cree esto? ({inference.evidenceCount} {inference.evidenceCount === 1 ? "evidencia" : "evidencias"})
        </Link>
      </div>
    </div>
  );
}

export interface EvidenceRowData {
  id: string;
  kind: EvidenceKind;
  source: EvidenceSource;
  observation: string;
  content: string;
  occurredAt: Date;
  assistanceLevel: AssistanceLevel;
  experience: { title: string };
  studentName?: string;
}

export function EvidenceRow({ evidence, href }: { evidence: EvidenceRowData; href: string }) {
  return (
    <Link href={href} className="block space-y-1.5 hover:bg-subtle/60 -mx-4 -my-3 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
        {evidence.studentName && <span className="font-medium text-ink-2">{evidence.studentName}</span>}
        <span>{evidenceKindLabel[evidence.kind]}</span>
        <span aria-hidden>·</span>
        <span>{evidenceSourceLabel[evidence.source]}</span>
        <span aria-hidden>·</span>
        <span>{evidence.experience.title}</span>
        <span aria-hidden>·</span>
        <span>{formatDate(evidence.occurredAt)}</span>
        <span aria-hidden>·</span>
        <span>{assistanceLevelLabel[evidence.assistanceLevel]}</span>
      </div>
      <p className="text-sm text-ink-2">{evidence.observation}</p>
      <p className="prose-plain border-l-2 border-line-strong pl-3 text-sm text-ink">“{truncate(evidence.content, 280)}”</p>
    </Link>
  );
}
