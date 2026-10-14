import type { ReactNode } from "react";
import { aiMode } from "@/server/ai";
import { ShellHeader } from "@/components/domain/shell-header";

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
    <div className="min-h-screen flex flex-col">
      {mode !== "live" && (
        <div className="border-b border-warning/30 bg-surface-2 px-4 py-1 text-center text-xs text-warning shrink-0" role="status">
          {mode === "scripted"
            ? "Modo de prueba: la IA está simulada (AI_PROVIDER=scripted). Las salidas son deterministas y no interpretan realmente."
            : "IA no configurada: se guardan conversaciones y entregas, pero no se generan respuestas del tutor ni análisis. Configurá GEMINI_API_KEY en Render."}
        </div>
      )}
      <ShellHeader
        home={home}
        userName={userName}
        roleLabel={roleLabel}
        nav={nav}
        userLinks={userLinks}
      />
      <main id="main-content" className="app-main mx-auto max-w-5xl px-4 py-3 sm:py-4 flex-1 w-full flex flex-col justify-center">{children}</main>
    </div>
  );
}
