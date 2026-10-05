const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return dateFormatter.format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return dateTimeFormatter.format(new Date(date));
}

/** "hace 3 días", "hoy", "ayer". */
export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const days = Math.floor((Date.now() - new Date(date).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  return formatDate(date);
}

export function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

export function toDateInputValue(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
