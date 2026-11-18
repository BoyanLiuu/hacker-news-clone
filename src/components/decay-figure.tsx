import {
  AXES,
  ISO_LINES,
  VIEWBOX,
  X_TICKS,
  Y_TICKS,
  dotRadius,
  isoLabel,
  isoPath,
  px,
  xOf,
  yOf,
} from "@/lib/figure";
import type { ScoredPost } from "@/lib/types";
import { FigureFrame, HollowPoints } from "./figure-frame";

export type FigurePoint = {
  id: number;
  rank: number;
  points: number;
  ageHours: number;
  commentCount: number;
  onThisPage: boolean;
};

export function toFigurePoints(candidates: ScoredPost[], pageIds: ReadonlySet<number>): FigurePoint[] {
  return candidates.map((row, i) => ({
    id: row.post.id,
    rank: i + 1,
    points: row.points,
    ageHours: row.ageHours,
    commentCount: row.post.commentCount,
    onThisPage: pageIds.has(row.post.id),
  }));
}

/**
 * Figure 1, the decay characteristic, as a server-rendered SVG.
 *
 * Filled ink dots are the stories on this page, sized by comment count; hollow dots are the other
 * candidates. The grey curves join stories of equal rank score, so **a story outranks every story
 * below its line** — which is the one thing a sorted list cannot show.
 *
 * Nothing here is interactive. The highlight and the gravity slider are a client component that
 * wraps this, so the figure itself costs no JavaScript to read.
 */
export function DecayFigure({
  points,
  gravity,
  children,
}: {
  points: FigurePoint[];
  gravity: number;
  /** Highlight overlay, supplied by the interactive wrapper. */
  children?: React.ReactNode;
}) {
  const onPage = points.filter((p) => p.onThisPage);
  const others = points.filter((p) => !p.onThisPage && p.ageHours < 96);

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      role="img"
      aria-labelledby="fig1-title fig1-desc"
      className="w-full"
    >
      <title id="fig1-title">Score against age</title>
      <desc id="fig1-desc">
        Each candidate story plotted by age in hours against points, on lines of equal rank score.
        {onPage.length} of {points.length} candidates are on this page.
      </desc>

      <FigureFrame />

      {/* Iso-rank lines, labelled with R. Straight because of the axes; the bend at the bottom
          left is the -1 in the ranking function, not a rendering artefact. */}
      <g fill="none" stroke="#C2C9CE" strokeWidth="1">
        {ISO_LINES.map((r) => (
          <path key={`iso${r}`} d={isoPath(r, gravity)} />
        ))}
      </g>
      <g className="fill-dim-3 font-mono text-[9.5px]">
        {ISO_LINES.map((r) => {
          const at = isoLabel(r, gravity);
          return (
            <text key={`isol${r}`} x={at.x} y={at.y} textAnchor={at.onTop ? "middle" : undefined}>
              {r === ISO_LINES[ISO_LINES.length - 1] ? `R ${r}` : r}
            </text>
          );
        })}
      </g>

      {/* Other candidates: hollow, so the page's own stories read first. */}
      <HollowPoints points={others} />

      <g fill="var(--color-ink)">
        {onPage.map((p) => (
          <circle
            key={p.id}
            data-point={p.id}
            cx={xOf(p.ageHours)}
            cy={yOf(p.points)}
            r={dotRadius(p.commentCount)}
          />
        ))}
      </g>

      {/* The top five are numbered, so the figure and the list can be read against each other. */}
      <g className="fill-ink font-mono text-[9px] font-semibold">
        {onPage.slice(0, 5).map((p) => (
          <text key={p.id} x={px(xOf(p.ageHours) + 7)} y={px(yOf(p.points) - 5)}>
            {p.rank}
          </text>
        ))}
      </g>

      {children}
    </svg>
  );
}

/** The caption: numbered in meta weight before a bold title, per DESIGN.md. */
export function FigureCaption({ gravity, live }: { gravity: number; live: number }) {
  return (
    <h2 className="type-section">
      <span className="pr-2 font-medium text-meta">Figure 1</span>
      Score against age
      {gravity !== live ? `, G = ${gravity.toFixed(1)}` : ""}
    </h2>
  );
}

export function FigureFootnote({ gravity, showHollow = true }: { gravity: number; showHollow?: boolean }) {
  return (
    <p className="mt-3 max-w-[70ch] text-[12px] leading-[1.5] text-meta">
      Filled points are the stories on this page; size shows comment count. Each line joins stories of
      equal rank score{" "}
      <span className="font-mono">
        R = (P − 1) / (T + 2)
        <sup>{gravity.toFixed(1)}</sup>
      </span>
      , labelled with R. A story outranks every story below its line.
      {showHollow ? " Hollow points are other candidates." : ""}
    </p>
  );
}
