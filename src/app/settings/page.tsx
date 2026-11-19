import { DatasheetTable } from "@/components/datasheet-table";
import { SettingsForm } from "@/components/settings-form";
import { PageHead, PageShell } from "@/components/page-shell";
import { formatIsoDate } from "@/lib/format";
import { requireViewer } from "@/services/require";
import { getViewer } from "@/services/viewer";

/**
 * About text and the show-dead preference. Email and password are not here: Clerk owns identity
 * from M10, so duplicating them would give two owners for one piece of state.
 */
export default async function SettingsPage() {
  // Gated before streaming, so the redirect carries a status — see submit/page.tsx.
  await requireViewer();

  return (
    <PageShell nav="" section="settings" aside={<Account />}>
      <PageHead title="Settings" sub="Your profile and what you see." />
      {/* No boundary around a form — see `submit/page.tsx`. */}
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
