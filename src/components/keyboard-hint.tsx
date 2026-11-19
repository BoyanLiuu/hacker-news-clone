import { SHORTCUTS } from "@/lib/shortcuts";

/**
 * The footer's `j k move · u vote · x collapse · ?` hint.
 *
 * Shipped with the keys and not before, which the plan was explicit about: the hint had never been
 * rendered, and a footer advertising shortcuts the build does not have is worse than a missing hint,
 * because the only way to find out is to try them.
 *
 * Reads the same `SHORTCUTS` the dialog does, so the two cannot come to disagree. A listing drops
 * the collapse key, because there is nothing on a listing to collapse.
 *
 * `aria-hidden`, and hidden below 640 px: it is a visual reminder of keys that need a hardware
 * keyboard, the dialog is the accessible version of the same information, and a screen reader
 * reading "j k move · u vote" out of a footer is noise.
 */
export function KeyboardHint({ rows }: { rows: "comments" | "stories" }) {
  const shown = SHORTCUTS.filter((shortcut) => rows === "comments" || !shortcut.comments);

  return (
    <span className="hidden items-baseline gap-[6px] sm:flex" aria-hidden="true">
      {shown.map((shortcut, i) => (
        <span key={shortcut.short} className="flex items-baseline gap-[6px]">
          {i > 0 ? <span className="text-rule">·</span> : null}
          {shortcut.keys.map((key) => (
            <kbd key={key} className="font-mono text-[11.5px] text-ink-2">
              {key}
            </kbd>
          ))}
          <span>{shortcut.short}</span>
        </span>
      ))}
    </span>
  );
}
