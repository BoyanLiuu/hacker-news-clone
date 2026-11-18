import { Suspense } from "react";
import { PageHead, PageShell } from "@/components/page-shell";
import { RankDebug } from "@/components/rank-debug";
import { CFG } from "@/lib/config";
import { shownAge } from "@/lib/figure";
import { rank } from "@/lib/rank";
import { getCandidates } from "@/services/posts";
import { getViewerOpts } from "@/services/viewer";

/**
 * Every term of the score, for the top candidates, with gravity as a live knob.
 *
 * This is the answer to "the ranking feels wrong but I cannot tell why" — the risk the plan names.
 * Tuning here changes nothing live: it is a view onto the same candidates with a different G.
 */
export default function RankDebugPage() {
  return (
    <PageShell nav="" section="rank debug">
      <PageHead title="Ranking details" sub={`Every term of the score for the top ${TOP} candidates`} />
      <Suspense fallback={<p className="mt-4 type-meta text-meta">Scoring candidates…</p>}>
        <Candidates />
      </Suspense>
    </PageShell>
  );
}

const TOP = 40;

async function Candidates() {
  const opts = await getViewerOpts();
  // Scored at the live gravity, so "vs live" has something to compare against. The client
  // rescores locally as the slider moves — no round trip, and the live order is never touched.
  const candidates = await getCandidates(opts);

  // Ages are rounded once, here, so a single value drives the ordering, the arithmetic and the
  // figure. Sorting on the true age while printing a rounded one put rows visibly out of R order,
  // which on the page that explains the ordering reads as a bug in the ranking.
  const rounded = candidates.slice(0, TOP).map((row) => ({
    id: row.post.id,
    title: row.post.title,
    points: row.points,
    ageHours: shownAge(row.ageHours),
    commentCount: row.post.commentCount,
  }));

  // The live baseline for "vs live" comes from the same values, so at live gravity every delta is
  // zero — the column compares gravities, not rounding.
  const liveRankById = new Map(
    [...rounded]
      .sort((a, b) => rank(b.points, b.ageHours, CFG.gravity) - rank(a.points, a.ageHours, CFG.gravity))
      .map((row, i) => [row.id, i + 1]),
  );

  const rows = rounded.map((row) => ({ ...row, liveRank: liveRankById.get(row.id)! }));

  return <RankDebug rows={rows} live={CFG.gravity} total={candidates.length} />;
}
