import Link from "next/link";
import { CFG, MINUTE } from "@/lib/config";
import { formatAgeLong, formatCount, formatMinutesLeft } from "@/lib/format";
import type { Post } from "@/lib/types";
import { CommentBody } from "./comment-body";
import { DeleteConfirm } from "./delete-confirm";
import { PostVotes } from "./post-votes";

/**
 * The story at the top of a thread: headline at 24 px, the domain inline, then one meta line of
 * facts. Closed by a 1 px ink rule, which separates it from the discussion below.
 */
export function PostHeader({
  post,
  viewerName,
  canFlag,
  confirmingDelete = false,
  voted = false,
}: {
  post: Post;
  viewerName: string | null;
  /** New accounts cannot flag, so the control is not offered — debrief §6, via `getViewer`. */
  canFlag: boolean;
  confirmingDelete?: boolean;
  /** This viewer's standing upvote on this post. */
  voted?: boolean;
}) {
  const own = viewerName !== null && post.author === viewerName;
  const editLeft = own ? formatMinutesLeft(new Date(post.createdAt.getTime() + CFG.editMinutes * MINUTE)) : null;
  // Deleting is offered only while nothing is attached: once someone has replied, the thread is
  // theirs too. Stated in the rules aside on /submit, enforced in the action in M12.
  const canDelete = own && post.commentCount === 0;

  return (
    <header className="rule-close pb-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 pt-1">
          <PostVotes id={post.id} title={post.title} own={own} signedIn={viewerName !== null} voted={voted} />
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

            {own ? (
              // The window is stated rather than discovered, so you know before you start typing.
              <span>{editLeft ? `edit (${editLeft})` : "edit closed"}</span>
            ) : null}
            {canDelete ? (
              <Link
                href={`/item?id=${post.id}&confirm=delete`}
                scroll={false}
                className="hover:underline"
              >
                delete
              </Link>
            ) : null}
            {!own && canFlag ? <span>flag</span> : null}

            <span>
              {formatCount(post.commentCount)} {post.commentCount === 1 ? "comment" : "comments"}
            </span>
            {post.isDead ? <span className="text-red">dead</span> : null}
          </p>
        </div>
      </div>

      {confirmingDelete && canDelete ? <DeleteConfirm postId={post.id} /> : null}

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
