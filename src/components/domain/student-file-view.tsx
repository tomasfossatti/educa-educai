import { Badge } from "@/components/ui/badge";
import { EmptyState, KeyValue, List, ListItem, Quote, Section } from "@/components/ui/layout";
import { formatDate, formatRelative } from "@/lib/format";
import { TEXT } from "@/lib/texts";
import type { StudentFile } from "@/server/services/student-file";

/**
 * Ficha de un estudiante en una materia. La usan el docente y "Mi ficha" del estudiante:
 * un solo componente garantiza que los dos vean exactamente lo mismo (V7).
 */
export function StudentFileView({ file, projectLinks }: { file: StudentFile; projectLinks: { id: string; content: string; createdAt: Date }[] }) {
  const t = TEXT.file;
  return (
    <div className="space-y-10">
      <Section title={t.profile}>
        <dl>
          <KeyValue label={t.career}>{file.student.career ?? "—"}</KeyValue>
          <KeyValue label={t.year}>{file.student.studyYear ?? "—"}</KeyValue>
          <KeyValue label={t.project}>{file.student.projectDescription ?? "—"}</KeyValue>
        </dl>
      </Section>

      <Section title={t.projectLinks}>
        {projectLinks.length === 0 ? (
          <p className="text-sm text-muted">{t.noProjectLinks}</p>
        ) : (
          <List>
            {projectLinks.map((l) => (
              <ListItem key={l.id}>
                <p className="text-sm text-ink">{l.content}</p>
                <p className="text-xs text-muted">{formatDate(l.createdAt)}</p>
              </ListItem>
            ))}
          </List>
        )}
      </Section>

      <Section title={t.topics}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {file.topics.map((topic) => (
            <li key={topic.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate text-ink">{topic.title}</span>
                <span className="block text-xs text-muted">{t.mastery(topic.mastery, topic.attempts)}</span>
              </span>
              <Badge tone={topic.doubts > 0 ? "attention" : "muted"}>{t.doubts(topic.doubts)}</Badge>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t.evidence}>
        {file.evidence.length === 0 ? (
          <EmptyState title={t.noEvidence} />
        ) : (
          <List>
            {file.evidence.map((e) => (
              <ListItem key={e.id}>
                <Quote>{e.content}</Quote>
                <p className="mt-1 text-xs text-muted">
                  {e.topics.map((x) => x.title).join(" · ") || "—"} · {formatDate(e.occurredAt)}
                </p>
              </ListItem>
            ))}
          </List>
        )}
      </Section>

      <Section title={t.activity}>
        {file.recentActivity.length === 0 ? (
          <p className="text-sm text-muted">{t.noActivity}</p>
        ) : (
          <List>
            {file.recentActivity.map((a) => (
              <ListItem key={a.id}>
                <span className="text-sm text-ink">{a.title}</span>
                <span className="ml-2 text-xs text-muted">
                  {a.origin === "UPLOAD" ? `${t.uploaded} · ` : ""}
                  {formatRelative(a.createdAt)}
                </span>
              </ListItem>
            ))}
          </List>
        )}
      </Section>
    </div>
  );
}
