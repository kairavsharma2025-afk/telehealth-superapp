// Human-readable relative time strings powered by Intl.RelativeTimeFormat.
// Returns things like:
//   future:  "in 2 hours", "tomorrow", "in 3 days"
//   past:    "5 minutes ago", "yesterday", "2 weeks ago"
// numeric: "auto" lets the platform substitute "yesterday"/"tomorrow"
// for ±1 day where it makes sense.

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function formatRelative(target: Date, now: Date = new Date()): string {
  const diffSec = Math.round((target.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);

  if (abs < 45) return rtf.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, "day");
  const diffWeek = Math.round(diffDay / 7);
  if (Math.abs(diffWeek) < 5) return rtf.format(diffWeek, "week");
  const diffMonth = Math.round(diffDay / 30);
  return rtf.format(diffMonth, "month");
}
