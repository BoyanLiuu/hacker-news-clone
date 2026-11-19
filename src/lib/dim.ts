/**
 * How far a low-scored comment fades, on the four-step ink ramp. A score is shown to its author
 * alone, so for everyone else this is the only signal a comment was voted down.
 *
 * Fading starts *below* 1, not at it: every comment begins at 1, and the imported dataset has
 * 134 459 of them sitting at exactly 1 because Algolia returns no per-comment points. Dimming at
 * `>= 1` would grey out every thread and say nothing.
 *
 * All four tokens clear 4.5:1 on paper — the ramp dims, it never fails contrast.
 */
export function dimFor(score: number): string {
  if (score >= 1) return "text-ink-2";
  if (score === 0) return "text-dim-1";
  if (score >= -3) return "text-dim-2";
  return "text-dim-3";
}
