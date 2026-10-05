import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExperienceResults } from "@/components/domain/experience-results";
import { TextLink } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/client";
import { Notice, PageHeader, Section } from "@/components/ui/layout";
import { formatDateTime } from "@/lib/format";
import { closeConversationAction, deleteConversationAction } from "@/server/actions/student";
import { requireEnrolledStudent } from "@/server/auth/guards";
import { getOwnConversation } from "@/server/services/conversations";
import { Chat } from "./chat";

export const metadata: Metadata = { title: "Tutor" };

export default async function TutorPage({ params }: { params: Promise<{ courseId: string; conversationId: string }> }) {
  const { courseId, conversationId } = await params;
  const { user, course } = await requireEnrolledStudent(courseId);
  const conversation = await getOwnConversation(conversationId, user.id);
  if (!conversation || conversation.courseId !== courseId) notFound();
  const active = conversation.status === "ACTIVE";
  const studentMessages = conversation.messages.filter((m) => m.role === "STUDENT").length;

  return (
    <>
      <PageHeader
        eyebrow={`${course.name} · Tutor`}
        title={conversation.title}
        description={
          conversation.activity ? (
            <>
              Conversación sobre la actividad <TextLink href={`/s/courses/${courseId}/activities/${conversation.activity.id}`}>{conversation.activity.title}</TextLink>. El
              tutor te ayuda a pensar, pero no va a resolverla por vos.
            </>
          ) : (
            `Iniciada el ${formatDateTime(conversation.createdAt)}`
          )
        }
      />

      <div className="space-y-8">
        <Notice>
          Al terminar la sesión, Educai puede generar evidencia sobre tu razonamiento a partir de esta conversación. Tu docente ve solo los fragmentos
          que se conviertan en evidencia, no la conversación completa.
        </Notice>

        <Chat
          conversationId={conversation.id}
          active={active}
          initialMessages={conversation.messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
        />

        {active ? (
          <form action={closeConversationAction.bind(null, conversation.id)} className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <ConfirmSubmit
              variant="secondary"
              message="¿Terminar la sesión? Educai va a analizar la conversación para generar evidencia y feedback. Después no podrás seguir escribiendo en ella."
              disabled={studentMessages === 0}
            >
              Terminar sesión y generar evidencia
            </ConfirmSubmit>
            <span className="text-xs text-muted">
              {studentMessages === 0 ? "Escribí al menos un mensaje para poder terminar." : "Podés volver más tarde: la sesión queda abierta."}
            </span>
          </form>
        ) : (
          <ExperienceResults experienceId={conversation.experienceId} studentId={user.id} courseId={courseId} />
        )}

        <Section title="Privacidad de esta conversación">
          <form action={deleteConversationAction.bind(null, conversation.id)} className="flex flex-wrap items-center gap-3">
            <ConfirmSubmit
              variant="danger"
              size="sm"
              message="¿Eliminar esta conversación? Se borran también la evidencia, las inferencias y el feedback que dependían de ella. No se puede deshacer."
            >
              Eliminar conversación
            </ConfirmSubmit>
            <span className="text-xs text-muted">Borra la conversación y todo lo que Educai derivó de ella.</span>
          </form>
        </Section>
      </div>
    </>
  );
}
