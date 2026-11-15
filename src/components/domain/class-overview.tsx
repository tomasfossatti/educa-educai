import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { List, ListItem, Section } from "@/components/ui/layout";
import { formatRelative } from "@/lib/format";
import { TEXT } from "@/lib/texts";
import type { ClassOverview } from "@/server/services/class-view";

/** Vista macro de la cátedra: participación, temas que no se entienden (con denominador) y alertas. */
export function ClassOverviewSection({ overview, courseId }: { overview: ClassOverview; courseId: string }) {
  const t = TEXT.classView;
  const p = overview.participation;
  const discussed = overview.topics.filter((x) => x.conversed > 0);
  const topics = discussed.filter((x) => x.withDoubt > 0);
  const clean = discussed.length - topics.length;
  return (
    <Section title={t.title} description={t.participation(p.consented, p.enrolled, p.conversedThisWeek)}>
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">{t.topicsTitle}</h3>
          {discussed.length === 0 && <p className="text-sm text-muted">{t.noTopics}</p>}
          {topics.length > 0 && (
            <List>
              {topics.map((x) => (
                <ListItem key={x.topicId} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink">{x.sentence}</span>
                  <Badge tone={x.percent >= 40 ? "attention" : "muted"}>{x.percent}%</Badge>
                </ListItem>
              ))}
            </List>
          )}
          {clean > 0 && <p className="text-xs text-muted">{t.topicsWithoutDoubts(clean)}</p>}
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">{t.masteryTitle}</h3>
          <p className="text-xs text-muted">{t.masteryLegend}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {overview.topics.map((x) => (
              <li key={x.topicId} className="rounded-lg border border-line px-3 py-2 text-sm">
                <span className="block truncate text-ink">{x.title}</span>
                <span className="block text-xs text-muted">{t.masteryBuckets(x.mastery.low, x.mastery.mid, x.mastery.high, x.mastery.none)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">{t.inactiveTitle}</h3>
          {overview.alerts.inactive.length === 0 ? (
            <p className="text-sm text-muted">{t.noInactive}</p>
          ) : (
            <ul className="flex flex-wrap gap-2 text-sm">
              {overview.alerts.inactive.map((s) => (
                <li key={s.studentId}>
                  <Link href={`/t/courses/${courseId}/students/${s.studentId}`} className="rounded-full border border-line px-3 py-1 hover:bg-surface-2">
                    {s.name}
                    {s.lastConversationAt && <span className="ml-1 text-xs text-muted">· {formatRelative(s.lastConversationAt)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}
