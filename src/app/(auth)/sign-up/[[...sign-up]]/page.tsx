import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";

/**
 * Inside the app shell, not a bare centred card: the header and nav are what make this look like
 * ByteBoard rather than a hosted form on a blank page.
 *
 * Wrapped in `Suspense` because the catch-all reads the URL with `usePathname()`.
 */
export default function Page() {
  return (
    <PageShell nav="">
      <div className="mt-6 flex justify-center">
        <Suspense fallback={<p className="type-meta text-meta">Loading…</p>}>
          <SignUp />
        </Suspense>
      </div>
    </PageShell>
  );
}
