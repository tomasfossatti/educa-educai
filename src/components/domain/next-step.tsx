import type { ActionSource, ActionType } from "@prisma/client";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/client";
import { actionTypeLabel } from "@/domain/labels";
import { setSuggestedActionStatusAction, startConversationAction } from "@/server/actions/student";

interface NextStep {
  id: string;
  type: ActionType;
  source: ActionSource;
  title: string;
  description: string;
  curriculumItem: { id: string; title: string } | null;
  activity: { id: string; title: string } | null;
}

/** Un próximo paso con su acción concreta (practicar, hacer la actividad, marcar como hecho). */
export function NextStepItem({ action, courseId }: { action: NextStep; courseId: string }) {
  const practice = action.type === "PRACTICE_WITH_TUTOR" || action.type === "REVIEW_CONCEPT";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <span className={action.source === "TEACHER" ? "font-medium text-primary" : undefined}>
          {action.source === "TEACHER" ? "De tu docente" : "Sugerido por Educai"}
        </span>
        <span aria-hidden>·</span>
        <span>{actionTypeLabel[action.type]}</span>
        {action.curriculumItem && (
          <>
            <span aria-hidden>·</span>
            <span>{action.curriculumItem.title}</span>
          </>
        )}
      </div>
      <p className="text-sm font-medium text-ink">{action.title}</p>
      <p className="prose-plain text-sm text-ink-2">{action.description}</p>
      <div className="flex flex-wrap gap-2">
        {action.activity && (
          <ButtonLink href={`/s/courses/${courseId}/activities/${action.activity.id}`} size="sm" variant="primary">
            Ir a la actividad
          </ButtonLink>
        )}
        {practice && (
          <form action={startConversationAction}>
            <input type="hidden" name="courseId" value={courseId} />
            <input type="hidden" name="suggestedActionId" value={action.id} />
            {action.curriculumItem && <input type="hidden" name="focusItemId" value={action.curriculumItem.id} />}
            <SubmitButton size="sm" variant="primary" pendingText="Abriendo…">
              Practicar con el tutor
            </SubmitButton>
          </form>
        )}
        <form action={setSuggestedActionStatusAction.bind(null, action.id, "DONE")}>
          <SubmitButton size="sm" variant="secondary">
            Marcar como hecho
          </SubmitButton>
        </form>
        <form action={setSuggestedActionStatusAction.bind(null, action.id, "DISMISSED")}>
          <SubmitButton size="sm" variant="ghost">
            Descartar
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
