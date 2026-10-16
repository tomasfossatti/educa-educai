import Link from "next/link";
import { DimensionTag, EvaluationBadge, LayerTag, ReviewBadge, SupportBadge } from "@/components/domain/status";
import { KeyValue, List, ListItem, Quote, Section } from "@/components/ui/layout";
import { parseActivityPrompts } from "@/domain/activity";
import { assistanceLevelLabel, evidenceKindLabel, evidenceSourceLabel, polarityLabel } from "@/domain/labels";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { EvidenceDetail as Detail, Viewer } from "@/server/services/development";

const ASSISTANCE_SOURCE = { OBSERVED: "observada en la conversación", DECLARED: "declarada por el estudiante", UNKNOWN: "desconocida" } as const;

/** Un Evidence Object con su fuente, contexto, provenance, señales y las inferencias que alimenta. */
export function EvidenceDetailView({ evidence, viewer, base }: { evidence: Detail; viewer: Viewer; base: string }) {
  const prompts = evidence.experience.submission ? parseActivityPrompts(evidence.experience.submission.activity.prompts) : [];
  const promptLabels = (evidence.provenance.promptKeys ?? []).map((k) => prompts.find((p) => p.key === k)?.label ?? k);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <LayerTag layer="observed" />
          <span className="text-xs text-[#72706b]">
            {evidenceKindLabel[evidence.kind]} · {evidenceSourceLabel[evidence.source]}
          </span>
        </div>
        <p className="text-base text-[#27251e] font-normal leading-relaxed">{evidence.observation}</p>
        <Quote>“{evidence.content}”</Quote>
        {evidence.provenance.excerptVerified === false && (
          <p className="text-xs text-[#72706b]">El fragmento muestra el texto completo de la fuente porque la cita propuesta por la IA no coincidía literalmente.</p>
        )}
      </section>

      <Section title="Contexto y provenance">
        <dl>
          {viewer === "teacher" && <KeyValue label="Estudiante">{evidence.student.user.name}</KeyValue>}
          <KeyValue label="Experiencia de origen">{evidence.experience.title}</KeyValue>
          <KeyValue label="Cuándo">{formatDateTime(evidence.occurredAt)}</KeyValue>
          {promptLabels.length > 0 && <KeyValue label="Consigna">{promptLabels.join(" · ")}</KeyValue>}
          <KeyValue label="Condiciones">{evidence.context ?? "—"}</KeyValue>
          <KeyValue label="Asistencia">
            {assistanceLevelLabel[evidence.assistanceLevel]} ({ASSISTANCE_SOURCE[evidence.assistanceSource]})
            {evidence.assistanceNote ? ` — ${evidence.assistanceNote}` : ""}
          </KeyValue>
          <KeyValue label="Currícula relacionada">
            {evidence.curriculumLinks.length ? evidence.curriculumLinks.map((l) => l.curriculumItem.title).join(" · ") : "Sin vincular"}
          </KeyValue>
          <KeyValue label="Registrada por">
            {evidence.provenance.origin === "seed" ? "Datos de demostración" : "Interpretation Engine"}
            {evidence.run && ` · ${formatDateTime(evidence.run.createdAt)}`}
            {viewer === "teacher" && evidence.provenance.model && <span className="text-[#72706b]"> · {evidence.provenance.model}</span>}
          </KeyValue>
        </dl>
      </Section>

      {evidence.sourceMessages.length > 0 && (
        <Section title="Fuente original" description="Solo los mensajes en los que se basa esta evidencia.">
          <div className="space-y-2">
            {evidence.sourceMessages.map((m) => (
              <div key={m.id} className={cn("prose-plain rounded-xl px-4 py-3 text-sm border", m.role === "STUDENT" ? "border-[#d1d1cd] bg-[#faf8f5] text-[#27251e]" : "border-[#d1d1cd] bg-[#fdfbfa] text-[#27251e]")}>
                <span className="mb-1 block text-xs font-normal text-[#72706b]">{m.role === "STUDENT" ? (viewer === "student" ? "Vos" : "Estudiante") : "Tutor"} · {formatDateTime(m.createdAt)}</span>
                {m.content}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Señales extraídas">
        {evidence.signals.length === 0 ? (
          <p className="text-sm text-[#72706b]">Esta evidencia no produjo señales.</p>
        ) : (
          <List>
            {evidence.signals.map((s) => (
              <ListItem key={s.id} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <DimensionTag dimension={s.dimension} />
                  <span className={s.polarity === "DIFFICULTY" ? "text-[#c08532]" : "text-[#72706b]"}>{polarityLabel[s.polarity]}</span>
                  {s.curriculumItem && <span className="text-[#72706b]">· {s.curriculumItem.title}</span>}
                </div>
                <p className="text-sm text-[#27251e]">{s.description}</p>
                {s.rationale && <p className="text-xs text-[#72706b]">{s.rationale}</p>}
              </ListItem>
            ))}
          </List>
        )}
      </Section>

      {evidence.supports.length > 0 && (
        <Section title="Inferencias que usan esta evidencia" action={<LayerTag layer="inferred" />}>
          <List>
            {evidence.supports.map((s) => (
              <ListItem key={s.id} className="space-y-1.5">
                <p className="text-sm text-[#27251e]">
                  {s.relation === "CONTRADICTS" && <span className="text-[#c08532]">En contra de: </span>}
                  <Link href={`${base}/inferences/${s.inference.id}`} className="text-[#016a71] hover:underline">
                    {viewer === "student" ? s.inference.studentStatement : s.inference.statement}
                  </Link>
                </p>
                <div className="flex flex-wrap gap-2">
                  <SupportBadge status={s.inference.supportStatus} />
                  <ReviewBadge status={s.inference.reviewStatus} audience={viewer} />
                </div>
              </ListItem>
            ))}
          </List>
        </Section>
      )}

      {evidence.evaluationLinks.length > 0 && (
        <Section title="Criterios evaluados con esta evidencia" action={<LayerTag layer="evaluated" />}>
          <List>
            {evidence.evaluationLinks.map((l) => (
              <ListItem key={l.evaluationId} className="flex flex-wrap items-center gap-2 text-sm text-[#27251e]">
                <span>{l.evaluation.criterion.title}</span>
                <EvaluationBadge result={l.evaluation.result} />
              </ListItem>
            ))}
          </List>
        </Section>
      )}
    </div>
  );
}
