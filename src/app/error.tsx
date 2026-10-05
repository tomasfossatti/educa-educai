"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-24">
      <h1 className="text-xl font-semibold">Algo salió mal</h1>
      <p className="mt-2 text-sm text-ink-2">
        No pudimos cargar esta pantalla. Tus datos no se perdieron. Probá de nuevo en unos segundos.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">Código: {error.digest}</p>}
      <Button onClick={reset} className="mt-6">
        Reintentar
      </Button>
    </main>
  );
}
