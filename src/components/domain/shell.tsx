import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/server/actions/auth";
import { aiMode } from "@/server/ai";

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
            : "IA no configurada: se guardan conversaciones y entregas, pero no se generan respuestas del tutor ni análisis. Configurá ANTHROPIC_API_KEY."}
        </div>
      )}
      <header className="topbar sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3.5">
          <Link href={home} className="brand flex items-center gap-2 group">
            <span className="brand-wordmark">
              <span className="brand-wordmark-base">educ</span>
              <span className="brand-wordmark-ai">ai</span>
            </span>
          </Link>
          {nav && <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">{nav}</nav>}
          <div className="ml-auto flex items-center gap-3 text-sm">
            {userLinks}
            <span className="hidden text-muted sm:inline">
              <strong className="font-semibold text-ink">{userName}</strong> · <small className="text-muted">{roleLabel}</small>
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-line px-3 py-1 text-xs font-medium text-muted hover:border-line-strong hover:bg-surface-2 hover:text-ink transition-colors"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main-content" className="app-main mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
