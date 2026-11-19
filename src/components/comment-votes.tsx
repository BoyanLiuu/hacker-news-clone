"use client";

import { useActionState } from "react";
import { castVote } from "@/services/vote-action";
import { OwnItemMark, VoteForm, voteState } from "./vote-button";

/**
 * The vote column for one comment: an up arrow, and a down arrow for a viewer past the karma
 * threshold.
 *
 * A client island per comment rather than a client `CommentTree`, which is the whole reason this
 * file exists. The tree renders recursively on the server and a thread can carry 400 nodes; making
 * the tree itself a client component would ship every comment body to the browser twice, once as
 * HTML and once as props. This ships one small component, instantiated per comment.
 *
 * `data-vote` goes on this wrapper and not on the comment, because for a comment only the glyph
 * reacts — the whole-row petrol wash in globals.css is scoped to `li`, which is the listing. A
 * thread with ten of your own votes in it should not look like ten rows you just clicked.
 *
 * No optimistic score here: a comment's score is shown to its author alone (Appendix A), and the
 * author cannot vote on their own comment. There is no number on screen to move.
 */
export function CommentVotes({
  id,
  author,
  own,
  canDownvote,
  signedIn,
  voted,
}: {
  id: number;
  author: string;
  own: boolean;
  canDownvote: boolean;
  signedIn: boolean;
  /** This viewer's standing vote, loaded with the thread. */
  voted?: 1 | -1;
}) {
  const [result, voteAction, pending] = useActionState(castVote, undefined);

  if (own) return <OwnItemMark />;
  // Signed out there is nothing to offer and nothing to gate: the header already says "Log in".
  if (!signedIn) return <span className="size-[26px]" />;

  const state = voteState({ pending, result, voted: Boolean(voted) });
  const label = `comment by ${author}`;

  return (
    <div data-vote={state} className="flex flex-col items-center">
      <VoteForm type="comment" id={id} label={label} direction={1} action={voteAction} />
      {canDownvote ? (
        <VoteForm type="comment" id={id} label={label} direction={-1} action={voteAction} />
      ) : null}

      {/* The refusal is shown, not swallowed. A vote that silently does nothing is the one failure
          mode worse than an error: you cannot tell it from a vote that worked. */}
      {result && !result.ok ? (
        <span role="alert" className="sr-only">
          {result.error}
        </span>
      ) : null}
    </div>
  );
}
