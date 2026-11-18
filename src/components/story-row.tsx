import Link from "next/link";
import { formatAge, formatCount } from "@/lib/format";
import type { Post } from "@/lib/types";
import { VoteButton } from "./vote-button";

/**
 * One ranked-list row, two lines on the five-track grid.
 *
 * Every listing uses this unchanged — /, /newest, /from and /front/:date differ only in the order
 * they pass rows in and which points value they pass, so the row needs no variants and no boolean
 * modes. `points` is separate from `post.scoreRaw` because a past front page shows back-projected
 * points for that day.
 */
export type StoryRowData = {
  rank: number;
  points: number;
  post: Post;
};

/**
 * What a vote looks like mid-flight, settled, or undone. Presentation only: every visual is CSS
 * keyed on `data-vote` (globals.css), and `points` above is whatever should be shown — the caller
 * owns the optimistic arithmetic, because M11's `useOptimistic` is the thing that will own it.
 */
export type VoteState = {
  state: "pending" | "confirmed" | "failed";
  /** `hh:mm:ss`, formatted on the server. The confirmed stamp; absent in the other two states. */
  savedAt?: string;
  /**
   * Where `Retry` goes, for the `failed` state. Supplied by the caller because the row does not know
   * which listing it is on, the same reason it does not do the optimistic arithmetic.
   *
   * It is a link and not a span because the design underlines it, and in this design an underline
   * means a control. An underlined word that does nothing is worse than no word: every other
   * not-yet-wired affordance here — `flag`, `edit`, `unvote` — is a bare span precisely so it does
   * not promise a click. M11 makes this the form submit that re-posts the vote.
   */
  retryHref?: string;
};

/**
 * Numbers rows continuously across pages, so page 2 starts at 31 rather than 1. Every listing needs
 * this and they had each been doing the arithmetic inline.
 */
export function toRows<T>(
  items: readonly T[],
  { page, pageSize }: { page: number; pageSize: number },
  unpack: (item: T) => { points: number; post: Post },
): StoryRowData[] {
  return items.map((item, i) => ({ rank: (page - 1) * pageSize + i + 1, ...unpack(item) }));
}

export function StoryRow({
  rank,
  points,
  post,
  viewerName,
  canFlag,
  vote,
}: StoryRowData & {
  viewerName: string | null;
  /** New accounts cannot flag, so the control is not offered — the same rule the thread applies. */
  canFlag: boolean;
  vote?: VoteState;
}) {
  const own = viewerName !== null && post.author === viewerName;
  const voted = vote?.state === "pending" || vote?.state === "confirmed";
  // Dead rows dim their title and figures to dim3; everything else keeps its normal ink.
  const dead = post.isDead;
  const titleInk = dead ? "text-dim-3" : "text-ink";
  const metaInk = dead ? "text-dim-3" : "text-meta";

  return (
    <li
      data-vote={vote?.state}
      className="grid grid-cols-[26px_28px_1fr] items-start gap-x-3 px-1 py-[7px] rule-divide hover:bg-hover focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-petrol sm:grid-cols-[30px_70px_1fr_52px_74px]"
    >
      <span className={`type-meta pt-[3px] text-right ${metaInk}`}>{rank}</span>

      {/* The vote control and the count share one track on desktop; the count moves to the meta
          line on phones, where the track is only wide enough for the button. */}
      <span className="flex items-start gap-2 sm:justify-end">
        <VoteButton label={post.title} own={own} />
        <span
          className={`vote-points hidden pt-[4px] text-right text-[15px] font-semibold tabular-nums sm:block ${titleInk}`}
        >
          {formatCount(points)}
        </span>
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
            <Link
              href={`/item?id=${post.id}`}
              className={`${titleInk} visited:text-visited`}
            >
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
            <span className="vote-points">{formatCount(points)}</span> points
          </span>
          <span className="sm:hidden">{formatAge(post.createdAt)}</span>
          <span className="sm:hidden">
            {post.commentCount === 0
              ? "discuss"
              : `${formatCount(post.commentCount)} ${post.commentCount === 1 ? "comment" : "comments"}`}
          </span>
          {dead ? <span className="text-red">dead</span> : null}
          {own ? <span>edit</span> : null}
          {!own && canFlag ? <span>flag</span> : null}
          {/* Delete is offered only while nothing is attached to the post — once someone has
              replied, removing it would take their comment with it. Debrief §1. */}
          {own && post.commentCount === 0 ? <span>delete</span> : null}

          {/* Undoing is offered the moment the vote shows, not after it settles — the whole point
              of an optimistic update is that the row is already acting as though it worked. */}
          {voted ? <span>unvote</span> : null}

          {/* The receipt. Mono, because it is a machine fact and the only timestamp in a row. */}
          {vote?.state === "confirmed" && vote.savedAt ? (
            <span className="rounded-hair bg-tint px-[5px] font-mono text-[11.5px] text-petrol-ink">
              saved {vote.savedAt}
            </span>
          ) : null}
        </span>

        {/* Rollback sits under the byline rather than replacing anything: the row has gone back to
            the number it had, so the only new information is why, and what to do about it. */}
        {vote?.state === "failed" ? (
          <p role="alert" className="mt-[6px] flex flex-wrap items-baseline gap-x-[6px] type-meta text-amber">
            <span aria-hidden="true" className="translate-y-[2px]">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M8 2 L15 14 H1 Z" strokeLinejoin="round" />
                <path d="M8 6.5 V9.5" strokeLinecap="round" />
                <circle cx="8" cy="11.6" r="0.7" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span>
              Vote not saved — the server didn&rsquo;t answer. Your vote was undone.
            </span>
            {vote.retryHref ? (
              <Link
                href={vote.retryHref}
                className="font-semibold text-amber underline underline-offset-2"
              >
                Retry
              </Link>
            ) : null}
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
