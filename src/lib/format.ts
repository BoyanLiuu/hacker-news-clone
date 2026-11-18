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

/**
 * The long form, for threads: "5 hours ago". Listings use the terse form because the age sits in a
 * 52 px column; a thread has room for a sentence and reads better for it.
 */
export function formatAgeLong(createdAt: Date, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - createdAt.getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${plural(minutes, "minute")} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} ${plural(hours, "hour")} ago`;

  const days = Math.round(hours / 24);
  return `${days} ${plural(days, "day")} ago`;
}

const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`);

/** The ranked time in the document line is a machine fact, so it is always UTC. */
export function formatUtcTime(at: Date): string {
  return at.toISOString().slice(11, 19);
}

/** hh:mm, for a deadline a person has to act on rather than a machine fact to correlate. */
export function formatUtcClock(at: Date): string {
  return at.toISOString().slice(11, 16);
}

export function formatIsoDate(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Forward-looking: "in 49 minutes". Rounds up, so a wait never reads as shorter than it is — a
 * reader told "in 1 minute" who still cannot act has been lied to.
 *
 * Minutes throughout, with no hours branch. Every deadline this formats is under two hours, and
 * rounding minutes into hours has to pick a direction: "in 1 hour" for 61 minutes breaks the rule
 * above, and "in 2 hours" overstates by nearly an hour. "in 95 minutes" is exact and still reads.
 */
export function formatUntil(at: Date, now: Date = new Date()): string {
  const minutes = Math.ceil((at.getTime() - now.getTime()) / 60_000);
  if (minutes < 1) return "in under a minute";
  return `in ${minutes} ${plural(minutes, "minute")}`;
}

/**
 * A closing window: "80 min left", or null once it has closed. Minutes throughout, because the
 * windows this measures are under two hours and "1 h left" hides that 61 minutes remain.
 */
export function formatMinutesLeft(deadline: Date, now: Date = new Date()): string | null {
  const minutes = Math.ceil((deadline.getTime() - now.getTime()) / 60_000);
  return minutes >= 1 ? `${minutes} min left` : null;
}
