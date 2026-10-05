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
          <span className="text-xs text-muted">
            {evidenceKindLabel[evidence.kind]} · {evidenceSourceLabel[evidence.source]}
          </span>
        </div>
        <p className="text-base text-ink">{evidence.observation}</p>
        <Quote>“{evidence.content}”</Quote>
        {evidence.provenance.excerptVerified === false && (
          <p className="text-xs text-muted">El fragmento muestra el texto completo de la fuente porque la cita propuesta por la IA no coincidía literalmente.</p>
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
            {viewer === "teacher" && evidence.provenance.model && <span className="text-muted"> · {evidence.provenance.model}</span>}
          </KeyValue>
        </dl>
      </Section>

      {evidence.sourceMessages.length > 0 && (
        <Section title="Fuente original" description="Solo los mensajes en los que se basa esta evidencia.">
          <div className="space-y-2">
            {evidence.sourceMessages.map((m) => (
              <div key={m.id} className={cn("prose-plain rounded-md px-3 py-2 text-sm", m.role === "STUDENT" ? "bg-subtle" : "border border-line bg-surface")}>
                <span className="mb-0.5 block text-xs font-medium text-muted">{m.role === "STUDENT" ? (viewer === "student" ? "Vos" : "Estudiante") : "Tutor"} · {formatDateTime(m.createdAt)}</span>
                {m.content}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Señales extraídas">
        {evidence.signals.length === 0 ? (
          <p className="text-sm text-muted">Esta evidencia no produjo señales.</p>
        ) : (
          <List>
            {evidence.signals.map((s) => (
              <ListItem key={s.id} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <DimensionTag dimension={s.dimension} />
                  <span className={s.polarity === "DIFFICULTY" ? "text-attention" : "text-ink-2"}>{polarityLabel[s.polarity]}</span>
                  {s.curriculumItem && <span className="text-muted">· {s.curriculumItem.title}</span>}
                </div>
                <p className="text-sm text-ink">{s.description}</p>
                {s.rationale && <p className="text-xs text-muted">{s.rationale}</p>}
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
                <p className="text-sm text-ink">
                  {s.relation === "CONTRADICTS" && <span className="text-attention">En contra de: </span>}
                  <Link href={`${base}/inferences/${s.inference.id}`} className="hover:text-primary">
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
              <ListItem key={l.evaluationId} className="flex flex-wrap items-center gap-2 text-sm">
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
