/**
 * How far a low-scored comment fades, on DESIGN.md's four-step ink ramp.
 *
 * Appendix A: a comment's score is shown to its author alone, so for everyone else this dimming is
 * the *only* signal that a comment was voted down. It therefore has to mean something specific.
 *
 * The thresholds start below 1, not at it, because 1 is where every comment begins — an unvoted
 * comment is not a bad one, and the imported dataset has 134 459 comments all sitting at exactly 1
 * (Algolia returns no per-comment points). Fading those would grey out every thread in the product
 * and say nothing. So only a comment that has been pushed to zero or below fades, which is also
 * what Hacker News does.
 *
 * All four tokens clear 4.5:1 on paper — the ramp dims, it never makes text fail contrast.
 */
export function dimFor(score: number): string {
  if (score >= 1) return "text-ink-2";
  if (score === 0) return "text-dim-1";
  if (score >= -3) return "text-dim-2";
  return "text-dim-3";
}
