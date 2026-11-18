"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { VIEWBOX } from "@/lib/figure";
import { formatCount } from "@/lib/format";
import { rank } from "@/lib/rank";
import { GravitySlider } from "./gravity-slider";

/**
 * Motion reaches the browser only here, and only after this page does.
 *
 * `bundle-dynamic-imports`: Motion is the one animated target in the product (ARCHITECTURE
 * Appendix E), and it is worth 31.1 KB gz on exactly one route. Loading it with the route rather than
 * with the app keeps it off every reading path, which is what N3 and N10 ask for — the front page
 * renders the same figure statically for the same reason.
 *
 * The placeholder holds the figure's exact aspect ratio, so arriving costs no layout shift (N8).
 */
const DecayFigureLive = dynamic(
  () => import("./decay-figure-live").then((mod) => ({ default: mod.DecayFigureLive })),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="w-full rounded-hair bg-well"
        style={{ aspectRatio: `${VIEWBOX.width} / ${VIEWBOX.height}` }}
      />
    ),
  },
);

export type DebugRow = {
  id: number;
  liveRank: number;
  title: string;
  points: number;
  ageHours: number;
  commentCount: number;
};

/**
 * The figure, the gravity knob and the per-term table, kept in step.
 *
 * Rescoring happens here rather than on the server: the candidate set is already in hand, and
 * `rank()` is the same function the server used, so moving the slider is arithmetic rather than a
 * round trip. The live ordering is untouched — this is a view, not a setting.
 */
export function RankDebug({ rows, live, total }: { rows: DebugRow[]; live: number; total: number }) {
  const [gravity, setGravity] = useState(live);

  const scored = useMemo(() => {
    // Ages arrive already rounded, so one value drives the order, the printed arithmetic and the
    // figure. Every row's R reproduces by hand from the P and T beside it.
    const withScore = rows.map((row) => ({ ...row, score: rank(row.points, row.ageHours, gravity) }));
    withScore.sort((a, b) => b.score - a.score);
    return withScore.map((row, i) => ({ ...row, rank: i + 1, delta: row.liveRank - (i + 1) }));
  }, [rows, gravity]);

  const figurePoints = useMemo(
    () =>
      scored.map((row) => ({
        id: row.id,
        rank: row.rank,
        points: row.points,
        ageHours: row.ageHours,
        commentCount: row.commentCount,
        onThisPage: true,
      })),
    [scored],
  );

  return (
    <div className="page-grid mt-4">
      <div className="min-w-0">
        <p className="max-w-[68ch] type-reading text-ink-2">
          Score{" "}
          <span className="font-mono text-[14px]">
            R = (P − 1) / (T + 2)
            <sup>G</sup>
          </span>
          , where P is points and T is hours since posting. Gravity is the one tuning knob; try it here.
          Changes stay in this view and do not touch the live front page.
        </p>

        <GravitySlider gravity={gravity} live={live} onChange={setGravity} />

        <table className="mt-5 w-full border-collapse text-[13px] rule-open">
          <thead>
            <tr className="bg-head type-label text-ink-2">
              <th scope="col" className="px-2 py-[6px] text-right">
                Rank
              </th>
              <th scope="col" className="px-2 py-[6px] text-right">
                vs live
              </th>
              <th scope="col" className="px-2 py-[6px] text-left">
                Story
              </th>
              <th scope="col" className="px-2 py-[6px] text-right">
                P
              </th>
              <th scope="col" className="px-2 py-[6px] text-right">
                T, h
              </th>
              <th scope="col" className="px-2 py-[6px] text-right whitespace-nowrap">
                (T + 2)<sup>G</sup>
              </th>
              <th scope="col" className="px-2 py-[6px] text-right">
                R
              </th>
            </tr>
          </thead>
          <tbody>
            {scored.map((row, i) => (
              <tr key={row.id} className={i === scored.length - 1 ? "rule-close" : "rule-divide"}>
                <td className="px-2 py-[7px] text-right font-semibold tabular-nums">{row.rank}</td>
                <td className="px-2 py-[7px] text-right tabular-nums">
                  <Delta value={row.delta} />
                </td>
                <td className="px-2 py-[7px]">{row.title}</td>
                <td className="px-2 py-[7px] text-right tabular-nums">{formatCount(row.points)}</td>
                <td className="px-2 py-[7px] text-right tabular-nums">{row.ageHours.toFixed(1)}</td>
                <td className="px-2 py-[7px] text-right tabular-nums">
                  {Math.pow(row.ageHours + 2, gravity).toFixed(1)}
                </td>
                <td className="px-2 py-[7px] text-right tabular-nums">{row.score.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <aside className="page-aside">
        <h2 className="type-section">
          <span className="pr-2 font-medium text-meta">Figure 1</span>
          Score against age{gravity !== live ? `, G = ${gravity.toFixed(1)}` : ""}
        </h2>
        <div className="mt-2">
          <DecayFigureLive points={figurePoints} gravity={gravity} />
        </div>
        <p className="mt-3 max-w-[70ch] text-[12px] leading-[1.5] text-meta">
          Each line joins stories of equal rank score, labelled with R. A story outranks every story below
          its line. Showing the top {rows.length} of {formatCount(total)} candidates.
        </p>
      </aside>
    </div>
  );
}

/**
 * Rank movement against the live ordering. Amber for a fall, petrol for a rise — the design
 * reserves amber for exactly this kind of downward delta.
 */
function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="text-meta">—</span>;
  if (value > 0) return <span className="font-semibold text-petrol-ink">+{value}</span>;
  return <span className="font-semibold text-amber">−{Math.abs(value)}</span>;
}
