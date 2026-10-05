import Link from "next/link";
import { DimensionTag, LayerTag, PolarityText, ReviewBadge, SupportBadge } from "@/components/domain/status";
import { KeyValue, List, ListItem, Notice, Section } from "@/components/ui/layout";
import {
  assistanceLevelLabel,
  evidenceKindLabel,
  evidenceSourceLabel,
  polarityLabel,
  reviewVerdictLabel,
  studentStanceLabel,
  supportStatusHelp,
} from "@/domain/labels";
import { formatDate, formatDateTime, plural } from "@/lib/format";
import type { InferenceDetail, Viewer } from "@/server/services/development";

/**
 * "¿Por qué Educai cree esto?" — una inferencia con su cadena completa:
 * evidencia → señales → inferencia → respaldo → contradicciones → revisión humana.
 */
export function InferenceTrace({ inference, viewer, base }: { inference: InferenceDetail; viewer: Viewer; base: string }) {
  const supporting = inference.supports.filter((s) => s.relation === "SUPPORTS");
  const contradicting = inference.supports.filter((s) => s.relation === "CONTRADICTS");
  const policyNotes = (Array.isArray(inference.policyNotes) ? inference.policyNotes : []) as string[];
  const byEvidence = (list: typeof supporting) => {
    const map = new Map<string, { evidence: (typeof list)[number]["evidence"]; signals: (typeof list)[number]["signal"][] }>();
    for (const s of list) {
      const entry = map.get(s.evidenceId) ?? { evidence: s.evidence, signals: [] };
      entry.signals.push(s.signal);
      map.set(s.evidenceId, entry);
    }
    return [...map.values()].sort((a, b) => a.evidence.occurredAt.getTime() - b.evidence.occurredAt.getTime());
  };

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <LayerTag layer="inferred" />
          <DimensionTag dimension={inference.dimension} />
          <span className="text-xs">
            <PolarityText polarity={inference.polarity} />
          </span>
          {inference.curriculumItem && <span className="text-xs text-muted">· {inference.curriculumItem.title}</span>}
        </div>
        <p className="text-lg text-ink">{viewer === "student" ? inference.studentStatement : inference.statement}</p>
        {viewer === "teacher" && (
          <p className="text-sm text-muted">
            Versión que ve el estudiante: <span className="text-ink-2">“{inference.studentStatement}”</span>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <SupportBadge status={inference.supportStatus} />
          <ReviewBadge status={inference.reviewStatus} audience={viewer} />
          {inference.state === "SUPERSEDED" && <span className="text-xs text-muted">Reemplazada por una inferencia más reciente</span>}
        </div>
      </section>

      <Section title="Nivel de respaldo">
        <dl>
          <KeyValue label="Estado">{supportStatusHelp[inference.supportStatus]}</KeyValue>
          <KeyValue label="Justificación">{inference.supportRationale}</KeyValue>
          <KeyValue label="Evidencia">
            {new Set(supporting.map((s) => s.evidenceId)).size} a favor · {new Set(contradicting.map((s) => s.evidenceId)).size} en contra · en{" "}
            {plural(new Set(inference.supports.map((s) => s.evidence.experienceId)).size, "experiencia", "experiencias")}
          </KeyValue>
          {policyNotes.length > 0 && (
            <KeyValue label="Ajustes de la política">
              <ul className="list-disc space-y-0.5 pl-4">
                {policyNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
              {viewer === "teacher" && inference.proposedSupportStatus !== inference.supportStatus && (
                <p className="mt-1 text-xs text-muted">El modelo había propuesto un respaldo mayor; las reglas de Educai lo ajustaron.</p>
              )}
            </KeyValue>
          )}
          {inference.run && (
            <KeyValue label="Origen">
              {inference.run.origin === "seed" ? "Dato de demostración" : "Interpretation Engine"} · {formatDateTime(inference.createdAt)}
              {viewer === "teacher" && <span className="text-muted"> · {inference.run.promptVersion}</span>}
            </KeyValue>
          )}
        </dl>
      </Section>

      {contradicting.length > 0 && (
        <Notice tone="attention" title="Hay evidencia en sentido opuesto">
          {inference.contradictionNote ?? "Conviene revisar la evidencia que apunta en otra dirección."}
        </Notice>
      )}

      <Section title="Evidencia que la respalda" action={<LayerTag layer="observed" />}>
        <EvidenceCards groups={byEvidence(supporting)} base={base} />
      </Section>

      {contradicting.length > 0 && (
        <Section title="Evidencia en sentido opuesto" action={<LayerTag layer="observed" />}>
          <EvidenceCards groups={byEvidence(contradicting)} base={base} />
        </Section>
      )}

      {(inference.supersedes || inference.supersededBy) && (
        <Section title="Historia de esta conclusión">
          <ul className="space-y-2 text-sm">
            {inference.supersedes && (
              <li>
                <span className="text-muted">Antes ({formatDate(inference.supersedes.createdAt)}, {polarityLabel[inference.supersedes.polarity].toLowerCase()}): </span>
                <Link href={`${base}/inferences/${inference.supersedes.id}`} className="text-primary hover:underline">
                  {viewer === "student" ? inference.supersedes.studentStatement : inference.supersedes.statement}
                </Link>
              </li>
            )}
            {inference.supersededBy && (
              <li>
                <span className="text-muted">Después ({formatDate(inference.supersededBy.createdAt)}): </span>
                <Link href={`${base}/inferences/${inference.supersededBy.id}`} className="text-primary hover:underline">
                  {viewer === "student" ? inference.supersededBy.studentStatement : inference.supersededBy.statement}
                </Link>
              </li>
            )}
          </ul>
        </Section>
      )}

      {(inference.reviews.length > 0 || inference.studentResponses.length > 0) && (
        <Section title="Revisión humana" action={<LayerTag layer="teacher" />}>
          <List>
            {inference.reviews.map((r) => (
              <ListItem key={r.id} className="space-y-1 text-sm">
                <p>
                  <span className="font-medium text-ink">{viewer === "teacher" ? r.teacher.user.name : "Tu docente"}</span>{" "}
                  <span className="text-muted">marcó «{reviewVerdictLabel[r.verdict]}» · {formatDateTime(r.createdAt)}</span>
                </p>
                {viewer === "teacher" && r.comment && <p className="prose-plain text-ink-2">{r.comment}</p>}
              </ListItem>
            ))}
            {inference.studentResponses.map((r) => (
              <ListItem key={r.id} className="space-y-1 text-sm">
                <p>
                  <span className="font-medium text-ink">{viewer === "student" ? "Vos" : inference.student.user.name}</span>{" "}
                  <span className="text-muted">respondió «{studentStanceLabel[r.stance]}» · {formatDateTime(r.createdAt)}</span>
                </p>
                {r.note && <p className="prose-plain text-ink-2">{r.note}</p>}
              </ListItem>
            ))}
          </List>
        </Section>
      )}
    </div>
  );
}

type Group = {
  evidence: InferenceDetail["supports"][number]["evidence"];
  signals: InferenceDetail["supports"][number]["signal"][];
};

function EvidenceCards({ groups, base }: { groups: Group[]; base: string }) {
  return (
    <List>
      {groups.map(({ evidence, signals }) => (
        <ListItem key={evidence.id} className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span className="font-medium text-ink-2">{evidenceKindLabel[evidence.kind]}</span>
            <span>· {evidenceSourceLabel[evidence.source]}</span>
            <span>· {evidence.experience.title}</span>
            <span>· {formatDate(evidence.occurredAt)}</span>
            <span>· {assistanceLevelLabel[evidence.assistanceLevel]}</span>
          </div>
          <p className="text-sm text-ink-2">{evidence.observation}</p>
          <p className="prose-plain border-l-2 border-line-strong pl-3 text-sm text-ink">“{evidence.content}”</p>
          {evidence.context && <p className="text-xs text-muted">Contexto: {evidence.context}</p>}
          <ul className="space-y-0.5 text-xs text-ink-2">
            {signals.map((s) => (
              <li key={s.id}>
                Señal: <span className={s.polarity === "DIFFICULTY" ? "text-attention" : undefined}>{polarityLabel[s.polarity]}</span> — {s.description}
              </li>
            ))}
          </ul>
          <Link href={`${base}/evidence/${evidence.id}`} className="text-xs text-primary hover:underline">
            Ver la fuente y su provenance
          </Link>
        </ListItem>
      ))}
    </List>
  );
}
