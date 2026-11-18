import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";

/**
 * Inside the app shell, not a bare centred card: the header and the document line are what make
 * this look like Tally rather than a hosted form on a blank page.
 *
 * Wrapped in `Suspense` because the catch-all reads the URL with `usePathname()`.
 */
export default function Page() {
  return (
    <PageShell nav="" section="sign-up">
      <div className="mt-6 flex justify-center">
        <Suspense fallback={<p className="type-meta text-meta">Loading…</p>}>
          <SignUp />
        </Suspense>
      </div>
    </PageShell>
  );
}
