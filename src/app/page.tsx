import Link from "next/link";
import { DatasheetTable, SyntheticNote } from "@/components/datasheet-table";
import { DecayFigure, FigureCaption, FigureFootnote, toFigurePoints } from "@/components/decay-figure";
import { PageHead, PageShell } from "@/components/page-shell";
import { OutOfRange, Pager, pageFromParam, pageOutOfRange } from "@/components/pager";
import { StoryList } from "@/components/story-list";
import { toRows } from "@/lib/rows";
import { CFG } from "@/lib/config";
import { formatCount } from "@/lib/format";
import { getCandidates, getRankedPage } from "@/services/posts";
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
 * The aside keeps its boundary: Figure 1 reads all 973 candidates, it is the slow half of the page,
 * and nothing in it is a control. ARCHITECTURE §5: a dynamic page over a cached data read.
 */
export default async function FrontPage({ searchParams }: { searchParams: Search }) {
  return (
    <PageShell nav="Front" section="front page" aside={<FrontAside />}>
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
  const voted = await getVotes("post", rows.map((row) => row.post.id));

  return (
    <>
      <StoryList
        rows={rows}
        viewerName={opts.userId}
        canFlag={viewer?.canFlag ?? false}
        voted={new Set(voted.keys())}
      />
      <Pager page={ranked} basePath="/" />
    </>
  );
}

async function FrontAside() {
  const opts = await getViewerOpts();
  const candidates = await getCandidates(opts);

  // Only the stories on this page get filled dots; the rest of the window is the hollow cloud.
  const pageIds = new Set(candidates.slice(0, CFG.pageSize).map((row) => row.post.id));

  return (
    <div className="flex flex-col gap-7">
      <section>
        <FigureCaption gravity={CFG.gravity} live={CFG.gravity} />
        <div className="mt-2">
          <DecayFigure points={toFigurePoints(candidates, pageIds)} gravity={CFG.gravity} />
        </div>
        <FigureFootnote gravity={CFG.gravity} />
        {/* The interactive version lives at /rank-debug, so the figure here is server-rendered SVG
            and Motion never reaches this page. Measured: `/` ships 177.0 KB gz of JS against a
            173.9 KB framework floor, and none of it is the figure's. */}
        <p className="mt-2 text-[12px] text-meta">
          <Link href="/rank-debug" className="text-petrol-ink underline underline-offset-2">
            Tune gravity and see every term
          </Link>
        </p>
      </section>

      <DatasheetTable
        number={1}
        title="Characteristics"
        rows={[
          ["Gravity, G", CFG.gravity.toFixed(1)],
          ["Candidate window", `${CFG.windowDays} days · ${formatCount(candidates.length)} stories`],
          ["Recompute interval", `${CFG.recomputeSeconds} s`],
          ["Page size", formatCount(CFG.pageSize)],
        ]}
        note={<SyntheticNote />}
      />
    </div>
  );
}
