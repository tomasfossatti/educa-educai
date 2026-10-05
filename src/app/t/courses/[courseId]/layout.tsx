import Link from "next/link";
import { TeacherCourseNav } from "@/components/domain/nav";
import { AppShell } from "@/components/domain/shell";
import { requireCourseTeacher } from "@/server/auth/guards";

export default async function CourseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { user, profile, course } = await requireCourseTeacher(courseId);
  return (
    <AppShell
      home="/t"
      userName={user.name}
      roleLabel={`Docente · ${profile.institution.name}`}
      nav={<TeacherCourseNav courseId={courseId} />}
    >
      <p className="-mt-4 mb-6 text-xs text-muted">
        <Link href="/t" className="hover:text-ink">
          Materias
        </Link>{" "}
        / <span className="text-ink-2">{course.name}</span> · código <span className="font-mono tracking-wider text-ink-2">{course.joinCode}</span>
      </p>
      {children}
    </AppShell>
  );
}
