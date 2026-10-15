"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-lg px-2.5 py-1 text-xs whitespace-nowrap transition-all duration-150 font-medium",
        active
          ? "bg-white/[0.08] border border-white/[0.12] text-[#F7F8F8] shadow-sm"
          : "text-[#8A8F98] hover:text-[#F7F8F8] hover:bg-white/[0.04]",
      )}
    >
      {label}
    </Link>
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
          <NavLink href={`${base}/activities`} label="Actividades" active={section.startsWith("/activities")} />
          <NavLink
            href={`${base}/development`}
            label="Desarrollo"
            active={section.startsWith("/development") || section.startsWith("/inferences") || section.startsWith("/evidence")}
          />
        </>
      )}
    </>
  );
}

/** Navegación del docente dentro de una materia: priorización → evidencia → decisión. */
export function TeacherCourseNav({ courseId }: { courseId: string }) {
  const pathname = usePathname();
  const base = `/t/courses/${courseId}`;
  const section = pathname.slice(base.length);
  const items = [
    { href: base, label: "Curso", active: section === "" || section.startsWith("/metrics") },
    { href: `${base}/attention`, label: "Atención", active: ["/attention", "/insights", "/inferences", "/evidence"].some((s) => section.startsWith(s)) },
    { href: `${base}/students`, label: "Estudiantes", active: section.startsWith("/students") || section.startsWith("/submissions") },
    { href: `${base}/activities`, label: "Actividades", active: section.startsWith("/activities") },
    { href: `${base}/curriculum`, label: "Currícula", active: section.startsWith("/curriculum") },
  ];
  return (
    <>
      {items.map((item) => (
        <NavLink key={item.href} {...item} />
      ))}
    </>
  );
}
