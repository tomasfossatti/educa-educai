"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/layout";
import { TEXT } from "@/lib/texts";
import { createExtensionCodeAction, lmsConnectionStatusAction } from "@/server/actions/lms";

const POLL_MS = 3000;

/**
 * Vinculación con la extensión del navegador: genera un código de un solo uso para la dirección de
 * Canvas que escribió la persona y espera a que la extensión conecte. Cuando conecta, refresca la página.
 */
export function ExtensionLink({ baseUrlInputId }: { baseUrlInputId: string }) {
  const t = TEXT.lms.extension;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ code: string; expiresAt: string } | { error: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState<string | null>(null);
  const [stage, setStage] = useState<{ stage: string; error: string | null }>({ stage: "code", error: null });
  const code = result && "code" in result ? result.code : null;

  useEffect(() => {
    if (!code || connected) return;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const tick = async () => {
      const status = await lmsConnectionStatusAction();
      if (cancelled) return;
      if (status.connected && status.extensionStage === "synced") {
        setConnected(status.accountName ?? "tu cuenta");
        router.refresh();
        return;
      }
      setStage({ stage: status.extensionStage, error: status.extensionError });
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, connected, router]);

  function generate() {
    const input = document.getElementById(baseUrlInputId) as HTMLInputElement | null;
    setCopied(false);
    setStage({ stage: "code", error: null });
    startTransition(async () => setResult(await createExtensionCodeAction(input?.value ?? "")));
  }

  return (
    <div className="space-y-4" data-testid="extension-link">
      <p className="text-sm text-muted">{t.intro}</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-ink">
        <li>
          {t.step1}{" "}
          <a href="/educai-canvas.zip" download className={buttonClass("secondary", "sm")}>
            {t.download}
          </a>
        </li>
        <li>{t.step2}</li>
        <li>{t.step3}</li>
      </ol>
      {result && "error" in result && <Notice tone="error">{result.error}</Notice>}
      {connected ? (
        <Notice tone="success">{t.done(connected)}</Notice>
      ) : code ? (
        <div className="space-y-2">
          <textarea readOnly value={code} aria-label={t.copy} className="h-20 w-full rounded-lg border border-line bg-surface-2 p-2 font-mono text-xs text-ink" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(code).then(() => setCopied(true), () => setCopied(false));
              }}
            >
              {copied ? t.copied : t.copy}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={generate} disabled={pending}>
              {t.generate}
            </Button>
          </div>
          <p className="text-xs text-muted">{t.expires}</p>
          {stage.stage === "error" && stage.error ? (
            <Notice tone="error">{t.failed(stage.error)}</Notice>
          ) : (
            <p className="text-xs text-muted" role="status">
              {stage.stage === "linked" ? t.linked : t.waiting}
            </p>
          )}
        </div>
      ) : (
        <Button type="button" onClick={generate} disabled={pending}>
          {pending ? t.generating : t.generate}
        </Button>
      )}
    </div>
  );
}
