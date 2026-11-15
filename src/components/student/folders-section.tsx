import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/layout";
import { formatRelative } from "@/lib/format";
import { TEXT } from "@/lib/texts";
import { listStudentFolders } from "@/server/services/folders";

/** Carpetas del estudiante con su última conversación (pantalla de inicio). */
export async function FoldersSection({ studentId }: { studentId: string }) {
  const folders = await listStudentFolders(studentId);
  const t = TEXT.folders;
  return (
    <Section title={t.sectionTitle} description={t.sectionDescription}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {folders.map((f) => {
          const last = f.conversations[0];
          return (
            <li key={f.id}>
              <Link
                href={`/s/folders/${f.id}`}
                className="flex h-full flex-col gap-2 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-2"
              >
                <span className="flex items-center gap-2">
                  <FolderOpen className="size-4 shrink-0 text-primary" />
                  <span className="truncate font-medium text-ink">{f.name}</span>
                  <Badge tone={f.kind === "SUBJECT" ? "primary" : "neutral"} className="ml-auto shrink-0">
                    {t.kind[f.kind]}
                  </Badge>
                </span>
                <span className="text-xs text-muted">
                  {last ? `${t.lastConversation(last.title)} · ${formatRelative(last.createdAt)}` : t.noConversations}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
