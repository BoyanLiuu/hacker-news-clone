"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SHORTCUTS } from "@/lib/shortcuts";

/**
 * Keyboard navigation: `j`/`k` to move, `u` to vote, `x` to collapse, `?` for the key list.
 *
 * One delegated island, not one per row — the opposite of `CollapseToggle`, and for a reason that
 * is not inconsistency: collapse has a piece of state per comment, so per-row components serialise
 * more compactly than a controller plus server-rendered buttons (measured in M3). A cursor is a
 * single position and the keys are a single document listener, so there is nothing to split.
 *
 * Rows are found in the DOM by `data-kbd-row` rather than passed in as props. Passing them would
 * mean serialising every row's id into the RSC payload for a feature most readers never use, and
 * the elements have to be reached anyway to scroll them and to click their controls.
 *
 * Acting by clicking the real control is deliberate. `u` finds the row's vote button and clicks it,
 * so the Server Action, the optimistic count, the karma gate and the self-vote refusal all behave
 * exactly as they do for a mouse. A second implementation of voting that happened to agree today is
 * the kind of thing that stops agreeing.
 */
export function KeyboardNav() {
  /**
   * The cursor position is a ref, not state, because nothing renders it — the cursor is painted
   * onto the DOM by `paint`. As state it was a dependency of the keydown effect, so every `j`
   * removed and re-added a document listener; as a ref the listener is registered once per dialog
   * state. This is the transient-value-in-a-ref case, and the index is only ever read in the
   * handler.
   */
  const index = useRef<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Where focus was before the dialog took it, so Escape can give it back.
  const restoreFocus = useRef<HTMLElement | null>(null);

  const rows = useCallback(
    () => [...document.querySelectorAll<HTMLElement>("[data-kbd-row]")],
    [],
  );

  /** Paint the cursor on one row and clear the rest. CSS owns what that looks like. */
  const paint = useCallback(
    (next: number | null) => {
      const all = rows();
      for (const row of all) delete row.dataset.cursor;
      if (next === null) return;

      const row = all[next];
      if (!row) return;
      row.dataset.cursor = "true";
      // `nearest` so moving down a long thread does not yank the viewport on every keystroke.
      row.scrollIntoView({ block: "nearest" });
    },
    [rows],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Never steal a key from a field. Without this, typing a comment containing "x" collapses
      // the thread under the cursor, and "u" casts a vote.
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        return;
      }
      // Leave browser and OS shortcuts alone.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape" && helpOpen) {
        event.preventDefault();
        setHelpOpen(false);
        return;
      }

      // `aria-modal` promises focus stays inside. The dialog holds exactly one focusable thing —
      // its close button — so the trap is just "keep Tab on it" rather than a cycle through a list.
      if (helpOpen && event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        restoreFocus.current = document.activeElement as HTMLElement | null;
        setHelpOpen((open) => !open);
        return;
      }

      // While the dialog is open it owns the keyboard; only Escape and `?` above get through.
      if (helpOpen) return;

      const all = rows();
      if (all.length === 0) return;

      switch (event.key) {
        case "j":
        case "k": {
          event.preventDefault();
          const current = index.current;
          const next =
            current === null
              ? 0
              : event.key === "j"
                ? Math.min(current + 1, all.length - 1)
                : Math.max(current - 1, 0);
          index.current = next;
          paint(next);
          return;
        }
        case "u":
        case "x": {
          if (index.current === null) return;
          const row = all[index.current];
          if (!row) return;

          // The row's own control, so every rule the mouse path enforces still applies. Absent —
          // signed out, your own item, a listing with nothing to collapse — the key does nothing,
          // which is the honest outcome rather than a message about a control that is not there.
          const selector = event.key === "u" ? "[data-kbd-vote]" : "[data-kbd-collapse]";
          const control = row.querySelector<HTMLElement>(selector);
          if (!control) return;

          event.preventDefault();
          control.click();
          return;
        }
        default:
          return;
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [helpOpen, paint, rows]);

  // Focus the dialog when it opens so Escape reaches it and a screen reader announces it; hand
  // focus back on close, which is what makes the dialog usable without a mouse at all.
  useEffect(() => {
    if (helpOpen) {
      closeRef.current?.focus();
      return;
    }
    // Only give focus back if the dialog actually took it; on first render there is nothing to
    // restore, and focusing null would steal focus from wherever the reader had put it.
    restoreFocus.current?.focus();
    restoreFocus.current = null;
  }, [helpOpen]);

  if (!helpOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      onClick={() => setHelpOpen(false)}
    >
      {/* The one floating surface in the design — DESIGN.md §Elevation permits a shadow here and
          nowhere else. Clicks inside must not reach the backdrop's dismiss handler. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kbd-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[380px] rounded-soft border border-rule bg-paper px-5 py-4 shadow-dialog outline-none"
      >
        <h2 id="kbd-title" className="type-title">
          Keyboard
        </h2>

        <dl className="mt-3">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.short}
              className="flex items-baseline justify-between gap-4 py-[5px] rule-divide"
            >
              <dt className="flex items-baseline gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded-hair border border-rule bg-well px-[6px] py-[1px] font-mono text-[12px] text-ink"
                  >
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd className="type-meta text-meta">{shortcut.long}</dd>
            </div>
          ))}
        </dl>

        {/* A real button, not only Escape: a touch user has no Escape key, and `aria-modal` needs
            something focusable inside for the Tab trap to hold on to. */}
        <div className="mt-4 flex items-baseline justify-between">
          <p className="type-meta text-meta">
            Or press <kbd className="font-mono">Esc</kbd>.
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setHelpOpen(false)}
            className="inline-flex h-9 items-center rounded-hair border border-field bg-white px-4 text-[14px] font-semibold text-ink hover:border-field-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

