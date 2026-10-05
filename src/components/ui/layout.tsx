import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        {eyebrow && <div className="text-xs font-medium uppercase tracking-wide text-muted">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0 text-sm">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-lg border border-line bg-surface p-4", className)}>{children}</div>;
}

/** Lista con separadores finos: la estructura por defecto en vez de muchas cards. */
export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("divide-y divide-line rounded-lg border border-line bg-surface", className)}>{children}</ul>;
}

export function ListItem({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cn("px-4 py-3", className)}>{children}</li>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface px-4 py-6 text-sm">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-muted">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "attention" | "error";
  title?: ReactNode;
  children?: ReactNode;
}) {
  const tones = {
    info: "border-line bg-subtle text-ink-2",
    success: "border-success/30 bg-surface text-ink-2",
    attention: "border-attention/30 bg-attention-soft text-ink-2",
    error: "border-danger/30 bg-danger-soft text-ink-2",
  } as const;
  return (
    <div className={cn("rounded-md border px-3 py-2.5 text-sm", tones[tone])} role={tone === "error" ? "alert" : undefined}>
      {title && <p className="font-medium text-ink">{title}</p>}
      {children && <div className={title ? "mt-0.5" : undefined}>{children}</div>}
    </div>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-1.5 text-sm sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}

export function Quote({ children }: { children: ReactNode }) {
  return <blockquote className="prose-plain border-l-2 border-line-strong pl-3 text-sm text-ink">{children}</blockquote>;
}
