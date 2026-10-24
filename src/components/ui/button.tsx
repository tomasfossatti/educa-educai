import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "invert";
type Size = "sm" | "md" | "icon" | "icon-round" | "nav" | "card" | "dropzone";

const base =
  "inline-flex items-center justify-center gap-1.5 font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap active:scale-95 select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover active:bg-[var(--accent-active)] shadow-xs font-semibold border border-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  secondary:
    "border border-line bg-surface-2 text-ink hover:bg-surface-3 hover:border-line-strong hover:text-ink font-medium shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  ghost:
    "text-muted hover:text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  danger:
    "border border-danger/30 bg-surface text-danger hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger",
  invert:
    "bg-ink text-surface hover:opacity-90 font-semibold border border-transparent shadow-xs",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-lg",
  md: "h-9.5 px-4 text-sm rounded-xl",
  icon: "size-8 p-0 rounded-lg",
  "icon-round": "size-8 p-0 rounded-full",
  nav: "h-7 px-2.5 text-xs rounded-lg",
  card: "h-auto p-4 rounded-xl",
  dropzone: "h-auto p-6 rounded-xl border-dashed",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  loading = false,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      className={buttonClass(variant, size, className)}
      aria-busy={loading}
      aria-disabled={props.disabled || loading}
      {...props}
    >
      {loading && (
        <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cn("text-primary underline-offset-2 hover:underline hover:text-primary-hover transition-colors", className)} {...props} />;
}
