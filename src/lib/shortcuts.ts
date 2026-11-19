/**
 * The keyboard shortcuts, in one place that both sides of the client boundary can read.
 *
 * Here and not in `keyboard-nav.tsx` because that file is `"use client"`, and a plain value exported
 * from a client module becomes a client *reference*: the footer hint is a server component, and
 * importing this from there turned every page into a 500 with
 * `TypeError: SHORTCUTS.filter is not a function`.
 *
 * That is the third time this project has shipped that shape — `TITLE_MAX` in M5, `toRows` in M11,
 * this in M15 — and each time `tsc`, `eslint` and `next build` all passed, because it only fails
 * when the code runs. AGENTS.md carries the rule. It did not stop it happening again, so the rule
 * now names this file as the place such values go.
 *
 * `long` is the dialog's wording, which has room for a sentence; `short` is the footer's, which has
 * room for a word and matches the comps' `j k move · u vote · x collapse · ?`. `comments` marks the
 * keys that only do something in a thread.
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
