import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/layout";
import { requireStudent } from "@/server/auth/guards";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Unirme a una materia" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  // El layout ya lo exige, pero un layout no es una frontera de seguridad confiable en Next.
  await requireStudent();
  const { code } = await searchParams;
  return (
    <div className="max-w-md">
      <PageHeader title="Unirme a una materia" description="Ingresá el código de 6 caracteres que te compartió tu docente." />
      <JoinForm defaultCode={typeof code === "string" ? code.slice(0, 8) : undefined} />
    </div>
  );
}
