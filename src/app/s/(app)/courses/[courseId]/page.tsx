import type { Metadata } from "next";
import { ClassDashboard } from "@/components/student/class-dashboard";
import { FloatingTutor } from "@/components/student/floating-tutor";
import { requireEnrolledStudent } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Clase de hoy" };

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { user, course } = await requireEnrolledStudent(courseId);

  const [items, conversations, profile, activity] = await Promise.all([
    db.curriculumItem.findMany({
      where: { courseId, status: "ACCEPTED", kind: { in: ["CONCEPT", "OBJECTIVE", "COMPETENCY"] } },
      orderBy: [{ kind: "asc" }, { position: "asc" }],
    }),
    db.aIConversation.findMany({
      where: { courseId, studentId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { messages: true } },
        experience: { include: { runs: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { evidence: true } } } },
      },
    }),
    db.studentProfile.findUnique({ where: { userId: user.id } }),
    db.activity.findFirst({
      where: { courseId, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const concepts = items.filter((i) => i.kind === "CONCEPT");
  const activeConversation = conversations.find((c) => c.status === "ACTIVE") || conversations[0];

  // Concepto central de la clase de hoy (extraído de la currícula)
  const currentConcept = concepts.find((c) => c.title.toLowerCase().includes("hipótesis")) || concepts[0];
  const conceptTitle = currentConcept?.title || "hipótesis falsables";
  const conceptDescription = currentConcept?.description || "Formular hipótesis de negocio falsables (métrica, umbral y plazo) para no perder tiempo ni plata en ideas que no funcionan.";

  // Organización o contexto declarado en el onboarding
  let userOrganization = "tu empresa o emprendimiento";
  if (profile?.declaredCurrentContext) {
    const raw = profile.declaredCurrentContext.trim();
    if (raw.toLowerCase().includes("restaurante")) {
      userOrganization = "tu restaurante en el centro de Rosario";
    } else if (raw.toLowerCase().includes("diseño") || raw.toLowerCase().includes("interfaces")) {
      userOrganization = "tus proyectos de diseño e interfaces";
    } else if (raw.toLowerCase().includes("logística") || raw.toLowerCase().includes("commerce")) {
      userOrganization = "tu e-commerce";
    } else {
      const cleaned = raw
        .replace(/^trabajo en (el área comercial de |la parte de )?/i, "")
        .replace(/^trabajo en /i, "")
        .replace(/^soy /i, "")
        .replace(/\.$/, "");
      userOrganization = cleaned.length > 55 ? cleaned.slice(0, 55) + "…" : cleaned;
    }
  }

  return (
    <div className="relative">
      {/* ──────────────── 1. DASHBOARD DE CLASE PRINCIPAL ──────────────── */}
      <ClassDashboard
        courseId={courseId}
        courseName={course.name}
        teacherName={course.teacher.user.name}
        totalClasses={8}
        currentClassNumber={4}
        conceptTitle={conceptTitle}
        conceptDescription={conceptDescription}
        userOrganization={userOrganization}
        activity={
          activity
            ? {
                id: activity.id,
                title: activity.title,
                description:
                  activity.scenario ||
                  activity.instructions ||
                  "Una empresa de logística quiere ofrecer entregas en franjas de una hora, con un costo extra, a clientes de comercios online. No sabe si alguien pagaría por ese servicio.",
                isUnlocked: false,
              }
            : {
                id: "practice-logistics",
                title: "Práctica: hipótesis falsables en logística de última milla",
                description:
                  "Una empresa de logística quiere ofrecer entregas en franjas de una hora, con un costo extra, a clientes de comercios online. No sabe si alguien pagaría por ese servicio.",
                isUnlocked: false,
              }
        }
        activeConversation={
          activeConversation
            ? {
                id: activeConversation.id,
                title: activeConversation.title,
                messageCount: activeConversation._count.messages,
              }
            : null
        }
      />

      {/* ──────────────── 2. CHAT IA FLOTANTE EN LA ESQUINA INFERIOR DERECHA ──────────────── */}
      <FloatingTutor
        courseId={courseId}
        courseName={course.name}
        topicTitle={currentConcept?.title || "Hipótesis falsables"}
        initialConversationId={activeConversation?.id}
        initialMessageCount={activeConversation?._count.messages ?? 0}
      />
    </div>
  );
}
