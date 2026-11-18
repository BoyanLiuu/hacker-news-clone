import Link from "next/link";
import { Suspense } from "react";
import { DatasheetTable, SyntheticNote } from "@/components/datasheet-table";
import { DecayFigure, FigureCaption, FigureFootnote, toFigurePoints } from "@/components/decay-figure";
import { PageHead, PageShell } from "@/components/page-shell";
import { OutOfRange, Pager, pageFromParam, pageOutOfRange } from "@/components/pager";
import { StoryList, StoryListSkeleton } from "@/components/story-list";
import { toRows, type VoteState } from "@/components/story-row";
import { CFG } from "@/lib/config";
import { formatCount, formatUtcTime } from "@/lib/format";
import { getCandidates, getRankedPage } from "@/services/posts";
import { getViewer, getViewerOpts } from "@/services/viewer";

type Search = Promise<{ p?: string; vote?: string; row?: string }>;

const VOTE_STATES = new Set<VoteState["state"]>(["pending", "confirmed", "failed"]);

/**
 * `?vote=pending|confirmed|failed&row=<n>` puts one row into one vote state.
 *
 * The four states are CSS keyed on `data-vote` (globals.css), so they need a source for that
 * attribute before the real one exists. M11 reads it from `useOptimistic` after a click; until
 * then this reads it from the URL, which makes every state addressable, screenshot-comparable
 * against its reference, and free of client JavaScript on the busiest page in the product.
 *
 * It only ever changes what is displayed. No vote is recorded, and `getRankedPage` is not consulted
 * about it — which is also why the +1 below is arithmetic here rather than anywhere near a service.
 */
function previewVote(params: { vote?: string; row?: string }): { rank: number; state: VoteState } | null {
  const state = params.vote as VoteState["state"] | undefined;
  if (!state || !VOTE_STATES.has(state)) return null;

  const rank = Number(params.row ?? 1);
  if (!Number.isInteger(rank) || rank < 1) return null;

  return {
    rank,
    state: {
      state,
      savedAt: state === "confirmed" ? formatUtcTime(new Date()) : undefined,
      // Retrying a failed vote puts the row back in flight, which is what retrying is. In M11 this
      // becomes the action re-posting the vote; the row cannot build the URL itself.
      retryHref: state === "failed" ? `/?vote=pending&row=${rank}` : undefined,
    },
  };
}

/**
 * The ranked front page. Rendered per request — the ranking is a function of now() — with the
 * ordering behind a Suspense boundary so the header and footer flush first and the skeleton on the
 * live grid covers the gap. ARCHITECTURE §5: a dynamic page over a cached data read.
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
  // The query string and the viewer are independent, so they resolve together; the ranked read
  // needs both and waits.
  const [params, viewer, opts] = await Promise.all([searchParams, getViewer(), getViewerOpts()]);
  const page = pageFromParam(params.p);
  const ranked = await getRankedPage(page, opts);

  if (pageOutOfRange(ranked)) return <OutOfRange page={ranked} basePath="/" />;

  const rows = toRows(ranked.items, ranked, (row) => ({ points: row.points, post: row.post }));

  // An optimistic vote shows the score it would become. Applied to the row rather than inside it,
  // because M11's `useOptimistic` is what will own this arithmetic.
  const preview = previewVote(params);
  const shown =
    preview && preview.state.state !== "failed"
      ? rows.map((row) => (row.rank === preview.rank ? { ...row, points: row.points + 1 } : row))
      : rows;

  return (
    <>
      <StoryList
        rows={shown}
        viewerName={opts.userId}
        canFlag={viewer?.canFlag ?? false}
        vote={preview ?? undefined}
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
