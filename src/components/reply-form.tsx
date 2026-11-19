"use client";

import { useActionState } from "react";
import { createComment } from "@/services/comment-actions";
import { Notice } from "./notice";

/**
 * The reply box, posting to `createComment`.
 *
 * No `onSubmit`: the browser's own `required` and `maxLength` cover the only two client checks
 * worth making, and the action re-checks both with `validateComment`. `useActionState` keeps the
 * form working with JavaScript disabled.
 *
 * `kind` tells the action which table `id` names. It is a routing hint and not a permission — the
 * action still has to find the row — but without it the id is ambiguous, because `Post` and
 * `Comment` have separate sequences and can issue the same number.
 *
 * `elementId` is a prop rather than a constant because a thread can carry more than one reply box:
 * two forms sharing one element id would point both labels at the first textarea.
 */
export function ReplyForm({
  targetId,
  kind = "post",
  label = "Add to the discussion",
  submit = "Add comment",
  elementId = "reply-text",
}: {
  /** The post or parent comment this reply belongs to. */
  targetId: number;
  kind?: "post" | "comment";
  label?: string;
  submit?: string;
  elementId?: string;
}) {
  const [state, action, pending] = useActionState(createComment, undefined);

  return (
    <form action={action} className="mt-4 max-w-[795px]">
      <input type="hidden" name="id" value={targetId} />
      <input type="hidden" name="kind" value={kind} />

      {state ? <Notice tone="red">{state.error}</Notice> : null}

      <label className="sr-only" htmlFor={elementId}>
        {label}
      </label>
      <textarea
        id={elementId}
        name="text"
        rows={4}
        required
        maxLength={10_000}
        placeholder={label}
        defaultValue={state?.text ?? ""}
        className="w-full rounded-hair border border-field bg-white px-[10px] py-2 text-[15px] caret-petrol placeholder:text-meta hover:border-field-hover focus:border-petrol focus:shadow-[0_0_0_2px_rgba(0,100,110,.22)] focus:outline-none"
      />

      <button
        type="submit"
        disabled={pending}
        className="mt-3 inline-flex h-9 items-center rounded-hair bg-ink px-4 text-[14px] font-semibold text-paper hover:bg-ink-hover disabled:bg-disabled disabled:text-disabled-ink"
      >
        {pending ? "Posting…" : submit}
      </button>

      {/* States what the formatter actually supports, including that HTML is not markup. */}
      <p className="mt-3 max-w-[70ch] text-[12.5px] leading-[1.5] text-meta">
        Blank line for a new paragraph · <code className="font-mono">*italics*</code> ·{" "}
        <code className="font-mono">`code`</code> · indent two spaces for a block · links work · HTML shows
        as text
      </p>
    </form>
  );
}
