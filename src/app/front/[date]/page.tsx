import { Suspense } from "react";
import { DatasheetTable, SyntheticNote } from "@/components/datasheet-table";
import { EmptyState } from "@/components/empty-state";
import { PageHead, PageShell } from "@/components/page-shell";
import { StoryList, StoryListSkeleton } from "@/components/story-list";
import { toRows } from "@/components/story-row";
import { CFG } from "@/lib/config";
import { formatIsoDate } from "@/lib/format";
import { getRankedPage } from "@/services/posts";
import { getViewer, getViewerOpts } from "@/services/viewer";

type Params = Promise<{ date: string }>;

/**
 * The front page as it stood on a given day. Points are back-projected to that moment, so the order
 * is what a reader would have seen rather than today's scores re-sorted by an old date.
 *
 * Whether this survives on a real database is ARCHITECTURE Appendix G question 4: it needs a daily
 * snapshot table. Over fixtures it comes free from the same candidate query.
 */
export default function PastFrontPage({ params }: { params: Params }) {
  return (
    <PageShell
      nav="Past"
      section={params.then(({ date }) => {
        const at = parseDate(date);
        return at ? `past · ${formatIsoDate(at)}` : "past front page";
      })}
      aside={<PastAside params={params} />}
    >
      <Suspense fallback={<StoryListSkeleton />}>
        <PastColumn params={params} />
      </Suspense>
    </PageShell>
  );
}

async function PastColumn({ params }: { params: Params }) {
  const [resolved, viewer, opts] = await Promise.all([params, getViewer(), getViewerOpts()]);
  const at = parseDate(resolved.date);
  if (!at) {
    return (
      <>
        <PageHead title="Past front page" />
        <EmptyState heading="That is not a date" action={{ href: "/", label: "Back to the front page" }}>
          Use a calendar date, as in <code className="rounded-hair bg-well px-1">/front/2026-11-17</code>.
        </EmptyState>
      </>
    );
  }

  const ranked = await getRankedPage(1, opts, at);

  if (ranked.total === 0) {
    return (
      <>
        <PageHead title="Past front page" sub={`As it stood on ${formatIsoDate(at)}`} />
        <EmptyState heading="No snapshot for that day" action={{ href: "/", label: "Back to the front page" }}>
          Nothing had been submitted by then, or the day falls outside the {CFG.windowDays}-day window the
          ranking covers.
        </EmptyState>
      </>
    );
  }

  const rows = toRows(ranked.items, ranked, (row) => ({ points: row.points, post: row.post }));

  return (
    <>
      <PageHead title="Past front page" sub={`As it stood on ${formatIsoDate(at)}`} />
      <StoryList rows={rows} viewerName={opts.userId} canFlag={viewer?.canFlag ?? false} />
    </>
  );
}

async function PastAside({ params }: { params: Params }) {
  const at = parseDate((await params).date);
  if (!at) return null;

  return (
    <DatasheetTable
      number={1}
      title="About this snapshot"
      rows={[
        ["As of", formatIsoDate(at)],
        ["Gravity, G", CFG.gravity.toFixed(1)],
        ["Points", "Back-projected to that day"],
        ["Order", "Score and age at that moment"],
      ]}
      note={<SyntheticNote />}
    />
  );
}

/** Only an exact ISO date, so a typo gives a clear message rather than a silently odd page. */
function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const at = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(at.getTime()) ? null : at;
}
