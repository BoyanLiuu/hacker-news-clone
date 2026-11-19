"use client";

import { useEffect, useSyncExternalStore } from "react";

const STORE_KEY = "tally:collapsed:v1";

/**
 * Collapsed comment ids, held in localStorage and exposed as an external store.
 *
 * Versioned in the key, ids only — never comment bodies — and every access is wrapped, because
 * storage throws in private browsing and when the quota is full. A failure there costs the memory
 * of which threads were collapsed, nothing more.
 */
const listeners = new Set<() => void>();
let snapshot: ReadonlySet<number> | null = null;

function read(): ReadonlySet<number> {
  if (snapshot) return snapshot;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    snapshot = new Set(Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : []);
  } catch {
    snapshot = new Set();
  }
  return snapshot;
}

function setCollapsed(id: number, collapsed: boolean) {
  const next = new Set(read());
  if (collapsed) next.add(id);
  else next.delete(id);
  snapshot = next;

  try {
    localStorage.setItem(STORE_KEY, JSON.stringify([...next]));
  } catch {
    // Collapsing still works for this page view; it just will not be remembered.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The server cannot know what this device collapsed, so it always renders expanded. */
const serverSnapshot: ReadonlySet<number> = new Set();

/**
 * The toggle, one client component per comment.
 *
 * The comment tree itself stays server-rendered HTML: this renders the chevron and the "+N hidden"
 * label, then flips `data-collapsed` on the enclosing `<article>` so CSS can hide the body, the
 * footer, the replies and the vote column. Passing each subtree through a client boundary instead
 * would serialise every comment into the RSC payload.
 *
 * A single delegated controller was tried in place of this and measured 10 KB larger gzipped on a
 * 330-comment thread: a client-component reference with two props serialises more compactly than
 * the equivalent server-rendered button tree, and gzip already collapses the repetition. The
 * untested counter-argument is hydration cost — 330 subscriptions rather than one — which nobody
 * has measured, so it is not a reason to change this back without numbers.
 *
 * With JavaScript off nothing renders here and the whole tree stays open, which is what the
 * read-without-JS requirement wants anyway.
 */
export function CollapseToggle({ id, hidden }: { id: number; hidden: number }) {
  const collapsed = useSyncExternalStore(
    subscribe,
    () => read().has(id),
    () => serverSnapshot.has(id),
  );

  // Pushing the state onto the DOM is the legitimate use of an effect: updating an external system
  // with the latest state from React.
  useEffect(() => {
    const article = document.querySelector<HTMLElement>(`[data-comment="${id}"]`);
    if (article) article.dataset.collapsed = String(collapsed);
  }, [id, collapsed]);

  return (
    <button
      type="button"
      data-kbd-collapse=""
      onClick={() => setCollapsed(id, !collapsed)}
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Expand this comment and ${hidden} replies` : "Collapse this comment"}
      className="flex items-center gap-2 text-[12.5px] text-meta"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="shrink-0">
        <path
          d="M1.5 3 L5 7 L8.5 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
          className="origin-center step-120 transition-transform"
          style={{ transform: collapsed ? "rotate(-90deg)" : "none" }}
        />
      </svg>
      {collapsed && hidden > 0 ? <span className="font-semibold text-ink-2">+{hidden} hidden</span> : null}
    </button>
  );
}
