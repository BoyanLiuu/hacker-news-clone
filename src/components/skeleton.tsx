/**
 * The one skeleton bar.
 *
 * Lived in `story-list.tsx` until the thread needed it too. It is `aria-hidden`, and the container
 * carries `role="status"` with an `aria-busy` label, so a screen reader hears "loading the
 * discussion" once rather than counting forty anonymous boxes. The role is load-bearing: an
 * `aria-label` on a role-less `div` is not reliably exposed, which is how the listing skeleton
 * announced nothing at all.
 *
 * No height of its own. A default here could not be overridden reliably from `className`: two
 * Tailwind height utilities on one element are decided by the order they appear in the generated
 * stylesheet, not by the order they appear in the string, so `h-9` lost to a baked-in `h-[12px]`
 * and the submit button rendered as a hairline. Every caller states its height.
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
 * A bar standing in for one line of text, inside a box of that line's real height.
 *
 * This is what keeps a skeleton from shifting the page. Stacking bars and guessing at the gaps gets
 * the look right and the total height wrong, and the error compounds down a long column — eight
 * comment rows at 3 px out each is a quarter of a row. Giving the wrapper the line height the live
 * type actually computes to means the bar can be any weight that reads well without moving
 * anything below it.
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
