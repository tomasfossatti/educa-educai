import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "invert" | "amber" | "forest";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 font-normal transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap active:scale-[0.99]";

const variants: Record<Variant, string> = {
  primary:
    "bg-[#27251e] text-[#faf8f5] hover:bg-[#3d3b32] font-normal border border-transparent shadow-[0_1px_2px_rgba(0,0,0,0.08)] rounded-xl",
  secondary:
    "border border-[#d1d1cd] bg-transparent text-[#72706b] hover:text-[#27251e] hover:border-[#27251e] hover:bg-[#fdfbfa] font-normal shadow-none rounded-md",
  ghost:
    "bg-transparent text-[#72706b] hover:text-[#27251e] hover:bg-[#fdfbfa] font-normal border border-transparent rounded-md",
  amber:
    "bg-[#c08532] text-[#faf8f5] hover:bg-[#ad7427] font-normal border border-transparent rounded-md",
  forest:
    "bg-[#016a71] text-[#faf8f5] hover:bg-[#015257] font-normal border border-transparent rounded-md",
  danger:
    "border border-[#cf2d56]/30 bg-[#fdf2f4] text-[#cf2d56] hover:bg-[#fbdde3] font-normal rounded-md",
  invert:
    "bg-[#fdfbfa] text-[#27251e] hover:bg-[#faf8f5] font-normal border border-[#d1d1cd] rounded-md",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
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
  return <Link className={cn("text-[#016a71] underline-offset-2 hover:underline transition-colors duration-150 font-normal", className)} {...props} />;
}
