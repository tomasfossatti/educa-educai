import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/layout";
import { NewCourseForm } from "./form";

export const metadata: Metadata = { title: "Crear materia" };

export default function NewCoursePage() {
  return (
    <div className="max-w-xl">
      <PageHeader title="Crear materia" description="Después vas a cargar el programa para que Educai proponga el mapeo curricular." />
      <NewCourseForm />
    </div>
  );
}
