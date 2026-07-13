const DAY_MS = 86_400_000;

function utcToday(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function daysUntilPrivateJobDeadline(
  deadline: string | null,
  now = new Date(),
): number | null {
  if (!deadline) return null;
  const target = new Date(`${deadline}T00:00:00.000Z`).getTime();
  return Math.round((target - utcToday(now)) / DAY_MS);
}

export function formatPrivateJobDate(value: string | null): string {
  if (!value) return "Not listed";

  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00.000Z`);

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatPrivateJobDeadline(
  deadline: string | null,
  now = new Date(),
): string {
  const days = daysUntilPrivateJobDeadline(deadline, now);
  if (days === null) return "No deadline listed";
  if (days < 0) return `Closed ${Math.abs(days)}d ago`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 7) return `Due in ${days} days`;
  return `Due ${formatPrivateJobDate(deadline)}`;
}

export function formatPrivateJobUpdatedAt(
  value: string,
  now = new Date(),
): string {
  const updated = new Date(value);
  const days = Math.floor((now.getTime() - updated.getTime()) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return formatPrivateJobDate(value);
}
