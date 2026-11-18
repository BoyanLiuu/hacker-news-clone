import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { CFG } from "@/lib/config";
import { formatAge, formatUtcTime } from "@/lib/format";
import { getRankingFreshness } from "@/services/posts";
import { getAuthState, getViewer } from "@/services/viewer";

/**
 * Pinned locale. A bare toLocaleString() formats against the server's locale, so the thousands
 * separator would vary by host — and DESIGN.md pins every figure to tabular lining numerals.
 */
const COUNT = new Intl.NumberFormat("en-US");

/**
 * Static hrefs only. "Past" and /front/:date were removed in M9 — ARCHITECTURE Appendix G, Q4. Reading the
 * clock here would make the header depend on the request for the sake of one link.
 */
const NAV = [
  { href: "/", label: "Front" },
  { href: "/newest", label: "Newest" },
  { href: "/submit", label: "Submit" },
];

/** The square-and-diagonal mark. Authored, not a logo file — DESIGN.md §Title Block. */
function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Tally, front page">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <rect x="1.5" y="1.5" width="17" height="17" rx="2" fill="none" stroke="var(--color-petrol)" strokeWidth="1.5" />
        <path d="M6 14 L14 6" stroke="var(--color-petrol)" strokeWidth="1.5" strokeLinecap="square" />
        <path d="M10.5 6 H14 V9.5" stroke="var(--color-petrol)" strokeWidth="1.5" strokeLinecap="square" fill="none" />
      </svg>
      <span style={{ fontSize: 19, fontWeight: 750, letterSpacing: "-0.01em" }}>Tally</span>
    </Link>
  );
}

/** The current item turns ink at 650 with a 2px petrol underline on the row's bottom edge. */
function NavItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center whitespace-nowrap text-[14.5px] ${
        active ? "font-[650] text-ink" : "font-medium text-ink-2"
      }`}
    >
      {label}
      {active ? <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] bg-petrol" /> : null}
    </Link>
  );
}

/**
 * The wordmark and nav are the same for everyone, so they render immediately. The account block
 * and the document line are per-request and stream into the slots — both fixed-height, so nothing
 * shifts when they arrive.
 */
export function SiteHeader({
  current,
  account,
  doc,
}: {
  current: string;
  account: React.ReactNode;
  doc: React.ReactNode;
}) {
  return (
    <header>
      <div className="border-b border-tint-line bg-tint">
        <div className="mx-auto flex h-[52px] max-w-wrap items-stretch gap-6 px-4 sm:px-8">
          <div className="flex items-center">
            <Wordmark />
          </div>

          {/* On phones the nav moves to its own scrolling row below — DESIGN.md §Title Block.
              -mb-px lets the active underline sit on the band's bottom edge, over its 1px border. */}
          <nav aria-label="Sections" className="hidden items-stretch gap-5 -mb-px sm:flex">
            {NAV.map(({ href, label }) => (
              <NavItem key={label} href={href} label={label} active={label === current} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4 text-[14.5px] whitespace-nowrap">{account}</div>
        </div>

        {/* Phones: the nav as a 40px horizontally scrolling second row. */}
        <nav
          aria-label="Sections"
          className="mx-auto flex h-10 max-w-wrap items-stretch gap-5 overflow-x-auto px-4 sm:hidden"
        >
          {NAV.map(({ href, label }) => (
            <NavItem key={label} href={href} label={label} active={label === current} />
          ))}
        </nav>
      </div>

      {doc}
    </header>
  );
}

/**
 * Three states, matching `AuthState`. The middle one is the reason this is not a simple
 * signed-in/signed-out pair: a Clerk session with no username yet has nothing to put in a byline,
 * so it gets a link to finish rather than a name.
 *
 * `SignOutButton` is Clerk's — the old `/logout` route never existed, which nothing noticed because
 * phase 1 had no session to end.
 */
export async function AccountBlock() {
  const [viewer, state] = await Promise.all([getViewer(), getAuthState()]);

  if (state === "anonymous") {
    return (
      <Link href="/sign-in" className="font-semibold text-ink">
        Log in
      </Link>
    );
  }

  if (!viewer) {
    return (
      <Link href="/welcome" className="font-semibold text-ink">
        Choose a username
      </Link>
    );
  }

  return (
    <>
      <Link href={`/user/${viewer.user.username}`} className="font-semibold text-ink">
        {viewer.user.username}
      </Link>
      <span className="text-petrol-ink">{COUNT.format(viewer.user.karma)}</span>
      <Link href="/settings" className="text-ink-2">
        Settings
      </Link>
      <SignOutButton>
        <button type="button" className="text-ink-2 hover:underline">
          Log out
        </button>
      </SignOutButton>
    </>
  );
}

export function AccountFallback() {
  return <span aria-hidden="true" className="h-4 w-40 rounded-hair bg-petrol/10" />;
}

const DOC_ROW =
  "mx-auto flex h-[30px] max-w-wrap items-center gap-3 overflow-x-auto px-4 type-mono whitespace-nowrap max-sm:text-[11px] sm:px-8";

/**
 * Machine facts only: section, revision, when the ranking last ran, its age, gravity. One row that
 * scrolls rather than wraps, so it holds its 30px height.
 *
 * Turns amber with a live dot when the ranking is behind — and `stale` is now a measurement rather
 * than a literal. M5 left it hardcoded `false` on the grounds that staleness can only be true if
 * something recorded when the ordering was computed; M9's `RankedPost.computedAt` is that record.
 *
 * Stale means "older than twice the recompute interval". One missed tick is normal jitter for a
 * minute-scheduled job and amber for it would make the indicator noise; two means the job is not
 * running, which is worth saying on every page.
 *
 * `rankedAt` null means the job has never run, which is its own kind of stale — and reads as "never"
 * rather than as the current time, because showing `now()` there is what made the old version a lie.
 */
export async function DocumentLine({ section }: { section: string | Promise<string> }) {
  const [label, { at: rankedAt, stale }] = await Promise.all([section, getRankingFreshness()]);

  return (
    <div className={`border-b ${stale ? "border-amber-line bg-amber-bg" : "border-tint bg-tint/40"}`}>
      <div className={`${DOC_ROW} ${stale ? "text-amber" : "text-petrol-ink"}`}>
        {stale ? <span aria-hidden="true" className="size-[6px] shrink-0 rounded-full bg-amber" /> : null}
        <span>{label}</span>
        <span aria-hidden="true">·</span>
        <span>rev 862</span>
        <span aria-hidden="true">·</span>
        <span>ranked {rankedAt ? `${formatUtcTime(rankedAt)} UTC` : "never"}</span>
        <span aria-hidden="true">·</span>
        <span>{rankedAt ? `${formatAge(rankedAt)} ago` : "job not running"}</span>
        <span className="ml-auto">gravity {CFG.gravity.toFixed(1)}</span>
      </div>
    </div>
  );
}

/** Blank, but the same 30px height, so the line never shifts when the facts arrive. */
export function DocumentLineFallback() {
  return (
    <div className="border-b border-tint bg-tint/40">
      <div className={DOC_ROW} aria-hidden="true" />
    </div>
  );
}
