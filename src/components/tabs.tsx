import Link from "next/link";

/**
 * Tabs as links, not state: the current tab is in the URL, so a profile's comments tab is
 * shareable and works without JavaScript. The current one turns ink at 650 with the same 2 px
 * petrol underline the nav uses.
 */
export function Tabs({
  tabs,
  current,
}: {
  tabs: { href: string; label: string; count?: number; key: string }[];
  current: string;
}) {
  return (
    <nav aria-label="Sections" className="mt-7 flex items-stretch gap-6 border-b border-rule">
      {tabs.map((tab) => {
        const active = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-baseline gap-2 pb-[7px] text-[14px] ${
              active ? "font-[650] text-ink" : "font-medium text-ink-2"
            }`}
          >
            {tab.label}
            {tab.count === undefined ? null : (
              <span className="type-meta text-meta tabular-nums">{tab.count}</span>
            )}
            {active ? <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-[2px] bg-petrol" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
