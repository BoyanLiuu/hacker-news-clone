import { UserProfile } from "@clerk/nextjs";
import { Suspense } from "react";
import { PageHead, PageShell } from "@/components/page-shell";
import { requireViewer } from "@/services/require";

/**
 * Email, password and connected accounts — Clerk's own `<UserProfile/>`.
 *
 * Here rather than on `/settings`, which is the one thing M10's checklist left unbuilt. The
 * component is a client component and needs `<ClerkProvider>`, which M14 confined to this route
 * group after measuring it at 132.5 KB gz on every page beneath it. Putting it on `/settings` would
 * have put that cost back on a page whose own job is two fields and a checkbox; a separate page
 * keeps the bill where the feature is. `/settings` links here.
 *
 * A catch-all segment because `<UserProfile/>` routes its own sub-pages (security, connections)
 * underneath this path, and `Suspense` because it reads the URL with `usePathname()`.
 *
 * Gated in the page body, before streaming, so a signed-out visitor gets a real 307 — the same
 * reason as `submit/page.tsx`.
 */
export default async function AccountPage() {
  await requireViewer();

  return (
    <PageShell nav="" section="account">
      <PageHead title="Account" sub="Email, password and sign-in methods." />
      <div className="mt-4">
        <Suspense fallback={<p className="type-meta text-meta">Loading…</p>}>
          <UserProfile routing="path" path="/account" />
        </Suspense>
      </div>
    </PageShell>
  );
}
