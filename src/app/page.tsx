import { connection } from "next/server";
import { Suspense } from "react";
import { DatasheetTable, SyntheticNote } from "@/components/datasheet-table";
import { PageHead, PageShell } from "@/components/page-shell";
import { OutOfRange, Pager, pageFromParam, pageOutOfRange } from "@/components/pager";
import { StoryList, StoryListSkeleton } from "@/components/story-list";
import { toRows } from "@/components/story-row";
import { CFG } from "@/lib/config";
import { formatCount } from "@/lib/format";
import { getCandidates, getRankedPage } from "@/services/posts";
import { getViewerOpts } from "@/services/viewer";

type Search = Promise<{ p?: string }>;

/**
 * The ranked front page. The shell prerenders and the ordering streams in behind a Suspense
 * boundary, because the ranking is a function of now() and cannot be prerendered — the skeleton on
 * the live grid is the fallback, which is what it exists for.
 */
export default function FrontPage({ searchParams }: { searchParams: Search }) {
  return (
    <PageShell nav="Front" section="front page" aside={<FrontAside />}>
      <PageHead title="Front page" sub="Ranked by score and age" />
      <Suspense fallback={<StoryListSkeleton />}>
        <RankedList searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function RankedList({ searchParams }: { searchParams: Search }) {
  await connection();

  // The query string and the viewer are independent, so they resolve together; the ranked read
  // needs both and waits.
  const [params, opts] = await Promise.all([searchParams, getViewerOpts()]);
  const page = pageFromParam(params.p);
  const ranked = await getRankedPage(page, opts);

  if (pageOutOfRange(ranked)) return <OutOfRange page={ranked} basePath="/" />;

  const rows = toRows(ranked.items, ranked, (row) => ({ points: row.points, post: row.post }));

  return (
    <>
      <StoryList rows={rows} viewerName={opts.userId} />
      <Pager page={ranked} basePath="/" />
    </>
  );
}

async function FrontAside() {
  await connection();

  const opts = await getViewerOpts();
  const candidates = await getCandidates(opts);

  return (
    <div className="flex flex-col gap-7">
      {/* Figure 1, the decay characteristic, lands in M4. */}
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
