/**
 * The keyboard shortcuts, in one place both sides of the client boundary can read.
 *
 * Here and not in `keyboard-nav.tsx`, which is `"use client"`: the footer hint is a server
 * component, and importing a value from a client module gives you a client *reference* and a 500 at
 * runtime with a clean build. Same trap as `rows.ts`; see AGENTS.md.
 *
 * `long` is the dialog's wording, `short` the footer's. `comments` marks keys that only act in a
 * thread.
 */
export const SHORTCUTS: {
  keys: string[];
  long: string;
  short: string;
  comments?: true;
}[] = [
  { keys: ["j", "k"], long: "Move the cursor between rows", short: "move" },
  { keys: ["u"], long: "Upvote the row under the cursor", short: "vote" },
  { keys: ["x"], long: "Collapse the comment under the cursor", short: "collapse", comments: true },
  { keys: ["?"], long: "This list", short: "keys" },
];
