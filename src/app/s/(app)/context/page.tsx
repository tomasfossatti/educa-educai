import type { Metadata } from "next";
import { LayerTag } from "@/components/domain/status";
import { Checkbox } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/client";
import { KeyValue, PageHeader, Section } from "@/components/ui/layout";
import { formatDate, plural } from "@/lib/format";
import { updatePrivacyAction } from "@/server/actions/student";
import { requireStudent } from "@/server/auth/guards";
import { getStudentDataSummary } from "@/server/services/privacy";
import { ContextForm, DeleteAccountForm } from "./forms";

export const metadata: Metadata = { title: "Tu contexto" };

export default async function ContextPage() {
  const { user, profile } = await requireStudent();
  const summary = await getStudentDataSummary(user.id);

  return (
    <>
      <PageHeader
        title="Tu contexto"
        description="Lo que declaraste sobre vos, qué sabe Educai, de dónde salió y quién puede verlo."
      />
      <div className="space-y-10">
        <Section
          title="Lo que declaraste"
          description="Es tu hipótesis inicial sobre vos. Educai la usa para que los ejemplos sean relevantes, nunca como evidencia de tus capacidades."
          action={<LayerTag layer="declared" />}
        >
          <ContextForm
            defaults={{
              currentContext: profile.declaredCurrentContext ?? "",
              interests: profile.declaredInterests ?? "",
              goals: profile.declaredGoals ?? "",
              strengths: profile.declaredStrengths ?? "",
              difficulties: profile.declaredDifficulties ?? "",
              workPreferences: profile.declaredWorkPreferences ?? "",
            }}
          />
          <p className="text-xs text-[#72706b]">Última actualización: {formatDate(profile.declaredUpdatedAt)}</p>
        </Section>

        <Section title="Qué sabe Educai sobre vos" description="Todo lo que se guarda proviene de lo que hiciste dentro de Educai.">
          <dl className="divide-y divide-[#d1d1cd] rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] px-5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
            <KeyValue label="Conversaciones con el tutor">
              {summary.conversations} ({summary.messages} mensajes tuyos) · Origen: tus sesiones de estudio · Visibles: solo vos
            </KeyValue>
            <KeyValue label="Entregas de actividades">{summary.submissions} · Visibles: vos y el docente de la materia</KeyValue>
            <KeyValue label="Evidencias">
              {summary.evidence} fragmentos de lo que produjiste, con su fuente · Visibles: vos y el docente de la materia
            </KeyValue>
            <KeyValue label="Inferencias activas">
              {summary.inferences} hipótesis generadas por IA a partir de esa evidencia · Visibles: vos y el docente
            </KeyValue>
            <KeyValue label="Revisiones docentes">{plural(summary.reviews, "revisión", "revisiones")} de tu docente sobre inferencias</KeyValue>
            <KeyValue label="Intervenciones">{plural(summary.interventions, "acción", "acciones")} de tu docente que te incluyeron</KeyValue>
            <KeyValue label="Contexto declarado">Visible para tu docente: {profile.shareContextWithTeachers ? "sí" : "no"}</KeyValue>
          </dl>
          <p className="text-xs text-[#72706b]">
            Podés eliminar una conversación desde su página: se borran también la evidencia y las inferencias que dependían de ella.
          </p>
        </Section>

        <Section title="Permisos">
          <form action={updatePrivacyAction} className="space-y-3">
            <Checkbox
              name="consent"
              defaultChecked={Boolean(profile.consentAnalysisAt)}
              label="Analizar mis conversaciones y entregas para generar evidencia y feedback"
              hint={
                profile.consentAnalysisAt
                  ? `Activo desde ${formatDate(profile.consentAnalysisAt)}. Si lo desactivás, lo ya generado se conserva pero no se analiza nada nuevo.`
                  : "Desactivado: tus experiencias se guardan pero no se analizan."
              }
            />
            <Checkbox
              name="shareContext"
              defaultChecked={profile.shareContextWithTeachers}
              label="Compartir mi contexto declarado con mis docentes"
            />
            <SubmitButton variant="secondary" size="sm">
              Guardar permisos
            </SubmitButton>
          </form>
        </Section>

        <Section title="Eliminar mi cuenta" description="Borra tu cuenta y todos tus datos: contexto, conversaciones, entregas, evidencia e inferencias. No se puede deshacer.">
          <DeleteAccountForm email={user.email} />
        </Section>
      </div>
    </>
  );
}
