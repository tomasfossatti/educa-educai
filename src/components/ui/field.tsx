import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-xl border border-[#d1d1cd] bg-[#faf8f5] px-3.5 text-sm text-[#27251e] placeholder:text-[#92918b] focus:border-[#016a71] focus:ring-1 focus:ring-[#016a71] focus:outline-none transition-colors duration-150 disabled:bg-[#fdfbfa] disabled:cursor-not-allowed font-normal";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  optional,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-[#27251e]">
        {label}
        {optional && <span className="ml-1 font-normal text-[#92918b]">(opcional)</span>}
      </label>
      {hint && <p className="text-xs text-[#72706b]">{hint}</p>}
      {children}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-10 pr-8", className)} {...props} />;
}

export function Checkbox({ label, hint, ...props }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 rounded accent-[#016a71]" {...props} />
      <span>
        <span className="text-[#27251e] font-normal">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-[#72706b]">{hint}</span>}
      </span>
    </label>
  );
}

export function Radio({ label, hint, ...props }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input type="radio" className="mt-0.5 size-4 shrink-0 accent-[#016a71]" {...props} />
      <span>
        <span className="text-[#27251e] font-normal">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-[#72706b]">{hint}</span>}
      </span>
    </label>
  );
}
