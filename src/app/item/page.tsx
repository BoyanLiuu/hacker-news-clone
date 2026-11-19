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
import type { CommentNode, Post } from "@/lib/types";
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
 * The id is validated in the page body so `notFound()` can set a 404 — once the shell has flushed
 * it cannot, and a wrong status makes every dead link look alive to crawlers. The cost is Next's
 * own error document instead of `not-found.tsx`, which is the cheaper of the two prices.
 *
 * That gate pays two sequential round trips signed in (`getViewerOpts`, then `getPostById` needs
 * its result) and one signed out. Both are request-cached, so the thread re-reads the post for
 * nothing; what the boundary buys is the comment read, the expensive one.
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
        <ContentsRow key={node.id} node={node} />,
        String(countDescendants(node)),
      ])}
      note="Sorted by score within each level. Collapsed threads stay collapsed on this device."
    />
  );
}

/**
 * One row of the contents table: who, and the first words of what they said.
 *
 * Two links rather than one, because the two halves point at different things — the name at the
 * person, the clip at the comment. One link over the whole row would have to pick, and whichever it
 * picked would be wrong half the time someone aimed at a username.
 *
 * The clip's href is absolute rather than a bare `#c123`, because the aside always lists page 1's
 * roots while the reader may be on `cp=2`, where that element is not in the document. Spelling out
 * the page makes the link correct from anywhere in the thread; from page 1 it is a same-document
 * navigation and just scrolls.
 */
function ContentsRow({ node }: { node: CommentNode }) {
  const clip = preview(node.text);

  return (
    <span className="flex min-w-0 items-baseline gap-2">
      {node.isDeleted ? (
        <span className="font-semibold text-ink">[deleted]</span>
      ) : (
        <Link href={`/user/${node.author}`} className="font-semibold text-ink hover:underline">
          {node.author}
        </Link>
      )}

      {/* A deleted comment has no body to clip, and a link with no text has no accessible name, so
          the row keeps its name and its count and simply stops being a jump target. */}
      {clip ? (
        <Link
          href={`/item?id=${node.postId}#c${node.id}`}
          className="min-w-0 truncate text-meta hover:underline"
        >
          {clip}
        </Link>
      ) : null}
    </span>
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
