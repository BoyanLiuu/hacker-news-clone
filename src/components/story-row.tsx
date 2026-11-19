"use client";

import Link from "next/link";
import { useActionState } from "react";
import { formatAge, formatCount, formatUtcTime } from "@/lib/format";
import type { StoryRowData } from "@/lib/rows";
import { castVote } from "@/services/vote-action";
import { OwnItemMark, SignInArrow, VoteForm, voteState } from "./vote-button";

/**
 * One ranked-list row, two lines on the five-track grid.
 *
 * Every listing uses this unchanged — /, /newest and /from differ only in the order they pass rows
 * in and which points value they pass, so the row needs no variants and no boolean modes.
 *
 * A client component since M11, which is a deliberate reversal: M6 kept the whole listing
 * server-rendered and said so. The reason is `data-vote`, which DESIGN.md puts on the row — the
 * wash covers the whole line, not the glyph — and an attribute on the `<li>` can only be set by
 * whoever renders the `<li>`. The cost was measured rather than assumed: see the commit.
 */
export function StoryRow({
  rank,
  points,
  post,
  viewerName,
  canFlag,
  voted,
  canEdit,
}: StoryRowData & {
  viewerName: string | null;
  /** New accounts cannot flag, so the control is not offered — the same rule the thread applies. */
  canFlag: boolean;
  /** This viewer's standing vote on this post, loaded with the page. Posts take upvotes only. */
  voted?: boolean;
  /** Whether the edit window is still open, decided by the server rather than read off the clock. */
  canEdit?: boolean;
}) {
  const [result, voteAction, pending] = useActionState(castVote, undefined);

  const own = viewerName !== null && post.author === viewerName;
  // Dead rows dim their title and figures to dim3; everything else keeps its normal ink.
  const dead = post.isDead;
  const titleInk = dead ? "text-dim-3" : "text-ink";
  const metaInk = dead ? "text-dim-3" : "text-meta";

  // `standing` is the state M6's URL preview could not express: a vote from an earlier session,
  // which fills its glyph without washing the row. See `voteState`.
  const state = voteState({ pending, result, voted: Boolean(voted) });

  // The server's number is authoritative once it answers; `points` is the page's own read.
  const shown = result?.ok ? result.points : points;
  const stillVoted = result?.ok ? result.voted : voted;

  return (
    <li
      data-vote={state}
      className="grid grid-cols-[26px_28px_1fr] items-start gap-x-3 px-1 py-[7px] rule-divide hover:bg-hover focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-petrol sm:grid-cols-[30px_70px_1fr_52px_74px]"
    >
      <span className={`type-meta pt-[3px] text-right ${metaInk}`}>{rank}</span>

      {/* The vote control and the count share one track on desktop; the count moves to the meta
          line on phones, where the track is only wide enough for the button. */}
      <span className="flex items-start gap-2 sm:justify-end">
        {own || viewerName === null ? (
          <>
            {own ? <OwnItemMark /> : <SignInArrow label={post.title} />}
            <span
              className={`vote-points hidden pt-[4px] text-right text-[15px] font-semibold tabular-nums sm:block ${titleInk}`}
            >
              {formatCount(shown)}
            </span>
          </>
        ) : (
          <VoteForm
            type="post"
            id={post.id}
            label={post.title}
            direction={1}
            action={voteAction}
            points={shown}
            format={formatCount}
            tone={titleInk}
          />
        )}
      </span>

      <span className="min-w-0">
        {/* Inline flow, not flex: the domain has to follow the title's last line, as the design
            shows. A flex row makes the long title fill the line and pushes the domain below it. */}
        <span className="type-story">
          {post.url ? (
            <a href={post.url} className={`${titleInk} visited:text-visited`}>
              {post.title}
            </a>
          ) : (
            <Link href={`/item?id=${post.id}`} className={`${titleInk} visited:text-visited`}>
              {post.title}
            </Link>
          )}
          {post.domain ? (
            <>
              {" "}
              <Link
                href={`/from?site=${post.domain}`}
                className="type-meta whitespace-nowrap text-meta hover:underline"
              >
                {post.domain}
              </Link>
            </>
          ) : null}
        </span>

        {/* Tags are coloured words, not chips — DESIGN.md §Ranked List Rows. */}
        <span className="mt-[6px] flex flex-wrap items-baseline gap-x-3 type-meta text-meta">
          <span>
            by{" "}
            {own ? (
              <span className="text-ink-2">you</span>
            ) : (
              <Link href={`/user/${post.author}`} className="text-ink-2 hover:underline">
                {post.author}
              </Link>
            )}
          </span>
          <span className="sm:hidden">
            <span className="vote-points">{formatCount(shown)}</span> points
          </span>
          <span className="sm:hidden">{formatAge(post.createdAt)}</span>
          <span className="sm:hidden">
            {post.commentCount === 0
              ? "discuss"
              : `${formatCount(post.commentCount)} ${post.commentCount === 1 ? "comment" : "comments"}`}
          </span>
          {dead ? <span className="text-red">dead</span> : null}
          {/* A link only while the window is open; the thread's header shows the countdown and
              the action re-checks the window regardless. `canEdit` is decided on the server — see
              `editWindow` for why a component must not read the clock itself. */}
          {own && canEdit ? (
            <Link href={`/edit?id=${post.id}`} className="hover:underline">
              edit
            </Link>
          ) : null}
          {!own && canFlag ? <span>flag</span> : null}
          {/* Delete is offered only while nothing is attached to the post — once someone has
              replied, removing it would take their comment with it. Debrief §1. */}
          {own && post.commentCount === 0 ? <span>delete</span> : null}

          {/* Undoing posts the same arrow again, which the action reads as taking the vote back
              while the grace window is open. A second form, because it is a second submission. */}
          {stillVoted && !own && viewerName !== null ? (
            <UnvoteForm postId={post.id} title={post.title} action={voteAction} />
          ) : null}

          {/* The receipt. Mono, because it is a machine fact and the only timestamp in a row. */}
          {result?.ok && result.voted ? (
            <span className="rounded-hair bg-tint px-[5px] font-mono text-[11.5px] text-petrol-ink">
              saved {formatUtcTime(new Date(result.savedAt))}
            </span>
          ) : null}
        </span>

        {/* Rollback sits under the byline rather than replacing anything: the row has gone back to
            the number it had, so the only new information is why, and what to do about it. */}
        {result && !result.ok ? (
          <p role="alert" className="mt-[6px] flex flex-wrap items-baseline gap-x-[6px] type-meta text-amber">
            <span aria-hidden="true" className="translate-y-[2px]">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M8 2 L15 14 H1 Z" strokeLinejoin="round" />
                <path d="M8 6.5 V9.5" strokeLinecap="round" />
                <circle cx="8" cy="11.6" r="0.7" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span>{result.error} Your vote was undone.</span>
            <RetryForm postId={post.id} title={post.title} action={voteAction} />
          </p>
        ) : null}
      </span>

      <span className={`hidden type-meta pt-[3px] text-right sm:block ${metaInk}`}>
        {formatAge(post.createdAt)}
      </span>

      <span className="hidden pt-[2px] text-right type-meta sm:block">
        <Link href={`/item?id=${post.id}`} className={dead ? "text-dim-3" : "text-ink-2 hover:underline"}>
          {post.commentCount > 0 ? formatCount(post.commentCount) : "discuss"}
        </Link>
      </span>
    </li>
  );
}

/** A bare submit styled as the meta-line text around it, so the row keeps one voice. */
function MetaSubmit({ children, label }: { children: string; label: string }) {
  return (
    <button type="submit" aria-label={label} className="underline-offset-2 hover:underline">
      {children}
    </button>
  );
}

function UnvoteForm({
  postId,
  title,
  action,
}: {
  postId: number;
  title: string;
  action: (form: FormData) => void;
}) {
  return (
    <form action={action} className="contents">
      <input type="hidden" name="type" value="post" />
      <input type="hidden" name="id" value={postId} />
      <input type="hidden" name="direction" value={1} />
      <MetaSubmit label={`Remove your upvote from ${title}`}>unvote</MetaSubmit>
    </form>
  );
}

function RetryForm({
  postId,
  title,
  action,
}: {
  postId: number;
  title: string;
  action: (form: FormData) => void;
}) {
  return (
    <form action={action} className="contents">
      <input type="hidden" name="type" value="post" />
      <input type="hidden" name="id" value={postId} />
      <input type="hidden" name="direction" value={1} />
      <button
        type="submit"
        className="font-semibold text-amber underline underline-offset-2"
        aria-label={`Retry voting on ${title}`}
      >
        Retry
      </button>
    </form>
  );
}
