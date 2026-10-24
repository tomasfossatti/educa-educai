import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Avatar({
  name,
  className,
  ...props
}: ComponentProps<"div"> & { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/20 select-none",
        className
      )}
      aria-label={name}
      {...props}
    >
      {initial}
    </div>
  );
}
