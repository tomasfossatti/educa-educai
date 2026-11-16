import Link from "next/link";
import { cookies } from "next/headers";
import { AppShell } from "@/components/domain/shell";
import { StudentNav } from "@/components/domain/nav";
import { requireStudent } from "@/server/auth/guards";
import { EVENT, todayKey, track } from "@/server/events";
import { listStudentFolderLinks } from "@/server/services/folders";
import { getCurrentCourseId, getStudentCourses } from "@/server/services/student-home";
import { CURRENT_COURSE_COOKIE } from "@/lib/constants";
import { TEXT } from "@/lib/texts";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireStudent();
  const [enrollments, folders] = await Promise.all([getStudentCourses(user.id), listStudentFolderLinks(user.id)]);
  const preferred = (await cookies()).get(CURRENT_COURSE_COOKIE)?.value;
  const currentEnrollment = enrollments.find((e) => e.courseId === preferred) ?? enrollments[0];
  const courseId = currentEnrollment?.courseId ?? (await getCurrentCourseId(user.id));
  const courseTitle = currentEnrollment?.course?.name;

  // Recurrencia: un evento por estudiante y día.
  await track(EVENT.studentActiveDay, { userId: user.id, studentId: user.id, courseId, dedupeKey: `active:${user.id}:${todayKey()}` });
  return (
    <AppShell
      home="/s"
      userName={user.name}
      roleLabel="Estudiante"
      courseId={courseId ?? undefined}
      courseTitle={courseTitle}
      folders={folders}
      courses={enrollments.map((e) => ({ id: e.courseId, name: e.course.name }))}
      nav={<StudentNav defaultCourseId={courseId} />}
      userLinks={
        <Link href="/s/context" className="text-ink-2 hover:text-ink">
          {TEXT.sidebar.context}
        </Link>
      }
    >
      {children}
    </AppShell>
  );
}
