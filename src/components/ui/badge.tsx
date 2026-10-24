import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "primary" | "attention" | "muted" | "danger" | "success";

const tones: Record<Tone, string> = {
  neutral: "border-line bg-surface-2 text-ink-2",
  primary: "border-primary/30 bg-primary/10 text-primary font-medium",
  attention: "border-attention/30 bg-attention/10 text-attention font-medium",
  muted: "border-line bg-surface-2 text-muted",
  danger: "border-danger/30 bg-danger/10 text-danger font-medium",
  success: "border-success/30 bg-success/10 text-success font-medium",
};

export function Badge({ tone = "neutral", children, title, className }: { tone?: Tone; children: ReactNode; title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-mono font-medium leading-none tracking-tight", tones[tone], className)}
    >
      {children}
    </span>
  );
}

export { ConceptPill } from "./layout";
