"use client";

import Link from "next/link";

/**
 * An unexpected failure. Offers a retry, because the common cause is transient — and says what
 * still works, because reading does not depend on whatever broke.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-wrap grow px-4 pt-16 sm:px-8">
        <h1 className="text-[26px] font-bold">Unexpected error</h1>
        <p className="mt-3 max-w-[68ch] type-reading text-ink-2">
          Something failed while building this page. Nothing you did caused it, and nothing was lost.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center rounded-hair bg-ink px-4 text-[14px] font-semibold text-paper hover:bg-ink-hover"
          >
            Try again
          </button>
          <Link href="/" className="type-meta text-ink underline decoration-text-button-underline underline-offset-[3px] hover:decoration-ink">
            Front page
          </Link>
        </div>
      </main>
    </div>
  );
}
