import { AXES, VIEWBOX, X_TICKS, Y_TICKS, xOf, yOf } from "@/lib/figure";

/**
 * Everything about Figure 1 that does not move: the grid, the axes, the ticks and the axis labels.
 *
 * Shared by the static server-rendered figure and the interactive one. They had identical copies,
 * which is the way two charts quietly stop looking like the same chart.
 */
export function FigureFrame() {
  return (
    <>
      <g stroke="#E6E9EB" strokeWidth="1">
        {X_TICKS.map((t) => (
          <line key={`vx${t}`} x1={xOf(t)} x2={xOf(t)} y1={AXES.top} y2={AXES.bottom} />
        ))}
        {Y_TICKS.map((p) => (
          <line key={`hy${p}`} x1={AXES.left} x2={AXES.right} y1={yOf(p)} y2={yOf(p)} />
        ))}
      </g>

      <g stroke="var(--color-ink)" strokeWidth="1">
        <line x1={AXES.left} x2={AXES.right} y1={AXES.bottom} y2={AXES.bottom} />
        <line x1={AXES.left} x2={AXES.left} y1={AXES.top} y2={AXES.bottom} />
      </g>

      <g className="fill-meta font-mono text-[9.5px]">
        {X_TICKS.map((t) => (
          <text key={`xt${t}`} x={xOf(t)} y={AXES.bottom + 13} textAnchor="middle">
            {t}
          </text>
        ))}
        {Y_TICKS.map((p) => (
          <text key={`yt${p}`} x={AXES.left - 5} y={yOf(p) + 3} textAnchor="end">
            {p}
          </text>
        ))}
      </g>

      <g className="fill-ink-2 text-[10px] font-semibold">
        <text x={AXES.right} y={VIEWBOX.height - 3} textAnchor="end">
          Age, hours
        </text>
        <text x={AXES.left + 4} y={AXES.top + 10}>
          Points
        </text>
      </g>
    </>
  );
}

/** Candidates that are not on this page: hollow, so the page's own stories read first. */
export function HollowPoints({ points }: { points: { id: number; ageHours: number; points: number }[] }) {
  return (
    <g fill="none" stroke="#9AA1A7" strokeWidth="1">
      {points.map((p) => (
        <circle key={p.id} cx={xOf(p.ageHours)} cy={yOf(p.points)} r="2.4" />
      ))}
    </g>
  );
}
