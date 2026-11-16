import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CourseSelector } from "@/components/student/course-selector";
import { SubmitButton } from "@/components/ui/client";
import { EmptyState } from "@/components/ui/layout";
import { cn } from "@/lib/cn";
import { TEXT } from "@/lib/texts";
import { trafficLight, type TrafficLight } from "@/domain/traffic-light";
import { startQuizAction } from "@/server/actions/folders";
import { requireStudent } from "@/server/auth/guards";
import { getPanelState, getPanelTopics } from "@/server/services/student-panel";

export const metadata: Metadata = { title: "Mi avance" };

const DOT: Record<TrafficLight, string> = {
  GREEN: "bg-success",
  YELLOW: "bg-[#f2b705]",
  GRAY: "bg-line-strong",
};

/**
 * Mi avance: un semáforo por tema, calculado en código desde el registro de prácticas
 * (`src/domain/traffic-light.ts`). Sin porcentajes. Tocar un tema abre una práctica de ese tema.
 */
export default async function ProgressPage() {
  const { user } = await requireStudent();
  const viewer = { id: user.id, role: user.role };
  const { options, current } = await getPanelState(viewer);
  if (!current) redirect("/s");
  const topics = await getPanelTopics(viewer, current);
  const t = TEXT.student.progress;

  return (
    <div className="shell mx-auto max-w-3xl space-y-5">
      <CourseSelector options={options} current={current} next="/s/avance" />
      {topics.length === 0 ? (
        <EmptyState title={current.courseId ? t.empty : t.noTopics} />
      ) : (
        <>
          <p className="text-muted">{t.hint}</p>
          <ul className="space-y-2">
            {topics.map((topic) => {
              const light = trafficLight(topic.masteryRecords[0]);
              return (
                <li key={topic.id}>
                  <form action={startQuizAction.bind(null, current.folderId, topic.id)}>
                    <SubmitButton
                      variant="secondary"
                      pendingText={TEXT.student.practice.starting}
                      aria-label={`${topic.title}: ${t.state[light]}`}
                      data-light={light}
                      className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left text-base"
                    >
                      <span className="flex w-full items-center justify-between gap-3">
                        <span className="whitespace-normal">{topic.title}</span>
                        <span className="flex shrink-0 items-center gap-2 text-sm text-ink-2">
                          <span className={cn("size-3.5 rounded-full", DOT[light])} aria-hidden />
                          {t.state[light]}
                        </span>
                      </span>
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
