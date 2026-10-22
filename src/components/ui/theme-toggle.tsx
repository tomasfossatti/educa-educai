"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export function ThemeToggle({ showLabel = false, className }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState<boolean>(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hasDarkClass = document.documentElement.classList.contains("dark");
    setIsDark(hasDarkClass);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);

    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("educai-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("educai-theme", "light");
    }
  };

  // Evitar hydration mismatch renderizando un placeholder estático con el mismo tamaño
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Alternar tema claro u oscuro"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors opacity-70",
          className
        )}
      >
        <span className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={cn(
        "group flex h-9 items-center justify-center rounded-lg border border-line bg-surface hover:bg-surface-2 text-muted hover:text-ink transition-all active:scale-95 shadow-sm cursor-pointer",
        showLabel ? "w-full gap-2 px-3 justify-start" : "w-9",
        className
      )}
    >
      {isDark ? (
        /* Ícono Sol (para pasar a Modo Claro) */
        <svg
          className="w-4 h-4 text-amber-300 transition-transform group-hover:rotate-45"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        /* Ícono Luna (para pasar a Modo Oscuro) */
        <svg
          className="w-4 h-4 text-primary transition-transform group-hover:-rotate-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}

      {showLabel && (
        <span className="text-xs font-medium text-ink">
          {isDark ? "Modo Claro" : "Modo Oscuro"}
        </span>
      )}
    </button>
  );
}
