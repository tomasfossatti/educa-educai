import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "primary" | "attention" | "muted" | "danger";

const tones: Record<Tone, string> = {
  neutral: "border-line-strong bg-surface text-ink-2",
  primary: "border-primary/30 bg-primary-soft text-primary",
  attention: "border-attention/30 bg-attention-soft text-attention",
  muted: "border-line bg-subtle text-muted",
  danger: "border-danger/30 bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children, title, className }: { tone?: Tone; children: ReactNode; title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium leading-none", tones[tone], className)}
    >
      {children}
    </span>
  );
}
