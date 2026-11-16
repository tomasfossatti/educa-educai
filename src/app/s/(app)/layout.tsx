import Link from "next/link";
import { StudentShell } from "@/components/student/student-shell";
import { TEXT } from "@/lib/texts";
import { requireStudent } from "@/server/auth/guards";
import { EVENT, todayKey, track } from "@/server/events";
import { getCurrentCourseId } from "@/server/services/student-home";

const MY_DATA_HREF = "/s/mis-datos";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireStudent();
  const courseId = await getCurrentCourseId(user.id);
  const t = TEXT.student;

  // Recurrencia: un evento por estudiante y día.
  await track(EVENT.studentActiveDay, { userId: user.id, studentId: user.id, courseId, dedupeKey: `active:${user.id}:${todayKey()}` });
  return (
    <StudentShell
      userName={user.name}
      myDataHref={MY_DATA_HREF}
      menuLinks={
        <Link href={MY_DATA_HREF}>{t.nav.myData}</Link>
      }
    >
      {children}
    </StudentShell>
  );
}
