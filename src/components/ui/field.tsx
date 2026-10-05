import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-faint focus:border-primary focus:outline-none disabled:bg-subtle";

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
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-muted">(opcional)</span>}
      </label>
      {hint && <p className="text-xs text-muted">{hint}</p>}
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
  return <input className={cn(control, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-9 pr-8", className)} {...props} />;
}

export function Checkbox({ label, hint, ...props }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" {...props} />
      <span>
        <span className="text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Radio({ label, hint, ...props }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input type="radio" className="mt-0.5 size-4 shrink-0 accent-primary" {...props} />
      <span>
        <span className="text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}
