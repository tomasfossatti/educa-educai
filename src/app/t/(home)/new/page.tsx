import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/layout";
import { requireTeacher } from "@/server/auth/guards";
import { NewCourseForm } from "./form";

export const metadata: Metadata = { title: "Crear materia" };

export default async function NewCoursePage() {
  // El layout ya lo exige, pero un layout no es una frontera de seguridad confiable en Next.
  await requireTeacher();
  return (
    <div className="max-w-xl">
      <PageHeader title="Crear materia" description="Después vas a cargar el programa para que Educai proponga el mapeo curricular." />
      <NewCourseForm />
    </div>
  );
}
