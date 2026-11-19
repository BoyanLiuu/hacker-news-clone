import { PageHead, PageShell } from "@/components/page-shell";
import { OutOfRange, Pager, pageFromParam, pageOutOfRange } from "@/components/pager";
import { StoryList } from "@/components/story-list";
import { toRows } from "@/lib/rows";
import { getRankedPage } from "@/services/posts";
import { getViewerFlags } from "@/services/flags";
import { getVotes } from "@/services/votes";
import { getViewer, getViewerOpts } from "@/services/viewer";

type Search = Promise<{ p?: string }>;

/**
 * The ranked front page. Rendered per request, because the ranking is a function of now().
 *
 * The rows are **not** behind a Suspense boundary, and that is M11's correction to M6. React streams
 * suspended content into a `<div hidden>` and swaps it in with an inline script, so with JavaScript
 * disabled the boundary served skeleton bars and nothing else — which made the vote forms inside it
 * unreachable and the plan's no-JS requirement impossible to meet, whatever the forms did. Awaiting
 * the ranked read here puts one database round trip into TTFB and the rows into the initial HTML.
 *
 * No aside. The Characteristics datasheet that stated gravity, the candidate window, the recompute
 * interval and the page size is gone with Figure 1 — the ordering is the product, not an exhibit
 * about the ordering. ARCHITECTURE §5: a dynamic page over a cached data read.
 */
export default async function FrontPage({ searchParams }: { searchParams: Search }) {
  return (
    <PageShell rows="stories" nav="Front">
      <PageHead title="Front page" sub="Ranked by score and age" />
      <RankedList searchParams={searchParams} />
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

