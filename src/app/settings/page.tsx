import { Suspense } from "react";
import { DatasheetTable } from "@/components/datasheet-table";
import { Field, PrimaryButton, textInputClass } from "@/components/field";
import { Notice } from "@/components/notice";
import { PageHead, PageShell } from "@/components/page-shell";
import { CFG } from "@/lib/config";
import { formatIsoDate } from "@/lib/format";
import { getViewer } from "@/services/viewer";

/**
 * About text and the show-dead preference. Email and password are not here: Clerk owns identity
 * from M10, so duplicating them would give two owners for one piece of state.
 */
export default function SettingsPage() {
  return (
    <PageShell nav="" section="settings" aside={<Account />}>
      <PageHead title="Settings" sub="Your profile and what you see." />
      <Suspense fallback={<p className="mt-4 type-meta text-meta">Loading…</p>}>
        <Form />
      </Suspense>
    </PageShell>
  );
}

async function Form() {
  const viewer = await getViewer();

  if (!viewer) {
    return <Notice tone="info">Settings need an account.</Notice>;
  }

  return (
    <form className="max-w-[640px]">
      {viewer.isNewAccount ? (
        <Notice tone="amber">
          New accounts cannot flag or downvote. Yours is {viewer.accountAgeDays} day{viewer.accountAgeDays === 1 ? "" : "s"} old;
          both unlock at {CFG.flagMinDays} days and {CFG.flagMinKarma} karma.
        </Notice>
      ) : null}

      <Field name="about" label="About" hint="Shown on your profile. Same formatting as comments.">
        <textarea
          id="about"
          name="about"
          rows={4}
          defaultValue={viewer.user.about}
          className={textInputClass(false)}
        />
      </Field>

      <div className="mt-6">
        <label className="flex items-start gap-3 text-[15px]">
          <input
            type="checkbox"
            name="showDead"
            defaultChecked={viewer.user.showDead}
            className="mt-[3px] size-4 accent-petrol"
          />
          <span>
            Show dead posts
            <span className="mt-1 block type-meta text-meta">
              Flagged items stay out of listings by default. They are always readable at their own link.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-7">
        <PrimaryButton type="submit">Save</PrimaryButton>
      </div>
    </form>
  );
}

async function Account() {
  const viewer = await getViewer();
  if (!viewer) return null;

  return (
    <DatasheetTable
      number={1}
      title="Account"
      rows={[
        ["Username", viewer.user.username],
        ["Joined", formatIsoDate(viewer.user.createdAt)],
        ["Karma", String(viewer.user.karma)],
        ["Moderator", viewer.user.isModerator ? "Yes" : "No"],
      ]}
      note="Username is permanent: it is your profile address and every byline you have written."
    />
  );
}
