import Link from "next/link";
import type { Page } from "@/lib/types";
import { EmptyState } from "./empty-state";

/**
 * True when the list has rows but this page number is past the end — someone edited `?p=` by hand.
 * Distinct from an empty list, which needs a different explanation.
 */
export function pageOutOfRange(page: Page<unknown>): boolean {
  return page.total > 0 && page.items.length === 0;
}

/**
 * Says so, rather than rendering an empty list under "Page 99 of 3". Every other dead end in the
 * app explains itself; this one was the exception.
 */
export function OutOfRange({ page, basePath, query = {} }: { page: Page<unknown>; basePath: string; query?: Record<string, string> }) {
  const lastPage = Math.max(1, Math.ceil(page.total / page.pageSize));
  const firstHref = Object.keys(query).length ? `${basePath}?${new URLSearchParams(query)}` : basePath;

  return (
    <EmptyState heading={`There is no page ${page.page}`} action={{ href: firstHref, label: "Back to page 1" }}>
      This list runs to page {lastPage}, at {page.pageSize} per page.
    </EmptyState>
  );
}

/**
 * Page links as type, not boxed buttons — lists never get boxed controls (DESIGN.md §Text Buttons).
 *
 * Anchors rather than form controls, and that outlived the no-JS requirement it was first written
 * for: a page is a location, so it has to be shareable, crawlable and reachable with the back
 * button, none of which a button gives you.
 */
export function Pager({ page, basePath, query = {} }: { page: Page<unknown>; basePath: string; query?: Record<string, string> }) {
  if (page.total <= page.pageSize) return null;

  const href = (p: number) => {
    const params = new URLSearchParams({ ...query, p: String(p) });
    return `${basePath}?${params}`;
  };
  const lastPage = Math.ceil(page.total / page.pageSize);

  return (
    <nav aria-label="Pages" className="mt-4 flex items-baseline gap-4 type-meta text-meta">
      {page.page > 1 ? (
        <Link href={href(page.page - 1)} className="font-semibold text-ink underline decoration-text-button-underline underline-offset-[3px] hover:decoration-ink">
          Previous
        </Link>
      ) : null}

      <span>
        Page {page.page} of {lastPage}
      </span>

      {page.hasNext ? (
        <Link href={href(page.page + 1)} className="font-semibold text-ink underline decoration-text-button-underline underline-offset-[3px] hover:decoration-ink">
          Next
        </Link>
      ) : null}
    </nav>
  );
}

/** Reads `?p=` into a 1-based page number, ignoring anything that is not a positive integer. */
export function pageFromParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}
