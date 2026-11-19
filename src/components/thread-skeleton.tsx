import { Bar, TextLine } from "./skeleton";

/**
 * The loading states for `/item` and `/reply`.
 *
 * Same principle as `StoryListSkeleton`: render the real chrome — rules, indent borders, the reply
 * box — and bar only the text. Anything rendered for real cannot drift from what it stands in for.
 *
 * Two components rather than one with a flag, because the pages do not stack the same way: `/item`
 * is headline, box, comments; `/reply` is breadcrumb, comment, box.
 */

/** Line heights measured off the live page, not chosen here — `TextLine` needs real numbers. */
const LINE = { meta: 19.5, body: 23.7, headline: 30 } as const;

/** `CommentBody`'s own measure, so bars wrap where the text will. */
const BODY_MEASURE = "max-w-[70ch]";

/** Deterministic variation, so the bars read as text rather than as a progress meter. */
function widthFor(seed: number, min: number, spread: number): string {
  return `${min + ((seed * 37) % spread)}%`;
}

/**
 * A real disabled `<textarea rows={4}>`, not bars: the same element with the same `rows` cannot be
 * wrong about its own height, where a guessed bar stack would shift every comment below it. Not
 * pulsed, because it already looks like what it becomes.
 */
function ReplyBoxSkeleton({ submitWidth }: { submitWidth: string }) {
  return (
    <div className="mt-4 max-w-[795px]">
      <textarea
        rows={4}
        disabled
        aria-hidden="true"
        tabIndex={-1}
        className="w-full resize-none rounded-hair border border-field bg-white px-[10px] py-2 text-[15px]"
      />
      {/* 36 px tall and 124 px wide: the real "Add comment" button, measured. */}
      <Bar className="mt-3 h-9" style={{ width: submitWidth }} />
    </div>
  );
}

/**
 * Indentation drawn by nesting the real `comment-children` utility, which carries the left rule and
 * the 34 px offset. Repeating the wrapper is what gets the stacked rules a deep reply really has;
 * one wrapper with a computed margin would land in the right place with the wrong number of lines
 * beside it.
 */
function Indent({ depth, children }: { depth: number; children: React.ReactNode }) {
  let node = children;
  for (let i = 0; i < depth; i += 1) {
    node = <div className="comment-children mt-1">{node}</div>;
  }
  return node;
}

/** One comment row, on the live row's own rhythm: meta line, `mt-1`, body, `mt-1`, actions. */
function CommentRowSkeleton({ seed, lines }: { seed: number; lines: number }) {
  return (
    <div className="pt-3">
      <div className="flex items-start gap-2">
        {/* The 26 px vote column, with the arrow's own footprint in it. */}
        <div className="flex w-[26px] shrink-0 justify-center pt-[3px]">
          <Bar className="h-[13px] w-[13px]" />
        </div>

        <div className="min-w-0 flex-1">
          {/* Byline, age and the parent link. */}
          <TextLine line={LINE.meta} bar={11} width={widthFor(seed, 26, 16)} />

          <div className={`mt-1 ${BODY_MEASURE}`}>
            {Array.from({ length: lines }, (_, i) => (
              <TextLine
                key={i}
                line={LINE.body}
                bar={14}
                // The last line of a paragraph runs short; the rest fill the measure.
                width={i === lines - 1 ? widthFor(seed + i, 38, 30) : "100%"}
              />
            ))}
          </div>

          {/* The reply link. */}
          <TextLine line={LINE.meta} bar={11} width="34px" className="mt-1" />
        </div>
      </div>
    </div>
  );
}

/** Depth and paragraph length per row, shaped like a real argument rather than a flat list. */
const THREAD_SHAPE: readonly { depth: number; lines: number }[] = [
  { depth: 0, lines: 1 },
  { depth: 1, lines: 3 },
  { depth: 2, lines: 1 },
  { depth: 2, lines: 2 },
  { depth: 1, lines: 1 },
  { depth: 0, lines: 2 },
  { depth: 1, lines: 1 },
  { depth: 0, lines: 1 },
];

function CommentRowsSkeleton({ shape }: { shape: readonly { depth: number; lines: number }[] }) {
  return (
    <>
      {shape.map((row, i) => (
        <Indent key={i} depth={row.depth}>
          <CommentRowSkeleton seed={i + 1} lines={row.lines} />
        </Indent>
      ))}
    </>
  );
}

/** `/item`: the story, the reply box, then the discussion. */
export function ThreadSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading the discussion">
      <header className="rule-close pb-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 pt-[5px]">
            <Bar className="h-[14px] w-[14px]" />
          </div>
          <div className="min-w-0 flex-1">
            <TextLine line={LINE.headline} bar={22} width="62%" />
            <TextLine line={LINE.meta} bar={11} width="46%" className="mt-2" />
          </div>
        </div>
      </header>

      <ReplyBoxSkeleton submitWidth="124px" />

      <div className="mt-6">
        <CommentRowsSkeleton shape={THREAD_SHAPE} />
      </div>
    </div>
  );
}

/** `/reply`: the breadcrumb, the comment and its subtree, then the reply box. */
export function PermalinkSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading the comment">
      <TextLine line={LINE.meta} bar={11} width="54%" />

      <div className="mt-2 rule-open">
        <CommentRowsSkeleton shape={THREAD_SHAPE.slice(0, 4)} />
      </div>

      {/* "Reply" rather than "Add comment", so a narrower button. */}
      <ReplyBoxSkeleton submitWidth="76px" />
    </div>
  );
}
