/**
 * The downvote is the same glyph rotated 180 degrees, and only appears on comments for a viewer
 * past the karma threshold. The gating itself is enforced server-side in M11; this decides whether
 * the control is offered at all.
 */
export function DownVoteButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      aria-label={`Downvote ${label}`}
      className="vote-pad group flex size-[26px] items-center justify-center rounded-soft hover:bg-petrol/7"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="rotate-180">
        <path
          d="M6 2 L11 10 L1 10 Z"
          fill="transparent"
          stroke="currentColor"
          strokeWidth="1.5"
          className="vote-glyph text-meta group-hover:text-ink"
        />
      </svg>
    </button>
  );
}

/**
 * A bare 26 px button holding a 12 px triangle drawn as a 1.5 px stroke in meta ink. On hover the
 * arrow turns ink over a 7% petrol wash. Your own items show a 7 px petrol square instead — you
 * cannot vote for yourself, so there is no arrow to offer.
 *
 * DESIGN.md §Vote Button. The four voted states are CSS, keyed on `data-vote` on the row — see
 * globals.css. This component contributes the two hooks they need, `vote-pad` on the button and
 * `vote-glyph` on the triangle, and is otherwise a server-rendered button with no state of its own.
 * M11 brings the action that sets the attribute.
 *
 * `fill="transparent"`, not `fill="none"`: `none` is not a colour and cannot interpolate, so the
 * stroke stepped over 120 ms while the fill snapped at 0 ms.
 */
export function VoteButton({ label, own }: { label: string; own: boolean }) {
  if (own) {
    return (
      <span className="flex size-[26px] items-center justify-center" title="Your own submission">
        <span aria-hidden="true" className="size-[7px] bg-petrol" />
        <span className="sr-only">Your own submission</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Upvote ${label}`}
      className="vote-pad group flex size-[26px] items-center justify-center rounded-soft hover:bg-petrol/7"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M6 2 L11 10 L1 10 Z"
          fill="transparent"
          stroke="currentColor"
          strokeWidth="1.5"
          className="vote-glyph text-meta group-hover:text-ink"
        />
      </svg>
    </button>
  );
}
