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
        {eyebrow && <div className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</div>}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted">{description}</p>}
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
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2.5">
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

const cardPaddings = {
  none: "p-0",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
} as const;

export function Card({
  children,
  className,
  padding = "md",
}: {
  children: ReactNode;
  className?: string;
  padding?: keyof typeof cardPaddings;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-line bg-surface shadow-xs transition-colors duration-150 hover:border-line-strong",
        cardPaddings[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

/** Lista con separadores finos: la estructura por defecto en vez de muchas cards. */
export function List({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul
      className={cn(
        "divide-y divide-line rounded-xl border border-line bg-surface overflow-hidden shadow-[var(--shadow-card)]",
        className
      )}
    >
      {children}
    </ul>
  );
}

export function ListItem({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cn("px-4 py-3.5 transition-colors hover:bg-surface-2/60", className)}>{children}</li>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface/60 px-4 py-8 text-center text-sm">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 text-muted max-w-md mx-auto">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
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
    info: "border-line bg-surface-2 text-ink-2",
    success: "border-success/30 bg-surface-2 text-ink-2",
    attention: "border-attention/30 bg-attention-soft text-ink-2",
    error: "border-danger/30 bg-danger-soft text-ink-2",
  } as const;
  return (
    <div className={cn("rounded-xl border px-3.5 py-3 text-sm backdrop-blur-sm", tones[tone])} role={tone === "error" ? "alert" : undefined}>
      {title && <p className="font-semibold text-ink">{title}</p>}
      {children && <div className={title ? "mt-0.5" : undefined}>{children}</div>}
    </div>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-1.5 text-sm sm:grid-cols-4 sm:gap-4">
      <dt className="text-muted sm:col-span-1">{label}</dt>
      <dd className="min-w-0 text-ink sm:col-span-3">{children}</dd>
    </div>
  );
}

/** Cita de evidencia o voz de estudiante con tipografía editorial. */
export function Quote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <blockquote className={cn("prose-plain font-editorial border-l-2 border-primary/70 pl-4 py-1 text-sm leading-relaxed text-ink/90 italic", className)}>
      {children}
    </blockquote>
  );
}

/** Cápsula de concepto pedagógico para insertar naturalmente dentro de la prosa. */
export function ConceptPill({
  tone = "primary",
  children,
  className,
}: {
  tone?: "primary" | "amber" | "emerald";
  children: ReactNode;
  className?: string;
}) {
  const toneClasses = {
    primary: "concept-pill",
    amber: "concept-pill concept-pill-amber",
    emerald: "concept-pill concept-pill-emerald",
  };
  return <span className={cn(toneClasses[tone], className)}>{children}</span>;
}

