"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
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
          "flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted opacity-70",
          className
        )}
      >
        <span className="size-4" />
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
        "group flex h-9 items-center justify-center rounded-lg border border-line bg-surface hover:bg-surface-2 text-muted hover:text-ink transition-colors duration-150 active:scale-95 shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        showLabel ? "w-full gap-2 px-3 justify-start" : "w-9",
        className
      )}
    >
      {isDark ? (
        <Sun className="size-4 text-attention transition-transform group-hover:rotate-45" />
      ) : (
        <Moon className="size-4 text-muted group-hover:text-primary transition-transform group-hover:-rotate-12" />
      )}
      {showLabel && (
        <span className="text-xs font-medium text-ink-2 group-hover:text-ink">
          {isDark ? "Modo claro" : "Modo oscuro"}
        </span>
      )}
    </button>
  );
}
