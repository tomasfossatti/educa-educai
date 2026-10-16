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
        {eyebrow && <div className="text-[11px] font-medium uppercase tracking-wider text-[#92918b]">{eyebrow}</div>}
        <h1 className="text-2xl sm:text-[26px] font-medium tracking-tight text-[#27251e] leading-snug">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-[#72706b] font-normal leading-relaxed">{description}</p>}
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
    <section id={id} className={cn("space-y-3.5", className)}>
      <div className="flex items-baseline justify-between gap-4 border-b border-[#d1d1cd] pb-2.5">
        <div>
          <h2 className="text-base font-medium tracking-tight text-[#27251e]">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-[#72706b] font-normal leading-relaxed">{description}</p>}
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
        "relative rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.08)]",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Lista con separadores finos: estructura con bordes de 16px en Soft Paper */
export function List({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul
      className={cn(
        "divide-y divide-[#d1d1cd] rounded-2xl border border-[#d1d1cd] bg-[#fdfbfa] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.08)]",
        className
      )}
    >
      {children}
    </ul>
  );
}

export function ListItem({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cn("px-4 py-3.5 transition-colors hover:bg-[#faf8f5]", className)}>{children}</li>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d1d1cd] bg-[#fdfbfa]/60 px-5 py-8 text-center text-sm">
      <p className="font-medium text-[#27251e] text-base">{title}</p>
      {children && <div className="mt-1.5 text-[#72706b] max-w-md mx-auto leading-relaxed">{children}</div>}
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
    info: "border-[#d1d1cd] bg-[#fdfbfa] text-[#27251e]",
    success: "border-transparent bg-[#016a71]/10 text-[#016a71]",
    attention: "border-[#c08532]/30 bg-[#fbf5eb] text-[#c08532]",
    error: "border-[#cf2d56]/30 bg-[#fdf2f4] text-[#cf2d56]",
  } as const;
  return (
    <div className={cn("rounded-2xl border px-4 py-3 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)]", tones[tone])} role={tone === "error" ? "alert" : undefined}>
      {title && <p className="font-medium text-[#27251e]">{title}</p>}
      {children && <div className={title ? "mt-1 text-[#72706b] leading-relaxed" : "leading-relaxed"}>{children}</div>}
    </div>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-1.5 text-sm sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-[#72706b] font-normal">{label}</dt>
      <dd className="min-w-0 text-[#27251e] font-normal">{children}</dd>
    </div>
  );
}

export function Quote({ children }: { children: ReactNode }) {
  return <blockquote className="prose-plain border-l-2 border-[#016a71] pl-3.5 text-sm text-[#72706b] italic">{children}</blockquote>;
}
