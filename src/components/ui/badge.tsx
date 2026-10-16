import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "primary" | "attention" | "muted" | "danger" | "success";

const tones: Record<Tone, string> = {
  neutral: "border-[#d1d1cd] bg-[#fdfbfa] text-[#72706b]",
  primary: "border-transparent bg-[#016a71] text-white",
  attention: "border-[#c08532]/30 bg-[#fbf5eb] text-[#c08532]",
  muted: "border-[#d1d1cd]/70 bg-transparent text-[#92918b]",
  danger: "border-[#cf2d56]/30 bg-[#fdf2f4] text-[#cf2d56]",
  success: "border-transparent bg-[#016a71] text-white",
};

export function Badge({ tone = "neutral", children, title, className }: { tone?: Tone; children: ReactNode; title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-none tracking-tight", tones[tone], className)}
    >
      {children}
    </span>
  );
}
