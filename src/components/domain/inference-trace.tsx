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
          {inference.curriculumItem && <span className="text-xs text-[#72706b]">· {inference.curriculumItem.title}</span>}
        </div>
        <p className="text-lg text-[#27251e] font-normal leading-relaxed">{viewer === "student" ? inference.studentStatement : inference.statement}</p>
        {viewer === "teacher" && (
          <p className="text-sm text-[#72706b]">
            Versión que ve el estudiante: <span className="text-[#27251e]">“{inference.studentStatement}”</span>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <SupportBadge status={inference.supportStatus} />
          <ReviewBadge status={inference.reviewStatus} audience={viewer} />
          {inference.state === "SUPERSEDED" && <span className="text-xs text-[#72706b]">Reemplazada por una inferencia más reciente</span>}
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
                <p className="mt-1 text-xs text-[#72706b]">El modelo había propuesto un respaldo mayor; las reglas de Educai lo ajustaron.</p>
              )}
            </KeyValue>
          )}
          {inference.run && (
            <KeyValue label="Origen">
              {inference.run.origin === "seed" ? "Dato de demostración" : "Interpretation Engine"} · {formatDateTime(inference.createdAt)}
              {viewer === "teacher" && <span className="text-[#72706b]"> · {inference.run.promptVersion}</span>}
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
                <span className="text-[#72706b]">Antes ({formatDate(inference.supersedes.createdAt)}, {polarityLabel[inference.supersedes.polarity].toLowerCase()}): </span>
                <Link href={`${base}/inferences/${inference.supersedes.id}`} className="text-[#016a71] hover:underline">
                  {viewer === "student" ? inference.supersedes.studentStatement : inference.supersedes.statement}
                </Link>
              </li>
            )}
            {inference.supersededBy && (
              <li>
                <span className="text-[#72706b]">Después ({formatDate(inference.supersededBy.createdAt)}): </span>
                <Link href={`${base}/inferences/${inference.supersededBy.id}`} className="text-[#016a71] hover:underline">
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
                  <span className="font-medium text-[#27251e]">{viewer === "teacher" ? r.teacher.user.name : "Tu docente"}</span>{" "}
                  <span className="text-[#72706b]">marcó «{reviewVerdictLabel[r.verdict]}» · {formatDateTime(r.createdAt)}</span>
                </p>
                {viewer === "teacher" && r.comment && <p className="prose-plain text-[#72706b]">{r.comment}</p>}
              </ListItem>
            ))}
            {inference.studentResponses.map((r) => (
              <ListItem key={r.id} className="space-y-1 text-sm">
                <p>
                  <span className="font-medium text-[#27251e]">{viewer === "student" ? "Vos" : inference.student.user.name}</span>{" "}
                  <span className="text-[#72706b]">respondió «{studentStanceLabel[r.stance]}» · {formatDateTime(r.createdAt)}</span>
                </p>
                {r.note && <p className="prose-plain text-[#72706b]">{r.note}</p>}
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
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#72706b]">
            <span className="font-medium text-[#27251e]">{evidenceKindLabel[evidence.kind]}</span>
            <span>· {evidenceSourceLabel[evidence.source]}</span>
            <span>· {evidence.experience.title}</span>
            <span>· {formatDate(evidence.occurredAt)}</span>
            <span>· {assistanceLevelLabel[evidence.assistanceLevel]}</span>
          </div>
          <p className="text-sm text-[#72706b]">{evidence.observation}</p>
          <p className="prose-plain border-l-2 border-[#d1d1cd] pl-3 text-sm text-[#27251e]">“{evidence.content}”</p>
          {evidence.context && <p className="text-xs text-[#72706b]">Contexto: {evidence.context}</p>}
          <ul className="space-y-0.5 text-xs text-[#72706b]">
            {signals.map((s) => (
              <li key={s.id}>
                Señal: <span className={s.polarity === "DIFFICULTY" ? "text-[#c08532]" : undefined}>{polarityLabel[s.polarity]}</span> — {s.description}
              </li>
            ))}
          </ul>
          <Link href={`${base}/evidence/${evidence.id}`} className="text-xs text-[#016a71] hover:underline">
            Ver la fuente y su provenance
          </Link>
        </ListItem>
      ))}
    </List>
  );
}
