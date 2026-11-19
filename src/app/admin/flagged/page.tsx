import { DatasheetTable } from "@/components/datasheet-table";
import { Notice } from "@/components/notice";
import { PageHead, PageShell } from "@/components/page-shell";
import { CFG } from "@/lib/config";
import { formatAge } from "@/lib/format";
import { setDead } from "@/services/flag-actions";
import { getFlagged } from "@/services/flags";
import { requireModerator, requireViewer } from "@/services/require";
import Link from "next/link";

/** The review queue: flagged and dead items, with Kill and Restore as text actions. */
export default async function FlaggedPage() {
  // Gated before streaming, so a signed-out visitor gets a real redirect — see submit/page.tsx.
  await requireViewer();

  return (
    <PageShell nav="" aside={<Thresholds />}>
      <PageHead title="Flagged and dead" sub="Items awaiting review." />
      {/* No boundary: every row carries a Kill or Restore form, and React streams suspended
          content into a `<div hidden>` that only JavaScript opens. See `submit/page.tsx`. */}
      <Queue />
    </PageShell>
  );
}

async function Queue() {
  // Redirects a signed-out visitor; returns null for a signed-in non-moderator.
  const viewer = await requireModerator();

  if (!viewer) {
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
              {/* Text actions, never boxed buttons inside a table — DESIGN.md §Text Buttons.
                  A form per row rather than one handler: `setDead` is a direct Server Action, so
                  the queue works without JavaScript like every other control here. */}
              <form action={setDead}>
                <input type="hidden" name="type" value="post" />
                <input type="hidden" name="id" value={post.id} />
                <input type="hidden" name="dead" value={post.isDead ? "0" : "1"} />
                <button
                  type="submit"
                  className="text-[13px] font-semibold text-ink underline decoration-text-button-underline underline-offset-[3px] hover:decoration-ink"
                >
                  {post.isDead ? "Restore" : "Kill"}
                </button>
              </form>
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
