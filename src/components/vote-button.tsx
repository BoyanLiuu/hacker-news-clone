"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import type { ItemType } from "@/lib/types";
import type { VoteResult } from "@/services/vote-action";

/**
 * The vote triangle: a bare 26 px button holding a 12 px glyph drawn as a 1.5 px stroke in meta ink.
 * On hover the arrow turns ink over a 7% petrol wash. DESIGN.md §Vote Button.
 *
 * `fill="transparent"`, not `fill="none"`: `none` is not a colour and cannot interpolate, so the
 * stroke stepped over 120 ms while the fill snapped at 0 ms.
 */
export function Glyph({ down }: { down?: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={down ? "rotate-180" : undefined}>
      <path
        d="M6 2 L11 10 L1 10 Z"
        fill="transparent"
        stroke="currentColor"
        strokeWidth="1.5"
        className="vote-glyph text-meta group-hover:text-ink"
      />
    </svg>
  );
}

/**
 * Disabled while its own form is in flight, so the same arrow cannot be clicked twice before the
 * first click answers. The composite key already makes a duplicate harmless on the server; this is
 * about not showing the voter two outcomes for one intent.
 *
 * `useFormStatus` reads the enclosing form, which is why this is a child of it rather than the form
 * itself — the hook returns nothing for the component that renders the `<form>`.
 */
function Submit({ label, down }: { label: string; down?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`${down ? "Downvote" : "Upvote"} ${label}`}
      className="vote-pad group flex size-[26px] items-center justify-center rounded-soft hover:bg-petrol/7 disabled:cursor-default"
    >
      <Glyph down={down} />
    </button>
  );
}

/**
 * The score, showing what it *would* become while the vote is in flight.
 *
 * The optimistic value comes from `useFormStatus().data` — the FormData React is currently
 * submitting — rather than from `useOptimistic`. `useOptimistic` would need its setter called inside
 * the action, which means wrapping `formAction` in a client closure, and a closure is not a Server
 * Action reference, so the form stops working with JavaScript disabled. Both requirements sit on the
 * same checklist line, and the no-JS one cannot be faked. This owns no state and so cannot go stale.
 */
function Points({
  points,
  format,
  tone,
}: {
  points: number;
  format: (n: number) => string;
  tone: string;
}) {
  const { data } = useFormStatus();
  const inFlight = data ? Number(data.get("direction")) : 0;

  return (
    <span
      className={`vote-points hidden pt-[4px] text-right text-[15px] font-semibold tabular-nums sm:block ${tone}`}
    >
      {format(points + inFlight)}
    </span>
  );
}

/**
 * One arrow, as a real form posting to a Server Action, with the score beside it.
 *
 * A form and not an `onClick` because voting has to work with JavaScript disabled: without JS this
 * is a POST that re-renders the page, and with JS React submits it in place. The hidden fields carry
 * what the server needs; it trusts none of them, and re-derives the voter from the session.
 *
 * The score lives *inside* the form because that is the only way it can see the submission: both
 * `useFormStatus` readers have to be children of the form they are reporting on.
 */
export function VoteForm({
  type,
  id,
  label,
  direction,
  action,
  points,
  format,
  tone = "text-ink",
}: {
  type: ItemType;
  id: number;
  label: string;
  direction: 1 | -1;
  action: (form: FormData) => void;
  /** Omitted on comments, whose score is shown only to their author — who cannot vote on it. */
  points?: number;
  format?: (n: number) => string;
  /** The row's ink. A dead row dims its figures to dim-3, and the points must dim with them. */
  tone?: string;
}) {
  return (
    <form action={action} className="flex items-start gap-2">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <Submit label={label} down={direction === -1} />
      {points !== undefined && format ? <Points points={points} format={format} tone={tone} /> : null}
    </form>
  );
}

/**
 * Signed out, the arrow is a link to sign in rather than a disabled button: a dead control that
 * looks live is the worse of the two, and this is also what tells someone *why* they cannot vote.
 *
 * Shared, because the same triangle had been written out three times — here, in the listing row and
 * above a thread — and three copies of one path is three places for the design to drift.
 */
export function SignInArrow({ label }: { label: string }) {
  return (
    <Link
      href="/sign-in"
      aria-label={`Sign in to upvote ${label}`}
      className="vote-pad group flex size-[26px] items-center justify-center rounded-soft hover:bg-petrol/7"
    >
      <Glyph />
    </Link>
  );
}

/**
 * Your own item gets a 7 px petrol square instead of an arrow — you cannot vote for yourself, so
 * there is nothing to offer. The server refuses it too; this only avoids offering it.
 */
export function OwnItemMark() {
  return (
    <span className="flex size-[26px] items-center justify-center" title="Your own submission">
      <span aria-hidden="true" className="size-[7px] bg-petrol" />
      <span className="sr-only">Your own submission</span>
    </span>
  );
}

/**
 * Which of the five `data-vote` states a control is in. Shared, because getting it wrong is easy
 * and was: the first version read "the action succeeded" as `confirmed`, so taking a vote back left
 * the glyph filled petrol while the count fell — the row said the vote was still there.
 *
 * `confirmed` therefore means *a vote now stands, and you just cast it*. A withdrawn vote has no
 * state at all: it should look exactly as it did before you clicked, because that is what undoing
 * is. `failed` is for a vote that did not save, which is a different thing from one you removed.
 */
export function voteState({
  pending,
  result,
  voted,
}: {
  pending: boolean;
  result: VoteResult | undefined;
  voted: boolean;
}): "pending" | "confirmed" | "failed" | "standing" | undefined {
  if (pending) return "pending";
  if (!result) return voted ? "standing" : undefined;
  if (!result.ok) return "failed";
  return result.voted ? "confirmed" : undefined;
}
