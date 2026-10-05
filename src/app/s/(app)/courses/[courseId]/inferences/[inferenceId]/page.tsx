import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InferenceTrace } from "@/components/domain/inference-trace";
import { TextLink } from "@/components/ui/button";
import { PageHeader, Section } from "@/components/ui/layout";
import { requireEnrolledStudent } from "@/server/auth/guards";
import { getInferenceDetail } from "@/server/services/development";
import { StudentResponseForm } from "./response-form";

export const metadata: Metadata = { title: "¿Por qué Educai cree esto?" };

export default async function StudentInferencePage({ params }: { params: Promise<{ courseId: string; inferenceId: string }> }) {
  const { courseId, inferenceId } = await params;
  const { user } = await requireEnrolledStudent(courseId);
  const inference = await getInferenceDetail(inferenceId, courseId, "student", user.id);
  if (!inference) notFound();
  const base = `/s/courses/${courseId}`;
  return (
    <>
      <PageHeader
        eyebrow={<TextLink href={`${base}/development`}>← Tu desarrollo</TextLink>}
        title="¿Por qué Educai cree esto?"
        description="Esta conclusión es una hipótesis construida a partir de evidencia concreta. Podés revisarla y decir si estás de acuerdo."
      />
      <div className="space-y-10">
        <InferenceTrace inference={inference} viewer="student" base={base} />
        <Section title="¿Qué opinás?" description="Tu respuesta queda junto a la conclusión y la ve tu docente. Sirve para corregir o contextualizar a Educai.">
          <StudentResponseForm inferenceId={inference.id} />
        </Section>
      </div>
    </>
  );
}
