import Link from "next/link";
import type { ReactNode } from "react";
import { aiMode } from "@/server/ai";
import { UserMenu } from "@/components/domain/user-menu";

/** Marco común: barra superior Obsidian + contenido centrado con ambientación. */
export function AppShell({
  home,
  userName,
  roleLabel,
  nav,
  userLinks,
  children,
}: {
  home: string;
  userName: string;
  roleLabel: string;
  nav?: ReactNode;
  userLinks?: ReactNode;
  children: ReactNode;
}) {
  const mode = aiMode();
  return (
    <div className="min-h-screen">
      {mode !== "live" && (
        <div className="border-b border-warning/30 bg-surface-2 px-4 py-1.5 text-center text-xs text-warning" role="status">
          {mode === "scripted"
            ? "Modo de prueba: la IA está simulada (AI_PROVIDER=scripted). Las salidas son deterministas y no interpretan realmente."
            : "IA no configurada: se guardan conversaciones y entregas, pero no se generan respuestas del tutor ni análisis. Configurá GEMINI_API_KEY en Render."}
        </div>
      )}
      <header className="topbar sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href={home} className="brand flex items-center gap-2 group">
              <span className="brand-wordmark">
                <span className="brand-wordmark-base">educ</span>
                <span className="brand-wordmark-ai">ai</span>
              </span>
            </Link>
            {nav && <nav className="flex items-center gap-1 overflow-x-auto">{nav}</nav>}
          </div>
          <div className="flex items-center">
            <UserMenu userName={userName} roleLabel={roleLabel} userLinks={userLinks} />
          </div>
        </div>
      </header>
      <main id="main-content" className="app-main mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
