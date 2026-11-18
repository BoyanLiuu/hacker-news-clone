import { Suspense } from "react";
import { DatasheetTable } from "@/components/datasheet-table";
import { Notice } from "@/components/notice";
import { PageHead, PageShell } from "@/components/page-shell";
import { CFG } from "@/lib/config";
import { formatAge } from "@/lib/format";
import { getFlagged } from "@/services/flags";
import { getViewer } from "@/services/viewer";
import Link from "next/link";

/** The review queue: flagged and dead items, with Kill and Restore as text actions. */
export default function FlaggedPage() {
  return (
    <PageShell nav="" section="moderation" aside={<Thresholds />}>
      <PageHead title="Flagged and dead" sub="Items awaiting review." />
      <Suspense fallback={<p className="mt-4 type-meta text-meta">Loading the queue…</p>}>
        <Queue />
      </Suspense>
    </PageShell>
  );
}

async function Queue() {
  const viewer = await getViewer();

  // Moderators only. Anyone else gets told plainly rather than shown an empty page.
  if (!viewer?.user.isModerator) {
    return (
      <Notice tone="info" action={<Link href="/" className="font-semibold underline underline-offset-2">Front page</Link>}>
        This queue is for moderators.
      </Notice>
    );
  }

  const queue = await getFlagged(viewer.opts);

  if (queue.length === 0) {
    return <p className="mt-6 type-meta text-meta">Nothing flagged. The queue is empty.</p>;
  }

  return (
    <table className="mt-4 w-full border-collapse text-[13px] rule-open">
      <thead>
        <tr className="bg-head type-label text-ink-2">
          <th scope="col" className="px-2 py-[6px] text-left">Story</th>
          <th scope="col" className="px-2 py-[6px] text-right">Flags</th>
          <th scope="col" className="px-2 py-[6px] text-right">Age</th>
          <th scope="col" className="px-2 py-[6px] text-left">State</th>
          <th scope="col" className="px-2 py-[6px] text-right">Action</th>
        </tr>
      </thead>
      <tbody>
        {queue.map((post, i) => (
          <tr key={post.id} className={i === queue.length - 1 ? "rule-close" : "rule-divide"}>
            <td className="px-2 py-[7px]">
              <Link href={`/item?id=${post.id}`} className="text-ink hover:underline">
                {post.title}
              </Link>
              <span className="block type-meta text-meta">by {post.author}</span>
            </td>
            <td className="px-2 py-[7px] text-right tabular-nums">{post.flags}</td>
            <td className="px-2 py-[7px] text-right tabular-nums">{formatAge(post.createdAt)}</td>
            <td className="px-2 py-[7px]">
              {post.isDead ? <span className="text-red">dead</span> : <span className="text-amber">flagged</span>}
            </td>
            <td className="px-2 py-[7px] text-right">
              {/* Text actions, never boxed buttons inside a table — DESIGN.md §Text Buttons. */}
              <button
                type="button"
                className="text-[13px] font-semibold text-ink underline decoration-text-button-underline underline-offset-[3px] hover:decoration-ink"
              >
                {post.isDead ? "Restore" : "Kill"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Thresholds() {
  return (
    <DatasheetTable
      number={1}
      title="Thresholds"
      rows={[
        ["Flags to die", String(CFG.flagsToDie)],
        ["Flagger age", `${CFG.flagMinDays} days`],
        ["Flagger karma", String(CFG.flagMinKarma)],
        ["Dead items", "Hidden from listings, live at their own link"],
      ]}
      note="Flags only count from established accounts, so a new-account brigade cannot kill a story."
    />
  );
}
