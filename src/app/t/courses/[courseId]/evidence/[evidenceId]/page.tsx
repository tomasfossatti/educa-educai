import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EvidenceDetailView } from "@/components/domain/evidence-detail";
import { TextLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/layout";
import { requireCourseTeacher } from "@/server/auth/guards";
import { openEvidenceAsTeacher } from "@/server/services/student-file";

export const metadata: Metadata = { title: "Evidencia" };

export default async function TeacherEvidencePage({ params }: { params: Promise<{ courseId: string; evidenceId: string }> }) {
  const { courseId, evidenceId } = await params;
  const { user } = await requireCourseTeacher(courseId);
  const evidence = await openEvidenceAsTeacher({ id: user.id, role: user.role }, evidenceId, courseId);
  if (!evidence) notFound();
  return (
    <>
      <PageHeader
        eyebrow={<TextLink href={`/t/courses/${courseId}/students/${evidence.studentId}`}>{evidence.student.user.name}</TextLink>}
        title="Evidencia"
      />
      <EvidenceDetailView evidence={evidence} viewer="teacher" base={`/t/courses/${courseId}`} />
    </>
  );
}
