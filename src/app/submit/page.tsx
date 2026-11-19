import { cache } from "react";
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
 * No rules table beside the form. The constraints are enforced in `lib/validate.ts` and re-checked
 * in `submitPost`, and the form states each one where it applies — the title counter, the URL/text
 * divider, the inline errors, and the rate-limit notice when the allowance is actually spent. A
 * panel restating all of them was a second place for the same rules to live, and the one most
 * likely to go stale.
 *
 * The gate runs in the page body, not inside a child.
 *
 * No Suspense boundary around the form. React streams suspended content into a `<div hidden>` and
 * swaps it in with an inline script, so a boundary around a control makes that control unreachable
 * with JavaScript disabled — M11 lost the front page's vote forms to exactly this. The plan
 * requires submitting and replying to work without JavaScript, so the read is awaited instead.
 *
 * A `redirect()` after streaming has begun cannot set a status: the shell flushes 200 and the
 * redirect travels in the payload, so a reader without JavaScript gets a blank page and a crawler
 * records a 200. Same lesson as `notFound()` in `item/page.tsx` — the check that decides whether a
 * page exists at all has to happen before the first byte.
 */
export default async function SubmitPage({ searchParams }: { searchParams: Search }) {
  await requireViewer();

  return (
    <PageShell nav="Submit">
      <PageHead title="Submit" sub="A link or a text post, not both." />
      <Form searchParams={searchParams} />
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

