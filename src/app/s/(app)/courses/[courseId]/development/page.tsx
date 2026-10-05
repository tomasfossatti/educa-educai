import type { Metadata } from "next";
import { DevelopmentView } from "@/components/domain/development-view";
import { PageHeader } from "@/components/ui/layout";
import { requireEnrolledStudent } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Desarrollo" };

export default async function StudentDevelopmentPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { user, course } = await requireEnrolledStudent(courseId);
  return (
    <>
      <PageHeader
        eyebrow={course.name}
        title="Tu desarrollo"
        description="Qué muestra la evidencia sobre lo que comprendés, aplicás y transferís, cuánta ayuda necesitás y cómo cambia con el tiempo. No es una nota ni una etiqueta: es una representación revisable."
      />
      <DevelopmentView studentId={user.id} courseId={courseId} viewer="student" base={`/s/courses/${courseId}`} />
    </>
  );
}
