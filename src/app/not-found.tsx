import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

/**
 * Unknown post or comment id. Deliberately plain: a 404 is a dead end, and the one useful thing on
 * it is the way out. No shell chrome: a dead end does not need a nav, and this page is reachable
 * before any request data has been read.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-wrap grow px-4 pt-16 sm:px-8">
        <h1 className="text-[26px] font-bold">Not found</h1>
        <p className="mt-3 max-w-[68ch] type-reading text-ink-2">
          That story or comment does not exist. It may have been deleted, or the address may have a
          typo in it.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-9 items-center rounded-hair bg-ink px-4 text-[14px] font-semibold text-paper hover:bg-ink-hover"
        >
          Back to the front page
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
