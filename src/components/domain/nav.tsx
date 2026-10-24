"use client";

import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <ButtonLink
      href={href}
      variant={active ? "secondary" : "ghost"}
      size="nav"
      aria-current={active ? "page" : undefined}
      className={active ? "font-semibold text-ink" : undefined}
    >
      {label}
    </ButtonLink>
  );
}

/** Navegación del estudiante: Inicio, Materia, Actividades, Desarrollo. */
export function StudentNav({ defaultCourseId }: { defaultCourseId: string | null }) {
  const pathname = usePathname();
  const match = pathname.match(/^\/s\/courses\/([^/]+)/);
  const courseId = match?.[1] ?? defaultCourseId;
  const base = courseId ? `/s/courses/${courseId}` : null;
  const section = match ? pathname.slice(match[0].length) : "";
  return (
    <>
      <NavLink href="/s" label="Inicio" active={pathname === "/s"} />
      {base && (
        <>
          <NavLink
            href={base}
            label="Materia"
            active={Boolean(match) && (section === "" || section.startsWith("/tutor"))}
          />
          <NavLink
            href={`${base}/activities`}
            label="Actividades"
            active={Boolean(match) && section.startsWith("/activities")}
          />
          <NavLink
            href={`${base}/development`}
            label="Desarrollo"
            active={Boolean(match) && section.startsWith("/development")}
          />
        </>
      )}
    </>
  );
}

/** Navegación del docente: Materia, Atención, Estudiantes, Actividades, Currícula. */
export function TeacherNav({ courseId }: { courseId: string }) {
  const pathname = usePathname();
  const base = `/t/courses/${courseId}`;
  const section = pathname.slice(base.length);
  return (
    <>
      <NavLink href="/t" label="Mis materias" active={pathname === "/t"} />
      <NavLink href={base} label="Materia" active={pathname === base} />
      <NavLink href={`${base}/attention`} label="Atención" active={section.startsWith("/attention")} />
      <NavLink href={`${base}/students`} label="Estudiantes" active={section.startsWith("/students")} />
      <NavLink href={`${base}/activities`} label="Actividades" active={section.startsWith("/activities")} />
      <NavLink href={`${base}/curriculum`} label="Currícula" active={section.startsWith("/curriculum")} />
    </>
  );
}

export const TeacherCourseNav = TeacherNav;
