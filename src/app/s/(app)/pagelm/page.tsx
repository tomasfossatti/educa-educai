import type { Metadata } from "next";
import { PageLMStudio } from "@/components/pagelm/pagelm-studio";
import { requireStudent } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "PageLM Studio",
  description: "Estudio de aprendizaje interactivo con IA: quizzes, flashcards, smart notes y podcasts.",
};

export default async function PageLMPage() {
  await requireStudent();

  return (
    <div className="relative w-full flex-1 flex flex-col justify-start">
      <PageLMStudio />
    </div>
  );
}
