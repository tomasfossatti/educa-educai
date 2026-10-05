import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/server/actions/auth";
import { aiMode } from "@/server/ai";

/** Marco común: barra superior mínima + contenido centrado. */
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
        <div className="border-b border-attention/30 bg-attention-soft px-4 py-1.5 text-center text-xs text-attention" role="status">
          {mode === "scripted"
            ? "Modo de prueba: la IA está simulada (AI_PROVIDER=scripted). Las salidas son deterministas y no interpretan realmente."
            : "IA no configurada: se guardan conversaciones y entregas, pero no se generan respuestas del tutor ni análisis. Configurá ANTHROPIC_API_KEY."}
        </div>
      )}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href={home} className="text-sm font-semibold tracking-tight text-ink">
            Educai
          </Link>
          {nav && <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">{nav}</nav>}
          <div className="ml-auto flex items-center gap-3 text-sm">
            {userLinks}
            <span className="hidden text-muted sm:inline">
              {userName} · {roleLabel}
            </span>
            <form action={logoutAction}>
              <button type="submit" className="text-muted hover:text-ink">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
