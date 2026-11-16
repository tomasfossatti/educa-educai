import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuizForm } from "@/components/student/quiz-form";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { TEXT } from "@/lib/texts";
import { AccessDenied, requireStudent } from "@/server/auth/guards";
import { getQuizForStudent } from "@/server/services/quiz";

export const metadata: Metadata = { title: "Practicar" };

/**
 * Un quiz. Mientras está abierto, la página no trae las respuestas correctas (las quita el servicio).
 * Al entregar: un solo mensaje y "Seguir"; el detalle de cada pregunta queda detrás de "Ver más".
 */
export default async function QuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const { user } = await requireStudent();
  const quiz = await getQuizForStudent({ id: user.id, role: user.role }, quizId).catch((e) => {
    if (e instanceof AccessDenied) notFound();
    throw e;
  });
  const t = TEXT.student.practice;

  if (quiz.status === "OPEN") {
    return (
      <div className="shell mx-auto max-w-3xl space-y-5">
        <h1 className="text-xl font-bold text-ink sm:text-2xl">{quiz.topic}</h1>
        <QuizForm quizId={quiz.id} questions={quiz.questions} />
      </div>
    );
  }

  const correct = quiz.correct ?? 0;
  return (
    <div className="shell mx-auto max-w-3xl space-y-6">
      <div className="space-y-2 rounded-2xl border border-line bg-surface p-6 text-center">
        <h1 className="text-2xl font-bold text-ink">{t.result(correct, quiz.total)}</h1>
        <p className="text-base text-ink-2">{correct === quiz.total ? t.resultGood : t.resultKeep}</p>
        <div className="pt-2">
          <ButtonLink href="/s/practicar" variant="primary" className="text-on-primary min-h-11 px-8 text-base">
            {t.next}
          </ButtonLink>
        </div>
      </div>
      <details>
        <summary className="min-h-11 cursor-pointer py-2 text-sm text-muted">{TEXT.student.myData.seeMore}</summary>
        <ol className="mt-2 space-y-4">
          {quiz.questions.map((q, i) => {
            const r = q as typeof q & { correctIndex: number; explanation: string; chosen: number | null };
            return (
              <li key={i} className="space-y-2 rounded-xl border border-line p-4">
                <p className="text-base font-medium text-ink">
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
                <p className="text-sm text-ink-2">{r.explanation}</p>
                <p className="text-xs text-muted">{t.from(TEXT.student.ask.source(q.source.fileName, q.source.page))}</p>
              </li>
            );
          })}
        </ol>
      </details>
    </div>
  );
}
