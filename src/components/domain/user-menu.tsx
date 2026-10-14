"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { logoutAction } from "@/server/actions/auth";

interface UserMenuProps {
  userName: string;
  roleLabel: string;
  userLinks?: ReactNode;
}

export function UserMenu({ userName, roleLabel, userLinks }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={menuRef} className="relative">
      {/* Botón único con ícono de avatar/perfil */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-2 shadow-sm transition-all hover:border-line-strong hover:bg-surface-3 hover:text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95"
        aria-label="Abrir menú de usuario"
        aria-expanded={isOpen}
      >
        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </button>

      {/* Menú flotante (dropdown) con fondo 100% opaco y sólido */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-line p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          style={{ backgroundColor: "#101726", opacity: 1 }}
        >
          {/* Datos del usuario */}
          <div className="border-b border-line/60 px-3 py-2.5">
            <p className="truncate text-xs font-bold text-ink">{userName}</p>
            <p className="truncate text-[11px] text-muted">{roleLabel}</p>
          </div>

          {/* Enlaces de usuario si los hay (ej. Tu contexto) */}
          {userLinks && (
            <div
              className="border-b border-line/60 px-1 py-1.5 text-xs text-ink-2 [&_a]:flex [&_a]:items-center [&_a]:gap-2 [&_a]:rounded-lg [&_a]:px-2.5 [&_a]:py-1.5 [&_a]:transition-colors hover:[&_a]:bg-surface-2 hover:[&_a]:text-ink"
              onClick={() => setIsOpen(false)}
            >
              {userLinks}
            </div>
          )}

          {/* Opción de cerrar sesión */}
          <div className="pt-1">
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-950/20 hover:text-rose-300"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>Salir</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
