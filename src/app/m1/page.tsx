import { connection } from "next/server";
import { Suspense } from "react";
import { CFG } from "@/lib/config";
import { maxDepth } from "@/lib/tree";
import { ANONYMOUS } from "@/lib/types";
import { getThread, getThreadRows, getSubtree } from "@/services/comments";
import { getCandidates, getNewestPage, getPostsByDomain, getRankedPage } from "@/services/posts";
import { getUserByName } from "@/services/users";

/**
 * M1's demo. Deliberately unstyled: this milestone proves the fixtures and the service boundary
 * work, and no design work belongs in it. M2 replaces the real front page; this page is deleted
 * once M2's listings render the same data for real.
 *
 * The static shell prerenders; the request-time read streams in behind a Suspense boundary. The
 * ranking is a function of now(), so it cannot be prerendered, and under `cacheComponents` a
 * boundary is how you say so — `dynamic = "force-dynamic"` is rejected outright. M2's real front
 * page needs this same shape, with the skeleton rows as its fallback (ux-25-loading).
 */
export default function M1Page() {
  return (
    <main style={{ fontFamily: "monospace", fontSize: 13, padding: 24, lineHeight: 1.6 }}>
      <h1>M1 — fixtures and the service boundary</h1>
      <p>Unstyled on purpose. Every number below comes through the service layer.</p>
      <Suspense fallback={<p>Ranking…</p>}>
        <Report />
      </Suspense>
    </main>
  );
}

async function Report() {
  await connection();

  const opts = ANONYMOUS;

  // The biggest thread is post 38214 — authored comments plus the generated filler.
  const bigPostId = 38214;

  // These reads are independent, so they run together. Awaiting them in sequence would be a
  // waterfall, and ARCHITECTURE §5's thread flow specifies Promise.all for exactly this reason.
  // Only the permalink depends on a prior result, so it waits.
  const [ranked, newest, candidates, tree, rows, byDomain, user] = await Promise.all([
    getRankedPage(1, opts),
    getNewestPage(1, opts),
    getCandidates(opts),
    getThread(bigPostId, opts),
    getThreadRows(bigPostId, opts),
    getPostsByDomain("kestrel.systems", 1, opts),
    getUserByName("mlin"),
  ]);

  const deep = rows.find((r) => r.depth >= CFG.depthCap);
  const permalink = deep ? await getSubtree(deep.id, opts) : null;

  return (
    <>
      <h2>Counts</h2>
      <ul>
        <li>candidates in the {CFG.windowDays}-day window: {candidates.length}</li>
        <li>ranked page 1: {ranked.items.length} of {ranked.total}, hasNext {String(ranked.hasNext)}</li>
        <li>newest page 1: {newest.items.length} of {newest.total}</li>
        <li>posts from kestrel.systems: {byDomain.total}</li>
        <li>user mlin: karma {user?.karma} ({user?.postKarma} post + {user?.commentKarma} comment)</li>
      </ul>

      <h2>Ranked, top 10 — score must fall monotonically</h2>
      <table cellPadding={4}>
        <thead>
          <tr>
            <th align="right">#</th>
            <th align="right">pts</th>
            <th align="right">age h</th>
            <th align="right">score</th>
            <th align="left">domain</th>
            <th align="left">title</th>
          </tr>
        </thead>
        <tbody>
          {ranked.items.slice(0, 10).map((row, i) => (
            <tr key={row.post.id}>
              <td align="right">{i + 1}</td>
              <td align="right">{row.points}</td>
              <td align="right">{row.ageHours.toFixed(1)}</td>
              <td align="right">{row.score.toFixed(3)}</td>
              <td>{row.post.domain ?? "—"}</td>
              <td>{row.post.title.slice(0, 54)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Ranking differs from recency</h2>
      <p>
        ranked #1: {ranked.items[0]?.post.title.slice(0, 48)} ({ranked.items[0]?.ageHours.toFixed(1)} h)
        <br />
        newest #1: {newest.items[0]?.title.slice(0, 48)}
        <br />
        same post: {String(ranked.items[0]?.post.id === newest.items[0]?.id)}
      </p>

      <h2>Thread {bigPostId}</h2>
      <ul>
        <li>rows returned: {rows.length}</li>
        <li>roots after assembly: {tree.length}</li>
        <li>deepest depth: {maxDepth(tree)} (visual cap is {CFG.depthCap})</li>
        <li>rows at or past the cap: {rows.filter((r) => r.depth >= CFG.depthCap).length}</li>
        <li>
          permalink for depth-{deep?.depth} comment {deep?.id}: {permalink ? "resolved" : "none"}, ancestors{" "}
          {permalink?.ancestors.length ?? 0}
        </li>
      </ul>

      <h2>Depth histogram</h2>
      <pre>
        {Array.from({ length: maxDepth(tree) + 1 }, (_, d) => {
          const n = rows.filter((r) => r.depth === d).length;
          return `depth ${String(d).padStart(2)}  ${String(n).padStart(4)}  ${"█".repeat(Math.ceil(n / 4))}`;
        }).join("\n")}
      </pre>
    </>
  );
}
