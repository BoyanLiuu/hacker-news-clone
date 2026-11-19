import { CFG, MINUTE } from "./config";

/**
 * Whether a post can still be edited, and how long is left.
 *
 * A plain function rather than an expression inside a component, because `Date.now()` in a render
 * is impure — eslint's `react-hooks/purity` rule rejects it, and it is right to: a client component
 * that reads the clock while rendering can hydrate against a different minute than the server used,
 * which is how a closed window renders as open for one paint.
 *
 * The window is advisory here. `editPost` checks it again against the same `CFG.editMinutes`,
 * because the action is reachable without the page that hides the link.
 */
export function editWindow(createdAt: Date, now: number = Date.now()): { open: boolean; closesAt: Date } {
  const closesAt = new Date(createdAt.getTime() + CFG.editMinutes * MINUTE);
  return { open: now < closesAt.getTime(), closesAt };
}
