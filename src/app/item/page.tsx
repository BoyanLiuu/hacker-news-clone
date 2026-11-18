import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CommentTree } from "@/components/comment-node";
import { DatasheetTable } from "@/components/datasheet-table";
import { PageShell } from "@/components/page-shell";
import { PostHeader } from "@/components/post-header";
import { ReplyForm } from "@/components/reply-form";
import { countDescendants } from "@/lib/tree";
import { getThread } from "@/services/comments";
import { getPostById } from "@/services/posts";
import { getViewer, getViewerOpts } from "@/services/viewer";

type Search = Promise<{ id?: string }>;

/**
 * A thread: the story, then its whole comment tree.
 *
 * Two reads and no recursion — the comments arrive as flat rows already in display order and are
 * assembled in one pass (ARCHITECTURE §6.2). A dead story is reachable here even though listings
 * hide it, which is why this uses getPostById rather than a listing query.
 */
/**
 * The id is checked here, in the page body, rather than inside the streamed boundary. `notFound()`
 * cannot set a status code once the shell has been flushed, so a bad id would otherwise answer 200
 * with no 404 content in the initial HTML — failing both crawlers and readers without JavaScript.

 */
/**
 * The id is validated here, in the page body, so `notFound()` can set a 404 status — once the shell
 * has been flushed it cannot. The trade is that Next answers with its own minimal error document
 * rather than `not-found.tsx`; the status, the noindex and the browser-rendered page are all
 * correct, but a reader with JavaScript disabled sees an empty 404 rather than a styled one. A
 * wrong status code is worse: it makes every dead link look alive to crawlers and link checkers.
 */
export default async function ItemPage({ searchParams }: { searchParams: Search }) {
  const id = Number((await searchParams).id);
  if (!Number.isInteger(id)) notFound();
  if (!(await getPostById(id, await getViewerOpts()))) notFound();

  return (
    <PageShell
      nav=""
      section={searchParams.then((p) => (p.id ? `item ${p.id}` : "item"))}
      aside={<ThreadAside searchParams={searchParams} />}
    >
      <Suspense fallback={<p className="type-meta text-meta">Loading the thread…</p>}>
        <Thread searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function Thread({ searchParams }: { searchParams: Search }) {
  const [params, viewer, opts] = await Promise.all([searchParams, getViewer(), getViewerOpts()]);
  const id = Number(params.id);
  const [post, roots] = await Promise.all([getPostById(id, opts), getThread(id, opts)]);
  if (!post) notFound();

  return (
    <>
      <PostHeader post={post} viewerName={opts.userId} />
      <ReplyForm />
      <div className="mt-6">
        <CommentTree nodes={roots} ctx={{
            opAuthor: post.author,
            viewerName: opts.userId,
            baseDepth: 0,
            canDownvote: viewer?.canDownvote ?? false,
          }} />
      </div>
    </>
  );
}

/**
 * Table 1, the thread's contents: every top-level comment with its reply count, so a long thread
 * can be navigated rather than scrolled. Figure 1 for a thread — points and rank since posting —
 * is charting work and lands with the other figures in M4.
 */
async function ThreadAside({ searchParams }: { searchParams: Search }) {
  const [params, opts] = await Promise.all([searchParams, getViewerOpts()]);
  const id = Number(params.id);
  if (!Number.isInteger(id)) return null;

  const roots = await getThread(id, opts);
  if (roots.length === 0) return null;

  return (
    <DatasheetTable
      number={1}
      title="Thread contents"
      rows={roots.slice(0, 12).map((node) => [
        // Author plus an opening clip, so a long thread can be navigated by what was said.
        <span key={node.id} className="flex min-w-0 items-baseline gap-2">
          <span className="font-semibold text-ink">{node.isDeleted ? "[deleted]" : node.author}</span>
          <span className="truncate text-meta">{preview(node.text)}</span>
        </span>,
        String(countDescendants(node)),
      ])}
      note="Sorted by score within each level. Collapsed threads stay collapsed on this device."
    />
  );
}

/** First words of a comment, with the formatting markers stripped so the clip reads as prose. */
function preview(text: string): string {
  const flat = text.replace(/[`*]/g, "").replace(/\s+/g, " ").trim();
  return flat.length > 42 ? `${flat.slice(0, 42)}…` : flat;
}
