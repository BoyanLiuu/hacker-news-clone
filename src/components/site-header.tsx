import Link from "next/link";

const NAV = [
  { href: "/", label: "Front" },
  { href: "/newest", label: "Newest" },
  { href: "/past", label: "Past" },
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

type Viewer = { name: string; karma: number } | null;

export type DocumentLine = {
  section: string;
  rev: number;
  rankedAt: string;
  age: string;
  gravity: number;
  stale?: boolean;
};

/**
 * The 52px petrol-tint title block, then the 30px mono document line.
 * The current nav item sits on a 2px petrol underline flush with the band's bottom edge.
 */
export function SiteHeader({ current, viewer, doc }: { current: string; viewer: Viewer; doc: DocumentLine }) {
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
              <NavItem key={href} href={href} label={label} active={label === current} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4 text-[14.5px] whitespace-nowrap">
            {viewer ? (
              <>
                <Link href={`/user/${viewer.name}`} className="font-semibold text-ink">
                  {viewer.name}
                </Link>
                <span className="text-petrol-ink">{viewer.karma.toLocaleString()}</span>
                <Link href="/settings" className="text-ink-2">
                  Settings
                </Link>
                <Link href="/logout" className="text-ink-2">
                  Log out
                </Link>
              </>
            ) : (
              <Link href="/login" className="font-semibold text-ink">
                Log in
              </Link>
            )}
          </div>
        </div>

        {/* Phones: the nav as a 40px horizontally scrolling second row. */}
        <nav
          aria-label="Sections"
          className="mx-auto flex h-10 max-w-wrap items-stretch gap-5 overflow-x-auto px-4 sm:hidden"
        >
          {NAV.map(({ href, label }) => (
            <NavItem key={href} href={href} label={label} active={label === current} />
          ))}
        </nav>
      </div>

      {/* Machine facts only: section, revision, when the ranking last ran, its age, gravity.
          One row that scrolls rather than wraps — it must hold its 30px height. */}
      <div className={`border-b ${doc.stale ? "border-amber-line bg-amber-bg" : "border-tint bg-tint/40"}`}>
        <div
          className={`mx-auto flex h-[30px] max-w-wrap items-center gap-3 overflow-x-auto px-4 type-mono whitespace-nowrap max-sm:text-[11px] sm:px-8 ${
            doc.stale ? "text-amber" : "text-petrol-ink"
          }`}
        >
          {doc.stale ? (
            <span aria-hidden="true" className="size-[6px] shrink-0 rounded-full bg-amber" />
          ) : null}
          <span>{doc.section}</span>
          <span aria-hidden="true">·</span>
          <span>rev {doc.rev}</span>
          <span aria-hidden="true">·</span>
          <span>ranked {doc.rankedAt} UTC</span>
          <span aria-hidden="true">·</span>
          <span>{doc.age} ago</span>
          <span className="ml-auto">gravity {doc.gravity.toFixed(1)}</span>
        </div>
      </div>
    </header>
  );
}
