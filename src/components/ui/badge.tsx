import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "primary" | "attention" | "muted" | "danger" | "success";

const tones: Record<Tone, string> = {
  neutral: "border-white/[0.08] bg-white/[0.04] text-[#D0D6E0]",
  primary: "border-primary/40 bg-primary/10 text-primary-light",
  attention: "border-amber-500/30 bg-amber-500/10 text-amber-300 font-medium",
  muted: "border-white/[0.06] bg-white/[0.02] text-[#8A8F98]",
  danger: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
};

export function Badge({ tone = "neutral", children, title, className }: { tone?: Tone; children: ReactNode; title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-mono font-medium leading-none tracking-tight", tones[tone], className)}
    >
      {children}
    </span>
  );
}

export { ConceptPill } from "./layout";

