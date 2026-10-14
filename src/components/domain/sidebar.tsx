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
}

const AI_RESOURCES = [
  {
    name: "DeepStudent (README_CN)",
    url: "https://github.com/helixnow/deep-student/blob/main/README_CN.md",
    badge: "Docs CN",
    repo: "helixnow/deep-student",
  },
  {
    name: "PageLM",
    url: "https://github.com/CaviraOSS/pagelm",
    badge: "CaviraOSS",
    repo: "CaviraOSS/pagelm",
  },
  {
    name: "DeepStudent",
    url: "https://github.com/helixnow/deep-student",
    badge: "GitHub",
    repo: "helixnow/deep-student",
  },
];

export function Sidebar({ isOpen, onClose, home, userName, roleLabel }: SidebarProps) {
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
  const studentCourseId = studentMatch?.[1];
  const teacherCourseId = teacherMatch?.[1];

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
        style={{ backgroundColor: "#0c1017" }}
        role="dialog"
        aria-modal="true"
        aria-label="Menú lateral"
      >
        {/* Cabecera del sidebar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line/60">
          <Link href={home} onClick={onClose} className="brand flex items-center gap-2 group">
            <span className="brand-wordmark text-lg">
              <span className="brand-wordmark-base">educ</span>
              <span className="brand-wordmark-ai">ai</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center p-1.5 rounded-lg text-muted hover:text-white hover:bg-surface-2 transition-colors"
            aria-label="Cerrar menú"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido con navegación */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* ──────────────── LOS 3 NOMBRES UNO ABAJO DEL OTRO ──────────────── */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary px-2">
              Proyectos & Herramientas
            </span>
            <div className="space-y-1.5">
              {AI_RESOURCES.map((item) => (
                <a
                  key={item.url}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-xl border border-line bg-surface-2/70 hover:bg-surface-3 p-3 transition-all hover:border-primary/50 shadow-sm"
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-white group-hover:text-primary transition-colors flex items-center gap-1.5 truncate">
                      <span className="truncate">{item.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 border border-line/60 text-muted group-hover:text-ink shrink-0">
                        {item.badge}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted truncate">
                      {item.repo}
                    </p>
                  </div>
                  <svg
                    className="w-4 h-4 text-muted group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0 ml-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Si está en un curso de estudiante */}
          {!isTeacher && studentCourseId && (
            <div className="space-y-2">
              <div className="rounded-xl border border-line bg-surface-2/60 p-3 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Cursada activa</span>
                <p className="text-xs font-bold text-white leading-snug">Estrategia y Validación de Negocios</p>
                <div className="flex items-center justify-between text-[11px] text-muted pt-1 border-t border-line/40">
                  <span>Clase 4 de 8</span>
                  <span className="font-semibold text-emerald-400">50% completado</span>
                </div>
              </div>

              <div className="pt-2 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted px-2">Materia en curso</span>
                <Link
                  href={`/s/courses/${studentCourseId}`}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                    pathname === `/s/courses/${studentCourseId}`
                      ? "bg-primary/15 text-white font-semibold border border-primary/30"
                      : "text-ink-2 hover:bg-surface-2 hover:text-white",
                  )}
                >
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>Clase de hoy</span>
                </Link>

                <Link
                  href={`/s/courses/${studentCourseId}/activities`}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                    pathname.startsWith(`/s/courses/${studentCourseId}/activities`)
                      ? "bg-primary/15 text-white font-semibold border border-primary/30"
                      : "text-ink-2 hover:bg-surface-2 hover:text-white",
                  )}
                >
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span>Actividades</span>
                </Link>

                <Link
                  href={`/s/courses/${studentCourseId}/development`}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                    pathname.startsWith(`/s/courses/${studentCourseId}/development`)
                      ? "bg-primary/15 text-white font-semibold border border-primary/30"
                      : "text-ink-2 hover:bg-surface-2 hover:text-white",
                  )}
                >
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span>Tu desarrollo</span>
                </Link>
              </div>
            </div>
          )}

          {/* Navegación general */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted px-2">Navegación</span>
            <Link
              href={home}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                pathname === home
                  ? "bg-primary/15 text-white font-semibold border border-primary/30"
                  : "text-ink-2 hover:bg-surface-2 hover:text-white",
              )}
            >
              <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Inicio</span>
            </Link>

            {!isTeacher && (
              <>
                <Link
                  href="/s/context"
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                    pathname === "/s/context"
                      ? "bg-primary/15 text-white font-semibold border border-primary/30"
                      : "text-ink-2 hover:bg-surface-2 hover:text-white",
                  )}
                >
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Tu contexto</span>
                </Link>

                <Link
                  href="/s/join"
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                    pathname === "/s/join"
                      ? "bg-primary/15 text-white font-semibold border border-primary/30"
                      : "text-ink-2 hover:bg-surface-2 hover:text-white",
                  )}
                >
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Unirme con código</span>
                </Link>
              </>
            )}

            {isTeacher && teacherCourseId && (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* Footer del sidebar con usuario y salida */}
        <div className="border-t border-line/60 p-4 space-y-3 bg-[#0a0d14]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs border border-primary/30">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{userName}</p>
              <p className="truncate text-[11px] text-muted">{roleLabel}</p>
            </div>
          </div>

          <form action={logoutAction} className="pt-1">
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
