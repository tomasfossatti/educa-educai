"use client";

import { WandSparkles } from "lucide-react";
import { useRef, useState, useTransition, type ComponentProps } from "react";
import { buttonClass } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { TEXT } from "@/lib/texts";
import { improveTextAction } from "@/server/actions/student";

/** Mínimo para habilitar el lápiz: el mismo que exige el servidor. */
const MIN_CHARS = 3;

/**
 * Cuadro de texto con "lápiz mágico": abajo a la derecha, un botón pide a la IA una mejor redacción.
 * Sirve para mejorar lo que el estudiante ya escribió, no para escribir desde cero: queda bloqueado
 * hasta que hay texto. La sugerencia aparece debajo y solo reemplaza el texto si toca "Usar".
 */
export function ImprovableTextarea({ field, className, onInput, ...props }: ComponentProps<typeof Textarea> & { field: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [hasText, setHasText] = useState(() => String(props.defaultValue ?? props.value ?? "").trim().length >= MIN_CHARS);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ suggestion: string; tip: string | null } | { error: string } | null>(null);
  const t = TEXT.improve;

  function improve() {
    const value = ref.current?.value ?? "";
    // Lo que ya escribió en otros campos del mismo formulario, para que la IA entienda el contexto.
    const form = ref.current?.form;
    const read = (name: string) => {
      const el = form?.elements.namedItem(name);
      return el && "value" in el ? String(el.value) : undefined;
    };
    const context = { career: read("career"), projectDescription: read("projectDescription"), currentContext: read("currentContext") };
    startTransition(async () => setResult(await improveTextAction(field, value, context)));
  }

  function use(suggestion: string) {
    const el = ref.current;
    if (!el) return;
    // Setter nativo + evento input: así el formulario y cualquier estado controlado ven el cambio.
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(el, suggestion);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    setHasText(suggestion.trim().length >= MIN_CHARS);
    setResult(null);
    el.focus();
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          ref={ref}
          className={cn("pr-10", className)}
          onInput={(event) => {
            setHasText(event.currentTarget.value.trim().length >= MIN_CHARS);
            onInput?.(event);
          }}
          {...props}
        />
        <button
          type="button"
          onClick={improve}
          disabled={pending || !hasText}
          aria-label={t.button}
          title={hasText ? t.button : t.needsText}
          className="absolute bottom-2 right-2 rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
        >
          <WandSparkles className={cn("h-4 w-4", pending && "animate-pulse")} aria-hidden />
        </button>
      </div>
      {pending && <p className="text-xs text-muted">{t.working}</p>}
      {result && "error" in result && <p className="text-xs text-attention">{result.error}</p>}
      {result && "suggestion" in result && (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-surface-2 p-3" role="status">
          <p className="text-xs font-medium text-muted">{t.suggestion}</p>
          <p className="text-sm text-ink">{result.suggestion}</p>
          {result.tip && <p className="text-xs text-ink-2">{result.tip}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => use(result.suggestion)} className={buttonClass("primary", "sm")}>
              {t.use}
            </button>
            <button type="button" onClick={() => setResult(null)} className={buttonClass("ghost", "sm")}>
              {t.discard}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
