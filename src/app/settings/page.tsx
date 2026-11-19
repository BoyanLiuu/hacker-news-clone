import Link from "next/link";
import { DatasheetTable } from "@/components/datasheet-table";
import { SettingsForm } from "@/components/settings-form";
import { PageHead, PageShell } from "@/components/page-shell";
import { formatIsoDate } from "@/lib/format";
import { requireViewer } from "@/services/require";
import { getViewer } from "@/services/viewer";

/**
 * About text and the show-dead preference.
 *
 * Email and password are not here, they are on `/account`: Clerk owns identity from M10, so
 * duplicating the fields would give two owners for one piece of state. That page is also where
 * `<ClerkProvider>` is, which is why it is a page and not a section of this one — see
 * `app/(auth)/account`.
 */
export default async function SettingsPage() {
  // Gated before streaming, so the redirect carries a status — see submit/page.tsx.
  await requireViewer();

  return (
    <PageShell nav="" aside={<Account />}>
      <PageHead title="Settings" sub="Your profile and what you see." />
      <p className="mt-3 type-meta text-meta">
        Email, password and sign-in methods are on{" "}
        <Link href="/account" className="text-petrol-ink underline underline-offset-2">
          your account page
        </Link>
        .
      </p>
      {/* No boundary, and not for `submit/page.tsx`'s withdrawn reason: `Form` calls the same
          `requireViewer` the gate above already called, and it resolves from `loadSession`'s
          request cache. A boundary here would flash a fallback in place of data in memory. */}
      <Form />
    </PageShell>
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
    </>
  );
}

async function Form() {
  // Already gated by the page; `requireViewer` is how the type knows the viewer exists.
  const viewer = await requireViewer();

  return (
    <SettingsForm
      about={viewer.user.about}
      showDead={viewer.user.showDead}
      isNewAccount={viewer.isNewAccount}
      accountAgeDays={viewer.accountAgeDays}
    />
  );
}
