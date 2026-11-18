"use client";

/**
 * The gravity knob. Its own file, and that is the point: `rank-debug` imports this statically but
 * loads the figure with `next/dynamic`, and a shared module would have pulled Motion back into the
 * static chunk the split exists to keep clear of it.
 *
 * No motion of its own — the slider moves, the figure responds.
 */
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
