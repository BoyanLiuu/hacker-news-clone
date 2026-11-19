import Link from "next/link";
import { CFG } from "@/lib/config";
import { formatAgeLong, formatCount } from "@/lib/format";
import { countDescendants } from "@/lib/tree";
import type { CommentNode as Node } from "@/lib/types";
import { CollapseToggle } from "./collapse-toggle";
import { CommentBody } from "./comment-body";
import { CommentVotes } from "./comment-votes";
import { dimFor } from "@/lib/dim";

type Ctx = {
  /** The post's author, so their replies get the OP chip. */
  opAuthor: string;
  viewerName: string | null;
  /** Comment downvotes unlock at a karma threshold — debrief §4. */
  canDownvote: boolean;
  /** New accounts cannot flag, so the control is not offered at all — debrief §6. */
  canFlag: boolean;
  /**
   * Whether to label shadow-banned rows. Moderators only, and deliberately not the author: a
   * shadow ban that announces itself to the person banned is just a slow ban.
   */
  isModerator: boolean;
  /** Depth the rendering started at, so a permalink view does not re-cap immediately. */
  baseDepth: number;
  /** This viewer's standing votes on the comments in this thread, by comment id. */
  voted: ReadonlyMap<number, 1 | -1>;
};

/**
 * One comment and its replies, rendered recursively on the server.
 *
 * Depth is capped visually, not structurally: past the cap the subtree is replaced by a link to the
 * comment's own permalink, so indentation can never break the 375 px layout no matter how deep the
 * argument goes.
 */
export function CommentTree({ nodes, ctx }: { nodes: Node[]; ctx: Ctx }) {
  return (
    <>
      {nodes.map((node) => (
        <CommentArticle key={node.id} node={node} ctx={ctx} />
      ))}
    </>
  );
}

function CommentArticle({ node, ctx }: { node: Node; ctx: Ctx }) {
  const relativeDepth = node.depth - ctx.baseDepth;
  const atCap = relativeDepth >= CFG.depthCap;
  const hidden = countDescendants(node);
  const own = ctx.viewerName !== null && node.author === ctx.viewerName;
  const deleted = node.isDeleted;

  // A deleted comment with replies stays as [deleted] so its children survive; a childless one
  // would be removed at the source. Debrief §3.
  return (
    <article id={`c${node.id}`} data-comment={node.id} className="comment-row pt-3">
      <div className="flex items-start gap-2">
        {/* The vote column hides when collapsed — you cannot vote on what you cannot read. */}
        <div className="collapsible flex w-[26px] shrink-0 flex-col items-center">
          {deleted ? null : (
            <CommentVotes
              id={node.id}
              author={node.author}
              own={own}
              canDownvote={ctx.canDownvote}
              signedIn={ctx.viewerName !== null}
              voted={ctx.voted.get(node.id)}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 type-meta text-meta">
            <CollapseToggle id={node.id} hidden={hidden} />

            {deleted ? (
              <span className="italic">[deleted]</span>
            ) : (
              <Link href={`/user/${node.author}`} className="font-semibold text-ink hover:underline">
                {node.author}
              </Link>
            )}

            {node.author === ctx.opAuthor && !deleted ? (
              <span className="rounded-hair border border-rule px-1 text-[11.5px] font-semibold">OP</span>
            ) : null}

            {/* Why a moderator can see a row nobody else can. Without it, hidden content reads as
                public content and gets replied to in the open. */}
            {node.isShadow && ctx.isModerator ? (
              <span className="font-semibold text-amber">
                shadow-banned · only the author and moderators see this
              </span>
            ) : null}

            <span>{formatAgeLong(node.createdAt)}</span>

            {/* You see the score on your own comments only — matching HN, and stated in the debrief. */}
            {own ? <span className="text-petrol-ink">{formatCount(node.scoreRaw)} points</span> : null}

            {node.parentId !== null ? (
              <Link href={`/reply?id=${node.parentId}`} className="hover:underline">
                parent
              </Link>
            ) : null}

            {node.isDead ? <span className="text-red">dead</span> : null}
          </div>

          <div className="collapsible">
            {deleted ? null : <CommentBody text={node.text} className={`mt-1 ${dimFor(node.scoreRaw)}`} />}

            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 type-meta text-meta">
              <Link href={`/reply?id=${node.id}`} className="hover:underline">
                reply
              </Link>
              {own || deleted || !ctx.canFlag ? null : <span>flag</span>}
            </div>
          </div>
        </div>
      </div>

      {node.children.length > 0 ? (
        <div className="collapsible comment-children mt-1">
          {atCap ? (
            <Link
              href={`/reply?id=${node.id}`}
              className="inline-block py-2 text-[13px] font-semibold text-petrol-ink hover:underline"
            >
              continue this thread → {hidden} more {hidden === 1 ? "reply" : "replies"}
            </Link>
          ) : (
            <CommentTree nodes={node.children} ctx={ctx} />
          )}
        </div>
      ) : null}
    </article>
  );
}
