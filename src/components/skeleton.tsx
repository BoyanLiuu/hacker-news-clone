/**
 * The one skeleton bar. `aria-hidden`, because the container carries `role="status"` and the label
 * — the role being load-bearing, since an `aria-label` on a role-less `div` is not reliably exposed.
 *
 * No default height. Two Tailwind height utilities on one element are resolved by stylesheet order,
 * not class-string order, so a baked-in `h-[12px]` silently beat callers' `h-9`. Every caller
 * states its own.
 */
export function Bar({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`block pulse-skeleton rounded-hair bg-skeleton motion-reduce:animate-none ${className}`}
    />
  );
}

/**
 * A bar standing in for one line of text, inside a box of that line's real height — which is what
 * stops the skeleton shifting the page. Guessing at gaps gets the look right and the total height
 * wrong, and the error compounds: eight rows at 3 px out is a quarter of a row.
 */
export function TextLine({
  line,
  bar,
  width,
  className = "",
}: {
  /** The real computed line height, in px. */
  line: number;
  /** How tall to draw the bar inside it, in px. */
  bar: number;
  width: string;
  className?: string;
}) {
  return (
    <span className={`flex items-center ${className}`} style={{ height: `${line}px` }}>
      <Bar style={{ height: `${bar}px`, width }} />
    </span>
  );
}
