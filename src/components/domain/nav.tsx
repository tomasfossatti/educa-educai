"use client";

import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { TEXT } from "@/lib/texts";

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
      <NavLink href={`${base}/material`} label={TEXT.material.nav} active={section.startsWith("/material")} />
      <NavLink href={`${base}/clases`} label={TEXT.classes.nav} active={section.startsWith("/clases")} />
    </>
  );
}

export const TeacherCourseNav = TeacherNav;
