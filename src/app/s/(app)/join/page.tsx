import type { Metadata } from "next";
import { TEXT } from "@/lib/texts";
import { requireStudent } from "@/server/auth/guards";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Unirme a una materia" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  // El layout ya lo exige, pero un layout no es una frontera de seguridad confiable en Next.
  await requireStudent();
  const { code } = await searchParams;
  const t = TEXT.student.noCourse;
  return (
    <div className="shell mx-auto max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-ink">{t.title}</h1>
        <p className="text-muted">{t.hint}</p>
      </div>
      <JoinForm defaultCode={typeof code === "string" ? code.slice(0, 8) : undefined} autoFocus />
    </div>
  );
}
