/** Days until deadline relative to the mock "today" (2026-07-08). */
export function daysUntil(iso: string): number {
  const today = new Date("2026-07-08T00:00:00");
  const target = new Date(`${iso}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function formatDeadline(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return `Closed ${-d}d ago`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d} days`;
}
