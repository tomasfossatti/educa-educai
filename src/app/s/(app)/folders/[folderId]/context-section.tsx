import type { FolderContext } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/ui/client";
import { List, ListItem, Notice, Section } from "@/components/ui/layout";
import { formatRelative } from "@/lib/format";
import { TEXT } from "@/lib/texts";
import { deleteContextAction } from "@/server/actions/folders";
import { EditContextForm } from "./context-form";

/** Contexto de la carpeta: resumen cruzado, hechos (editables y borrables) e historial. */
export function ContextSection({
  summary,
  facts,
  trace,
  consent,
}: {
  summary: FolderContext | null;
  facts: FolderContext[];
  trace: FolderContext[];
  consent: boolean;
}) {
  const t = TEXT.context;
  const item = (row: FolderContext) => (
    <ListItem key={row.id} className="space-y-2">
      <EditContextForm id={row.id} content={row.content} label={row.layer === "SUMMARY" ? t.summaryLabel : t.factLabel} />
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>
          {formatRelative(row.updatedAt)}
          {row.editedByStudent && <Badge tone="muted" className="ml-2">{t.edited}</Badge>}
        </span>
        <form action={deleteContextAction.bind(null, row.id)}>
          <ConfirmSubmit variant="ghost" size="sm" message={t.removeConfirm}>
            {t.remove}
          </ConfirmSubmit>
        </form>
      </div>
    </ListItem>
  );
  return (
    <Section title={t.title} description={t.description}>
      {!consent && <Notice>{t.noConsent}</Notice>}
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">{t.summary}</h3>
          {summary ? <List>{item(summary)}</List> : <p className="text-sm text-muted">{t.noSummary}</p>}
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">{t.facts}</h3>
          {facts.length ? <List>{facts.map(item)}</List> : <p className="text-sm text-muted">{t.noFacts}</p>}
        </div>
        {trace.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-ink">{t.trace}</summary>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {trace.map((x) => (
                <li key={x.id}>
                  {x.content} · {formatRelative(x.createdAt)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Section>
  );
}
