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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#72706b]">
        {inference.studentName && <span className="font-medium text-[#27251e]">{inference.studentName}</span>}
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
      <p className="text-sm text-[#27251e] leading-relaxed">{audience === "student" ? inference.studentStatement : inference.statement}</p>
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <SupportBadge status={inference.supportStatus} />
        <ReviewBadge status={inference.reviewStatus} audience={audience} />
        <Link href={href} className="text-sm text-[#016a71] hover:underline font-normal">
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
    <Link href={href} className="block space-y-1.5 hover:bg-[#faf8f5] -mx-4 -my-3 px-4 py-3 transition-colors">
      <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#72706b]">
        {evidence.studentName && <span className="font-medium text-[#27251e]">{evidence.studentName}</span>}
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
      <p className="text-sm text-[#72706b] leading-relaxed">{evidence.observation}</p>
      <p className="prose-plain border-l-2 border-[#d1d1cd] pl-3 text-sm text-[#27251e]">“{truncate(evidence.content, 280)}”</p>
    </Link>
  );
}
