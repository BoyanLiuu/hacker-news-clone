import { Suspense } from "react";
import { DatasheetTable } from "@/components/datasheet-table";
import { Notice } from "@/components/notice";
import { PageHead, PageShell } from "@/components/page-shell";
import { SubmitForm, TITLE_MAX } from "@/components/submit-form";
import { CFG } from "@/lib/config";
import { getViewer } from "@/services/viewer";

/** A link or a text post, never both. The rules sit beside the form rather than being discovered. */
export default function SubmitPage() {
  return (
    <PageShell nav="Submit" section="submit" aside={<Rules />}>
      <PageHead title="Submit" sub="A link or a text post, not both." />
      <Suspense fallback={<p className="mt-4 type-meta text-meta">Loading…</p>}>
        <Form />
      </Suspense>
    </PageShell>
  );
}

async function Form() {
  const viewer = await getViewer();

  // Signed out, the form is not offered at all — the debrief requires an account to submit.
  if (!viewer) {
    return (
      <Notice tone="info" action={<a href="/login" className="font-semibold underline underline-offset-2">Log in</a>}>
        Submitting needs an account. Reading does not.
      </Notice>
    );
  }

  return (
    <>
      {viewer.isNewAccount ? (
        <Notice tone="amber">
          Your account is less than {CFG.flagMinDays} days old, so flagging and downvoting are not
          available yet. Submitting and commenting are.
        </Notice>
      ) : null}
      <SubmitForm viewerName={viewer.user.username} />
    </>
  );
}

function Rules() {
  return (
    <DatasheetTable
      number={1}
      title="Submission rules"
      rows={[
        ["Title", `Required, 1–${TITLE_MAX} characters`],
        ["Content", "A URL or text, never both"],
        ["Duplicates", `A URL posted in the last ${CFG.dupDays} days opens the existing thread and counts your upvote`],
        ["Rate limit", `${CFG.ratePerHour} an hour per account, ${CFG.ratePerIp} per network`],
        ["Editing", `Title and text for ${CFG.editMinutes / 60} hours; the URL is fixed`],
        ["Deleting", "Only while nobody has commented"],
      ]}
      note="Illustrative limits; the final values are undecided."
    />
  );
}
