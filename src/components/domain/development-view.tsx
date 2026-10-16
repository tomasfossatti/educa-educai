import type { SupportStatus } from "@prisma/client";
import { DimensionBlock } from "@/components/domain/dimension";
import { EvidenceRow, InferenceRow } from "@/components/domain/rows";
import { LayerTag } from "@/components/domain/status";
import { EmptyState, List, ListItem, Section } from "@/components/ui/layout";
import { snapshotDimensionLabel, supportStatusLabel } from "@/domain/labels";
import { formatDateTime } from "@/lib/format";
import { getActiveInferences, getEvidenceList, getSnapshots, type Viewer } from "@/server/services/development";

const SYMBOL: Record<SupportStatus, string> = { CONSISTENT: "●", PARTIAL: "◐", INSUFFICIENT: "○", CONTRADICTORY: "◑" };

/**
 * Development Snapshot + inferencias + evidencia. Compartido por la vista del estudiante y la del docente;
 * `base` define a qué rutas apuntan los enlaces de trazabilidad.
 */
export async function DevelopmentView({ studentId, courseId, viewer, base }: { studentId: string; courseId: string; viewer: Viewer; base: string }) {
  const [snapshots, inferences, evidence] = await Promise.all([
    getSnapshots(studentId, courseId),
    getActiveInferences(studentId, courseId, viewer),
    getEvidenceList(studentId, courseId),
  ]);
  const latest = snapshots[0];
  const evidenceHref = (id: string) => `${base}/evidence/${id}`;

  return (
    <div className="space-y-10">
      <Section
        title="Snapshot de desarrollo"
        description={
          latest
            ? `Calculado ${formatDateTime(latest.createdAt)} a partir de ${latest.evidenceCount} evidencias en ${latest.experienceCount} experiencias. Cada dimensión muestra la evidencia que la sostiene.`
            : undefined
        }
        action={<LayerTag layer="inferred" />}
      >
        {!latest ? (
          <EmptyState title="Todavía no hay evidencia suficiente">
            El snapshot se construye a partir de conversaciones con el tutor y actividades analizadas.
          </EmptyState>
        ) : (
          <div className="divide-y divide-[#d1d1cd] rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] shadow-[0_1px_2px_rgba(0,0,0,0.06)] overflow-hidden">
            {latest.dimensions.map((d) => (
              <DimensionBlock key={d.id} dimension={d} evidenceHref={evidenceHref} />
            ))}
          </div>
        )}
      </Section>

      {snapshots.length > 1 && (
        <Section title="Historial" description="Cómo cambió el respaldo de cada dimensión con cada nueva evidencia.">
          <div className="overflow-x-auto rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#d1d1cd] text-xs text-[#72706b]">
                <tr>
                  <th className="px-3.5 py-2.5 font-medium">Fecha</th>
                  {latest.dimensions.map((d) => (
                    <th key={d.dimension} className="px-3.5 py-2.5 font-medium">
                      {snapshotDimensionLabel[d.dimension]}
                    </th>
                  ))}
                  <th className="px-3.5 py-2.5 font-medium">Evidencias</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1d1cd]">
                {snapshots.map((s) => (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap px-3.5 py-2.5 text-[#72706b]">{formatDateTime(s.createdAt)}</td>
                    {latest.dimensions.map((ld) => {
                      const d = s.dimensions.find((x) => x.dimension === ld.dimension);
                      return (
                        <td key={ld.dimension} className="px-3.5 py-2.5" title={d ? `${supportStatusLabel[d.status]}: ${d.summary}` : undefined}>
                          <span className={d?.status === "CONTRADICTORY" ? "text-attention" : d?.status === "INSUFFICIENT" ? "text-[#92918b]" : "text-[#27251e]"}>
                            {d ? SYMBOL[d.status] : "—"}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3.5 py-2.5 text-[#72706b]">{s.evidenceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-[#d1d1cd] px-3.5 py-2.5 text-xs text-[#72706b]">
              ● consistente · ◐ parcial · ○ insuficiente · ◑ contradictoria
            </p>
          </div>
        </Section>
      )}

      <Section
        title={viewer === "student" ? "Conclusiones actuales" : "Inferencias activas"}
        description="Hipótesis generadas a partir de la evidencia. Abrí cualquiera para ver por qué Educai la propone."
      >
        {inferences.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay inferencias.</p>
        ) : (
          <List>
            {inferences.map((i) => (
              <ListItem key={i.id}>
                <InferenceRow
                  audience={viewer}
                  href={`${base}/inferences/${i.id}`}
                  inference={{ ...i, evidenceCount: new Set(i.supports.map((s) => s.evidenceId)).size }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Section>

      <Section id="evidencia" title="Evidencia" description="Lo que se observó, en orden cronológico inverso." action={<LayerTag layer="observed" />}>
        {evidence.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay evidencia registrada.</p>
        ) : (
          <List>
            {evidence.map((e) => (
              <ListItem key={e.id}>
                <EvidenceRow evidence={e} href={evidenceHref(e.id)} />
              </ListItem>
            ))}
          </List>
        )}
      </Section>
    </div>
  );
}
