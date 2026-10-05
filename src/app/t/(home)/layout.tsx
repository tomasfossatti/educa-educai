import { AppShell } from "@/components/domain/shell";
import { requireTeacher } from "@/server/auth/guards";

export default async function TeacherHomeLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireTeacher();
  return (
    <AppShell home="/t" userName={user.name} roleLabel={`Docente · ${profile.institution.name}`}>
      {children}
    </AppShell>
  );
}
