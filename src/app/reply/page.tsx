import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentTree } from "@/components/comment-node";
import { DatasheetTable } from "@/components/datasheet-table";
import { PageShell } from "@/components/page-shell";
import { ReplyForm } from "@/components/reply-form";
import { formatAgeLong } from "@/lib/format";
import { countDescendants, flatten } from "@/lib/tree";
import { getSubtree } from "@/services/comments";
import { getPostById } from "@/services/posts";
import { getViewer, getViewerOpts } from "@/services/viewer";
import { getViewerFlags } from "@/services/flags";
import { getVotes } from "@/services/votes";

type Search = Promise<{ id?: string }>;

/**
 * A comment permalink: the comment, its subtree, and a breadcrumb of ancestors so the reader can
 * see what it is replying to. This is where "continue this thread" lands when a subtree passes the
 * depth cap, so the tree re-roots here and depth starts counting again from this comment.
 *
 * The id is validated in the page body so the status is a real 404 — see item/page.tsx.
 */
export default async function ReplyPage({ searchParams }: { searchParams: Search }) {
  const id = Number((await searchParams).id);
  if (!Number.isInteger(id)) notFound();
  if (!(await getSubtree(id, await getViewerOpts()))) notFound();

  return (
    <PageShell rows="comments"
      nav=""
      aside={<PermalinkAside searchParams={searchParams} />}
    >
      {/* Awaited for the same reason as the thread: this page is mostly a reply form. */}
      <Permalink searchParams={searchParams} />
    </PageShell>
  );
}

async function Permalink({ searchParams }: { searchParams: Search }) {
  const [params, viewer, opts] = await Promise.all([searchParams, getViewer(), getViewerOpts()]);
  const id = Number(params.id);
  const found = await getSubtree(id, opts);
  if (!found) notFound();

  const { ancestors, node } = found;
  // Independent of each other, so one round trip rather than two — the subtree is already loaded.
  const subtreeIds = flatten([node]).map((n) => n.id);
  const [post, commentVotes, commentFlags] = await Promise.all([
    getPostById(node.postId, opts),
    getVotes("comment", subtreeIds),
    getViewerFlags("comment", subtreeIds),
  ]);

  return (
    <>
      {/* The breadcrumb is the context a permalink would otherwise lose. */}
      <nav aria-label="Context" className="flex flex-wrap items-baseline gap-x-2 type-meta text-meta">
        <Link href={`/item?id=${node.postId}`} className="font-semibold text-ink hover:underline">
          {post ? post.title : "the thread"}
        </Link>
        {ancestors.map((ancestor) => (
          <span key={ancestor.id} className="flex items-baseline gap-x-2">
            <span aria-hidden="true">›</span>
            <Link href={`/reply?id=${ancestor.id}`} className="text-ink-2 hover:underline">
              {ancestor.isDeleted ? "[deleted]" : ancestor.author}
            </Link>
          </span>
        ))}
        <span aria-hidden="true">›</span>
        <span>{node.isDeleted ? "[deleted]" : node.author}</span>
      </nav>

      <h1 className="sr-only">
        Comment by {node.author}, {formatAgeLong(node.createdAt)}
      </h1>

      <div className="mt-2 rule-open">
        {/* baseDepth re-roots the cap: arriving here from "continue this thread" must not
            immediately hit the cap again, or the reader cannot get any deeper. */}
        <CommentTree
          nodes={[node]}
          ctx={{
            opAuthor: post?.author ?? "",
            viewerName: opts.userId,
            baseDepth: node.depth,
            canDownvote: viewer?.canDownvote ?? false,
            canFlag: viewer?.canFlag ?? false,
            isModerator: opts.isModerator,
            voted: commentVotes,
            flagged: commentFlags,
          }}
        />
      </div>

      <ReplyForm targetId={node.id} kind="comment" label="Reply to this comment" submit="Reply" />
    </>
  );
}

async function PermalinkAside({ searchParams }: { searchParams: Search }) {
  const [params, opts] = await Promise.all([searchParams, getViewerOpts()]);
  const id = Number(params.id);
  if (!Number.isInteger(id)) return null;

  const found = await getSubtree(id, opts);
  if (!found) return null;

  return (
    <DatasheetTable
      number={1}
      title="About this comment"
      rows={[
        ["Depth in thread", String(found.node.depth)],
        ["Ancestors", String(found.ancestors.length)],
        ["Replies below", String(countDescendants(found.node))],
      ]}
      note="Depth counts from the top of the thread. The cap restarts from this comment."
    />
  );
}
