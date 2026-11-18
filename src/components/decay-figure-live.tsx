"use client";

import { LazyMotion, domAnimation, useReducedMotion, type Transition } from "motion/react";
import * as m from "motion/react-m";
import { useState } from "react";
import {
  AXES,
  ISO_LINES,
  VIEWBOX,
  dotRadius,
  isoLabel,
  isoPath,
  px,
  shownAge,
  xOf,
  yOf,
} from "@/lib/figure";
import { rank } from "@/lib/rank";
import type { FigurePoint } from "./decay-figure";
import { FigureFrame, HollowPoints } from "./figure-frame";

/**
 * The interactive figure: click a rank to highlight it, and move gravity to tilt the fan.
 *
 * This is the only place Motion is used in the product, and it passes the test in ARCHITECTURE
 * Appendix E — moving ~69 point positions and six iso-line path strings together, in step, is not
 * something CSS can express.
 *
 * No reading path pays for it: this module is only reached from /rank-debug, so Next's route
 * splitting already keeps Motion out of / and /item — measured, not assumed. Motion costs 32 KB gz
 * on this route, down from 43 KB by importing `m` from `motion/react-m` rather than `motion/react`;
 * LazyMotion then loads only the DOM animation features.
 *
 * Motion is configured against its own defaults: 120 ms stepped, not eased. DESIGN.md is explicit
 * that values step rather than glide, and a spring here would make a measuring instrument feel like
 * an app.
 */
/**
 * `steps(2, end)` as an easing function. Motion takes béziers or a custom function, not CSS step
 * timing, so the design's stepped motion has to be expressed as one: two discrete jumps rather
 * than a glide. A spring here would make a measuring instrument feel like an app.
 */
const stepped = (t: number) => Math.ceil(t * 2) / 2;
const STEP = { duration: 0.12, ease: stepped } satisfies Transition;

export function DecayFigureLive({
  points,
  gravity,
}: {
  points: FigurePoint[];
  gravity: number;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const transition: Transition = reduced ? { duration: 0 } : STEP;

  const onPage = points.filter((p) => p.onThisPage);
  const others = points.filter((p) => !p.onThisPage && p.ageHours < 96);
  const chosen = selected === null ? null : (points.find((p) => p.id === selected) ?? null);

  return (
    <LazyMotion features={domAnimation} strict>
      <svg
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        role="img"
        aria-labelledby="figl-title figl-desc"
        className="w-full"
      >
        <title id="figl-title">Score against age</title>
        <desc id="figl-desc">
          Each candidate plotted by age against points, on lines of equal rank score. Gravity is{" "}
          {gravity.toFixed(1)}.
        </desc>

        <FigureFrame />

        {/* The lines tilt as gravity moves. That tilt is the lesson: gravity is the slope. */}
        <g fill="none" stroke="#C2C9CE" strokeWidth="1">
          {ISO_LINES.map((r) => (
            <m.path key={`iso${r}`} animate={{ d: isoPath(r, gravity) }} transition={transition} />
          ))}
        </g>
        <g className="fill-dim-3 font-mono text-[9.5px]">
          {ISO_LINES.map((r) => {
            const at = isoLabel(r, gravity);
            return (
              <m.text
                key={`isol${r}`}
                animate={{ x: at.x, y: at.y }}
                transition={transition}
                textAnchor={at.onTop ? "middle" : undefined}
              >
                {r === ISO_LINES[ISO_LINES.length - 1] ? `R ${r}` : r}
              </m.text>
            );
          })}
        </g>

        <HollowPoints points={others} />

        {/* Points are buttons: the figure is how you ask "why is this one here?". */}
        <g>
          {onPage.map((p) => (
            <circle
              key={p.id}
              cx={xOf(p.ageHours)}
              cy={yOf(p.points)}
              r={Math.max(dotRadius(p.commentCount), 6)}
              fill="transparent"
              className="cursor-pointer focus-visible:outline-2 focus-visible:outline-petrol"
              role="button"
              tabIndex={0}
              aria-label={`No. ${p.rank}, ${p.points} points at ${p.ageHours.toFixed(1)} hours`}
              onClick={() => setSelected(selected === p.id ? null : p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(selected === p.id ? null : p.id);
                }
              }}
            />
          ))}
          {onPage.map((p) => (
            <circle
              key={`dot${p.id}`}
              cx={xOf(p.ageHours)}
              cy={yOf(p.points)}
              r={dotRadius(p.commentCount)}
              fill="var(--color-ink)"
              pointerEvents="none"
            />
          ))}
        </g>

        <g className="fill-ink font-mono text-[9px] font-semibold" pointerEvents="none">
          {onPage.slice(0, 5).map((p) => (
            <text key={p.id} x={px(xOf(p.ageHours) + 7)} y={px(yOf(p.points) - 5)}>
              {p.rank}
            </text>
          ))}
        </g>

        {chosen ? <Highlight point={chosen} gravity={gravity} transition={transition} /> : null}
      </svg>

      {chosen ? <Readout point={chosen} gravity={gravity} /> : null}

    </LazyMotion>
  );
}

/** The selected story's own iso-line, a ring, and crosshairs to both axes. */
function Highlight({
  point,
  gravity,
  transition,
}: {
  point: FigurePoint;
  gravity: number;
  transition: Transition;
}) {
  const r = rank(point.points, shownAge(point.ageHours), gravity);
  const x = xOf(point.ageHours);
  const y = yOf(point.points);

  return (
    <g pointerEvents="none">
      <m.path
        animate={{ d: isoPath(r, gravity) }}
        transition={transition}
        fill="none"
        stroke="var(--color-petrol)"
        strokeWidth="1.6"
      />
      <line x1={x} x2={x} y1={y} y2={AXES.bottom} stroke="var(--color-petrol)" strokeDasharray="3 2" />
      <line x1={AXES.left} x2={x} y1={y} y2={y} stroke="var(--color-petrol)" strokeDasharray="3 2" />
      <circle cx={x} cy={y} r="9" fill="none" stroke="var(--color-petrol)" strokeWidth="1.5" />
      <circle cx={x} cy={y} r="5" fill="var(--color-petrol)" />
    </g>
  );
}

/** The arithmetic, with the real numbers substituted — the figure's whole claim, checkable. */
function Readout({ point, gravity }: { point: FigurePoint; gravity: number }) {
  // Ages arrive rounded, so what is printed is what was computed. See shownAge().
  const age = shownAge(point.ageHours);
  const r = rank(point.points, age, gravity);
  return (
    <div className="mt-2 rounded-hair bg-tint px-3 py-2 font-mono text-[11.5px] leading-[1.5] text-petrol-ink">
      No. {point.rank} · {point.points} pts at {age.toFixed(1)} h
      <br />R = ({point.points} − 1) / ({age.toFixed(1)} + 2)
      <sup>{gravity.toFixed(1)}</sup> = {r.toFixed(2)}
    </div>
  );
}

export function GravitySlider({
  gravity,
  live,
  onChange,
}: {
  gravity: number;
  live: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
      <label htmlFor="gravity" className="text-[13.5px] font-semibold">
        Gravity, G
      </label>
      <input
        id="gravity"
        type="range"
        min={0.6}
        max={3}
        step={0.1}
        value={gravity}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-[220px] accent-petrol"
      />
      <span className="font-mono text-[15px] text-petrol-ink">{gravity.toFixed(1)}</span>
      <span className="type-meta text-meta">
        Live value {live.toFixed(1)}. Lower favours points; higher favours freshness.
      </span>
    </div>
  );
}
