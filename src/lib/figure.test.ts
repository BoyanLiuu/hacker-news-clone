import { describe, expect, it } from "vitest";
import { CFG } from "./config";
import { X_TICKS, isoPath, pointsAtAge, xOf, yOf } from "./figure";
import { rank } from "./rank";

/** Slope of the straight part of an iso-line, in screen space. */
function screenSlope(r: number, gravity: number, fromAge = 10, toAge = 46): number {
  const x1 = xOf(fromAge);
  const x2 = xOf(toAge);
  const y1 = yOf(pointsAtAge(r, fromAge, gravity));
  const y2 = yOf(pointsAtAge(r, toAge, gravity));
  return (y2 - y1) / (x2 - x1);
}

describe("figure axes", () => {
  // Catches: axes built on log(age) instead of log(age + 2), or a linear axis. Either destroys the
  // one property the figure exists to teach — that gravity is the slope — while still looking
  // exactly like a chart.
  it("makes iso-line slope proportional to gravity", () => {
    const slopes = [1.2, 1.8, 2.4].map((g) => screenSlope(3, g));
    const ratios = slopes.map((s, i) => s / [1.2, 1.8, 2.4][i]);

    // Same constant of proportionality at every gravity.
    expect(ratios[0]).toBeCloseTo(ratios[1], 2);
    expect(ratios[1]).toBeCloseTo(ratios[2], 2);
    // Steeper decay reads as a steeper line (y grows downward, so slopes are negative).
    expect(slopes[2]).toBeLessThan(slopes[1]);
    expect(slopes[1]).toBeLessThan(slopes[0]);
  });

  // Catches: an iso-line that is straight only by accident. Across three decades the sampled
  // segments must share one slope, or the "outranks everything below its line" claim is false.
  it("keeps an iso-line straight in these axes", () => {
    const g = CFG.gravity;
    const segments = [
      screenSlope(3, g, 4, 10),
      screenSlope(3, g, 10, 22),
      screenSlope(3, g, 22, 46),
    ];
    for (const s of segments) expect(s).toBeCloseTo(segments[0], 1);
  });

  // Catches: ticks "tidied" to round numbers like 0,10,20,...,  which breaks the even spacing and
  // makes "one tick right" mean nothing in particular.
  it("spaces x ticks so age + 2 doubles each step", () => {
    // 0,1,4,10,22,46,96 shifts to 2,3,6,12,24,48,98. The first step is 1.5x and the last 2.04x,
    // because the axis has to start at 0 hours and end near four days; every step between is 2x.
    const shifted = X_TICKS.map((t) => t + 2);
    expect(shifted).toEqual([2, 3, 6, 12, 24, 48, 98]);

    for (let i = 2; i <= 5; i++) {
      expect(shifted[i] / shifted[i - 1]).toBe(2);
    }

    // So those steps are evenly spaced on screen: one tick right is always twice as old.
    // Within 0.2 px rather than exactly, because coordinates are rounded to a tenth — uneven ticks
    // would differ by tens of pixels, so this still catches the failure it is here for.
    const gaps = [1, 2, 3, 4].map((i) => xOf(X_TICKS[i + 1]) - xOf(X_TICKS[i]));
    for (const gap of gaps) expect(Math.abs(gap - gaps[0])).toBeLessThan(0.2);
  });

  it("maps the axis ends to the plot edges", () => {
    expect(xOf(0)).toBeCloseTo(34, 1);
    expect(xOf(96)).toBeCloseTo(310, 1);
    expect(yOf(1)).toBeCloseTo(264, 1);
    expect(yOf(1000)).toBeCloseTo(10, 1);
  });

  it("clamps points below one rather than running off the chart", () => {
    expect(yOf(0)).toBe(yOf(1));
    expect(yOf(-5)).toBe(yOf(1));
  });
});

describe("iso lines", () => {
  // Catches: the figure and the ranking function drifting apart, so the chart draws a model the
  // site does not use. Every point on a line of rank r must score r.
  it("agrees with rank() at every sampled age", () => {
    const g = CFG.gravity;
    for (const r of [0.3, 1, 3, 10]) {
      for (const age of [0, 1, 4, 10, 22, 46, 96]) {
        const points = pointsAtAge(r, age, g);
        expect(rank(points, age, g)).toBeCloseTo(r, 8);
      }
    }
  });

  it("emits a path that starts with a move and stays inside the viewBox", () => {
    const path = isoPath(3, CFG.gravity);
    expect(path.startsWith("M")).toBe(true);
    const coords = [...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)];
    expect(coords.length).toBeGreaterThan(10);
    for (const [, x, y] of coords) {
      expect(Number(x)).toBeGreaterThanOrEqual(33);
      expect(Number(x)).toBeLessThanOrEqual(311);
      expect(Number(y)).toBeGreaterThanOrEqual(9);
      expect(Number(y)).toBeLessThanOrEqual(265);
    }
  });

  // Catches: a high-rank line drawn as a flat stub because every sample exceeded the ceiling.
  it("skips samples above the ceiling without emitting an empty path", () => {
    expect(isoPath(30, CFG.gravity)).not.toBe("");
    expect(isoPath(0.1, CFG.gravity)).not.toBe("");
  });
});
