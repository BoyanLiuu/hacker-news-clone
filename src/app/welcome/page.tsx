import { redirect } from "next/navigation";
import { PageHead, PageShell } from "@/components/page-shell";
import { getAuthState } from "@/services/viewer";
import { ClaimForm } from "./claim-form";

/** Claim a username. The one page a signed-in account without one is allowed to see. */
export default async function WelcomePage() {
  // Before streaming: signed out there is nothing to name, and already named this is a dead end.
  const state = await getAuthState();
  if (state === "anonymous") redirect("/sign-in");
  if (state === "active") redirect("/");

  return (
    <PageShell nav="">
      <PageHead title="Choose a username" sub="Permanent, and the address of your profile." />
      <ClaimForm />
    </PageShell>
  );
}


