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

  // Objetivo general de la clase de hoy (extraído de la currícula)
  const currentConcept = concepts.find((c) => c.title.toLowerCase().includes("hipótesis")) || concepts[0];
  const learningGoal = currentConcept
    ? `${currentConcept.title}: ${currentConcept.description}`
    : "Formular hipótesis de negocio falsables (métrica, umbral y plazo) para no perder tiempo ni plata en ideas que no funcionan.";

  // Personalización basada en el perfil declarado del estudiante (Refuerzo positivo y Autoeficacia)
  let personalizedApplication = "dominar hipótesis falsables y validar decisiones estratégicas en tus proyectos profesionales y personales.";
  if (profile?.declaredCurrentContext) {
    if (profile.declaredCurrentContext.toLowerCase().includes("restaurante")) {
      personalizedApplication = "validar las promociones, combos y el nuevo menú semanal en tu restaurante en Rosario.";
    } else if (profile.declaredCurrentContext.toLowerCase().includes("diseño") || profile.declaredCurrentContext.toLowerCase().includes("interfaces")) {
      personalizedApplication = "descubrir métricas de usabilidad y testear hipótesis de comportamiento antes de diseñar interfaces completas.";
    } else if (profile.declaredCurrentContext.toLowerCase().includes("logística") || profile.declaredCurrentContext.toLowerCase().includes("commerce")) {
      personalizedApplication = "conectar hipótesis de entrega y satisfacción de clientes antes de modificar los flujos logísticos del e-commerce.";
    } else {
      personalizedApplication = `dominar experimentos simples y supuestos falsables en: ${profile.declaredCurrentContext.slice(0, 120)}.`;
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
        learningGoal={learningGoal}
        personalizedApplication={personalizedApplication}
        activity={
          activity
            ? {
                id: activity.id,
                title: activity.title,
                description: activity.scenario || activity.instructions || "Actividad práctica de aplicación de clase.",
                isUnlocked: false,
              }
            : null
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
