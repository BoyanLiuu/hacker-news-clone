import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CommentTree } from "@/components/comment-node";
import { DatasheetTable } from "@/components/datasheet-table";
import { Notice } from "@/components/notice";
import { PageShell } from "@/components/page-shell";
import { pageFromParam } from "@/components/pager";
import { PostHeader } from "@/components/post-header";
import { ReplyForm } from "@/components/reply-form";
import { ThreadSkeleton } from "@/components/thread-skeleton";
import { CFG } from "@/lib/config";
import { formatAgeLong } from "@/lib/format";
import { countDescendants, flatten } from "@/lib/tree";
import type { Post } from "@/lib/types";
import { getThreadPage } from "@/services/comments";
import { getPostById } from "@/services/posts";
import { getViewer, getViewerOpts } from "@/services/viewer";
import { getViewerFlags } from "@/services/flags";
import { getVotes } from "@/services/votes";

type Search = Promise<{ id?: string; dup?: string; confirm?: string; cp?: string }>;

/**
 * A thread: the story, then its whole comment tree.
 *
 * Two reads and no recursion — the comments arrive as flat rows already in display order and are
 * assembled in one pass (ARCHITECTURE §6.2). A dead story is reachable here even though listings
 * hide it, which is why this uses getPostById rather than a listing query.
 *
 * The id is validated here, in the page body, so `notFound()` can set a 404 status — once the shell
 * has been flushed it cannot. The trade is that Next answers with its own minimal error document
 * rather than `not-found.tsx`; the status, the noindex and the browser-rendered page are all
 * correct. A wrong status code is worse: it makes every dead link look alive to crawlers and link
 * checkers.
 *
 * That gate costs two sequential round trips before the first byte when signed in — `getViewerOpts`
 * resolves the viewer, then `getPostById` needs the result — and one when signed out, where
 * `loadSession` returns without touching the database. Both are request-cached, so the thread below
 * pays nothing to read the post again. What the boundary buys is the comment read, which is the
 * expensive one: a 500-comment thread no longer holds the header, the nav and the story back while
 * it loads.
 */
export default async function ItemPage({ searchParams }: { searchParams: Search }) {
  const id = Number((await searchParams).id);
  if (!Number.isInteger(id)) notFound();
  if (!(await getPostById(id, await getViewerOpts()))) notFound();

  return (
    <PageShell rows="comments"
      nav=""
      aside={<ThreadAside searchParams={searchParams} />}
    >
      <Suspense fallback={<ThreadSkeleton />}>
        <Thread searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function Thread({ searchParams }: { searchParams: Search }) {
  const [params, viewer, opts] = await Promise.all([searchParams, getViewer(), getViewerOpts()]);
  const id = Number(params.id);
  const [post, threadPage] = await Promise.all([
    getPostById(id, opts),
    getThreadPage(id, opts, pageFromParam(params.cp)),
  ]);
  const roots = threadPage.roots;
  if (!post) notFound();

  // Both vote overlays together: two independent reads of this viewer's own rows, so there is no
  // reason to pay two round trips for them. Kept out of `getThread` so its result stays identical
  // for every viewer — ARCHITECTURE §5.
  const commentIds = flatten(roots).map((node) => node.id);
  const [postVotes, commentVotes, postFlags, commentFlags] = await Promise.all([
    getVotes("post", [post.id]),
    getVotes("comment", commentIds),
    getViewerFlags("post", [post.id]),
    getViewerFlags("comment", commentIds),
  ]);

  return (
    <>
      {params.dup === "1" ? <DuplicateNotice post={post} /> : null}

      <PostHeader
        post={post}
        viewerName={opts.userId}
        canFlag={viewer?.canFlag ?? false}
        confirmingDelete={params.confirm === "delete"}
        voted={postVotes.has(post.id)}
        flagged={postFlags.has(post.id)}
      />
      <ReplyForm targetId={post.id} />
      <div className="mt-6">
        <CommentTree nodes={roots} ctx={{
            opAuthor: post.author,
            viewerName: opts.userId,
            baseDepth: 0,
            canDownvote: viewer?.canDownvote ?? false,
            canFlag: viewer?.canFlag ?? false,
            isModerator: opts.isModerator,
            voted: commentVotes,
            flagged: commentFlags,
          }} />
      </div>

      {/* Only when there is more than one page, so the overwhelming majority of threads — which
          have fewer than 40 top-level comments — show nothing new. */}
      {threadPage.pages > 1 ? (
        <CommentPager id={post.id} page={threadPage.page} pages={threadPage.pages} totalRoots={threadPage.totalRoots} />
      ) : null}
    </>
  );
}

/**
 * Where a duplicate submission lands. M12's `submitPost` redirects here with `dup=1` instead of
 * creating a second row, and the notice explains the redirect rather than leaving you to wonder
 * why Submit took you to someone else's thread.
 *
 * The author and the age are read from the post, so nothing a submitter typed reaches the page.
 */
function DuplicateNotice({ post }: { post: Post }) {
  return (
    <Notice tone="info">
      <strong>That link is already here.</strong> {post.author} submitted it{" "}
      {formatAgeLong(post.createdAt)}, so you&rsquo;re in the existing discussion and your upvote
      has been counted.
    </Notice>
  );
}

/**
 * Table 1, the thread's contents: every top-level comment with its reply count, so a long thread
 * can be navigated rather than scrolled.
 *
 * The design also pairs a thread with its own Figure 1 — points and rank since posting. It is not
 * built, and not deferred to a later milestone either: it needs per-vote timestamps, and phase 1
 * has only a current score. Drawing it from `pointsAt`'s back-projection would put an invented
 * history on the page in the same frame as measured facts. ARCHITECTURE Appendix E records it as
 * dropped from phase 1, to be reconsidered in M9 once the ranking job keeps a history.
 */
async function ThreadAside({ searchParams }: { searchParams: Search }) {
  const [params, opts] = await Promise.all([searchParams, getViewerOpts()]);
  const id = Number(params.id);
  if (!Number.isInteger(id)) return null;

  // Page 1's roots, which is all this needs: the table below shows the first 12, and page 1 holds
  // the first 40 in the same sibling order the thread renders. Deliberately not the current page —
  // a contents list that only described the page you are already on would be of no use.
  const { roots } = await getThreadPage(id, opts, 1);
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

/**
 * Top-level sibling pagination, M14's bound on how wide a thread page gets.
 *
 * `cp` and not `p`, so a thread's comment page cannot collide with a listing's page parameter if
 * the two ever appear on one URL. Links rather than buttons: this is navigation, and it has to work
 * without JavaScript like everything else here.
 */
function CommentPager({
  id,
  page,
  pages,
  totalRoots,
}: {
  id: number;
  page: number;
  pages: number;
  totalRoots: number;
}) {
  const href = (n: number) => `/item?id=${id}&cp=${n}`;

  return (
    <nav aria-label="Comment pages" className="mt-6 flex items-baseline justify-between rule-open pt-3 type-meta text-meta">
      <span>
        Top-level comments {(page - 1) * CFG.rootsPerPage + 1}–
        {Math.min(page * CFG.rootsPerPage, totalRoots)} of {totalRoots}
      </span>
      <span className="flex items-baseline gap-4">
        {page > 1 ? (
          <Link href={href(page - 1)} className="font-semibold text-petrol-ink hover:underline">
            Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={href(page + 1)} className="font-semibold text-petrol-ink hover:underline">
            Next
          </Link>
        ) : null}
      </span>
    </nav>
  );
}
