import { Suspense } from "react";
import { DatasheetTable } from "@/components/datasheet-table";
import { Field, PrimaryButton, textInputClass } from "@/components/field";
import { Notice } from "@/components/notice";
import { PageHead, PageShell } from "@/components/page-shell";
import { CFG } from "@/lib/config";
import { formatIsoDate } from "@/lib/format";
import { getViewer, SIGNED_OUT } from "@/services/viewer";

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

  return (
    <>
      {viewer ? (
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
      ) : null}
      <ViewerSwitch current={viewer?.user.username ?? SIGNED_OUT} />
    </>
  );
}

/** One account per state worth looking at, named by the state rather than by the username. */
const VIEWERS = [
  { as: "mlin", label: "established" },
  { as: "fernhill", label: "new account" },
  { as: "moss", label: "moderator" },
  { as: SIGNED_OUT, label: "signed out" },
] as const;

/**
 * The fixture viewer switch. Six of M5's surfaces are states of *who is looking*, and without a
 * control they would each need a code edit to look at — which means they would stop being checked.
 *
 * Phase 1 only, and labelled as such on the page rather than hidden, because an unexplained control
 * that changes your identity is worse than no control. M10 deletes this with `/preview`.
 */
function ViewerSwitch({ current }: { current: string }) {
  return (
    <section className="mt-8">
      <h2 className="type-section">Preview as</h2>
      <p className="mt-1 type-meta text-meta">
        A build-time switch over the sample accounts, so the new-account, moderator and signed-out
        states can be read. It goes away with real sign-in.
      </p>

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 type-meta">
        {VIEWERS.map(({ as, label }) => (
          <li key={as}>
            {as === current ? (
              <span className="font-semibold text-ink">{label}</span>
            ) : (
              <a
                href={`/preview?as=${as}&to=%2Fsettings`}
                className="text-petrol-ink underline underline-offset-2"
              >
                {label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
