import { CFG, HOUR } from "./config";

/**
 * The ranking function. One constant, one module, because it is the editorial voice.
 *
 *   score = (points - 1) / (ageHours + 2) ^ GRAVITY
 *
 * The -1 discounts the author's own implicit vote; the +2 stops a brand-new post dividing by
 * something near zero. Neither is arbitrary and neither should be "simplified" away.
 *
 * The expression is not indexable, which is the whole problem the architecture solves by bounding
 * candidates to a 7-day window — see ARCHITECTURE §6.1.
 */
export function rank(points: number, ageHours: number, gravity: number = CFG.gravity): number {
  return (points - 1) / Math.pow(ageHours + 2, gravity);
}

export function ageHoursBetween(createdAt: Date, at: Date = new Date()): number {
  return (at.getTime() - createdAt.getTime()) / HOUR;
}

/** True while a post is still a front-page candidate. */
export function isCandidate(createdAt: Date, at: Date = new Date()): boolean {
  const age = ageHoursBetween(createdAt, at);
  return age >= 0 && age < CFG.windowDays * 24;
}
