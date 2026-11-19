import { CFG, MINUTE } from "./config";

/**
 * Whether a post can still be edited, and how long is left.
 *
 * `now` is a parameter so the clock is never read during a render: a component that does hydrates
 * against a different minute than the server used, which renders a closed window as open for one
 * paint. eslint's `react-hooks/purity` rule enforces it.
 *
 * Advisory only — `editPost` re-checks against the same `CFG.editMinutes`, because the action is
 * reachable without the page that hides the link.
 */
export function editWindow(createdAt: Date, now: number = Date.now()): { open: boolean; closesAt: Date } {
  const closesAt = new Date(createdAt.getTime() + CFG.editMinutes * MINUTE);
  return { open: now < closesAt.getTime(), closesAt };
}
