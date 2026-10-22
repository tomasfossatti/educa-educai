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

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-white/[0.08] bg-[#0F1011] p-5 shadow-none transition-colors duration-150 hover:border-white/[0.14]",
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
        "divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#0F1011] overflow-hidden",
        className
      )}
    >
      {children}
    </ul>
  );
}

export function ListItem({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cn("px-4 py-3.5 transition-colors hover:bg-white/[0.03]", className)}>{children}</li>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.12] bg-[#0F1011]/60 px-4 py-8 text-center text-sm backdrop-blur-sm">
      <p className="font-semibold text-[#F7F8F8]">{title}</p>
      {children && <div className="mt-1 text-[#8A8F98] max-w-md mx-auto">{children}</div>}
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
    <div className="grid grid-cols-1 gap-0.5 py-1.5 text-sm sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}

/** Cita de evidencia o voz de estudiante con tipografía editorial serif. */
export function Quote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <blockquote className={cn("prose-plain font-editorial border-l-2 border-primary/70 pl-4 py-1 text-[15px] leading-relaxed text-[#F7F8F8]/90 italic tracking-[-0.01em]", className)}>
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

