"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { logoutAction } from "@/server/actions/auth";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  home: string;
  userName: string;
  roleLabel: string;
  courseId?: string;
  courseTitle?: string;
  currentClassNumber?: number;
  totalClasses?: number;
}

const AI_RESOURCES = [
  {
    name: "Get It.",
    href: "/s/get-it",
    badge: "Read · See · Get",
    description: "Mapa de dominio 4 ejes, Feynman y sandbox visual",
  },
  {
    name: "PageLM",
    href: "/s/pagelm",
    badge: "Studio",
    description: "NotebookLM, quizzes, flashcards y podcast",
  },
  {
    name: "DeepStudent",
    href: "/s/deep-student",
    badge: "Workbench",
    description: "Agente de estudio autónomo paso a paso",
  },
];

export function Sidebar({
  isOpen,
  onClose,
  home,
  userName,
  roleLabel,
  courseId: propCourseId,
  courseTitle = "Estrategia y Validación de Negocios",
  currentClassNumber = 4,
  totalClasses = 8,
}: SidebarProps) {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  // Cerrar con tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Cerrar únicamente cuando la ruta cambie de verdad
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  const studentMatch = pathname.match(/^\/s\/courses\/([^/]+)/);
  const teacherMatch = pathname.match(/^\/t\/courses\/([^/]+)/);
  const studentCourseId = studentMatch?.[1] || propCourseId;
  const teacherCourseId = teacherMatch?.[1] || propCourseId;

  const isTeacher = home === "/t" || pathname.startsWith("/t");

  return (
    <>
      {/* Backdrop con blur */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer lateral */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 sm:w-80 flex flex-col border-r border-line shadow-2xl transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none",
        )}
        style={{ backgroundColor: "#0A0B0D" }}
        role="dialog"
        aria-modal="true"
        aria-label="Menú lateral"
      >
        {/* Cabecera del sidebar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <Link href={home} onClick={onClose} className="brand flex items-center gap-2 group">
            <span className="brand-wordmark text-lg">
              <span className="brand-wordmark-base">educ</span>
              <span className="brand-wordmark-ai">ai</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center p-1.5 rounded-lg text-[#8A8F98] hover:text-[#F7F8F8] hover:bg-white/[0.06] transition-colors"
            aria-label="Cerrar menú"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido con navegación */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* ──────────────── 1) CURSADA: TÍTULO Y CLASE (TEXTO FLOTANDO, SIN BOTÓN NI BORDE) ──────────────── */}
          {!isTeacher && (
            <div className="space-y-1 px-2 pt-1 pb-1">
              <Link
                href={studentCourseId ? `/s/courses/${studentCourseId}` : "/s"}
                onClick={onClose}
                className="group block"
              >
                <h3 className="text-base font-bold text-[#F7F8F8] tracking-tight group-hover:text-purple-300 transition-colors leading-snug">
                  {courseTitle}
                </h3>
                <p className="text-xs text-[#8A8F98] mt-1 font-medium">
                  Clase {currentClassNumber} de {totalClasses}
                </p>
              </Link>
            </div>
          )}

          {/* ──────────────── 2) PROYECTOS & HERRAMIENTAS ──────────────── */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8A8F98] px-2">
              Proyectos & Herramientas
            </span>
            <div className="space-y-1.5">
              {AI_RESOURCES.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "group flex items-center justify-between rounded-xl border p-3 transition-all duration-150 shadow-sm",
                    pathname === item.href
                      ? "border-primary bg-primary/15 text-white font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                      : "border-white/[0.08] bg-[#0F1011] hover:bg-[#141517] hover:border-white/[0.18]",
                  )}
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-[#F7F8F8] group-hover:text-primary transition-colors flex items-center gap-1.5 truncate">
                      <span className="truncate">{item.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[#8A8F98] group-hover:text-[#D0D6E0] shrink-0">
                        {item.badge}
                      </span>
                    </p>
                    <p className="text-[11px] text-[#8A8F98] truncate">
                      {item.description}
                    </p>
                  </div>
                  <svg
                    className="w-4 h-4 text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* Si es docente en un curso, mantener herramientas de gestión */}
          {isTeacher && teacherCourseId && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted px-2">Gestión docente</span>
              <Link
                href={`/t/courses/${teacherCourseId}/attention`}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                  pathname.startsWith(`/t/courses/${teacherCourseId}/attention`)
                    ? "bg-primary/15 text-white font-semibold border border-primary/30"
                    : "text-ink-2 hover:bg-surface-2 hover:text-white",
                )}
              >
                <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span>Atención prioritaria</span>
              </Link>

              <Link
                href={`/t/courses/${teacherCourseId}/students`}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                  pathname.startsWith(`/t/courses/${teacherCourseId}/students`)
                    ? "bg-primary/15 text-white font-semibold border border-primary/30"
                    : "text-ink-2 hover:bg-surface-2 hover:text-white",
                )}
              >
                <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Estudiantes</span>
              </Link>

              <Link
                href={`/t/courses/${teacherCourseId}/curriculum`}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                  pathname.startsWith(`/t/courses/${teacherCourseId}/curriculum`)
                    ? "bg-primary/15 text-white font-semibold border border-primary/30"
                    : "text-ink-2 hover:bg-surface-2 hover:text-white",
                )}
              >
                <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>Currícula</span>
              </Link>
            </div>
          )}
        </div>

        {/* Footer del sidebar con usuario y salida */}
        <div className="border-t border-white/[0.08] p-4 space-y-3 bg-[#0A0B0D]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs border border-primary/30">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{userName}</p>
              <p className="truncate text-[11px] text-muted">{roleLabel}</p>
            </div>
          </div>

          <div className="pt-1 space-y-2">
            <ThemeToggle showLabel className="w-full justify-center" />
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-950/20 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 transition-colors"
              >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span>Salir</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
