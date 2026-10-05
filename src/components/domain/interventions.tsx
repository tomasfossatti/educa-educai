import type { InterventionType } from "@prisma/client";
import Link from "next/link";
import { LayerTag } from "@/components/domain/status";
import { List, ListItem } from "@/components/ui/layout";
import { dimensionLabel, interventionTypeLabel, polarityLabel } from "@/domain/labels";
import { truncate } from "@/domain/text-guards";
import { formatDate } from "@/lib/format";
import { getInterventionFollowUp } from "@/server/services/development";

interface InterventionData {
  id: string;
  type: InterventionType;
  description: string;
  messageToStudents: string | null;
  occurredAt: Date;
  curriculumItemId: string | null;
  targets: { studentId: string; student: { user: { name: string } } }[];
}

/** Intervenciones registradas y la evidencia que apareció después (insight → acción → nueva evidencia). */
export async function InterventionList({ interventions, courseId }: { interventions: InterventionData[]; courseId: string }) {
  if (interventions.length === 0) return null;
  const followUps = await Promise.all(interventions.map((i) => getInterventionFollowUp(i.id, courseId)));
  const base = `/t/courses/${courseId}`;
  return (
    <List>
      {interventions.map((intervention, index) => {
        const after = followUps[index];
        return (
          <ListItem key={intervention.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <LayerTag layer="teacher" />
              <span className="font-medium text-ink-2">{interventionTypeLabel[intervention.type]}</span>
              <span>· {formatDate(intervention.occurredAt)}</span>
              <span>· {intervention.targets.map((t) => t.student.user.name).join(", ")}</span>
            </div>
            <p className="prose-plain text-sm text-ink">{intervention.description}</p>
            {intervention.messageToStudents && <p className="prose-plain text-sm text-ink-2">Mensaje: “{intervention.messageToStudents}”</p>}
            <div className="rounded-md bg-subtle px-3 py-2 text-sm">
              {after.length === 0 ? (
                <p className="text-muted">Todavía no hay evidencia relacionada posterior a esta intervención.</p>
              ) : (
                <>
                  <p className="mb-1 font-medium text-ink">Evidencia posterior ({after.length})</p>
                  <ul className="space-y-1.5">
                    {after.map((e) => {
                      const related = e.signals.filter((s) => !intervention.curriculumItemId || s.curriculumItemId === intervention.curriculumItemId);
                      return (
                        <li key={e.id} className="text-ink-2">
                          <Link href={`${base}/evidence/${e.id}`} className="text-primary hover:underline">
                            {e.student.user.name} · {e.experience.title} · {formatDate(e.occurredAt)}
                          </Link>
                          {related.length > 0 && (
                            <span className="text-xs">
                              {" "}
                              —{" "}
                              {related
                                .map((s) => `${polarityLabel[s.polarity].toLowerCase()} en ${dimensionLabel[s.dimension].toLowerCase()}`)
                                .join(", ")}
                            </span>
                          )}
                          <span className="block text-xs text-muted">“{truncate(e.content, 160)}”</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </ListItem>
        );
      })}
    </List>
  );
}
