"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <Button
        variant="secondary"
        size="icon-round"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Abrir menú de usuario"
        aria-expanded={isOpen}
      >
        <User className="size-4 text-ink-2" />
      </Button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-line bg-surface p-2 shadow-lg z-50 animate-in fade-in duration-150"
        >
          {/* Datos del usuario */}
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-xs font-bold text-ink">{userName}</p>
            <p className="truncate text-xs text-muted">{roleLabel}</p>
          </div>

          {/* Enlaces de usuario si los hay */}
          {userLinks && (
            <div className="border-b border-line px-1 py-1 text-xs text-ink-2 [&_a]:flex [&_a]:items-center [&_a]:gap-2 [&_a]:rounded-lg [&_a]:px-2.5 [&_a]:py-1.5 [&_a]:transition-colors hover:[&_a]:bg-surface-2 hover:[&_a]:text-ink">
              {userLinks}
            </div>
          )}

          {/* Opción de cerrar sesión */}
          <div className="pt-1">
            <form action={logoutAction}>
              <Button
                variant="danger"
                size="sm"
                type="submit"
                className="w-full justify-start text-xs"
              >
                <LogOut className="size-3.5 mr-1" />
                <span>Salir</span>
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
