import { Suspense } from "react";
import { PageHead, PageShell } from "@/components/page-shell";
import { OutOfRange, Pager, pageFromParam, pageOutOfRange } from "@/components/pager";
import { StoryList, StoryListSkeleton } from "@/components/story-list";
import { toRows } from "@/lib/rows";
import { getRankedPage } from "@/services/posts";
import { getViewerFlags } from "@/services/flags";
import { getVotes } from "@/services/votes";
import { getViewer, getViewerOpts } from "@/services/viewer";

type Search = Promise<{ p?: string }>;

/**
 * The ranked front page. Rendered per request, because the ranking is a function of now().
 *
 * The rows stream behind a Suspense boundary, so the header, the nav and the skeleton grid leave
 * the server before the ranked read resolves rather than after it. Keeping this function
 * synchronous is what allows that — an `await` here would hold the shell back exactly as rendering
 * the list inline did.
 *
 * No aside: the ordering is the product, not an exhibit about the ordering.
 */
export default function FrontPage({ searchParams }: { searchParams: Search }) {
  return (
    <PageShell rows="stories" nav="Front">
      <PageHead title="Front page" sub="Ranked by score and age" />
      <Suspense fallback={<StoryListSkeleton />}>
        <RankedList searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function RankedList({ searchParams }: { searchParams: Search }) {
  // The query string and the viewer are independent, so they resolve together; the ranked read
  // needs both and waits.
  const [params, viewer, opts] = await Promise.all([searchParams, getViewer(), getViewerOpts()]);
  const page = pageFromParam(params.p);
  const ranked = await getRankedPage(page, opts);

  if (pageOutOfRange(ranked)) return <OutOfRange page={ranked} basePath="/" />;

  const rows = toRows(ranked.items, ranked, (row) => ({ points: row.points, post: row.post }));

  // The per-viewer overlay, read after the ranking rather than with it: the ranked page is cached
  // for everyone signed out, and a `voted` column in that read would make one cache entry per
  // person. One extra query for thirty ids — ARCHITECTURE §5.
  const ids = rows.map((row) => row.post.id);
  const [voted, flagged] = await Promise.all([getVotes("post", ids), getViewerFlags("post", ids)]);

  return (
    <>
      <StoryList
        rows={rows}
        viewerName={opts.userId}
        canFlag={viewer?.canFlag ?? false}
        voted={new Set(voted.keys())}
        flagged={flagged}
      />
      <Pager page={ranked} basePath="/" />
    </>
  );
}

