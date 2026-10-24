"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/domain/user-menu";
import { Sidebar } from "@/components/domain/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { OPEN_SIDEBAR_EVENT } from "@/lib/sidebar";

interface ShellHeaderProps {
  home: string;
  userName: string;
  roleLabel: string;
  courseId?: string;
  courseTitle?: string;
  currentClassNumber?: number;
  totalClasses?: number;
  nav?: ReactNode;
  userLinks?: ReactNode;
}

export function ShellHeader({
  home,
  userName,
  roleLabel,
  courseId,
  courseTitle,
  currentClassNumber,
  totalClasses,
  nav,
  userLinks,
}: ShellHeaderProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleOpenSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("educai:close-sidebar"));
    }
  }, []);

  useEffect(() => {
    function handleGlobalOpen() {
      setIsSidebarOpen(true);
    }
    window.addEventListener(OPEN_SIDEBAR_EVENT, handleGlobalOpen);
    return () => {
      window.removeEventListener(OPEN_SIDEBAR_EVENT, handleGlobalOpen);
    };
  }, []);

  return (
    <>
      <header className="topbar sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur-md shrink-0">
        <div className="relative w-full">
          {/* Esquina izquierda: Marca y botón de menú */}
          <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 flex items-center gap-2.5 z-20">
            <Link href={home} className="brand flex items-center gap-2 group">
              <span className="brand-wordmark">
                <span className="brand-wordmark-base">educ</span>
                <span className="brand-wordmark-ai">ai</span>
              </span>
            </Link>

            <Button
              variant="secondary"
              size="icon"
              onClick={handleOpenSidebar}
              title="Abrir menú lateral"
              aria-label="Abrir menú lateral"
            >
              <PanelLeft className="size-4 text-ink-2" />
            </Button>
          </div>

          {/* Navegación central alineada */}
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-x-6 px-4 py-2.5">
            <div className="flex items-center pl-28 xl:pl-0">
              {nav && (
                <nav className="flex items-center gap-1 overflow-x-auto -ml-2.5">
                  {nav}
                </nav>
              )}
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserMenu userName={userName} roleLabel={roleLabel} userLinks={userLinks} />
            </div>
          </div>
        </div>
      </header>

      {/* Menú lateral */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        home={home}
        userName={userName}
        roleLabel={roleLabel}
        courseId={courseId}
        courseTitle={courseTitle}
        currentClassNumber={currentClassNumber}
        totalClasses={totalClasses}
      />
    </>
  );
}
