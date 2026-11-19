import { editWindow } from "@/lib/edit-window";
import type { StoryRowData } from "@/lib/rows";
import { StoryRow } from "./story-row";

/** The five-track grid, shared by the head band, the rows and the skeleton so nothing shifts. */
const TRACKS =
  "grid grid-cols-[26px_28px_1fr] gap-x-3 sm:grid-cols-[30px_70px_1fr_52px_74px]";

/**
 * Static, so it is built once rather than per render — and defined once, so the list and the
 * skeleton cannot drift apart. They must stay identical: the zero-layout-shift budget depends on
 * the loading state sitting on exactly the live grid.
 */
const HEAD_BAND = (
  <div aria-hidden="true" className={`${TRACKS} hidden bg-head px-1 py-[7px] type-label text-ink-2 sm:grid`}>
    <span className="text-right">#</span>
    <span className="text-right">Points</span>
    <span>Story</span>
    <span className="text-right">Age</span>
    <span className="text-right">Comments</span>
  </div>
);

/**
 * A ruled datasheet list: a 1.5 px ink rule opens it, a grey head band labels the columns, pale
 * rules divide the rows, and a 1 px ink rule closes it — DESIGN.md §Ranked List Rows.
 *
 * The head band is hidden at 640 px and below, where each row moves its figures into the meta line.
 */
export function StoryList({
  rows,
  viewerName,
  canFlag,
  voted,
  flagged,
}: {
  rows: StoryRowData[];
  viewerName: string | null;
  canFlag: boolean;
  /**
   * The post ids this viewer has already upvoted. One query for the whole page rather than a column
   * on the listing read, so the cached ranking stays the same bytes for everyone — ARCHITECTURE §5.
   */
  voted?: ReadonlySet<number>;
  /** The post ids this viewer has already flagged. One query for the page, like `voted`. */
  flagged?: ReadonlySet<number>;
}) {
  return (
    <div className="mt-4 rule-open">
      {HEAD_BAND}

      <ol className="rule-close">
        {rows.map((row) => (
          <StoryRow
            key={row.post.id}
            {...row}
            viewerName={viewerName}
            canFlag={canFlag}
            voted={voted?.has(row.post.id)}
            canEdit={editWindow(row.post.createdAt).open}
            flagged={flagged?.has(row.post.id)}
          />
        ))}
      </ol>
    </div>
  );
}

/**
 * The Suspense fallback. Bars sit on the exact same grid as a real row, so the list does not move
 * when the data arrives — the zero-layout-shift budget in ARCHITECTURE §6.3 depends on it.
 */
export function StoryListSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="mt-4 rule-open">
      {HEAD_BAND}

      <div className="rule-close" aria-busy="true" aria-label="Loading stories">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={`${TRACKS} items-start px-1 py-[7px] rule-divide`}>
            <Bar className="ml-auto w-4" />
            <Bar className="ml-auto hidden w-11 sm:block" />
            <span className="min-w-0">
              {/* Widths vary per row so the block reads as text, not as a progress bar. */}
              <Bar className="h-[14px]" style={{ width: `${52 + ((i * 37) % 40)}%` }} />
              <Bar className="mt-[8px] h-[10px]" style={{ width: `${24 + ((i * 13) % 18)}%` }} />
            </span>
            <Bar className="ml-auto hidden w-[30px] sm:block" />
            <Bar className="ml-auto hidden w-6 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`block h-[12px] pulse-skeleton rounded-hair bg-skeleton motion-reduce:animate-none ${className}`}
    />
  );
}
