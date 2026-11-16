import type { Metadata } from "next";
import { LmsPanel } from "@/components/lms/lms-panel";
import { PageHeader } from "@/components/ui/layout";
import { TEXT } from "@/lib/texts";
import { requireTeacher } from "@/server/auth/guards";
import { getLmsConnection } from "@/server/services/lms";
import { getExtensionStatus } from "@/server/services/lms-extension";

export const metadata: Metadata = { title: TEXT.lms.title };
// La importación corre después de responder (after) y puede tardar: 16 lecturas, más de un minuto.
export const maxDuration = 300;

export default async function TeacherAssistantPage() {
  const { user } = await requireTeacher();
  const viewer = { id: user.id, role: user.role };
  const [connection, extension] = await Promise.all([getLmsConnection(viewer), getExtensionStatus(viewer)]);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={TEXT.lms.title} description={TEXT.lms.teacherDescription} />
      <LmsPanel connection={connection} extension={extension} welcome={TEXT.lms.chat.welcomeTeacher} />
    </div>
  );
}
