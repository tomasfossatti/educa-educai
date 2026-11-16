import Link from "next/link";
import type { ReactNode } from "react";
import { AiModeBanner } from "@/components/domain/shell";
import { UserMenu } from "@/components/domain/user-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TEXT } from "@/lib/texts";
import { StudentNav } from "./student-nav";

/**
 * Marco del panel simple del estudiante. Solo tres destinos (Preguntar, Practicar, Mi avance) y
 * Mis datos: barra inferior en el celular, lateral en la computadora, y Mis datos arriba a la derecha.
 */
export function StudentShell({
  userName,
  myDataHref,
  menuLinks,
  children,
}: {
  userName: string;
  myDataHref: string;
  menuLinks: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <AiModeBanner />
      <header className="topbar sticky top-0 z-40 shrink-0 border-b border-line bg-canvas/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/s" className="brand flex min-h-11 items-center" aria-label="Educai">
            <span className="brand-wordmark">
              <span className="brand-wordmark-base">educ</span>
              <span className="brand-wordmark-ai">ai</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu userName={userName} roleLabel={TEXT.student.nav.role} userLinks={menuLinks} />
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4">
        <aside className="hidden w-52 shrink-0 py-6 md:block">
          <div className="sticky top-20">
            <StudentNav variant="side" myDataHref={myDataHref} />
          </div>
        </aside>
        <main id="main-content" className="app-main flex w-full min-w-0 flex-1 flex-col py-4 pb-28 sm:py-6 md:pb-8">
          {children}
        </main>
      </div>
      <StudentNav variant="bottom" myDataHref={myDataHref} />
    </div>
  );
}
