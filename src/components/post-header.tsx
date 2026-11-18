import Link from "next/link";
import { formatAgeLong, formatCount } from "@/lib/format";
import type { Post } from "@/lib/types";
import { CommentBody } from "./comment-body";
import { VoteButton } from "./vote-button";

/**
 * The story at the top of a thread: headline at 24 px, the domain inline, then one meta line of
 * facts. Closed by a 1 px ink rule, which separates it from the discussion below.
 */
export function PostHeader({ post, viewerName }: { post: Post; viewerName: string | null }) {
  const own = viewerName !== null && post.author === viewerName;

  return (
    <header className="rule-close pb-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 pt-1">
          <VoteButton label={post.title} own={own} />
        </div>

        <div className="min-w-0">
          <h1 tabIndex={-1} className="type-headline max-sm:text-[20px]">
            {post.url ? (
              <a href={post.url} className="text-ink visited:text-visited">
                {post.title}
              </a>
            ) : (
              post.title
            )}
            {post.domain ? (
              <>
                {" "}
                <Link
                  href={`/from?site=${post.domain}`}
                  className="type-meta whitespace-nowrap font-normal text-meta hover:underline"
                >
                  {post.domain}
                </Link>
              </>
            ) : null}
          </h1>

          <p className="mt-2 flex flex-wrap items-baseline gap-x-3 type-meta text-meta">
            <span>
              <span className="font-semibold text-ink">{formatCount(post.scoreRaw)}</span> points
            </span>
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
            <span>{formatAgeLong(post.createdAt)}</span>
            {own ? <span>edit</span> : <span>flag</span>}
            <span>
              {post.commentCount === 0
                ? "discuss"
                : `${formatCount(post.commentCount)} ${post.commentCount === 1 ? "comment" : "comments"}`}
            </span>
            {post.isDead ? <span className="text-red">dead</span> : null}
          </p>
        </div>
      </div>

      {/* A text post's body sits under the meta line, aligned past the vote column. Story text caps
          at 68ch rather than a comment's 70ch — DESIGN.md §Typography. */}
      {post.text ? (
        <div className="mt-3 sm:pl-[38px]">
          <CommentBody text={post.text} className="max-w-[68ch] type-reading" />
        </div>
      ) : null}
    </header>
  );
}
