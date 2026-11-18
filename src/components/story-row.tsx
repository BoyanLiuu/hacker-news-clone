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

export function StoryRow({ rank, points, post, viewerName }: StoryRowData & { viewerName: string | null }) {
  const own = viewerName !== null && post.author === viewerName;
  // Dead rows dim their title and figures to dim3; everything else keeps its normal ink.
  const dead = post.isDead;
  const titleInk = dead ? "text-dim-3" : "text-ink";
  const metaInk = dead ? "text-dim-3" : "text-meta";

  return (
    <li className="grid grid-cols-[26px_28px_1fr] items-start gap-x-3 px-1 py-[7px] rule-divide hover:bg-hover focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-petrol sm:grid-cols-[30px_70px_1fr_52px_74px]">
      <span className={`type-meta pt-[3px] text-right ${metaInk}`}>{rank}</span>

      {/* The vote control and the count share one track on desktop; the count moves to the meta
          line on phones, where the track is only wide enough for the button. */}
      <span className="flex items-start gap-2 sm:justify-end">
        <VoteButton label={post.title} own={own} />
        <span
          className={`hidden pt-[4px] text-right text-[15px] font-semibold tabular-nums sm:block ${titleInk}`}
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
          <span className="sm:hidden">{formatCount(points)} points</span>
          <span className="sm:hidden">{formatAge(post.createdAt)}</span>
          <span className="sm:hidden">
            {post.commentCount === 0
              ? "discuss"
              : `${formatCount(post.commentCount)} ${post.commentCount === 1 ? "comment" : "comments"}`}
          </span>
          {dead ? <span className="text-red">dead</span> : null}
          {own ? <span>edit</span> : <span>flag</span>}
          {/* Delete is offered only while nothing is attached to the post — once someone has
              replied, removing it would take their comment with it. Debrief §1. */}
          {own && post.commentCount === 0 ? <span>delete</span> : null}
        </span>
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
