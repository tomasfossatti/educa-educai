"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { UserMenu } from "@/components/domain/user-menu";
import { Sidebar } from "@/components/domain/sidebar";
import { OPEN_SIDEBAR_EVENT } from "@/lib/sidebar";

interface ShellHeaderProps {
  home: string;
  userName: string;
  roleLabel: string;
  nav?: ReactNode;
  userLinks?: ReactNode;
}

export function ShellHeader({ home, userName, roleLabel, nav, userLinks }: ShellHeaderProps) {
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
      <header className="topbar sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur-md shrink-0">
        <div className="relative w-full">
          {/* ──────────────── 1) ESQUINA IZQUIERDA: EDUCAI + SÍMBOLO MENÚ LATERAL (FUERA DE LA ESTRUCTURA CENTRAL) ──────────────── */}
          <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 flex items-center gap-2.5 z-20">
            <Link href={home} className="brand flex items-center gap-2 group">
              <span className="brand-wordmark">
                <span className="brand-wordmark-base">educ</span>
                <span className="brand-wordmark-ai">ai</span>
              </span>
            </Link>

            {/* Símbolo para desplegar el menú lateral */}
            <button
              type="button"
              onClick={handleOpenSidebar}
              className="flex items-center justify-center p-1.5 rounded-lg text-muted hover:text-white hover:bg-surface-2 border border-line/60 hover:border-line-strong transition-all active:scale-95 shadow-sm cursor-pointer"
              title="Abrir menú lateral"
              aria-label="Abrir menú lateral"
            >
              <svg className="w-4.5 h-4.5 text-ink-2 hover:text-white transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect width="18" height="18" x="3" y="3" rx="2" strokeWidth={1.8} />
                <path strokeLinecap="round" strokeWidth={1.8} d="M9 3v18" />
              </svg>
            </button>
          </div>

          {/* ──────────────── 2) ESTRUCTURA CENTRAL: INICIO MATERIA ACTIVIDADES DESARROLLO (ALINEADO CON EL MAIN: max-w-5xl px-4) ──────────────── */}
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-x-6 px-4 py-2.5">
            <div className="flex items-center pl-28 xl:pl-0">
              {nav && (
                <nav className="flex items-center gap-1 overflow-x-auto -ml-2.5">
                  {nav}
                </nav>
              )}
            </div>

            <div className="flex items-center">
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
      />
    </>
  );
}
