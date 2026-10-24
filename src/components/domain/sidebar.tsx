"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  X,
  ChevronRight,
  AlertCircle,
  Users,
  BookOpen,
  LogOut,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/cn";
import { logoutAction } from "@/server/actions/auth";

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
    name: "Deep Student",
    description: "Laboratorio de agentes y prompts para estudiantes",
    badge: "Agentes",
    href: "/s/deep-student",
  },
  {
    name: "PageLM Studio",
    description: "Generador de interfaces educativas con IA",
    badge: "UI",
    href: "/s/pagelm",
  },
  {
    name: "Get It",
    description: "Espacio de resolución guiada paso a paso",
    badge: "Tutor",
    href: "/s/get-it",
  },
];

export function Sidebar({
  isOpen,
  onClose,
  home,
  userName,
  roleLabel,
  courseId: propCourseId,
  courseTitle = "Materia activa",
  currentClassNumber = 1,
  totalClasses = 12,
}: SidebarProps) {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (prevPathname.current !== pathname && isOpen) {
      prevPathname.current = pathname;
      onClose();
    }
  }, [pathname, onClose, isOpen]);

  const studentMatch = pathname.match(/^\/s\/courses\/([^/]+)/);
  const teacherMatch = pathname.match(/^\/t\/courses\/([^/]+)/);
  const studentCourseId = studentMatch?.[1] || propCourseId;
  const teacherCourseId = teacherMatch?.[1] || propCourseId;

  const isTeacher = home === "/t" || pathname.startsWith("/t");

  if (!isOpen) return null;

  return (
    <dialog
      open
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 m-0 h-full w-full max-h-none max-w-none bg-black/60 p-0 backdrop-blur-xs block"
      aria-label="Menú lateral"
    >
      {/* Drawer lateral */}
      <aside
        className="h-full w-72 sm:w-80 flex flex-col border-r border-line bg-surface shadow-2xl animate-in slide-in-from-left duration-200"
        role="document"
      >
        {/* Cabecera del sidebar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <Link href={home} onClick={onClose} className="brand flex items-center gap-2 group">
            <span className="brand-wordmark text-lg">
              <span className="brand-wordmark-base">educ</span>
              <span className="brand-wordmark-ai">ai</span>
            </span>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <X className="size-4 text-muted" />
          </Button>
        </div>

        {/* Contenido con navegación */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Cursada actual */}
          {!isTeacher && (
            <div className="space-y-1 px-2 pt-1 pb-1">
              <Link
                href={studentCourseId ? `/s/courses/${studentCourseId}` : "/s"}
                onClick={onClose}
                className="group block"
              >
                <h3 className="text-sm font-bold text-ink tracking-tight group-hover:text-primary transition-colors leading-snug">
                  {courseTitle}
                </h3>
                <p className="text-xs text-muted mt-0.5 font-medium">
                  Clase {currentClassNumber} de {totalClasses}
                </p>
              </Link>
            </div>
          )}

          {/* Proyectos y herramientas (sentence case) */}
          <div className="space-y-2">
            <span className="text-xs font-mono font-medium text-muted px-2">
              Proyectos y herramientas
            </span>
            <div className="space-y-1.5">
              {AI_RESOURCES.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "group flex items-center justify-between rounded-xl border p-3 transition-colors duration-150 shadow-xs",
                    pathname === item.href
                      ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                      : "border-line bg-surface-2/50 hover:bg-surface-2 hover:border-line-strong"
                  )}
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs font-semibold text-ink group-hover:text-primary transition-colors flex items-center gap-1.5 truncate">
                      <span className="truncate">{item.name}</span>
                      <Badge tone="neutral" className="shrink-0">{item.badge}</Badge>
                    </p>
                    <p className="text-xs text-muted truncate">
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted group-hover:text-primary transition-colors shrink-0 ml-2" />
                </Link>
              ))}
            </div>
          </div>

          {/* Herramientas de gestión docente */}
          {isTeacher && teacherCourseId && (
            <div className="space-y-1">
              <span className="text-xs font-mono font-medium text-muted px-2">Gestión docente</span>
              <ButtonLink
                href={`/t/courses/${teacherCourseId}/attention`}
                variant={pathname.startsWith(`/t/courses/${teacherCourseId}/attention`) ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start gap-3"
              >
                <AlertCircle className="size-4 text-primary shrink-0" />
                <span>Atención prioritaria</span>
              </ButtonLink>

              <ButtonLink
                href={`/t/courses/${teacherCourseId}/students`}
                variant={pathname.startsWith(`/t/courses/${teacherCourseId}/students`) ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start gap-3"
              >
                <Users className="size-4 text-primary shrink-0" />
                <span>Estudiantes</span>
              </ButtonLink>

              <ButtonLink
                href={`/t/courses/${teacherCourseId}/curriculum`}
                variant={pathname.startsWith(`/t/courses/${teacherCourseId}/curriculum`) ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start gap-3"
              >
                <BookOpen className="size-4 text-primary shrink-0" />
                <span>Currícula</span>
              </ButtonLink>
            </div>
          )}
        </div>

        {/* Footer del sidebar */}
        <div className="border-t border-line p-4 space-y-3 bg-surface">
          <div className="flex items-center gap-3">
            <Avatar name={userName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-ink">{userName}</p>
              <p className="truncate text-xs text-muted">{roleLabel}</p>
            </div>
          </div>

          <div className="pt-1 space-y-2">
            <ThemeToggle showLabel className="w-full justify-center" />
            <form action={logoutAction}>
              <Button
                variant="danger"
                size="sm"
                type="submit"
                className="w-full"
              >
                <LogOut className="size-3.5 mr-1" />
                <span>Salir</span>
              </Button>
            </form>
          </div>
        </div>
      </aside>
    </dialog>
  );
}
