import { CFG } from "./config";

/**
 * Geometry for Figure 1, the decay characteristic.
 *
 * The axes are `log(age + 2)` against `log(points)` — not `log(age)`. That `+ 2` is the same one in
 * the ranking function, and choosing it here is what makes the figure teach anything: in these axes
 * an iso-rank line `P - 1 = R(T + 2)^G` is straight, with **slope proportional to G**. Tuning
 * gravity visibly tilts the whole fan, which is the point.
 *
 * The x ticks are spaced so `age + 2` doubles each step, so one tick right always means "twice as
 * old". Tidying them to round numbers would destroy that.
 */
export const VIEWBOX = { width: 344, height: 296 } as const;
const MARGIN = { left: 34, right: 34, top: 10, bottom: 32 } as const;

const PLOT = {
  left: MARGIN.left,
  right: VIEWBOX.width - MARGIN.right,
  top: MARGIN.top,
  bottom: VIEWBOX.height - MARGIN.bottom,
} as const;

/** The x axis spans age 0 to 96 hours, i.e. `age + 2` from 2 to 98. */
const AGE_MIN_SHIFTED = 2;
const AGE_MAX_SHIFTED = 98;
/** The y axis spans 1 to 1000 points — three decades. */
const POINT_DECADES = 3;

export const X_TICKS = [0, 1, 4, 10, 22, 46, 96] as const;
export const Y_TICKS = [1, 3, 10, 30, 100, 300, 1000] as const;
export const ISO_LINES = [0.1, 0.3, 1, 3, 10, 30] as const;

const LOG_MIN = Math.log10(AGE_MIN_SHIFTED);
const LOG_SPAN = Math.log10(AGE_MAX_SHIFTED) - LOG_MIN;

/**
 * SVG coordinates rounded to one decimal.
 *
 * Sub-pixel precision is invisible, bloats the markup, and — because the server renders a number to
 * a string while the client sets it from a float — a 14th-digit difference between the two is a
 * hydration mismatch. Rounding removes the whole class of problem.
 */
export const px = (n: number): number => Math.round(n * 10) / 10;

export function xOf(ageHours: number): number {
  const t = (Math.log10(ageHours + 2) - LOG_MIN) / LOG_SPAN;
  return px(PLOT.left + t * (PLOT.right - PLOT.left));
}

export function yOf(points: number): number {
  const t = Math.log10(Math.max(1, points)) / POINT_DECADES;
  return px(PLOT.bottom - t * (PLOT.bottom - PLOT.top));
}

/** The age at which a line of rank `r` reaches `points`, used to place the line's label. */
export function ageAtPoints(r: number, points: number, gravity: number): number {
  return Math.pow((points - 1) / r, 1 / gravity) - 2;
}

export function pointsAtAge(r: number, ageHours: number, gravity: number): number {
  return 1 + r * Math.pow(ageHours + 2, gravity);
}

/**
 * An iso-rank line: every story on it has the same score, so a story outranks everything below its
 * line. Sampled rather than drawn as a straight line because the `- 1` in the ranking function
 * bends it near the bottom-left, and that bend is honest.
 */
export function isoPath(r: number, gravity: number, samples = 48): string {
  let path = "";
  for (let i = 0; i <= samples; i++) {
    const shifted = Math.pow(10, LOG_MIN + LOG_SPAN * (i / samples));
    const age = shifted - 2;
    const points = pointsAtAge(r, age, gravity);

    // Off the top of the chart: stop if the line has already started, skip if it has not.
    if (points > Y_TICKS[Y_TICKS.length - 1]) {
      if (path) break;
      continue;
    }
    path += `${path ? "L" : "M"}${xOf(age)} ${yOf(points)}`;
  }
  return path;
}

/** Where an iso-line's label goes: along the right edge, or along the top once it exits there. */
export function isoLabel(r: number, gravity: number): { x: number; y: number; onTop: boolean } {
  const atRightEdge = pointsAtAge(r, 94, gravity);
  const ceiling = Y_TICKS[Y_TICKS.length - 1];

  if (atRightEdge > ceiling) {
    return { x: xOf(ageAtPoints(r, ceiling - 1, gravity)), y: PLOT.top - 2, onTop: true };
  }
  return { x: PLOT.right + 4, y: px(yOf(atRightEdge) + 3), onTop: false };
}

/**
 * The age as the reader sees it, and the score computed from that same value.
 *
 * Fixture ages drift as the process runs, so a true age is 5.238 h while the readout says "5.2 h".
 * Computing the displayed score from the true age makes the printed arithmetic fail to evaluate to
 * the printed result — `(412 - 1) / (5.2 + 2)^1.8` gives 11.77, not the 11.66 the true age yields.
 * For a figure whose whole claim is that the ranking is checkable rather than a black box, that is
 * worse than a rounding error. So every displayed figure derives from the displayed age.
 *
 * Ordering still uses the true score; only what is printed is derived this way.
 */
export const shownAge = (ageHours: number): number => Math.round(ageHours * 10) / 10;

/** Dot size carries comment count — four steps, because more would not be readable at 5 px. */
export function dotRadius(commentCount: number): number {
  if (commentCount === 0) return 2.4;
  if (commentCount <= 5) return 3.2;
  if (commentCount <= 20) return 4.2;
  return 5.4;
}

export const AXES = PLOT;

/** The gravity range the slider offers, around the live value. */
export const GRAVITY_RANGE = { min: 0.6, max: 3, step: 0.1, live: CFG.gravity } as const;
