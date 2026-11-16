"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, MessageCircle, PencilLine, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { TEXT } from "@/lib/texts";

type Destination = "ask" | "practice" | "progress" | "myData";

/** A qué destino pertenece una dirección del panel del estudiante. */
export function destinationFor(pathname: string): Destination | null {
  if (pathname === "/s" || pathname.startsWith("/s/c/")) return "ask";
  if (pathname.startsWith("/s/practicar") || /^\/s\/folders\/[^/]+\/quiz\//.test(pathname)) return "practice";
  if (pathname.startsWith("/s/avance")) return "progress";
  if (pathname.startsWith("/s/mis-datos") || pathname.startsWith("/s/context")) return "myData";
  return null;
}

const ICONS = { ask: MessageCircle, practice: PencilLine, progress: BarChart3, myData: UserRound } as const;

/**
 * Los tres destinos del estudiante (Preguntar, Practicar, Mi avance). En el celular es una barra
 * inferior fija; en la computadora, una barra lateral que suma Mis datos.
 */
export function StudentNav({ variant, myDataHref }: { variant: "bottom" | "side"; myDataHref: string }) {
  const pathname = usePathname();
  const active = destinationFor(pathname);
  const t = TEXT.student.nav;
  const items: { key: Destination; href: string; label: string }[] = [
    { key: "ask", href: "/s", label: t.ask },
    { key: "practice", href: "/s/practicar", label: t.practice },
    { key: "progress", href: "/s/avance", label: t.progress },
    ...(variant === "side" ? [{ key: "myData" as const, href: myDataHref, label: t.myData }] : []),
  ];

  return (
    <nav
      aria-label={t.label}
      className={cn(
        variant === "bottom"
          ? "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
          : "hidden md:block",
      )}
    >
      <ul className={cn(variant === "bottom" ? "mx-auto grid max-w-md grid-cols-3" : "flex flex-col gap-1")}>
        {items.map(({ key, href, label }) => {
          const Icon = ICONS[key];
          const current = active === key;
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  variant === "bottom" ? "min-h-14 flex-col justify-center gap-0.5 text-xs font-medium" : "gap-3 px-3 text-base",
                  current && "bg-surface-2 font-semibold text-ink",
                )}
              >
                <Icon className={variant === "bottom" ? "size-6" : "size-5"} aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
