import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EvidenceDetailView } from "@/components/domain/evidence-detail";
import { TextLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/layout";
import { requireEnrolledStudent } from "@/server/auth/guards";
import { getEvidenceDetail } from "@/server/services/development";

export const metadata: Metadata = { title: "Evidencia" };

export default async function StudentEvidencePage({ params }: { params: Promise<{ courseId: string; evidenceId: string }> }) {
  const { courseId, evidenceId } = await params;
  const { user } = await requireEnrolledStudent(courseId);
  const evidence = await getEvidenceDetail(evidenceId, courseId, "student", user.id);
  if (!evidence) notFound();
  return (
    <>
      <PageHeader eyebrow={<TextLink href={`/s/courses/${courseId}/development#evidencia`}>← Tu evidencia</TextLink>} title="Evidencia" />
      <EvidenceDetailView evidence={evidence} viewer="student" base={`/s/courses/${courseId}`} />
    </>
  );
}
