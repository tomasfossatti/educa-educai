import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/layout";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Unirme a una materia" };

export default function JoinPage() {
  return (
    <div className="max-w-md">
      <PageHeader title="Unirme a una materia" description="Ingresá el código de 6 caracteres que te compartió tu docente." />
      <JoinForm />
    </div>
  );
}
