import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "primary" | "attention" | "muted" | "danger" | "success";

const tones: Record<Tone, string> = {
  neutral: "border-line bg-surface-2 text-ink-2",
  primary: "border-primary/40 bg-primary-soft text-primary",
  attention: "border-attention/40 bg-attention-soft text-attention font-medium",
  muted: "border-line/60 bg-surface text-muted",
  danger: "border-danger/40 bg-danger-soft text-danger",
  success: "border-success/40 bg-success-muted text-success",
};

export function Badge({ tone = "neutral", children, title, className }: { tone?: Tone; children: ReactNode; title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none shadow-sm", tones[tone], className)}
    >
      {children}
    </span>
  );
}
