"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import {
  X,
  AlertCircle,
  Users,
  BookOpen,
  FileText,
  Presentation,
  LogOut,
  Sparkles,
  Home,
  ClipboardList,
  TrendingUp,
  IdCard,
  FolderOpen,
  UserRound,
  KeyRound,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TEXT } from "@/lib/texts";
import { logoutAction } from "@/server/actions/auth";
import type { SidebarCourse, SidebarFolder } from "@/lib/sidebar";

const SECTION_LABEL = "text-xs font-mono font-medium text-muted px-2";

/** Enlace de la barra lateral con ícono, resaltado si es la página actual. */
function SideLink({ href, active, icon, children }: { href: string; active: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <ButtonLink
      href={href}
      variant={active ? "secondary" : "ghost"}
      size="sm"
      aria-current={active ? "page" : undefined}
      className="w-full justify-start gap-3"
    >
      {icon}
      <span className="truncate">{children}</span>
    </ButtonLink>
  );
}

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
  folders?: SidebarFolder[];
  courses?: SidebarCourse[];
}


export function Sidebar({
  isOpen,
  onClose,
  home,
  userName,
  roleLabel,
  courseId: propCourseId,
  courseTitle,
  currentClassNumber,
  totalClasses,
  folders = [],
  courses = [],
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

  // Cierra el menú al cambiar de página. La página se recuerda siempre, también con el menú
  // cerrado: si no, al abrirlo después de navegar por otro lado se cerraba solo.
  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    if (isOpen) onClose();
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
      aria-label={TEXT.sidebar.label}
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
            aria-label={TEXT.sidebar.close}
          >
            <X className="size-4 text-muted" />
          </Button>
        </div>

        {/* Contenido con navegación */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {!isTeacher && (
            <StudentLinks
              pathname={pathname}
              courseId={studentCourseId}
              // El título sigue a la materia de la URL; si no hay, a la elegida en el inicio.
              courseTitle={courses.find((c) => c.id === studentCourseId)?.name ?? courseTitle}
              currentClassNumber={currentClassNumber}
              totalClasses={totalClasses}
              folders={folders}
              onClose={onClose}
            />
          )}

          {/* Herramientas de gestión docente */}
          {isTeacher && teacherCourseId && (
            <div className="space-y-1">
              <span className={SECTION_LABEL}>Gestión docente</span>
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

              <ButtonLink
                href={`/t/courses/${teacherCourseId}/material`}
                variant={pathname.startsWith(`/t/courses/${teacherCourseId}/material`) ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start gap-3"
              >
                <FileText className="size-4 text-primary shrink-0" />
                <span>{TEXT.material.nav}</span>
              </ButtonLink>

              <ButtonLink
                href={`/t/courses/${teacherCourseId}/clases`}
                variant={pathname.startsWith(`/t/courses/${teacherCourseId}/clases`) ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start gap-3"
              >
                <Presentation className="size-4 text-primary shrink-0" />
                <span>{TEXT.classes.nav}</span>
              </ButtonLink>
            </div>
          )}

          {isTeacher && (
            <div className="space-y-1">
              <SideLink href="/t/asistente" active={pathname === "/t/asistente"} icon={<Sparkles className="size-4 text-primary shrink-0" />}>
                {TEXT.lms.navLabel}
              </SideLink>
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
                <span>{TEXT.sidebar.logout}</span>
              </Button>
            </form>
          </div>
        </div>
      </aside>
    </dialog>
  );
}

/** Navegación del estudiante: sección de la materia, sus carpetas y herramientas. */
function StudentLinks({
  pathname,
  courseId,
  courseTitle,
  currentClassNumber,
  totalClasses,
  folders,
  onClose,
}: {
  pathname: string;
  courseId?: string;
  courseTitle?: string;
  currentClassNumber?: number;
  totalClasses?: number;
  folders: SidebarFolder[];
  onClose: () => void;
}) {
  const t = TEXT.sidebar;
  const base = courseId ? `/s/courses/${courseId}` : null;
  const section = base && pathname.startsWith(base) ? pathname.slice(base.length) : null;
  const icon = (Icon: typeof Home) => <Icon className="size-4 text-primary shrink-0" />;

  return (
    <>
      <div className="space-y-1">
        <SideLink href="/s" active={pathname === "/s"} icon={icon(Home)}>
          {t.home}
        </SideLink>
        <SideLink href="/s/asistente" active={pathname === "/s/asistente"} icon={icon(Sparkles)}>
          {TEXT.lms.navLabel}
        </SideLink>
      </div>

      {base ? (
        <div className="space-y-1">
          {courseTitle && (
            <Link href={base} onClick={onClose} className="group block px-2 pb-1">
              <h3 className="text-sm font-bold text-ink tracking-tight group-hover:text-primary transition-colors leading-snug">
                {courseTitle}
              </h3>
              {currentClassNumber && totalClasses ? (
                <p className="text-xs text-muted mt-0.5 font-medium">
                  Clase {currentClassNumber} de {totalClasses}
                </p>
              ) : null}
            </Link>
          )}
          <SideLink href={base} active={section === "" || Boolean(section?.startsWith("/tutor"))} icon={icon(BookOpen)}>
            {t.course}
          </SideLink>
          <SideLink href={`${base}/activities`} active={Boolean(section?.startsWith("/activities"))} icon={icon(ClipboardList)}>
            {t.activities}
          </SideLink>
          <SideLink href={`${base}/development`} active={Boolean(section?.startsWith("/development"))} icon={icon(TrendingUp)}>
            {t.development}
          </SideLink>
          <SideLink href={`${base}/ficha`} active={Boolean(section?.startsWith("/ficha"))} icon={icon(IdCard)}>
            {TEXT.file.myTitle}
          </SideLink>
        </div>
      ) : null}

      <div className="space-y-1">
        <SideLink href="/s/join" active={pathname === "/s/join"} icon={icon(KeyRound)}>
          {base ? t.joinAnother : t.join}
        </SideLink>
      </div>

      <div className="space-y-1">
        <span className={SECTION_LABEL}>{t.folders}</span>
        {folders.length === 0 ? (
          <p className="px-2 text-xs text-muted">{t.noFolders}</p>
        ) : (
          folders.map((f) => (
            <SideLink
              key={f.id}
              href={`/s/folders/${f.id}`}
              active={pathname.startsWith(`/s/folders/${f.id}`)}
              icon={icon(FolderOpen)}
            >
              {f.name}
            </SideLink>
          ))
        )}
      </div>

      <div className="space-y-1">
        <SideLink href="/s/context" active={pathname.startsWith("/s/context")} icon={icon(UserRound)}>
          {t.context}
        </SideLink>
      </div>
    </>
  );
}
