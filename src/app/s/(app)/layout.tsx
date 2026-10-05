import Link from "next/link";
import { AppShell } from "@/components/domain/shell";
import { StudentNav } from "@/components/domain/nav";
import { requireStudent } from "@/server/auth/guards";
import { EVENT, todayKey, track } from "@/server/events";
import { getCurrentCourseId } from "@/server/services/student-home";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireStudent();
  const courseId = await getCurrentCourseId(user.id);
  // Recurrencia: un evento por estudiante y día.
  await track(EVENT.studentActiveDay, { userId: user.id, studentId: user.id, courseId, dedupeKey: `active:${user.id}:${todayKey()}` });
  return (
    <AppShell
      home="/s"
      userName={user.name}
      roleLabel="Estudiante"
      nav={<StudentNav defaultCourseId={courseId} />}
      userLinks={
        <Link href="/s/context" className="text-ink-2 hover:text-ink">
          Tu contexto
        </Link>
      }
    >
      {children}
    </AppShell>
  );
}
