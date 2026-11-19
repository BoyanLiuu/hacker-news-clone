import { cache, Suspense } from "react";
import { LoadingLine } from "@/components/loading-line";
import { Notice } from "@/components/notice";
import { PageHead, PageShell } from "@/components/page-shell";
import { SubmitForm } from "@/components/submit-form";
import { CFG, HOUR } from "@/lib/config";
import { formatUntil, formatUtcClock } from "@/lib/format";
import { getSubmitQuota, type SubmitQuota } from "@/services/posts";
import { requireViewer } from "@/services/require";
import { getViewerOpts } from "@/services/viewer";

type Search = Promise<{ limited?: string }>;

/**
 * A link or a text post, never both.
 *
 * No rules panel beside the form: the constraints are enforced in `lib/validate.ts`, re-checked in
 * `submitPost`, and stated by the form where each applies. A panel restating them would be a second
 * place for the same rules to live.
 *
 * The gate runs in the page body, above the boundary, because a `redirect()` issued after streaming
 * begins cannot set a status — the shell has already flushed 200. The quota read decides only what
 * the form *says*, so that part streams.
 */
export default async function SubmitPage({ searchParams }: { searchParams: Search }) {
  await requireViewer();

  return (
    <PageShell nav="Submit">
      <PageHead title="Submit" sub="A link or a text post, not both." />
      <Suspense fallback={<LoadingLine>Loading the form…</LoadingLine>}>
        <Form searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

/**
 * `?limited=1` fills the allowance for preview, so the rate-limited notice can be seen without
 * actually posting three stories to light it up. It changes what you are shown, never what is true:
 * the action re-reads the real quota and refuses on its own.
 */
const readQuota = cache(async (searchParams: Search): Promise<SubmitQuota> => {
  const [params, opts] = await Promise.all([searchParams, getViewerOpts()]);
  const quota = await getSubmitQuota(opts);
  if (params.limited !== "1") return quota;

  // An allowance filled this instant frees its oldest slot in an hour.
  return { used: quota.limit, limit: quota.limit, resetAt: quota.resetAt ?? new Date(Date.now() + HOUR) };
});

async function Form({ searchParams }: { searchParams: Search }) {
  // Already gated by the page; `getViewer` cannot be null here, but the type says it can.
  const [viewer, quota] = await Promise.all([requireViewer(), readQuota(searchParams)]);

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

