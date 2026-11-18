/** Tabular lining figures everywhere, right-aligned in fixed columns — DESIGN.md §Typography. */
const COUNT = new Intl.NumberFormat("en-US");

export const formatCount = (n: number) => COUNT.format(n);

/**
 * Relative age as the design sets it: "36 min", "5 h", "3 d". Terse because it sits in a 52 px
 * column, and the unit is always present so a bare number is never ambiguous.
 */
export function formatAge(createdAt: Date, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - createdAt.getTime()) / 1000));
  if (seconds < 60) return `${seconds} s`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  // Hours up to two days, so "36 h" reads more usefully than "2 d" at that range.
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;

  return `${Math.round(hours / 24)} d`;
}

/** The ranked time in the document line is a machine fact, so it is always UTC. */
export function formatUtcTime(at: Date): string {
  return at.toISOString().slice(11, 19);
}

export function formatIsoDate(at: Date): string {
  return at.toISOString().slice(0, 10);
}
