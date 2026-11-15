import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TextLink } from "@/components/ui/button";
import { Notice, PageHeader } from "@/components/ui/layout";
import { cn } from "@/lib/cn";
import { TEXT } from "@/lib/texts";
import { AccessDenied, requireStudent } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getQuizForStudent } from "@/server/services/quiz";
import { QuizForm } from "./quiz-form";

export const metadata: Metadata = { title: "Quiz" };

export default async function QuizPage({ params }: { params: Promise<{ folderId: string; quizId: string }> }) {
  const { folderId, quizId } = await params;
  const { user } = await requireStudent();
  const quiz = await getQuizForStudent({ id: user.id, role: user.role }, quizId).catch((e) => {
    if (e instanceof AccessDenied) notFound();
    throw e;
  });
  const t = TEXT.quiz;
  const mastery =
    quiz.status === "SUBMITTED"
      ? await db.masteryRecord.findUnique({
          where: { studentId_curriculumItemId: { studentId: user.id, curriculumItemId: quiz.topicId } },
          select: { score: true, attempts: true },
        })
      : null;

  return (
    <div className="shell space-y-6">
      <PageHeader title={t.title(quiz.topic)} />
      <TextLink href={`/s/folders/${folderId}`}>{t.backToFolder}</TextLink>
      {quiz.status === "OPEN" ? (
        <QuizForm quizId={quiz.id} questions={quiz.questions} />
      ) : (
        <div className="space-y-6">
          <Notice tone="success" title={t.result(quiz.correct ?? 0, quiz.total)}>
            {mastery && (
              <span>
                {t.mastery(mastery.score)} · {mastery.attempts < 3 && t.capNote}
              </span>
            )}
          </Notice>
          <ol className="space-y-4">
            {quiz.questions.map((q, i) => {
              const r = q as typeof q & { correctIndex: number; explanation: string; chosen: number | null };
              return (
                <li key={i} className="space-y-2 rounded-xl border border-line p-4">
                  <p className="text-sm font-medium text-ink">
                    {i + 1}. {q.prompt}
                  </p>
                  <ul className="space-y-1 text-sm">
                    {q.options.map((o, j) => (
                      <li
                        key={j}
                        className={cn(
                          "rounded px-2 py-1",
                          j === r.correctIndex && "bg-success/10 text-success",
                          j === r.chosen && j !== r.correctIndex && "bg-danger/10 text-danger",
                        )}
                      >
                        {o}
                        {j === r.chosen && <span className="ml-2 text-xs">({t.yourAnswer})</span>}
                        {j === r.correctIndex && j !== r.chosen && <span className="ml-2 text-xs">({t.correctAnswer})</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-ink-2">{r.explanation}</p>
                  <p className="text-xs text-muted">{t.source(q.source.fileName, q.source.page)}</p>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
