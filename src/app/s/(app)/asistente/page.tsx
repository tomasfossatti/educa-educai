import type { Metadata } from "next";
import { LmsPanel } from "@/components/lms/lms-panel";
import { PageHeader } from "@/components/ui/layout";
import { TEXT } from "@/lib/texts";
import { requireStudent } from "@/server/auth/guards";
import { getLmsConnection } from "@/server/services/lms";

export const metadata: Metadata = { title: TEXT.lms.title };
// La importación corre después de responder (after) y puede tardar: 16 lecturas, más de un minuto.
export const maxDuration = 300;

export default async function StudentAssistantPage() {
  const { user } = await requireStudent();
  const connection = await getLmsConnection({ id: user.id, role: user.role });
  return (
    <div className="shell max-w-3xl space-y-6">
      <PageHeader title={TEXT.lms.title} description={TEXT.lms.studentDescription} />
      <LmsPanel connection={connection} welcome={TEXT.lms.chat.welcomeStudent} />
    </div>
  );
}
