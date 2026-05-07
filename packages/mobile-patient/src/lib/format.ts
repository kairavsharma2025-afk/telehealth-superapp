// Date helpers shared across screens.

const dateOpts: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

const timeOpts: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};

export function formatTimeRange(startAt: string, endAt: string): string {
  const start = new Date(startAt).toLocaleString(undefined, dateOpts);
  const end = new Date(endAt).toLocaleTimeString(undefined, timeOpts);
  return `${start} → ${end}`;
}
