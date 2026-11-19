"use client";

import { useActionState } from "react";
import { castVote } from "@/services/vote-action";
import { OwnItemMark, SignInArrow, VoteForm, voteState } from "./vote-button";

/**
 * The single vote arrow above a thread's headline.
 *
 * Separate from the listing's control because the thread shows no number beside the arrow — the
 * points are in the meta line under the headline, outside this component and outside the form, so
 * there is nothing here for `useFormStatus` to update optimistically. The score corrects itself when
 * the action's `revalidatePath` re-renders the page, which on a thread is one row, not thirty.
 */
export function PostVotes({
  id,
  title,
  own,
  signedIn,
  voted,
}: {
  id: number;
  title: string;
  own: boolean;
  signedIn: boolean;
  voted: boolean;
}) {
  const [result, voteAction, pending] = useActionState(castVote, undefined);

  if (own) return <OwnItemMark />;

  if (!signedIn) return <SignInArrow label={title} />;

  const state = voteState({ pending, result, voted });

  return (
    <div data-vote={state}>
      <VoteForm type="post" id={id} label={title} direction={1} action={voteAction} />
      {result && !result.ok ? (
        <span role="alert" className="sr-only">
          {result.error}
        </span>
      ) : null}
    </div>
  );
}
