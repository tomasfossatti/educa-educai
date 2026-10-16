"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { UserMenu } from "@/components/domain/user-menu";
import { Sidebar } from "@/components/domain/sidebar";
import { OPEN_SIDEBAR_EVENT } from "@/lib/sidebar";
import { cn } from "@/lib/cn";

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

  const isStudent = home === "/s";

  return (
    <>
      <header className="topbar sticky top-0 z-40 border-b border-[#d1d1cd] bg-[#faf8f5] shrink-0">
        <div className="relative w-full">
          {/* ──────────────── 1) ESQUINA IZQUIERDA: EDUCAI + SÍMBOLO MENÚ LATERAL ──────────────── */}
          <div className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 flex items-center gap-2.5 z-20">
            <Link href={home} className="brand flex items-center gap-2 group">
              <span className="brand-wordmark">
                <span className="text-[#27251e] font-medium tracking-tight">educ</span>
                <span className="text-[#016a71] font-medium tracking-tight">ai</span>
              </span>
            </Link>

            {/* Símbolo para desplegar el menú lateral */}
            <button
              type="button"
              onClick={handleOpenSidebar}
              className="flex items-center justify-center p-1.5 rounded-md text-[#72706b] hover:text-[#27251e] hover:bg-[#fdfbfa] border border-[#d1d1cd] transition-colors active:scale-95 cursor-pointer"
              title="Abrir menú lateral"
              aria-label="Abrir menú lateral"
            >
              <svg className="w-4 h-4 text-[#72706b] hover:text-[#27251e] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect width="18" height="18" x="3" y="3" rx="3" strokeWidth={1.8} />
                <path strokeLinecap="round" strokeWidth={1.8} d="M9 3v18" />
              </svg>
            </button>
          </div>

          {/* ──────────────── 2) ESTRUCTURA CENTRAL ──────────────── */}
          <div className={cn("mx-auto flex items-center justify-between gap-x-6 px-4 py-2.5", isStudent ? "max-w-[900px]" : "max-w-5xl")}>
            <div className="flex items-center pl-28 xl:pl-0">
              {nav && (
                <nav className="flex items-center gap-1.5 overflow-x-auto -ml-2.5">
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
        courseId={courseId}
        courseTitle={courseTitle}
        currentClassNumber={currentClassNumber}
        totalClasses={totalClasses}
      />
    </>
  );
}
