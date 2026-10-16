"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { logoutAction } from "@/server/actions/auth";
import { cn } from "@/lib/cn";

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
          "fixed inset-0 z-40 bg-[#27251e]/25 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer lateral */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 sm:w-80 flex flex-col border-r border-[#d1d1cd] bg-[#faf8f5] shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menú lateral"
      >
        {/* Cabecera del sidebar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#d1d1cd]">
          <Link href={home} onClick={onClose} className="brand flex items-center gap-2 group">
            <span className="brand-wordmark text-lg">
              <span className="text-[#27251e] font-medium tracking-tight">educ</span>
              <span className="text-[#016a71] font-medium tracking-tight">ai</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center p-1.5 rounded-md text-[#72706b] hover:text-[#27251e] hover:bg-[#fdfbfa] transition-colors"
            aria-label="Cerrar menú"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido con navegación */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* ──────────────── 1) CURSADA: TÍTULO Y CLASE ──────────────── */}
          {!isTeacher && (
            <div className="space-y-1 px-2 pt-1 pb-1">
              <Link
                href={studentCourseId ? `/s/courses/${studentCourseId}` : "/s"}
                onClick={onClose}
                className="group block"
              >
                <h3 className="text-base font-medium text-[#27251e] tracking-tight group-hover:text-[#016a71] transition-colors leading-snug">
                  {courseTitle}
                </h3>
                <p className="text-xs text-[#72706b] mt-1 font-normal">
                  Clase {currentClassNumber} de {totalClasses}
                </p>
              </Link>
            </div>
          )}

          {/* ──────────────── 2) PROYECTOS & HERRAMIENTAS ──────────────── */}
          <div className="space-y-2">
            <span className="text-[11px] uppercase tracking-wider text-[#92918b] px-2 font-medium">
              Proyectos & Herramientas
            </span>
            <div className="space-y-2">
              {AI_RESOURCES.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "group flex items-center justify-between rounded-2xl border p-3.5 transition-colors duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
                    pathname === item.href
                      ? "border-[#016a71] bg-[#f2f8f8] text-[#27251e]"
                      : "border-[#d1d1cd] bg-[#fdfbfa] hover:bg-[#fcf9f6]",
                  )}
                >
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-[#27251e] group-hover:text-[#016a71] transition-colors flex items-center gap-1.5 truncate">
                      <span className="truncate">{item.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#faf8f5] border border-[#d1d1cd] text-[#72706b] shrink-0 font-medium">
                        {item.badge}
                      </span>
                    </p>
                    <p className="text-[12px] text-[#72706b] truncate font-normal">
                      {item.description}
                    </p>
                  </div>
                  <svg
                    className="w-4 h-4 text-[#72706b] group-hover:text-[#27251e] group-hover:translate-x-0.5 transition-all shrink-0 ml-2"
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
              <span className="text-[10px] uppercase tracking-wider text-[#72706b] px-2 font-normal">Gestión docente</span>
              <Link
                href={`/t/courses/${teacherCourseId}/attention`}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-normal transition-colors",
                  pathname.startsWith(`/t/courses/${teacherCourseId}/attention`)
                    ? "bg-[#016a71] text-white"
                    : "text-[#27251e] hover:bg-[#fdfbfa]",
                )}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span>Atención prioritaria</span>
              </Link>

              <Link
                href={`/t/courses/${teacherCourseId}/students`}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-normal transition-colors",
                  pathname.startsWith(`/t/courses/${teacherCourseId}/students`)
                    ? "bg-[#016a71] text-white"
                    : "text-[#27251e] hover:bg-[#fdfbfa]",
                )}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Estudiantes</span>
              </Link>

              <Link
                href={`/t/courses/${teacherCourseId}/curriculum`}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-normal transition-colors",
                  pathname.startsWith(`/t/courses/${teacherCourseId}/curriculum`)
                    ? "bg-[#016a71] text-white"
                    : "text-[#27251e] hover:bg-[#fdfbfa]",
                )}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>Currícula</span>
              </Link>
            </div>
          )}
        </div>

        {/* Footer del sidebar con usuario y salida */}
        <div className="border-t border-[#d1d1cd] p-4 space-y-3 bg-[#fdfbfa]">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#faf8f5] text-[#27251e] font-medium text-xs border border-[#d1d1cd]">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[#27251e]">{userName}</p>
              <p className="truncate text-[11px] text-[#72706b] font-normal">{roleLabel}</p>
            </div>
          </div>

          <form action={logoutAction} className="pt-1">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#cf2d56]/20 bg-[#fdf2f4] px-3 py-2 text-xs font-normal text-[#cf2d56] hover:bg-[#fbdde3] transition-colors"
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
