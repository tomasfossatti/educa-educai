"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FormMessage, PendingButton, useActionForm } from "@/components/ui/client";
import { TEXT } from "@/lib/texts";
import { startThreadAction } from "@/server/actions/folders";

/**
 * Envuelve la conversación: al seleccionar texto adentro, aparece "Preguntar sobre esto",
 * que abre un hilo corto sobre ese fragmento sin perder la conversación principal.
 */
export function SelectionAsk({ conversationId, folderId, children }: { conversationId: string; folderId: string; children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState("");
  const { state, pending, onSubmit } = useActionForm(startThreadAction);

  useEffect(() => {
    function onSelection() {
      const selection = document.getSelection();
      const text = selection?.toString().trim() ?? "";
      const inside = selection && selection.rangeCount > 0 && container.current?.contains(selection.getRangeAt(0).commonAncestorContainer);
      if (inside && text.length >= 3) setAnchor(text);
    }
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, []);

  return (
    <div className="space-y-3">
      <div ref={container}>{children}</div>
      {anchor && (
        <form method="post" onSubmit={onSubmit} className="sticky bottom-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3 shadow-sm">
          <input type="hidden" name="conversationId" value={conversationId} />
          <input type="hidden" name="folderId" value={folderId} />
          <input type="hidden" name="anchor" value={anchor} />
          <span className="min-w-0 flex-1 truncate text-xs text-muted">«{anchor}»</span>
          <PendingButton pending={pending} pendingText={TEXT.thread.opening} size="sm">
            {TEXT.thread.askAbout}
          </PendingButton>
          <FormMessage state={state} />
        </form>
      )}
    </div>
  );
}
