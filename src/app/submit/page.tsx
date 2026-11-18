import { cache, Suspense } from "react";
import { DatasheetTable } from "@/components/datasheet-table";
import { Notice } from "@/components/notice";
import { PageHead, PageShell } from "@/components/page-shell";
import { SubmitForm } from "@/components/submit-form";
import { CFG, HOUR } from "@/lib/config";
import { formatUntil, formatUtcClock } from "@/lib/format";
import { getSubmitQuota, type SubmitQuota } from "@/services/posts";
import { getViewer, getViewerOpts } from "@/services/viewer";

type Search = Promise<{ limited?: string }>;

/** A link or a text post, never both. The rules sit beside the form rather than being discovered. */
export default function SubmitPage({ searchParams }: { searchParams: Search }) {
  return (
    <PageShell nav="Submit" section="submit" aside={<Rules searchParams={searchParams} />}>
      <PageHead title="Submit" sub="A link or a text post, not both." />
      <Suspense fallback={<p className="mt-4 type-meta text-meta">Loading…</p>}>
        <Form searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

/**
 * `?limited=1` fills the allowance for preview.
 *
 * The count itself is real — `getSubmitQuota` reads the viewer's last hour of posts — but no fixture
 * viewer has three submissions in the last hour, and giving one three would put three fresh posts
 * on the front page to light up one notice. The override is the smaller distortion, and it is the
 * same kind of switch as the viewer cookie: it changes what you are shown, never what is true.
 */
const readQuota = cache(async (searchParams: Search): Promise<SubmitQuota> => {
  const [params, opts] = await Promise.all([searchParams, getViewerOpts()]);
  const quota = await getSubmitQuota(opts);
  if (params.limited !== "1") return quota;

  // An allowance filled this instant frees its oldest slot in an hour. Cached with the rest, so
  // the form and the aside cannot disagree about a value they both read off the clock.
  return { used: quota.limit, limit: quota.limit, resetAt: quota.resetAt ?? new Date(Date.now() + HOUR) };
});

async function Form({ searchParams }: { searchParams: Search }) {
  const [viewer, quota] = await Promise.all([getViewer(), readQuota(searchParams)]);

  // Signed out, the form is not offered at all — the debrief requires an account to submit.
  if (!viewer) {
    return (
      <Notice tone="info" action={<a href="/login" className="font-semibold underline underline-offset-2">Log in</a>}>
        Submitting needs an account. Reading does not.
      </Notice>
    );
  }

  // Formatted here, on the server, because both strings are read off the clock: a client component
  // rendering "in 49 minutes" would hydrate against a different minute than it rendered in.
  const blocked =
    quota.used >= quota.limit && quota.resetAt
      ? { at: formatUtcClock(quota.resetAt), until: formatUntil(quota.resetAt), used: quota.used }
      : null;

  return (
    <>
      {viewer.isNewAccount ? (
        <Notice tone="amber">
          Your account is less than {CFG.flagMinDays} days old, so flagging and downvoting are not
          available yet. Submitting and commenting are.
        </Notice>
      ) : null}
      <SubmitForm viewerName={viewer.user.username} blocked={blocked} />
    </>
  );
}

async function Rules({ searchParams }: { searchParams: Search }) {
  const quota = await readQuota(searchParams);

  return (
    <DatasheetTable
      number={1}
      title="Submission rules"
      rows={[
        ["Title", `Required, 1–${CFG.titleMax} characters`],
        ["Content", "A URL or text, never both"],
        ["Duplicates", `A URL posted in the last ${CFG.dupDays} days opens the existing thread and counts your upvote`],
        [
          "Rate limit",
          <>
            {CFG.ratePerHour} an hour per account, {CFG.ratePerIp} per network
            <sup className="ml-[1px] text-[10px]">1</sup>
          </>,
        ],
        ["Editing", `Title and text for ${CFG.editMinutes / 60} hours; the URL is fixed`],
        ["Deleting", "Only while nobody has commented"],
        // Last, so the one row that changes while you work sits where you look for it.
        ["This hour", `${quota.used} of ${quota.limit} used`],
      ]}
      note={
        <>
          <sup className="mr-[2px] text-[10px]">1</sup>
          Illustrative limits; the final values are undecided.
        </>
      }
    />
  );
}
