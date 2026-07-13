const DAY_MS = 86_400_000;

function utcDateValue(iso: string): number {
  return new Date(`${iso}T00:00:00.000Z`).getTime();
}

function utcTodayValue(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function getIsoToday(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isBoardJobUnexpired(
  deadline: string | null,
  today = getIsoToday(),
): boolean {
  return deadline === null || deadline >= today;
}

export function daysUntilBoardDeadline(
  deadline: string | null,
  now = new Date(),
): number | null {
  if (!deadline) return null;
  return Math.round((utcDateValue(deadline) - utcTodayValue(now)) / DAY_MS);
}

export function formatBoardDate(iso: string | null): string {
  if (!iso) return "Not listed";

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}

export function formatBoardDeadline(
  deadline: string | null,
  now = new Date(),
): string {
  const days = daysUntilBoardDeadline(deadline, now);
  if (days === null) return "No deadline listed";
  if (days < 0) return "Deadline passed";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 7) return `Due in ${days} days`;
  return `Due ${formatBoardDate(deadline)}`;
}
