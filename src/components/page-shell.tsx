import { Suspense } from "react";
import { KeyboardNav } from "./keyboard-nav";
import { SiteFooter } from "./site-footer";
import {
  AccountBlock,
  AccountFallback,
  DocumentLine,
  DocumentLineFallback,
  SiteHeader,
} from "./site-header";

/**
 * Header, two-column grid, footer. Every page composes this rather than repeating the chrome.
 *
 * Deliberately synchronous, so the chrome flushes before any data read completes: the account
 * block, the document line and whatever the page streams into `children` each sit behind their own
 * boundary. The aside is a slot, not a render prop, so a page passes the element it wants.
 */
export function PageShell({
  nav,
  section,
  aside,
  rows,
  children,
}: {
  nav: string;
  section: string | Promise<string>;
  /** What `j`/`k` move through here, if anything. Drives both the keys and the footer's hint. */
  rows?: "comments" | "stories";
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        current={nav}
        account={
          <Suspense fallback={<AccountFallback />}>
            <AccountBlock />
          </Suspense>
        }
        doc={
          <Suspense fallback={<DocumentLineFallback />}>
            <DocumentLine section={section} />
          </Suspense>
        }
      />

      <main className="mx-auto w-full max-w-wrap grow px-4 pt-6 sm:px-8">
        {/* Only reserve the aside track when there is an aside; otherwise the page kept a 336px
            gap and squeezed its own content into what was left. */}
        <div className={aside ? "page-grid" : ""}>
          <div className="min-w-0">{children}</div>
          {/* The aside reads the viewer or the candidate set, so it streams like the list does. */}
          {aside ? (
            <aside className="page-aside">
              <Suspense fallback={null}>{aside}</Suspense>
            </aside>
          ) : null}
        </div>
      </main>

      <SiteFooter rows={rows} />
      {rows ? <KeyboardNav /> : null}
    </div>
  );
}

/** A page head: title on the baseline, with a meta subline beside it. */
export function PageHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 tabIndex={-1} className="type-title">
        {title}
      </h1>
      {sub ? <span className="text-[13.5px] text-meta">{sub}</span> : null}
    </div>
  );
}
